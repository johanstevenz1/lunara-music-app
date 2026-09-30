import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ServerConfig {
  origin: string;
  clientId: string;
  fetcher?: typeof fetch;
}
export function createHandler(config: ServerConfig) {
  const fetcher = config.fetcher ?? fetch;
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.headers.origin && request.headers.origin !== config.origin) {
      response.writeHead(403);
      response.end(JSON.stringify({ message: 'Origin is not allowed.' }));
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', config.origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://internal');
    if (url.pathname === '/api/health') {
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (url.pathname === '/api/config') {
      response.end(JSON.stringify({ spotifyClientId: config.clientId }));
      return;
    }
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 4096) {
      response.writeHead(401);
      response.end(JSON.stringify({ message: 'Connect Spotify to continue.' }));
      return;
    }
    let endpoint: string;
    let body: string | undefined;
    let resetModesDevice: string | null = null;
    if (request.method === 'GET' && url.pathname === '/api/me') endpoint = '/me';
    else if (request.method === 'GET' && url.pathname === '/api/search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query || query.length > 200) {
        response.writeHead(400);
        response.end(JSON.stringify({ message: 'Enter a search of up to 200 characters.' }));
        return;
      }
      endpoint = '/search?' + new URLSearchParams({ q: query, type: 'track', limit: '10' });
    } else if (request.method === 'PUT' && url.pathname === '/api/play') {
      let raw = '';
      for await (const chunk of request) {
        raw += String(chunk);
        if (raw.length > 8192) {
          response.writeHead(413);
          response.end(JSON.stringify({ message: 'Request is too large.' }));
          return;
        }
      }
      let data: { uri?: unknown; deviceId?: unknown; resetModes?: unknown };
      try {
        data = JSON.parse(raw);
      } catch {
        response.writeHead(400);
        response.end(JSON.stringify({ message: 'Invalid playback request.' }));
        return;
      }
      if (
        !data ||
        typeof data.uri !== 'string' ||
        !/^spotify:track:[a-zA-Z0-9]{22}$/.test(data.uri) ||
        typeof data.deviceId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(data.deviceId)
      ) {
        response.writeHead(400);
        response.end(JSON.stringify({ message: 'Choose a valid track and ready device.' }));
        return;
      }
      endpoint = '/me/player/play?device_id=' + encodeURIComponent(data.deviceId);
      if (data.resetModes === true) resetModesDevice = data.deviceId;
      // Spotify's wire protocol requires an array of URIs, not our domain list.
      body = JSON.stringify({ uris: [data.uri] });
    } else {
      response.writeHead(404);
      response.end(JSON.stringify({ message: 'Endpoint not found.' }));
      return;
    }
    try {
      // The application owns shuffle/repeat via its linked nodes. Prevent an
      // inherited Spotify-native repeat mode from looping the single URI forever.
      if (resetModesDevice) {
        const options = {
          method: 'PUT',
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(12000),
        };
        const deviceQuery = '&device_id=' + encodeURIComponent(resetModesDevice);
        const transferResponse = await fetcher('https://api.spotify.com/v1/me/player', {
          ...options,
          headers: { ...options.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [resetModesDevice], play: false }),
        });
        if (!transferResponse.ok) {
          response.writeHead(transferResponse.status);
          response.end(
            JSON.stringify({
              message:
                'Cannot select the Lunara Spotify device. Reconnect the player and try again.',
            }),
          );
          return;
        }
        const repeatResponse = await fetcher(
          'https://api.spotify.com/v1/me/player/repeat?state=off' + deviceQuery,
          options,
        );
        if (!repeatResponse.ok) {
          response.writeHead(repeatResponse.status);
          response.end(
            JSON.stringify({
              message:
                'Cannot prepare the Spotify device. Reconnect the player and check your account access.',
            }),
          );
          return;
        }
        const shuffleResponse = await fetcher(
          'https://api.spotify.com/v1/me/player/shuffle?state=false' + deviceQuery,
          options,
        );
        if (!shuffleResponse.ok) {
          response.writeHead(shuffleResponse.status);
          response.end(
            JSON.stringify({
              message:
                'Cannot prepare the Spotify device. Reconnect the player and check your account access.',
            }),
          );
          return;
        }
      }
      const upstream = await fetcher('https://api.spotify.com/v1' + endpoint, {
        method: request.method,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(12000),
      });
      if (upstream.status === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      if (!upstream.ok) {
        const message =
          upstream.status === 401
            ? 'Your session expired. Connect Spotify again.'
            : upstream.status === 403
              ? 'Spotify denied access. Check Premium and the app user allowlist.'
              : upstream.status === 404
                ? 'The player is offline or this track is unavailable.'
                : upstream.status === 429
                  ? 'Spotify is busy. Please wait before trying again.'
                  : 'Spotify could not complete this request.';
        const retry = upstream.headers.get('Retry-After');
        if (retry) {
          response.setHeader('Retry-After', retry);
          response.setHeader('Access-Control-Expose-Headers', 'Retry-After');
        }
        response.writeHead(upstream.status);
        response.end(JSON.stringify({ message }));
        return;
      }
      response.writeHead(200);
      response.end(await upstream.text());
    } catch {
      response.writeHead(502);
      response.end(
        JSON.stringify({ message: 'Cannot reach Spotify. Check your connection and try again.' }),
      );
    }
  };
}
