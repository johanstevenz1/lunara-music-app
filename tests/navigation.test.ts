import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Library, restore, snapshot, type Track } from '../src/core/library.js';
import { Navigation } from '../src/core/navigation.js';
const track = (title: string): Track => ({
  source: 'spotify',
  title,
  artist: 'Test',
  album: 'Test',
  cover: '',
  durationMs: 10000,
  uri: 'spotify:track:' + title,
});
function setup() {
  const library = new Library();
  library.tracks.append(track('A'));
  library.tracks.append(track('B'));
  library.tracks.append(track('C'));
  return { library, navigation: new Navigation(library, () => 0) };
}
test('normal navigation, automatic end and repeat modes', () => {
  const { library, navigation } = setup();
  library.current = library.tracks.head;
  assert.equal(navigation.next(), library.current!.next);
  library.current = navigation.next();
  assert.equal(navigation.previous(), library.current!.previous);
  library.current = library.tracks.tail;
  assert.equal(navigation.next(true), null);
  navigation.repeat = 'playlist';
  assert.equal(navigation.next(true), library.tracks.head);
  navigation.repeat = 'current';
  assert.equal(navigation.next(true), library.current);
});
test('shuffle visits all nodes once, retains original links and previous history', () => {
  const { library, navigation } = setup();
  library.current = library.tracks.head;
  const original = library.tracks.toArray();
  navigation.setShuffle(true);
  const b = navigation.next();
  library.current = b;
  const c = navigation.next();
  assert.notEqual(c, b);
  library.current = c;
  assert.equal(navigation.next(), null);
  assert.equal(navigation.previous(), b);
  library.current = b;
  assert.equal(navigation.next(), c);
  assert.deepEqual(library.tracks.toArray(), original);
  navigation.repeat = 'playlist';
  library.current = c;
  assert.notEqual(navigation.next(), c);
  navigation.setShuffle(false);
  assert.equal(navigation.previous(), c!.previous);
});
test('empty, one song, remove current and snapshot round trip', () => {
  const library = new Library();
  const navigation = new Navigation(library);
  assert.equal(navigation.next(), null);
  const node = library.tracks.append(track('A'));
  library.current = node;
  assert.equal(navigation.next(), null);
  navigation.repeat = 'playlist';
  assert.equal(navigation.next(), node);
  const copy = restore(structuredClone(snapshot(library)));
  assert.equal(copy.tracks.head!.value.title, 'A');
  assert.equal(copy.active.id, library.active.id);
  library.removeTrack(node.id);
  assert.equal(library.current, null);
  assert.equal(navigation.next(), null);
});
