import { DoublyLinkedList } from '../core/list.js';
import type { Track } from '../core/library.js';
import type { AuthService } from './auth.js';
interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: ReadonlyArray<{ name: string }>;
  album: { name: string; images: ReadonlyArray<{ url: string }> };
  external_urls: { spotify: string };
}
interface CacheEntry {
  query: string;
  expires: number;
  tracks: DoublyLinkedList<Track>;
}
export class SearchService {
  private cache = new DoublyLinkedList<CacheEntry>();
  constructor(private auth: AuthService) {}
  clear(): void {
    this.cache.clear();
  }
  async search(query: string, signal: AbortSignal): Promise<DoublyLinkedList<Track>> {
    const key = query.trim().toLowerCase();
    for (const entry of this.cache)
      if (entry.value.query === key && entry.value.expires > Date.now()) return entry.value.tracks;
    const response = await this.auth.request('/api/search?' + new URLSearchParams({ q: query }), {
      signal,
    });
    const data = (await response.json()) as { tracks: { items: ReadonlyArray<SpotifyTrack> } };
    const tracks = new DoublyLinkedList<Track>();
    for (const item of data.tracks.items) {
      let artist = '';
      for (const person of item.artists) artist += (artist ? ', ' : '') + person.name;
      tracks.append({
        source: 'spotify',
        title: item.name,
        artist,
        album: item.album.name,
        cover: item.album.images[0]?.url ?? '',
        durationMs: item.duration_ms,
        uri: item.uri,
        externalUrl: item.external_urls.spotify,
      });
    }
    this.cache.append({ query: key, expires: Date.now() + 60000, tracks });
    if (this.cache.size > 12) this.cache.remove(this.cache.head!.id);
    return tracks;
  }
}
