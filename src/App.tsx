import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Artwork,
  Connection,
  IconButton,
  Modal,
  NowPlaying,
  PlacementControls,
  PlayerBar,
  Queue,
  Sidebar,
  TrackRows,
  Visualizer,
  renderNodes,
  Headphones,
  ListMusic,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from './components';
import { store } from './store';
import { type Track } from './core/library';
import type { ListNode } from './core/list';
type EditModal =
  | { kind: 'create' | 'rename' | 'delete' }
  | { kind: 'move'; node: ListNode<Track>; position: number };
export default function App() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const [modal, setModal] = useState<EditModal | null>(null);
  const [name, setName] = useState('');
  const [position, setPosition] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void store.initialize();
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        document.querySelector('dialog[open]')
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        void store.toggle();
      }
      if (event.code === 'Escape') {
        store.expandedPlayer = false;
        store.queue = false;
        store.sidebar = false;
        store.changed();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);
  useEffect(() => {
    if (!store.notice) return;
    const timer = setTimeout(() => {
      store.notice = '';
      store.changed();
    }, 4000);
    return () => clearTimeout(timer);
  }, [store.notice]);
  const create = () => {
    setName('');
    setModal({ kind: 'create' });
  };
  const move = (node: ListNode<Track>, nextPosition: number) => {
    setPosition(nextPosition);
    setModal({ kind: 'move', node, position: nextPosition });
  };
  const tracks = store.library.tracks;
  let totalDuration = 0;
  for (const node of tracks) totalDuration += node.value.durationMs;
  const title =
    store.page === 'home'
      ? 'Welcome to your space'
      : store.page === 'search'
        ? 'Find your next favorite'
        : store.page === 'library'
          ? 'Your library'
          : store.library.active.value.name;
  return (
    <div className="app-shell">
      <Sidebar create={create} />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              label="Open menu"
              className="mobile-menu"
              onClick={() => {
                store.sidebar = true;
                store.changed();
              }}
            >
              <Menu />
            </IconButton>
            <span className="breadcrumb">
              YOUR MUSIC / <strong>{store.page.toUpperCase()}</strong>
            </span>
          </div>
          <Connection />
        </header>
        {store.error && (
          <div className="error-banner" role="alert">
            <span>{store.error}</span>
            <IconButton
              label="Dismiss error"
              onClick={() => {
                store.error = '';
                store.changed();
              }}
            >
              ×
            </IconButton>
          </div>
        )}
        {store.loading ? (
          <div className="empty">
            <AudioLoading />
            <h2>Loading your library…</h2>
          </div>
        ) : (
          <>
            {store.page === 'home' && (
              <>
                <section className="welcome">
                  <span className="eyebrow">LUNARA / YOUR DAILY SOUNDTRACK</span>
                  <h1>
                    {title}
                    <span className="accent">.</span>
                  </h1>
                  <p>All the music you love. A little more you.</p>
                </section>
                <section className="home-feature">
                  <div className="feature-copy">
                    <span className="eyebrow">YOUR LISTENING STARTS HERE</span>
                    <h2>
                      A mood.
                      <br />A moment.
                      <br />
                      <span className="accent">Your playlist.</span>
                    </h2>
                    <p>Find a song on Spotify and make it yours.</p>
                    <button className="primary-button" onClick={() => store.navigate('search')}>
                      <Search />
                      Explore Spotify
                    </button>
                  </div>
                  <div className="home-record">
                    <Artwork track={tracks.head?.value} className="feature-record" />
                    <div className="record-hole" />
                  </div>
                </section>
                <section>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">MADE BY YOU</span>
                      <h2>Your playlists</h2>
                    </div>
                    <button className="text-button" onClick={create}>
                      <Plus />
                      Create playlist
                    </button>
                  </div>
                  <div className="playlist-grid">
                    {renderNodes(store.library.playlists, (node) => (
                      <button
                        className="playlist-card"
                        key={node.id}
                        onClick={() => {
                          void store.openPlaylist(node.id).catch((error) => store.fail(error));
                        }}
                      >
                        <Artwork track={node.value.tracks.head?.value} />
                        <strong>{node.value.name}</strong>
                        <small>{node.value.tracks.size} tracks · Personal playlist</small>
                        <span className="card-play">
                          <Play fill="currentColor" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {store.page === 'library' && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR COLLECTION</span>
                    <h1>{title}</h1>
                    <p className="muted">Playlists made by you, saved in this browser.</p>
                  </div>
                  <button className="primary-button" onClick={create}>
                    <Plus />
                    Create playlist
                  </button>
                </div>
                <div className="playlist-grid">
                  {renderNodes(store.library.playlists, (node) => (
                    <button
                      className="playlist-card"
                      key={node.id}
                      onClick={() => {
                        void store.openPlaylist(node.id).catch((error) => store.fail(error));
                      }}
                    >
                      <Artwork track={node.value.tracks.head?.value} />
                      <strong>{node.value.name}</strong>
                      <small>{node.value.tracks.size} tracks</small>
                      <span className="card-play">
                        <Play fill="currentColor" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {store.page === 'search' && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">DISCOVER / SPOTIFY</span>
                    <h1>{title}</h1>
                    <p className="muted">Search songs, artists, or albums.</p>
                  </div>
                </div>
                <div className="search-field">
                  <Search />
                  <input
                    aria-label="Search Spotify"
                    type="search"
                    maxLength={200}
                    placeholder="What do you want to listen to?"
                    value={store.query}
                    onChange={(event) => store.setQuery(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="search-toolbar">
                  <span className="muted">
                    Adding to <strong>{store.library.active.value.name}</strong>
                  </span>
                  <PlacementControls />
                </div>
                {!store.auth.connected ? (
                  <div className="empty">
                    <Headphones />
                    <h2>Discover your sound</h2>
                    <p>Connect Spotify to search real songs and listen here.</p>
                    <button
                      className="primary-button"
                      onClick={() => {
                        void store.connect();
                      }}
                    >
                      Connect Spotify
                    </button>
                  </div>
                ) : store.searchLoading ? (
                  <div className="empty">
                    <AudioLoading />
                    <h2>Searching Spotify…</h2>
                  </div>
                ) : store.searchError ? (
                  <div className="empty">
                    <Search />
                    <h2>Search is unavailable</h2>
                    <p>{store.searchError}</p>
                    <button
                      className="secondary-button"
                      onClick={() => store.setQuery(store.query)}
                    >
                      Try again
                    </button>
                  </div>
                ) : store.results.size ? (
                  <>
                    <div className="section-heading">
                      <h2>Songs</h2>
                      <span className="muted">{store.results.size} results from Spotify</span>
                    </div>
                    <TrackRows list={store.results} search move={move} />
                  </>
                ) : (
                  <div className="empty">
                    <Search />
                    <h2>{store.query ? 'No songs found' : 'Something for every mood'}</h2>
                    <p>
                      {store.query
                        ? 'Try another song, artist, or album.'
                        : 'Type a song, artist, or album to begin.'}
                    </p>
                  </div>
                )}
              </>
            )}
            {store.page === 'playlist' && (
              <>
                <section className="playlist-hero">
                  <Artwork track={tracks.head?.value} className="playlist-cover" />
                  <div className="playlist-description">
                    <span className="eyebrow">PERSONAL PLAYLIST</span>
                    <h1>{title}</h1>
                    <p>A collection of moments, one song at a time.</p>
                    <div className="playlist-meta">
                      <span>
                        {tracks.size} {tracks.size === 1 ? 'track' : 'tracks'}
                      </span>
                      <span>·</span>
                      <span>{Math.ceil(totalDuration / 60000)} min</span>
                      <span>·</span>
                      <span>Made by you</span>
                    </div>
                  </div>
                </section>
                <div className="playlist-actions">
                  <div className="action-group">
                    <IconButton
                      label="Play playlist"
                      className="play-button hero-play"
                      onClick={() => {
                        if (tracks.head) void store.playNode(tracks.head, true);
                        else store.navigate('search');
                      }}
                      disabled={store.busy}
                    >
                      <Play fill="currentColor" />
                    </IconButton>
                    <IconButton
                      label="Shuffle playlist"
                      active={store.navigation.shuffle}
                      onClick={() => {
                        store.navigation.setShuffle(!store.navigation.shuffle);
                        store.changed();
                      }}
                    >
                      <Shuffle />
                    </IconButton>
                    <IconButton
                      label="Rename playlist"
                      onClick={() => {
                        setName(store.library.active.value.name);
                        setModal({ kind: 'rename' });
                      }}
                    >
                      <MoreHorizontal />
                    </IconButton>
                    <IconButton
                      label="Delete playlist"
                      onClick={() => setModal({ kind: 'delete' })}
                      disabled={store.busy}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <div className="action-group">
                    <button
                      className="secondary-button"
                      onClick={() => fileInput.current?.click()}
                      disabled={store.busy}
                    >
                      <Upload />
                      Import MP3
                    </button>
                    <button className="primary-button" onClick={() => store.navigate('search')}>
                      <Plus />
                      Add songs
                    </button>
                  </div>
                </div>
                <div className="playlist-subbar">
                  <span className="eyebrow">YOUR TRACKS</span>
                  <PlacementControls />
                </div>
                {tracks.size ? (
                  <TrackRows list={tracks} move={move} />
                ) : (
                  <div className="empty">
                    <ListMusic />
                    <h2>A good playlist starts with one song</h2>
                    <p>Search Spotify to add music, or import an MP3 you own.</p>
                    <button className="primary-button" onClick={() => store.navigate('search')}>
                      <Search />
                      Find a song
                    </button>
                    <small>Imported MP3s stay in this browser.</small>
                  </div>
                )}
              </>
            )}
            <Visualizer />
          </>
        )}
        <div className="content-footer">
          <span>lunara.</span>
          <small>Your music, connected.</small>
        </div>
      </main>
      <Queue />
      <PlayerBar />
      <NowPlaying />
      <input
        ref={fileInput}
        type="file"
        accept=".mp3,audio/mpeg"
        multiple
        hidden
        aria-label="Import MP3 files"
        onChange={(event) => {
          if (event.target.files) void store.importFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {store.notice && (
        <div className="toast" role="status">
          {store.notice}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.kind === 'create'
              ? 'Create a playlist'
              : modal.kind === 'rename'
                ? 'Rename playlist'
                : modal.kind === 'delete'
                  ? 'Delete this playlist?'
                  : 'Move song'
          }
          close={() => setModal(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (modal.kind === 'create') store.createPlaylist(name);
              else if (modal.kind === 'rename') store.renamePlaylist(name);
              else if (modal.kind === 'delete')
                void store.deletePlaylist().catch((error) => store.fail(error));
              else if (modal.kind === 'move') store.moveTrack(modal.node.id, position);
              setModal(null);
            }}
          >
            {modal.kind === 'delete' ? (
              <p>
                This removes “{store.library.active.value.name}” from your library. Your Spotify
                library is not changed.
              </p>
            ) : modal.kind === 'move' ? (
              <>
                <p>Move “{modal.node.value.title}” to a new position.</p>
                <label htmlFor="move-position">Position (1–{tracks.size})</label>
                <input
                  id="move-position"
                  type="number"
                  min="1"
                  max={tracks.size}
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  autoFocus
                  required
                />
              </>
            ) : (
              <>
                <label htmlFor="playlist-name">Playlist name</label>
                <input
                  id="playlist-name"
                  value={name}
                  maxLength={80}
                  placeholder="Give your playlist a name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoFocus
                />
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className={`primary-button ${modal.kind === 'delete' ? 'danger' : ''}`}
                type="submit"
              >
                {modal.kind === 'create'
                  ? 'Create playlist'
                  : modal.kind === 'delete'
                    ? 'Delete playlist'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function AudioLoading() {
  return <span className="loading-spinner" aria-hidden="true" />;
}
