export const API_URL =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}
export interface SpotifyUser {
  display_name: string;
  images: ReadonlyArray<{ url: string }>;
  product?: string;
}
export class AuthService {
  private session: Session | null = null;
  private refreshing: Promise<string> | null = null;
  constructor(
    private clientId = (import.meta.env?.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '',
  ) {}
  get connected(): boolean {
    return this.session !== null;
  }
  async configure(): Promise<void> {
    if (!this.clientId) {
      const response = await fetch(API_URL + '/api/config');
      if (!response.ok) throw new Error('Spotify configuration is unavailable.');
      const data = (await response.json()) as { spotifyClientId: string };
      this.clientId = data.spotifyClientId;
    }
    if (!/^[a-f0-9]{32}$/.test(this.clientId))
      throw new Error('The Spotify Client ID is not configured.');
  }
  async login(): Promise<void> {
    await this.configure();
    const bytes = crypto.getRandomValues(new Uint8Array(64));
    let verifier = '';
    for (const byte of bytes)
      verifier += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[byte % 62];
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    let binary = '';
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    const challenge = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const state = crypto.randomUUID();
    const redirectUri = location.origin + '/callback';
    sessionStorage.setItem(
      'lunara-pkce',
      JSON.stringify({ verifier, state, redirectUri, createdAt: Date.now() }),
    );
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope:
        'streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state',
    });
    location.assign('https://accounts.spotify.com/authorize?' + params);
  }
  async finishLogin(): Promise<boolean> {
    if (location.pathname !== '/callback') return false;
    const query = new URLSearchParams(location.search);
    const raw = sessionStorage.getItem('lunara-pkce');
    sessionStorage.removeItem('lunara-pkce');
    history.replaceState(null, '', '/');
    if (query.get('error'))
      throw new Error('Spotify authorization was cancelled. You can connect again.');
    if (!raw || !query.get('code'))
      throw new Error('Your sign-in attempt expired. Please connect again.');
    const pending = JSON.parse(raw) as {
      verifier: string;
      state: string;
      redirectUri: string;
      createdAt: number;
    };
    if (query.get('state') !== pending.state || Date.now() - pending.createdAt > 600000)
      throw new Error('This sign-in attempt is invalid or expired. Please connect again.');
    await this.configure();
    await this.exchange(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: query.get('code')!,
        redirect_uri: pending.redirectUri,
        client_id: this.clientId,
        code_verifier: pending.verifier,
      }),
    );
    return true;
  }
  private async exchange(body: URLSearchParams): Promise<string> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      this.logout();
      throw new Error('Spotify could not renew your session. Please connect again.');
    }
    const token = (await response.json()) as TokenResponse;
    this.session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? this.session?.refreshToken ?? '',
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    return this.session.accessToken;
  }
  async getToken(force = false): Promise<string> {
    if (!this.session) throw new Error('Connect your Spotify account first.');
    if (!force && Date.now() < this.session.expiresAt - 60000) return this.session.accessToken;
    return (this.refreshing ??= this.exchange(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.session.refreshToken,
        client_id: this.clientId,
      }),
    ).finally(() => {
      this.refreshing = null;
    }));
  }
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const send = async (force: boolean): Promise<Response> => {
      const token = await this.getToken(force);
      try {
        return await fetch(API_URL + path, {
          ...init,
          headers: { ...init.headers, Authorization: 'Bearer ' + token },
          signal: init.signal ?? AbortSignal.timeout(15000),
        });
      } catch {
        if (init.signal?.aborted) throw init.signal.reason;
        throw new Error('Cannot reach the music service. Check your connection and try again.');
      }
    };
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(data?.message ?? 'Spotify is unavailable. Please try again.');
    }
    return response;
  }
  logout(): void {
    this.session = null;
    sessionStorage.removeItem('lunara-pkce');
  }
}
