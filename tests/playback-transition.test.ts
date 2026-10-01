import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer, type PlaybackState } from '../src/services/player.js';
import { AuthService } from '../src/services/auth.js';
import type { Track } from '../src/core/library.js';

test('unsupported protected audio leaves search connected without claiming a ready player', async () => {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const name of ['window', 'Audio', 'navigator'])
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setInterval: () => 0 },
  });
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    value: class {
      addEventListener() {}
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Chrome/130',
      requestMediaKeySystemAccess: async () => {
        throw new Error('Protected media unavailable');
      },
    },
  });
  try {
    const auth = new AuthService('a'.repeat(32));
    Object.defineProperty(auth, 'connected', { value: true });
    const player = new MusicPlayer(auth);
    let ready = true;
    player.onReady = (value) => {
      ready = value;
    };
    await assert.rejects(player.connect(), /protected audio/);
    assert.equal(ready, false);
    assert.equal(auth.connected, true);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('Spotify transition waits for real playback and ignores delayed events and polls', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const events: Record<string, (data: never) => void> = {};
  let poll = () => {};
  let resolvePoll: ((value: ReturnType<typeof state>) => void) | null = null;
  let holdPoll = false;
  let activations = 0;
  let requests = 0;
  const received: PlaybackState[] = [];
  const state = (uri: string, paused = false, position = 0) => ({
    paused,
    position,
    duration: 10000,
    track_window: { current_track: { uri } },
  });
  class MockSDK {
    addListener(name: string, cb: (data: never) => void) {
      events[name] = cb;
      return true;
    }
    async connect() {
      events.ready({ device_id: 'device' } as never);
      return true;
    }
    disconnect() {}
    async pause() {}
    async resume() {}
    async seek() {}
    async setVolume() {}
    async activateElement() {
      activations++;
    }
    async getCurrentState() {
      if (holdPoll)
        return new Promise<ReturnType<typeof state>>((resolve) => {
          resolvePoll = resolve;
        });
      return null;
    }
  }
  class MockAudio {
    addEventListener() {}
    pause() {}
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      Spotify: { Player: MockSDK },
      setInterval: (cb: () => void) => {
        poll = cb;
        return 0;
      },
      setTimeout,
    },
  });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });
  const auth = new AuthService('a'.repeat(32));
  Object.defineProperty(auth, 'connected', { value: true });
  auth.request = async () => {
    requests++;
    return new Response(null, { status: 204 });
  };
  const song = (uri: string): Track => ({
    source: 'spotify',
    uri,
    title: uri,
    artist: 'Test',
    album: 'Test',
    cover: '',
    durationMs: 10000,
  });
  try {
    const player = new MusicPlayer(auth);
    player.onState = (value) => {
      received.push(value);
    };
    let ends = 0;
    player.onEnded = () => {
      ends++;
    };
    await player.connect();
    player.activate();
    const first = player.play(song('A'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests, 1);
    events.player_state_changed(state('A') as never);
    await first;
    holdPoll = true;
    poll(); // A request started before Next; return it after B is already playing.
    holdPoll = false;
    let started = false;
    const next = player.play(song('B')).then(() => {
      started = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    events.player_state_changed(state('A', false, 9500) as never);
    events.player_state_changed(state('A', true, 0) as never);
    events.player_state_changed(state('B', true, 0) as never);
    assert.equal(started, false); // HTTP 204 and paused state cannot invent audio.
    events.player_state_changed(state('B', false, 150) as never);
    await next;
    const beforeLatePoll = received.length;
    assert.ok(resolvePoll);
    (resolvePoll as (value: ReturnType<typeof state>) => void)(state('A', true, 0));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(received.length, beforeLatePoll);
    events.player_state_changed(state('A', true, 0) as never);
    assert.equal(received.at(-1)?.uri, 'B');
    assert.equal(received.at(-1)?.paused, false);
    assert.equal(ends, 0);
    assert.equal(activations, 1);
    events.player_state_changed(state('B', false, 9500) as never);
    await player.pause();
    events.player_state_changed(state('B', true, 0) as never);
    assert.equal(ends, 0); // Pause near the end is not automatic completion.
    const failed = player.play(song('C'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    events.playback_error({ message: 'DRM unsupported' } as never);
    await assert.rejects(failed, /Chrome or Edge/);
    player.disconnect();
  } finally {
    for (const [key, descriptor] of [
      ['window', originalWindow],
      ['Audio', originalAudio],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
