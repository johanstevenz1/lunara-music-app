import { DoublyLinkedList, type ListNode } from './list.js';
import type { Track, Library } from './library.js';
export type RepeatMode = 'off' | 'playlist' | 'current';
export class Navigation {
  shuffle = false;
  repeat: RepeatMode = 'off';
  private history = new DoublyLinkedList<ListNode<Track>>();
  constructor(
    private library: Library,
    private random = Math.random,
  ) {}
  reset(): void {
    this.history.clear();
  }
  setShuffle(enabled: boolean): void {
    this.shuffle = enabled;
    this.reset();
    if (enabled && this.library.current) this.record(this.library.current);
  }
  private record(node: ListNode<Track>): void {
    this.history.current = this.history.append(node);
  }
  private sameCurrentTrack(node: ListNode<Track>): boolean {
    const current = this.library.current;
    if (!current) return false;
    return (
      node === current ||
      (node.value.source === 'spotify'
        ? node.value.uri === current.value.uri
        : node.value.blobId === current.value.blobId)
    );
  }
  selected(node: ListNode<Track>): void {
    this.reset();
    this.library.current = node;
    if (this.shuffle) this.record(node);
  }
  next(automatic = false): ListNode<Track> | null {
    const tracks = this.library.tracks;
    if (!tracks.head) return null;
    if (automatic && this.repeat === 'current') return this.library.current ?? tracks.head;
    if (!this.shuffle)
      return (
        this.library.current?.next ??
        (!this.library.current || this.repeat === 'playlist' ? tracks.head : null)
      );
    const forward = this.history.current?.next;
    if (forward && tracks.find(forward.value.id)) {
      this.history.current = forward;
      return forward.value;
    }
    const candidates = new DoublyLinkedList<ListNode<Track>>();
    for (const node of tracks) {
      let visited = this.sameCurrentTrack(node);
      for (const past of this.history) if (past.value.id === node.id) visited = true;
      if (!visited) candidates.append(node);
    }
    if (!candidates.size && this.repeat === 'playlist') {
      this.reset();
      if (this.library.current) this.record(this.library.current);
      for (const node of tracks) if (!this.sameCurrentTrack(node)) candidates.append(node);
      if (!candidates.size) return tracks.head;
    }
    if (!candidates.size) return null;
    const chosen = candidates.at(Math.floor(this.random() * candidates.size)).value;
    this.record(chosen);
    return chosen;
  }
  previous(): ListNode<Track> | null {
    if (this.shuffle) {
      let previous = this.history.current?.previous ?? null;
      while (previous && !this.library.tracks.find(previous.value.id)) previous = previous.previous;
      if (previous) {
        this.history.current = previous;
        return previous.value;
      }
      return this.library.current;
    }
    return (
      this.library.current?.previous ??
      (this.repeat === 'playlist'
        ? this.library.tracks.tail
        : (this.library.current ?? this.library.tracks.head))
    );
  }
}
