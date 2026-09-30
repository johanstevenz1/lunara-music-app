import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  AudioLines,
  Check,
  ChevronDown,
  Code2,
  Headphones,
  Home,
  LibraryBig,
  ListMusic,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { store, type Page } from './store';
import { type Track } from './core/library';
import { DoublyLinkedList, type ListNode } from './core/list';
export function time(ms: number): string {
  const seconds = Math.floor(Math.max(ms, 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** Array exists only at the React rendering boundary, never as playlist state. */
export function renderNodes<T>(
  list: DoublyLinkedList<T>,
  render: (node: ListNode<T>, index: number) => ReactNode,
): ReactNode[] {
  const children: ReactNode[] = [];
  let index = 0;
  for (const node of list) children.push(render(node, index++));
  return children;
}
export function Artwork({ track, className = '' }: { track?: Track; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [track?.cover]);
  return (
    <div className={`artwork ${className}`}>
      {track?.cover && !broken ? (
        <img
          src={track.cover}
          alt={`${track.album} artwork`}
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <AudioLines aria-hidden="true" />
      )}
    </div>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector('input')?.focus();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-label={title} className="modal">
      <div className="modal-heading">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={close}>
          <X />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function Sidebar({ create }: { create: () => void }) {
  const nav = (page: Page, label: string, icon: ReactNode) => (
    <button
      className={`nav-item ${store.page === page ? 'selected' : ''}`}
      onClick={() => store.navigate(page)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <>
      <button
        className={`sidebar-overlay ${store.sidebar ? 'visible' : ''}`}
        aria-label="Close sidebar"
        onClick={() => {
          store.sidebar = false;
          store.changed();
        }}
      />
      <aside className={`sidebar ${store.sidebar ? 'opened' : ''}`}>
        <a
          href="/"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            store.navigate('home');
          }}
        >
          <span className="brand-mark">
            <Moon />
          </span>
          lunara<span className="brand-dot">.</span>
        </a>
        <p className="eyebrow sidebar-label">YOUR SPACE</p>
        <nav aria-label="Main navigation">
          {nav('home', 'Home', <Home />)}
          {nav('search', 'Search', <Search />)}
          {nav('library', 'Your library', <LibraryBig />)}
        </nav>
        <div className="sidebar-section">
          <span className="eyebrow">PLAYLISTS</span>
          <IconButton label="Create playlist" onClick={create} disabled={store.busy}>
            <Plus />
          </IconButton>
        </div>
        <div className="playlist-links">
          {renderNodes(store.library.playlists, (node) => (
            <button
              key={node.id}
              className={`playlist-link ${store.page === 'playlist' && store.library.active.id === node.id ? 'selected' : ''}`}
              onClick={() => {
                void store.openPlaylist(node.id).catch((error) => store.fail(error));
              }}
            >
              <Artwork track={node.value.tracks.head?.value} />
              <span>
                <strong>{node.value.name}</strong>
                <small>{node.value.tracks.size} tracks</small>
              </span>
            </button>
          ))}
        </div>
        <button
          className={`nav-item developer-link ${store.developer ? 'selected' : ''}`}
          onClick={() => {
            store.developer = !store.developer;
            store.changed();
          }}
        >
          <Code2 />
          <span>Developer view</span>
        </button>
        <div className="sidebar-footer">
          <Headphones />
          <span>
            Made for listening.
            <br />
            <small>Powered by Spotify</small>
          </span>
        </div>
      </aside>
    </>
  );
}
export function Connection() {
  const connected = store.auth.connected;
  return (
    <div className="connection">
      {connected ? (
        <>
          <div className="profile-image">
            {store.user?.images[0]?.url ? (
              <img
                src={store.user.images[0].url}
                alt="Spotify profile"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <Headphones />
            )}
          </div>
          <div className="profile-text">
            <strong>{store.user?.display_name || 'Spotify listener'}</strong>
            <small>{store.ready ? 'Player ready' : 'Player connecting'}</small>
          </div>
          {!store.ready && (
            <button
              className="small-button"
              onClick={() => {
                void store.connect();
              }}
            >
              Reconnect
            </button>
          )}
          <IconButton
            label="Disconnect Spotify"
            onClick={() => {
              void store.logout();
            }}
          >
            <LogOut />
          </IconButton>
        </>
      ) : (
        <button
          className="connect-button"
          onClick={() => {
            void store.connect();
          }}
          disabled={store.busy}
        >
          <Headphones />
          {store.connecting ? 'Connecting…' : 'Connect Spotify'}
        </button>
      )}
    </div>
  );
}
export function PlacementControls() {
  return (
    <div className="placement">
      <label htmlFor="placement">Add songs</label>
      <select
        id="placement"
        value={store.placement}
        onChange={(event) => {
          store.placement = event.target.value as typeof store.placement;
          store.changed();
        }}
      >
        <option value="end">At the end</option>
        <option value="start">At the beginning</option>
        <option value="position">At position…</option>
      </select>
      {store.placement === 'position' && (
        <input
          aria-label="Insertion position"
          type="number"
          min="1"
          max={store.library.tracks.size + 1}
          value={store.position}
          onChange={(event) => {
            store.position = Number(event.target.value);
            store.changed();
          }}
        />
      )}
    </div>
  );
}
export function TrackRows({
  list,
  search = false,
  move,
}: {
  list: DoublyLinkedList<Track>;
  search?: boolean;
  move: (node: ListNode<Track>, position: number) => void;
}) {
  return (
    <div className="track-list">
      {renderNodes(list, (node, index) => {
        const current = !search && store.library.current === node;
        return (
          <div key={node.id} className={`track-row ${current ? 'playing' : ''}`}>
            <span className="track-index">
              {current && !store.playback.paused ? <AudioLines size={17} /> : index + 1}
            </span>
            <button
              className="track-main"
              aria-label={`Play ${node.value.title}`}
              onClick={() => {
                if (search) void store.playResult(node.value);
                else void store.playNode(node, true);
              }}
              disabled={store.busy}
            >
              <Artwork track={node.value} />
              <span>
                <strong>{node.value.title}</strong>
                <small>{node.value.artist}</small>
              </span>
            </button>
            <span className="track-album">
              {node.value.album}
              <small>{node.value.source === 'spotify' ? 'Spotify' : 'Local MP3'}</small>
            </span>
            <span className="track-duration">{time(node.value.durationMs)}</span>
            {search ? (
              <>
                <IconButton
                  label={`Add ${node.value.title} to playlist`}
                  onClick={() => {
                    store.add(node.value);
                  }}
                >
                  <Plus />
                </IconButton>
                <IconButton
                  label={`Queue ${node.value.title} next`}
                  onClick={() => {
                    store.add(node.value, true);
                  }}
                >
                  <ListMusic />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton
                  label={`Move ${node.value.title}`}
                  onClick={() => move(node, index + 1)}
                  disabled={store.busy}
                >
                  <ArrowUpDown />
                </IconButton>
                <IconButton
                  label={`Remove ${node.value.title}`}
                  onClick={() => {
                    void store.removeTrack(node.id).catch((error) => store.fail(error));
                  }}
                  disabled={store.busy}
                >
                  <X />
                </IconButton>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function Transport({ large = false }: { large?: boolean }) {
  const { navigation } = store;
  return (
    <div className={`transport ${large ? 'large' : ''}`}>
      <IconButton
        label={navigation.shuffle ? 'Disable shuffle' : 'Enable shuffle'}
        active={navigation.shuffle}
        onClick={() => {
          navigation.setShuffle(!navigation.shuffle);
          store.changed();
        }}
      >
        <Shuffle />
      </IconButton>
      <IconButton
        label="Previous song"
        onClick={() => {
          void store.previous().catch((error) => store.fail(error));
        }}
        disabled={store.busy}
      >
        <SkipBack />
      </IconButton>
      <IconButton
        label={store.playback.paused ? 'Play' : 'Pause'}
        className="play-button"
        onClick={() => {
          void store.toggle();
        }}
        disabled={store.busy}
      >
        {store.playback.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
      </IconButton>
      <IconButton
        label="Next song"
        onClick={() => {
          void store.next().catch((error) => store.fail(error));
        }}
        disabled={store.busy}
      >
        <SkipForward />
      </IconButton>
      <IconButton
        label={`Repeat: ${navigation.repeat}`}
        active={navigation.repeat !== 'off'}
        onClick={() => {
          navigation.repeat =
            navigation.repeat === 'off'
              ? 'playlist'
              : navigation.repeat === 'playlist'
                ? 'current'
                : 'off';
          store.changed();
        }}
      >
        {navigation.repeat === 'current' ? <Repeat1 /> : <Repeat />}
      </IconButton>
    </div>
  );
}
export function Progress() {
  const { playback } = store;
  const [drag, setDrag] = useState<number | null>(null);
  return (
    <div className="progress">
      <span>{time(drag ?? playback.position)}</span>
      <input
        type="range"
        aria-label="Playback position"
        min="0"
        max={playback.duration || 1}
        step="1000"
        value={Math.min(drag ?? playback.position, playback.duration || 1)}
        disabled={!store.library.current || !playback.duration}
        onChange={(event) => setDrag(Number(event.target.value))}
        onPointerUp={() => {
          if (drag !== null) void store.seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag !== null) void store.seek(drag);
          setDrag(null);
        }}
        onBlur={() => setDrag(null)}
      />
      <span>{time(playback.duration)}</span>
    </div>
  );
}
export function PlayerBar() {
  const current = store.library.current?.value;
  return (
    <footer className="player-bar">
      <button
        className="player-track"
        aria-label="Open now playing"
        onClick={() => {
          store.expandedPlayer = true;
          store.changed();
        }}
      >
        <Artwork track={current} />
        <span>
          <strong>{current?.title ?? 'Your next favorite is waiting'}</strong>
          <small>{current?.artist ?? 'Search Spotify to start listening'}</small>
        </span>
      </button>
      <div className="player-center">
        <Transport />
        <Progress />
      </div>
      <div className="player-options">
        <IconButton label={store.volume ? 'Mute' : 'Unmute'} onClick={() => store.mute()}>
          {store.volume ? <Volume2 /> : <VolumeX />}
        </IconButton>
        <input
          type="range"
          aria-label="Volume"
          min="0"
          max="1"
          step="0.01"
          value={store.volume}
          onChange={(event) => {
            void store.setVolume(Number(event.target.value));
          }}
        />
        <IconButton
          label="Open queue"
          active={store.queue}
          onClick={() => {
            store.queue = !store.queue;
            store.changed();
          }}
        >
          <ListMusic />
        </IconButton>
        <IconButton
          label="Expand player"
          onClick={() => {
            store.expandedPlayer = true;
            store.changed();
          }}
        >
          <ChevronDown className="rotate" />
        </IconButton>
      </div>
    </footer>
  );
}
export function NowPlaying() {
  if (!store.expandedPlayer) return null;
  const current = store.library.current?.value;
  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="now-heading">
        <IconButton
          label="Close now playing"
          onClick={() => {
            store.expandedPlayer = false;
            store.changed();
          }}
        >
          <ArrowLeft />
        </IconButton>
        <span className="eyebrow">NOW PLAYING</span>
        <IconButton
          label="View queue"
          onClick={() => {
            store.expandedPlayer = false;
            store.queue = true;
            store.changed();
          }}
        >
          <ListMusic />
        </IconButton>
      </div>
      <div className={`record ${!store.playback.paused ? 'spinning' : ''}`}>
        <Artwork track={current} className="record-art" />
        <div className="record-hole" />
      </div>
      <div className="now-details">
        <span className="playlist-badge">{store.library.active.value.name}</span>
        <h1>{current?.title ?? 'Find your sound'}</h1>
        <p>{current?.artist ?? 'Connect Spotify and choose a song'}</p>
        {current?.externalUrl && (
          <a href={current.externalUrl} target="_blank" rel="noreferrer">
            Listen on Spotify
          </a>
        )}
        <Progress />
        <Transport large />
        <div className="now-volume">
          <IconButton label={store.volume ? 'Mute' : 'Unmute'} onClick={() => store.mute()}>
            {store.volume ? <Volume2 /> : <VolumeX />}
          </IconButton>
          <input
            type="range"
            aria-label="Player volume"
            min="0"
            max="1"
            step="0.01"
            value={store.volume}
            onChange={(event) => {
              void store.setVolume(Number(event.target.value));
            }}
          />
        </div>
      </div>
    </section>
  );
}
export function Queue() {
  if (!store.queue) return null;
  let before = true;
  return (
    <aside className="queue-panel" aria-label="Music queue">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">UP NEXT</span>
          <h2>Your queue</h2>
        </div>
        <IconButton
          label="Close queue"
          onClick={() => {
            store.queue = false;
            store.changed();
          }}
        >
          <X />
        </IconButton>
      </div>
      <p className="muted">
        {store.library.active.value.name} · {store.library.tracks.size} tracks
      </p>
      {store.navigation.shuffle && (
        <p className="queue-note">Shuffle is on. The order below is your original playlist.</p>
      )}
      {store.library.tracks.isEmpty() ? (
        <div className="empty compact">
          <ListMusic />
          <h3>A little quiet here</h3>
          <p>Add songs to build your queue.</p>
        </div>
      ) : (
        renderNodes(store.library.tracks, (node) => {
          const current = node === store.library.current;
          if (current) before = false;
          return (
            <button
              key={node.id}
              className={`queue-track ${current ? 'selected' : ''}`}
              disabled={store.busy}
              onClick={() => {
                void store.playNode(node, true);
              }}
            >
              <Artwork track={node.value} />
              <span>
                <small>
                  {current
                    ? 'NOW PLAYING'
                    : before && store.library.current
                      ? 'PREVIOUS'
                      : 'UPCOMING'}
                </small>
                <strong>{node.value.title}</strong>
                <small>{node.value.artist}</small>
              </span>
              {current && <AudioLines />}
            </button>
          );
        })
      )}
    </aside>
  );
}
export function Visualizer() {
  if (!store.developer) return null;
  const list = store.library.tracks;
  return (
    <section className="visualizer">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LIVE DATA STRUCTURE</span>
          <h2>Doubly linked list</h2>
        </div>
        <span className="playlist-badge">Size: {list.size}</span>
      </div>
      <div className="node-summary">
        <span>
          Head: <strong>{list.head?.value.title ?? 'null'}</strong>
        </span>
        <span>
          Tail: <strong>{list.tail?.value.title ?? 'null'}</strong>
        </span>
        <span>
          Current: <strong>{list.current?.value.title ?? 'null'}</strong>
        </span>
        <span>
          Previous: <strong>{list.current?.previous?.value.title ?? 'null'}</strong>
        </span>
        <span>
          Next: <strong>{list.current?.next?.value.title ?? 'null'}</strong>
        </span>
      </div>
      <div className="nodes">
        <span className="null-node">NULL</span>
        {renderNodes(list, (node, index) => (
          <div key={node.id} className="node-pair">
            <span className="node-link">⇄</span>
            <button
              className={`list-node ${node === list.current ? 'current' : ''}`}
              disabled={store.busy}
              onClick={() => {
                void store.playNode(node, true);
              }}
            >
              <small>
                NODE {index + 1}
                {node === list.head ? ' · HEAD' : ''}
                {node === list.tail ? ' · TAIL' : ''}
              </small>
              <strong>{node.value.title}</strong>
              <code>
                prev: {node.previous?.value.title ?? 'null'}
                <br />
                next: {node.next?.value.title ?? 'null'}
              </code>
              {node === list.current && <span className="current-label">CURRENT</span>}
            </button>
          </div>
        ))}
        <span className="node-link">⇄</span>
        <span className="null-node">NULL</span>
      </div>
    </section>
  );
}
export {
  ArrowLeft,
  Check,
  Headphones,
  Home,
  ListMusic,
  Menu,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
};
