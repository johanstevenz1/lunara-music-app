import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/auth.js';
test('PKCE challenge, callback state, token refresh and logout', async () => {
  const values = new Map<string, string>();
  let target = '';
  let cleanPath = '';
  let refreshes = 0;
  const originalFetch = globalThis.fetch;
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalHistory = Object.getOwnPropertyDescriptor(globalThis, 'history');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  const location = {
    origin: 'https://lunara.example',
    pathname: '/',
    search: '',
    assign: (url: string) => {
      target = url;
    },
  };
  Object.defineProperty(globalThis, 'location', { configurable: true, value: location });
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    value: {
      replaceState: (_data: unknown, _unused: string, path: string) => {
        cleanPath = path;
      },
    },
  });
  globalThis.fetch = async (_input, init) => {
    const params = init?.body as URLSearchParams;
    if (params.get('grant_type') === 'refresh_token') refreshes++;
    return Response.json({
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expires_in: 3600,
    });
  };
  try {
    const auth = new AuthService('a'.repeat(32));
    await auth.login();
    const url = new URL(target);
    assert.equal(url.hostname, 'accounts.spotify.com');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    const pending = JSON.parse(values.get('lunara-pkce')!) as { verifier: string; state: string };
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(pending.verifier),
    );
    assert.equal(Buffer.from(digest).toString('base64url'), url.searchParams.get('code_challenge'));
    location.pathname = '/callback';
    location.search = '?code=test-code&state=' + pending.state;
    assert.equal(await auth.finishLogin(), true);
    assert.equal(cleanPath, '/');
    assert.ok(auth.connected);
    assert.equal(await auth.getToken(), 'test-access');
    await Promise.all([auth.getToken(true), auth.getToken(true)]);
    assert.equal(refreshes, 1);
    assert.ok(!values.has('lunara-pkce'));
    assert.equal(values.size, 0);
    auth.logout();
    assert.equal(auth.connected, false);
    await assert.rejects(() => auth.getToken());
    await auth.login();
    location.search = '?code=test-code&state=wrong';
    await assert.rejects(() => auth.finishLogin(), /invalid/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of [
      ['location', originalLocation],
      ['history', originalHistory],
      ['sessionStorage', originalStorage],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
