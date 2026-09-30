import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../server/app.js';
async function withServer(fetcher: typeof fetch, action: (base: string) => Promise<void>) {
  const server = createServer(
    createHandler({ origin: 'https://lunara.example', clientId: 'public-test-id', fetcher }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await action(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
test('API health, CORS rejection, missing token and preflight', async () => {
  await withServer(
    async () => {
      throw new Error('Unexpected Spotify call');
    },
    async (base) => {
      assert.equal((await fetch(base + '/api/health')).status, 200);
      assert.equal((await fetch(base + '/api/search?q=music')).status, 401);
      assert.equal(
        (await fetch(base + '/api/health', { headers: { Origin: 'https://other.example' } }))
          .status,
        403,
      );
      assert.equal(
        (
          await fetch(base + '/api/search', {
            method: 'OPTIONS',
            headers: { Origin: 'https://lunara.example' },
          })
        ).status,
        204,
      );
    },
  );
});
test('API uses real Spotify search endpoint with bounded limit', async () => {
  let called = '';
  await withServer(
    async (input) => {
      called = String(input);
      return Response.json({ tracks: { items: [] } });
    },
    async (base) => {
      const response = await fetch(base + '/api/search?q=arbitrary%20artist', {
        headers: { Authorization: 'Bearer test' },
      });
      assert.equal(response.status, 200);
      const url = new URL(called);
      assert.equal(url.hostname, 'api.spotify.com');
      assert.equal(url.searchParams.get('q'), 'arbitrary artist');
      assert.equal(url.searchParams.get('limit'), '10');
      assert.equal(
        (await fetch(base + '/api/search?q=', { headers: { Authorization: 'Bearer test' } }))
          .status,
        400,
      );
    },
  );
});
test('play validates URI and routes to the selected Spotify device', async () => {
  let called = '';
  let sent = '';
  await withServer(
    async (input, init) => {
      called = String(input);
      sent = String(init?.body);
      return new Response(null, { status: 204 });
    },
    async (base) => {
      const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
      assert.equal(
        (
          await fetch(base + '/api/play', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ uri: 'invalid', deviceId: 'device' }),
          })
        ).status,
        400,
      );
      const uri = 'spotify:track:1234567890123456789012';
      assert.equal(
        (
          await fetch(base + '/api/play', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ uri, deviceId: 'device' }),
          })
        ).status,
        204,
      );
      assert.equal(new URL(called).searchParams.get('device_id'), 'device');
      assert.deepEqual(JSON.parse(sent), { uris: [uri] });
    },
  );
});
test('rate limit response is sanitized and forwards retry information', async () => {
  await withServer(
    async () =>
      new Response('sensitive upstream details', { status: 429, headers: { 'Retry-After': '30' } }),
    async (base) => {
      const response = await fetch(base + '/api/me', { headers: { Authorization: 'Bearer test' } });
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('Retry-After'), '30');
      assert.ok(!(await response.text()).includes('sensitive'));
    },
  );
});
test('first playback disables inherited Spotify-native repeat and shuffle', async () => {
  const requests: string[] = [];
  await withServer(
    async (input) => {
      requests.push(String(input));
      return new Response(null, { status: 204 });
    },
    async (base) => {
      const response = await fetch(base + '/api/play', {
        method: 'PUT',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: 'spotify:track:1234567890123456789012',
          deviceId: 'device',
          resetModes: true,
        }),
      });
      assert.equal(response.status, 204);
      assert.equal(requests.length, 4);
      assert.equal(new URL(requests[0]).pathname, '/v1/me/player');
      assert.equal(new URL(requests[1]).searchParams.get('state'), 'off');
      assert.equal(new URL(requests[2]).searchParams.get('state'), 'false');
      assert.equal(new URL(requests[3]).pathname, '/v1/me/player/play');
    },
  );
});
