import type { Track } from '../core/library.js';
import type { AuthService } from './auth.js';
import { loadAudio } from '../storage.js';
export interface PlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  uri: string;
}
interface SDKState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: { uri: string } };
}
interface SDKPlayer {
  addListener(event: string, callback: (data: never) => void): boolean;
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  activateElement(): Promise<void>;
  getCurrentState(): Promise<SDKState | null>;
}
declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SDKPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
export class MusicPlayer {
  private sdk: SDKPlayer | null = null;
  private deviceId = '';
  private audio = new Audio();
  private blobUrl = '';
  private active: Track | null = null;
  private polling = false;
  private previous: PlaybackState | null = null;
  private generation = 0;
  private volume = 0.65;
  private prepared = false;
  onState: (state: PlaybackState) => void = () => {};
  onEnded: () => void = () => {};
  onError: (message: string) => void = () => {};
  onReady: (ready: boolean) => void = () => {};
  constructor(private auth: AuthService) {
    this.audio.addEventListener('timeupdate', () => this.localState());
    this.audio.addEventListener('loadedmetadata', () => this.localState());
    this.audio.addEventListener('play', () => this.localState());
    this.audio.addEventListener('pause', () => this.localState());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('error', () =>
      this.onError('This MP3 cannot be played. Try another file.'),
    );
    // Poll SDK state, never synthesize playback position from a timer.
    window.setInterval(() => {
      if (!this.sdk || this.active?.source !== 'spotify' || this.polling) return;
      this.polling = true;
      void this.sdk
        .getCurrentState()
        .then((state) => this.spotifyState(state))
        .catch(() => {})
        .finally(() => {
          this.polling = false;
        });
    }, 1000);
  }
  async connect(): Promise<void> {
    if (this.sdk && this.deviceId) return;
    if (this.sdk) this.sdk.disconnect();
    this.prepared = false;
    if (!window.Spotify)
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error('Spotify player took too long to load. Please reconnect.')),
          15000,
        );
        window.onSpotifyWebPlaybackSDKReady = () => {
          clearTimeout(timer);
          resolve();
        };
        const old = document.getElementById('spotify-sdk');
        old?.remove();
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Spotify player could not load. Check browser protection settings.'));
        };
        document.body.appendChild(script);
      });
    this.sdk = new window.Spotify!.Player({
      name: 'Lunara',
      volume: this.volume,
      getOAuthToken: (cb) => {
        void this.auth
          .getToken()
          .then(cb)
          .catch((error) => this.onError((error as Error).message));
      },
    });
    this.sdk.addListener('ready', (data: { device_id: string }) => {
      this.deviceId = data.device_id;
      this.onReady(true);
    });
    this.sdk.addListener('not_ready', () => {
      this.deviceId = '';
      this.onReady(false);
      this.onError('Lunara is offline. Reconnect the player.');
    });
    this.sdk.addListener('player_state_changed', (state: SDKState | null) =>
      this.spotifyState(state),
    );
    this.sdk.addListener('autoplay_failed', () =>
      this.onError('Your browser blocked playback. Press Play again to enable audio.'),
    );
    this.sdk.addListener('initialization_error', () =>
      this.onError('This browser cannot initialize Spotify playback. Try a supported browser.'),
    );
    this.sdk.addListener('authentication_error', () => {
      this.disconnect();
      this.auth.logout();
      this.onError('Spotify authentication expired. Please connect again.');
    });
    this.sdk.addListener('account_error', () =>
      this.onError('Spotify playback needs a Premium account authorized for this app.'),
    );
    this.sdk.addListener('playback_error', () =>
      this.onError('Spotify cannot play this track. Try another song.'),
    );
    if (!(await this.sdk.connect()))
      throw new Error('Spotify player could not connect. Please try again.');
  }
  private spotifyState(state: SDKState | null): void {
    if (!state || this.active?.source !== 'spotify') return;
    const next: PlaybackState = {
      paused: state.paused,
      position: state.position,
      duration: state.duration,
      uri: state.track_window.current_track.uri,
    };
    // Spotify signals completion by resetting position to zero while paused.
    const ended =
      this.previous &&
      !this.previous.paused &&
      next.paused &&
      next.position === 0 &&
      this.previous.duration > 0 &&
      this.previous.position >= this.previous.duration - 2000 &&
      next.uri === this.previous.uri;
    this.previous = next;
    this.onState(next);
    if (ended) this.onEnded();
  }
  private localState(): void {
    if (this.active?.source !== 'local') return;
    this.onState({
      paused: this.audio.paused,
      position: this.audio.currentTime * 1000,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0,
      uri: this.active.blobId!,
    });
  }
  /** Call immediately inside a click handler to retain the browser user gesture. */
  activate(): void {
    if (this.sdk) void this.sdk.activateElement().catch(() => {});
  }
  async play(track: Track): Promise<void> {
    const generation = ++this.generation;
    if (track.source === 'spotify') {
      if (!this.auth.connected) throw new Error('Connect Spotify to play this song.');
      if (!this.sdk || !this.deviceId)
        throw new Error('The Spotify player is starting. Wait for Player ready, then press Play.');
      this.audio.pause();
      this.active = track;
      this.previous = null;
      await this.auth.request('/api/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: track.uri,
          deviceId: this.deviceId,
          resetModes: !this.prepared,
        }),
      });
      this.prepared = true;
    } else {
      await this.sdk?.pause();
      const blob = await loadAudio(track.blobId!);
      if (generation !== this.generation) return;
      if (!blob) throw new Error('This MP3 is missing from this browser. Import it again.');
      this.audio.pause();
      if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = URL.createObjectURL(blob);
      this.audio.src = this.blobUrl;
      this.audio.volume = this.volume;
      this.active = track;
      try {
        await this.audio.play();
      } catch {
        throw new Error('Audio was blocked. Press Play again to enable playback.');
      }
    }
  }
  async toggle(paused: boolean): Promise<void> {
    if (this.active?.source === 'local') {
      if (paused) await this.audio.play();
      else this.audio.pause();
    } else if (this.sdk) {
      if (paused) await this.sdk.resume();
      else await this.sdk.pause();
    }
  }
  async pause(): Promise<void> {
    this.audio.pause();
    await this.sdk?.pause();
  }
  async seek(position: number): Promise<void> {
    this.previous = null;
    if (this.active?.source === 'local') this.audio.currentTime = position / 1000;
    else await this.sdk?.seek(position);
  }
  async setVolume(volume: number): Promise<void> {
    this.volume = volume;
    this.audio.volume = volume;
    await this.sdk?.setVolume(volume);
  }
  async stop(): Promise<void> {
    ++this.generation;
    await this.pause();
    this.active = null;
    this.previous = null;
  }
  disconnect(): void {
    this.sdk?.disconnect();
    this.sdk = null;
    this.deviceId = '';
    this.prepared = false;
    this.onReady(false);
  }
}
