import { Library, type Track } from './core/library';
import { DoublyLinkedList, type ListNode } from './core/list';
import { Navigation } from './core/navigation';
import { AuthService, type SpotifyUser } from './services/auth';
import { SearchService } from './services/search';
import { MusicPlayer, type PlaybackState } from './services/player';
import { importAudio } from './services/importAudio';
import { loadLibrary, saveLibrary } from './storage';
export type Page = 'home' | 'search' | 'library' | 'playlist';
export type Placement = 'start' | 'end' | 'position';
export class AppStore {
  library = new Library();
  navigation = new Navigation(this.library);
  readonly auth = new AuthService();
  readonly searchService = new SearchService(this.auth);
  readonly player = new MusicPlayer(this.auth);
  readonly listeners = new DoublyLinkedList<() => void>();
  version = 0;
  page: Page = 'home';
  user: SpotifyUser | null = null;
  ready = false;
  sidebar = false;
  expandedPlayer = false;
  queue = false;
  developer = false;
  busy = false;
  connecting = false;
  loading = true;
  searchLoading = false;
  query = '';
  searchError = '';
  results = new DoublyLinkedList<Track>();
  placement: Placement = 'end';
  position = 1;
  volume = 0.65;
  previousVolume = 0.65;
  notice = '';
  error = '';
  playback: PlaybackState = { paused: true, position: 0, duration: 0, uri: '' };
  private searchTimer = 0;
  private searchAbort: AbortController | null = null;
  private searchVersion = 0;
  private saveChain = Promise.resolve();
  subscribe = (listener: () => void): (() => void) => {
    const node = this.listeners.append(listener);
    return () => {
      this.listeners.remove(node.id);
    };
  };
  getVersion = (): number => this.version;
  changed(): void {
    this.version++;
    for (const listener of this.listeners) listener.value();
  }
  fail(error: unknown): void {
    this.error = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    this.changed();
  }
  constructor() {
    this.player.onReady = (ready) => {
      this.ready = ready;
      this.changed();
    };
    this.player.onError = (message) => {
      this.error = message;
      if (!this.auth.connected) this.user = null;
      this.changed();
    };
    this.player.onState = (state) => {
      const current = this.library.current;
      if (!current) return;
      const expected = current.value.uri ?? current.value.blobId;
      if (state.uri !== expected) {
        // Ignore stale SDK events during a command; reconcile external Spotify changes.
        if (this.busy) return;
        let match: ListNode<Track> | null = null;
        for (const node of this.library.tracks)
          if (node.value.uri === state.uri) {
            match = node;
            break;
          }
        if (match) this.navigation.selected(match);
        else {
          void this.player.pause().catch(() => {});
          this.error = 'Playback changed outside this playlist. Select a song to continue.';
          this.playback.paused = true;
          this.changed();
          return;
        }
      }
      this.playback = state;
      this.changed();
    };
    this.player.onEnded = () => {
      void this.next(true);
    };
  }
  async initialize(): Promise<void> {
    try {
      const saved = await loadLibrary();
      if (saved) {
        this.library = saved;
        this.navigation = new Navigation(saved);
      }
    } catch {
      this.error =
        'Browser storage is unavailable. Allow site storage to keep playlists and imported MP3s.';
    }
    this.loading = false;
    this.changed();
    try {
      if (await this.auth.finishLogin()) await this.connectProfile();
    } catch (error) {
      this.fail(error);
    }
  }
  save(): void {
    this.saveChain = this.saveChain
      .then(() => saveLibrary(this.library))
      .catch(() =>
        this.fail(new Error('Your changes could not be saved. Browser storage may be full.')),
      );
  }
  async connectProfile(): Promise<void> {
    this.user = (await (await this.auth.request('/api/me')).json()) as SpotifyUser;
    this.changed();
    await this.player.connect();
  }
  async connect(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.connecting = true;
    this.error = '';
    this.changed();
    try {
      if (this.auth.connected) await this.player.connect();
      else await this.auth.login();
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
      this.connecting = false;
      this.changed();
    }
  }
  async logout(): Promise<void> {
    try {
      await this.player.stop();
    } catch {
      /* SDK may already be offline. */
    }
    this.player.disconnect();
    this.auth.logout();
    this.user = null;
    this.results.clear();
    this.searchService.clear();
    this.playback = { paused: true, position: 0, duration: 0, uri: '' };
    this.library.current = null;
    this.changed();
  }
  navigate(page: Page): void {
    this.page = page;
    this.sidebar = false;
    this.changed();
  }
  async openPlaylist(id: string): Promise<void> {
    if (this.busy) return;
    if (id !== this.library.active.id) {
      await this.player.stop();
      this.library.selectPlaylist(id);
      this.position = 1;
      this.navigation.reset();
      this.playback = { paused: true, position: 0, duration: 0, uri: '' };
    }
    this.navigate('playlist');
    this.save();
  }
  createPlaylist(name: string): void {
    const entry = this.library.playlists.append({
      name: name.trim().slice(0, 80) || 'Untitled playlist',
      tracks: new DoublyLinkedList(),
    });
    void this.openPlaylist(entry.id).catch((error) => this.fail(error));
    this.changed();
    this.save();
  }
  renamePlaylist(name: string): void {
    this.library.active.value.name = name.trim().slice(0, 80) || 'Untitled playlist';
    this.changed();
    this.save();
  }
  async deletePlaylist(): Promise<void> {
    await this.player.stop();
    this.library.playlists.remove(this.library.active.id);
    if (!this.library.playlists.head)
      this.library.playlists.append({ name: 'My playlist', tracks: new DoublyLinkedList() });
    this.library.active = this.library.playlists.head!;
    this.library.current = null;
    this.navigation.reset();
    this.playback = { paused: true, position: 0, duration: 0, uri: '' };
    this.navigate('library');
    this.save();
  }
  insertionIndex(): number {
    if (this.placement === 'start') return 0;
    if (this.placement === 'end') return this.library.tracks.size;
    if (
      !Number.isInteger(this.position) ||
      this.position < 1 ||
      this.position > this.library.tracks.size + 1
    )
      throw new Error(`Choose a position from 1 to ${this.library.tracks.size + 1}.`);
    return this.position - 1;
  }
  add(track: Track, queue = false): ListNode<Track> | null {
    try {
      let index = this.insertionIndex();
      if (queue && this.library.current) {
        index = 0;
        for (const node of this.library.tracks) {
          index++;
          if (node === this.library.current) break;
        }
      } else if (queue) index = this.library.tracks.size;
      const node = this.library.tracks.insertAt(index, { ...track });
      this.notice = queue
        ? 'Added next in your queue'
        : `Added to ${this.library.active.value.name}`;
      this.changed();
      this.save();
      return node;
    } catch (error) {
      this.fail(error);
      return null;
    }
  }
  async importFiles(files: FileList): Promise<void> {
    if (this.busy) return;
    // FileList is live; retain references before the input resets its value.
    const pending = new DoublyLinkedList<File>();
    for (const file of files) pending.append(file);
    this.busy = true;
    this.notice = 'Importing MP3…';
    this.changed();
    try {
      for (const node of pending) {
        const track = await importAudio(node.value);
        this.add(track);
      }
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  async removeTrack(id: string): Promise<void> {
    if (this.busy) return;
    const isCurrent = this.library.current?.id === id;
    const wasPlaying = !this.playback.paused;
    if (isCurrent) await this.player.stop();
    this.library.removeTrack(id);
    this.navigation.reset();
    if (isCurrent) {
      this.playback = { paused: true, position: 0, duration: 0, uri: '' };
      if (wasPlaying && this.library.current) await this.playNode(this.library.current);
    }
    this.changed();
    this.save();
  }
  moveTrack(id: string, position: number): void {
    try {
      this.library.tracks.move(id, position - 1);
      this.changed();
      this.save();
    } catch {
      this.fail(new Error(`Choose a position from 1 to ${this.library.tracks.size}.`));
    }
  }
  async playNode(node: ListNode<Track>, intentional = false): Promise<void> {
    this.player.activate();
    if (this.busy) return;
    const previous = this.library.current;
    this.busy = true;
    this.error = '';
    this.library.current = node;
    this.changed();
    try {
      await this.player.play(node.value);
      if (intentional) this.navigation.selected(node);
      this.playback = {
        paused: false,
        position: 0,
        duration: node.value.durationMs,
        uri: node.value.uri ?? node.value.blobId!,
      };
    } catch (error) {
      this.library.current = previous;
      this.navigation.reset();
      this.playback.paused = true;
      this.fail(error);
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  async playResult(track: Track): Promise<void> {
    this.player.activate();
    const node = this.add(track);
    if (node) await this.playNode(node, true);
  }
  async toggle(): Promise<void> {
    this.player.activate();
    if (this.busy) return;
    if (!this.library.current || !this.playback.uri) {
      const node = this.library.current ?? this.library.tracks.head;
      if (node) await this.playNode(node, true);
      else {
        this.notice = 'Search Spotify and add your first song.';
        this.navigate('search');
      }
      return;
    }
    try {
      await this.player.toggle(this.playback.paused);
    } catch (error) {
      this.fail(error);
    }
  }
  async next(automatic = false): Promise<void> {
    this.player.activate();
    if (this.busy) return;
    const node = this.navigation.next(automatic);
    if (node) await this.playNode(node);
    else {
      await this.player.pause();
      this.playback.paused = true;
      this.notice = 'End of playlist';
      this.changed();
    }
  }
  async previous(): Promise<void> {
    this.player.activate();
    const node = this.navigation.previous();
    if (node) await this.playNode(node);
  }
  setQuery(query: string): void {
    this.query = query;
    this.searchError = '';
    this.searchAbort?.abort();
    clearTimeout(this.searchTimer);
    const version = ++this.searchVersion;
    if (!query.trim()) {
      this.results.clear();
      this.searchLoading = false;
      this.changed();
      return;
    }
    this.searchLoading = true;
    this.changed();
    this.searchTimer = window.setTimeout(() => {
      const controller = new AbortController();
      this.searchAbort = controller;
      void this.searchService
        .search(query, controller.signal)
        .then((results) => {
          if (version === this.searchVersion) this.results = results;
        })
        .catch((error) => {
          if (!controller.signal.aborted && version === this.searchVersion) {
            this.results.clear();
            this.searchError = (error as Error).message;
          }
        })
        .finally(() => {
          if (version === this.searchVersion) {
            this.searchLoading = false;
            this.changed();
          }
        });
    }, 350);
  }
  async seek(position: number): Promise<void> {
    try {
      await this.player.seek(position);
    } catch {
      this.fail(new Error('Unable to change playback position.'));
    }
  }
  async setVolume(volume: number): Promise<void> {
    this.volume = volume;
    if (volume > 0) this.previousVolume = volume;
    this.changed();
    try {
      await this.player.setVolume(volume);
    } catch {
      this.fail(new Error('Unable to change volume.'));
    }
  }
  mute(): void {
    void this.setVolume(this.volume > 0 ? 0 : this.previousVolume);
  }
}
export const store = new AppStore();
