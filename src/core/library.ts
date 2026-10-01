import { DoublyLinkedList, type ListNode } from './list.js';

export interface Track {
  source: 'spotify' | 'local';
  title: string;
  artist: string;
  album: string;
  cover: string;
  durationMs: number;
  uri?: string;
  externalUrl?: string;
  blobId?: string;
}
export interface Playlist {
  name: string;
  tracks: DoublyLinkedList<Track>;
}
export class Library {
  readonly playlists = new DoublyLinkedList<Playlist>();
  active: ListNode<Playlist>;
  get current(): ListNode<Track> | null {
    return this.tracks.current;
  }
  set current(node: ListNode<Track> | null) {
    this.tracks.current = node;
  }
  constructor() {
    this.active = this.playlists.append({ name: 'My playlist', tracks: new DoublyLinkedList() });
  }
  get tracks(): DoublyLinkedList<Track> {
    return this.active.value.tracks;
  }
  /** Track identity belongs to its source, not to a newly generated node ID. */
  findTrack(track: Track): ListNode<Track> | null {
    const identity = track.source === 'spotify' ? track.uri : track.blobId;
    if (!identity) return null;
    for (const node of this.tracks) {
      if (node.value.source !== track.source) continue;
      const candidate = track.source === 'spotify' ? node.value.uri : node.value.blobId;
      if (candidate === identity) return node;
    }
    return null;
  }
  selectPlaylist(id: string): void {
    const playlist = this.playlists.find(id);
    if (!playlist) throw new Error('Playlist not found.');
    this.tracks.current = null;
    this.active = playlist;
    this.current = null;
  }
  selectTrack(id: string): ListNode<Track> {
    const node = this.tracks.find(id);
    if (!node) throw new Error('Track not found.');
    this.current = node;
    return node;
  }
  next(): ListNode<Track> | null {
    this.current = this.current ? this.current.next : this.tracks.head;
    return this.current;
  }
  previous(): ListNode<Track> | null {
    this.current = this.current ? this.current.previous : this.tracks.tail;
    return this.current;
  }
  removeTrack(id: string): void {
    if (this.current?.id === id) this.current = this.current.next ?? this.current.previous;
    this.tracks.remove(id);
  }
}

interface StoredTrack {
  id: string;
  value: Track;
  next: StoredTrack | null;
}
interface StoredPlaylist {
  id: string;
  name: string;
  head: StoredTrack | null;
  next: StoredPlaylist | null;
}
interface Snapshot {
  version: 1;
  activeId: string;
  head: StoredPlaylist | null;
}

/** Plain linked records for IndexedDB; never serialize cyclic live pointers. */
export function snapshot(library: Library): Snapshot {
  const saved: Snapshot = { version: 1, activeId: library.active.id, head: null };
  let lastPlaylist: StoredPlaylist | null = null;
  for (const playlist of library.playlists) {
    const entry: StoredPlaylist = {
      id: playlist.id,
      name: playlist.value.name,
      head: null,
      next: null,
    };
    let lastTrack: StoredTrack | null = null;
    for (const track of playlist.value.tracks) {
      const item: StoredTrack = { id: track.id, value: track.value, next: null };
      if (lastTrack) lastTrack.next = item;
      else entry.head = item;
      lastTrack = item;
    }
    if (lastPlaylist) lastPlaylist.next = entry;
    else saved.head = entry;
    lastPlaylist = entry;
  }
  return saved;
}
export function restore(saved: Snapshot): Library {
  if (saved.version !== 1) throw new Error('Unsupported library version.');
  const library = new Library();
  library.playlists.remove(library.active.id);
  let playlist = saved.head;
  while (playlist) {
    const tracks = new DoublyLinkedList<Track>();
    let track = playlist.head;
    while (track) {
      tracks.append(track.value, track.id);
      track = track.next;
    }
    library.playlists.append({ name: playlist.name, tracks }, playlist.id);
    playlist = playlist.next;
  }
  if (!library.playlists.head)
    library.playlists.append({ name: 'My playlist', tracks: new DoublyLinkedList() });
  library.active = library.playlists.find(saved.activeId) ?? library.playlists.head!;
  return library;
}
