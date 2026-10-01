import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Track } from '../src/core/library.js';

const track = (uri: string): Track => ({
  source: 'spotify',
  title: uri,
  artist: 'Regression fixture',
  album: 'Test',
  cover: '',
  durationMs: 10000,
  uri,
});

async function withStore(action: (store: import('../src/store.js').AppStore) => Promise<void>) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  class MockAudio {
    addEventListener() {}
    pause() {}
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setInterval: () => 0 },
  });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MockAudio });
  try {
    const { AppStore } = await import('../src/store.js');
    const store = new AppStore();
    store.save = () => {};
    store.player.activate = () => {};
    store.player.play = async (song) => {
      store.player.onState({ paused: false, position: 100, duration: 10000, uri: song.uri! });
    };
    await action(store);
  } finally {
    for (const [key, descriptor] of [
      ['window', originalWindow],
      ['Audio', originalAudio],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('repeated add and playing a search result reuse exactly one linked node', async () => {
  await withStore(async (store) => {
    const song = track('spotify:track:1111111111111111111111');
    const original = store.add(song);
    assert.equal(store.add({ ...song }), original);
    assert.equal(store.add({ ...song }), original);
    await store.playResult({ ...song });
    await store.playResult({ ...song });
    assert.equal(store.library.tracks.size, 1);
    assert.equal(store.library.current, original);
    assert.equal(store.library.tracks.head, store.library.tracks.tail);
    store.placement = 'position';
    store.position = 0;
    assert.equal(store.add(song), original); // Existing track needs no insertion position.
    store.busy = true;
    await store.playResult(track('spotify:track:2222222222222222222222'));
    assert.equal(store.library.tracks.size, 1);
  });
});

test('queueing an existing track relinks it after current without making a copy', async () => {
  await withStore(async (store) => {
    const a = store.add(track('A'))!;
    const b = store.add(track('B'))!;
    const c = store.add(track('C'))!;
    store.library.current = c;
    assert.equal(store.add(a.value, true), a);
    assert.equal(store.library.tracks.size, 3);
    assert.equal(store.library.tracks.head, b);
    assert.equal(c.next, a);
    assert.equal(a.previous, c);
    assert.equal(store.library.current, c);
    store.add(a.value, true);
    assert.equal(store.library.tracks.size, 3);
    assert.equal(c.next, a);
  });
});

test('next and previous keep the requested cursor when old SDK states arrive late', async () => {
  await withStore(async (store) => {
    const first = store.add(track('A'))!;
    const second = store.add(track('B'))!;
    let pauses = 0;
    store.player.pause = async () => {
      pauses++;
    };
    await store.playNode(first, true);
    await store.next();
    assert.equal(store.library.current, first.next);
    store.player.onState({ paused: true, position: 0, duration: 10000, uri: 'A' });
    store.player.onState({ paused: true, position: 0, duration: 10000, uri: 'unknown' });
    assert.equal(store.library.current, second);
    assert.equal(store.playback.uri, 'B');
    assert.equal(store.playback.paused, false);
    assert.equal(pauses, 0);
    await store.previous();
    assert.equal(store.library.current, second.previous);
    assert.equal(store.playback.uri, 'A');
    assert.equal(store.playback.position, 100); // Keep actual SDK position.
    store.busy = true;
    await store.previous();
    assert.equal(store.library.current, first);
  });
});

test('failed next restores the previous cursor and unlocks playback controls', async () => {
  await withStore(async (store) => {
    const first = store.add(track('A'))!;
    store.add(track('B'));
    await store.playNode(first, true);
    store.player.play = async () => {
      throw new Error('Unavailable track');
    };
    await store.next();
    assert.equal(store.library.current, first);
    assert.equal(store.playback.uri, 'A');
    assert.equal(store.busy, false);
    assert.match(store.error, /Unavailable/);
  });
});

test('legacy duplicate cleanup preserves the playing node and can restore original order', async () => {
  await withStore(async (store) => {
    const first = store.library.tracks.append(track('A'));
    const duplicate = store.library.tracks.append(track('A'));
    const b = store.library.tracks.append(track('B'));
    const last = store.library.tracks.append(track('A'));
    store.library.current = duplicate;
    assert.equal(store.duplicateCount, 2);
    store.removeDuplicates();
    assert.equal(store.library.tracks.size, 2);
    assert.equal(store.library.current, duplicate);
    assert.equal(duplicate.next, b);
    assert.equal(store.duplicateCount, 0);
    assert.equal(store.canUndoCleanup, true);
    store.undoCleanup();
    assert.equal(store.library.tracks.size, 4);
    assert.equal(store.library.tracks.head?.id, first.id);
    assert.equal(store.library.tracks.tail?.id, last.id);
    assert.equal(store.library.current, duplicate);
    assert.equal(duplicate.previous?.id, first.id);
    assert.equal(b.next?.id, last.id);
    assert.equal(store.canUndoCleanup, false);
  });
});
