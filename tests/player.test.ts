import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../src/services/player.js';
import { AuthService } from '../src/services/auth.js';
import { Library, type Track } from '../src/core/library.js';
import { Navigation } from '../src/core/navigation.js';
test('SDK playback uses the node URI, actual state, seek, volume and completion', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const events: Record<string, (data: never) => void> = {};
  let playedUri = '';
  let device = '';
  let ended = 0;
  let sought = -1;
  let volume = -1;
  let pauseCalls = 0;
  class MockSDK {
    addListener(event: string, callback: (data: never) => void) {
      events[event] = callback;
      return true;
    }
    async connect() {
      events.ready({ device_id: 'test-device' } as never);
      return true;
    }
    disconnect() {}
    async pause() {
      pauseCalls++;
    }
    async resume() {}
    async seek(position: number) {
      sought = position;
    }
    async setVolume(value: number) {
      volume = value;
    }
    async activateElement() {}
    async getCurrentState() {
      return null;
    }
  }
  class MockAudio {
    addEventListener() {}
    pause() {}
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { Spotify: { Player: MockSDK }, setInterval: () => 0 },
  });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });
  const auth = new AuthService('a'.repeat(32));
  Object.defineProperty(auth, 'connected', { value: true });
  auth.request = async (_path, init) => {
    const body = JSON.parse(String(init?.body)) as { uri: string; deviceId: string };
    playedUri = body.uri;
    device = body.deviceId;
    return new Response(null, { status: 204 });
  };
  try {
    const library = new Library();
    const navigation = new Navigation(library);
    const a: Track = {
      source: 'spotify',
      title: 'Test A',
      artist: 'Test',
      album: 'Test',
      cover: '',
      durationMs: 10000,
      uri: 'spotify:track:1234567890123456789012',
    };
    const b: Track = { ...a, title: 'Test B', uri: 'spotify:track:2234567890123456789012' };
    const first = library.tracks.append(a);
    const second = library.tracks.append(b);
    library.current = first;
    const player = new MusicPlayer(auth);
    await player.connect();
    player.onState = (state) => {
      assert.equal(state.uri, library.current?.value.uri);
    };
    player.onEnded = () => {
      ended++;
      library.current = navigation.next(true);
    };
    await player.play(first.value);
    assert.equal(playedUri, library.current.value.uri);
    assert.equal(device, 'test-device');
    events.player_state_changed({
      paused: false,
      position: 9000,
      duration: 10000,
      track_window: { current_track: { uri: a.uri } },
    } as never);
    events.player_state_changed({
      paused: true,
      position: 0,
      duration: 10000,
      track_window: { current_track: { uri: a.uri } },
    } as never);
    assert.equal(ended, 1);
    assert.equal(library.current, second);
    await player.play(second.value);
    assert.equal(playedUri, second.value.uri);
    await player.seek(4500);
    assert.equal(sought, 4500);
    await player.setVolume(0.25);
    assert.equal(volume, 0.25);
    await player.pause();
    assert.equal(pauseCalls, 1);
    events.player_state_changed({
      paused: true,
      position: 0,
      duration: 10000,
      track_window: { current_track: { uri: b.uri } },
    } as never);
    assert.equal(ended, 1); // Pausing or seeking cannot invent an end event.
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
