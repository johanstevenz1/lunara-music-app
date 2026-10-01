# Lunara — Doubly Linked List + Spotify

A responsive music application for the TypeScript double-list workshop. Lunara is an independent project. It does not import, modify, or deploy any existing Auralis application.

## Delivery status

- Production URL: **deployment to Vercel and Railway deferred by the user; no public application URL yet**.
- GitHub repository: [johanstevenz1/lunara-music-app](https://github.com/johanstevenz1/lunara-music-app).
- Strict TypeScript and production build: verified locally.
- Automated tests: run `npm test`; they include controlled Spotify responses, not a live Premium account.
- Spotify OAuth, profile, live search and SDK readiness: verified with the authorized account.
- Real Spotify streaming: implemented; **sustained audio is not yet verified in Lunara**. The SDK reports a generic playback error in the embedded test browser; see `QA.md`.
- See `QA.md` for the exact checks performed and `DEPLOYMENT.md` for cloud configuration.

## Features

- Original generic doubly linked list with head, tail, current, size, and real bidirectional links.
- Create, rename, open, and delete personal playlists.
- Insert at beginning/end or a user-selected position; remove and reorder tracks.
- Adding or playing an existing search result reuses its linked node. Queueing it moves the same node. Legacy duplicates can be cleaned up with Undo.
- Spotify OAuth Authorization Code with PKCE, CSRF state verification, expiry handling, refresh deduplication, and logout.
- Spotify profile, arbitrary song/artist/album search, artwork, title, artist, album, and duration.
- Debounced search, cancellation, short-lived bounded caching, and clear loading/empty/error states.
- Real Spotify Web Playback SDK device, play/pause, seek, volume/mute, actual state events and polling.
- Automatic advance, three repeat modes, shuffle history and no immediate shuffle repetition.
- Visible queue based on the active doubly linked list. Search result “Queue next” inserts after the current node.
- Developer View displays actual node links, head/tail/current, previous/next, and size.
- Secondary MP3 import, ID3v1 metadata parsing, browser audio playback and persistent local blobs.
- Responsive desktop/sidebar/player and mobile circular now-playing layout inspired by the supplied reference.
- Keyboard shortcuts: Space toggles playback; Escape closes overlays/dialogs. Form controls retain normal keyboard behavior.

## Technologies

React 19, strict TypeScript, Vite 7, Tailwind CSS 4 with original CSS, Lucide icons, Node.js built-in HTTP server, IndexedDB, Node's test runner. No third-party list, queue, stack, or playback library implements the playlist logic.

## Architecture

```text
src/
  core/list.ts         Original ListNode<T> and DoublyLinkedList<T>
  core/library.ts      Playlist domain model and linked persistence records
  core/navigation.ts   Repeat, shuffle and playback history
  services/auth.ts     PKCE authorization and token renewal
  services/search.ts   Real Spotify search and bounded cache
  services/player.ts   Web Playback SDK and secondary local audio
  services/importAudio.ts  Original MP3 header/ID3v1 parsing
  storage.ts           IndexedDB transactions
  store.ts             Application actions and playback synchronization
  components.tsx       Reusable interface controls
  App.tsx              Home/search/library/playlist screens
  styles.css           Responsive visual system
server/
  app.ts               Validated authenticated Spotify proxy
  index.ts             Environment validation and HTTP startup
tests/                 Structure, navigation, OAuth, SDK and API tests
```

The Vercel frontend authenticates directly with Spotify using PKCE. A Railway API proxies bounded, authenticated Spotify searches, profile requests and device-targeted playback commands. Tokens are forwarded over HTTPS and are not stored or logged by the backend.

## Doubly linked list

```text
null ← A ⇄ B ⇄ C → null
             ↑
           current
```

Every playlist is a `DoublyLinkedList<Track>`. The collection of playlists, search results, cache, observers, batch imports and shuffle history also use the original linked structure.

Normal forward navigation reads `current.next`; reverse navigation reads `current.previous`. The UI never navigates a playlist using array indices. Reordering reconnects the same node and preserves its identity, including the current node. Removing the current node selects its next neighbor or previous neighbor; removing the only node clears current/head/tail. The playback coordinator stops the removed song and, if playback was active, starts the replacement.

Required methods are present: `append`, `prepend`, `insertAt`, `removeAt`, `remove`, `find`, `next`, `previous`, `clear`, `toArray`, `getSize`, `isEmpty`. `at`, `insert`, and `move` support indexed edits. The UI uses positions starting at 1; the structure uses positions starting at 0.

Arrays appear only at external protocol/render/export/test boundaries, as allowed by the supplied AGENTS.md: Spotify JSON, React's rendered children, SDK data, tests, and `toArray()`. `toArray()` is an export helper and is not used to store or navigate production playlists. Typed byte buffers are needed by SHA-256 PKCE and MP3 parsing.

Normal next/previous are O(1). Finding a node is O(n); indexed lookup starts from the nearer end. Append/prepend pointer updates are O(1), but insertion also checks ID uniqueness in O(n). Shuffle scans its separate history, preserving the original order and links. History supports backward and forward navigation; repeat-off stops when the shuffle cycle is exhausted.

## Spotify authentication and playback

1. The app creates a random PKCE verifier, SHA-256 challenge and random `state`.
2. Only the short-lived pending verifier/state/redirect are kept in `sessionStorage` until callback.
3. The callback validates state and a ten-minute expiry before exchanging the code.
4. Access/refresh tokens are held **only in runtime memory**, never hard-coded, committed, placed in URLs, or stored in IndexedDB/localStorage.
5. `getToken` renews before expiry and shares concurrent refresh attempts. API 401 responses trigger one renewal/retry.
6. After profile retrieval, the actual official Spotify SDK creates a device named **Lunara**.
7. A user click activates the audio element; playback sends the selected node's real URI to `/me/player/play?device_id=...`.
8. SDK events and `getCurrentState()` update progress. A one-second poll reads actual SDK state; it does not manufacture elapsed playback.
9. Shuffle and repeat choose application nodes and send their URIs to Spotify. They do not replace the domain structure with Spotify's native queue.

Playback requests wait for the matching, unpaused SDK track rather than assuming HTTP 204 means the song is playing. Late events for an old URI and polls started before a transition are ignored. Failed transitions unlock the controls and restore the previous cursor. Chromium browsers are checked for protected-audio capability before connecting the SDK; passing this check alone does not prove successful streaming.

Scopes: `streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state`.

Because tokens are kept in memory, refreshing or reopening the page requires connecting Spotify again. Your app playlists and local MP3s survive browser reloads.

## Environment variables

Copy `.env.example` into `.env.local` for development. Vite reads `.env.local`; the development API loads it automatically. These files are ignored by Git and Docker.

| Variable                 | Location                     | Purpose                                               |
| ------------------------ | ---------------------------- | ----------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`      | Railway/local API            | Public application identifier                         |
| `FRONTEND_ORIGIN`        | Railway/local API            | Exact allowed frontend origin, without trailing slash |
| `PORT`                   | Railway/local API            | HTTP listen port; Railway may provide this            |
| `VITE_API_URL`           | Vercel build                 | Railway HTTPS API origin, without trailing slash      |
| `VITE_SPOTIFY_CLIENT_ID` | Vercel/local build, optional | Public ID; otherwise obtained from API `/config`      |
| `VITE_DEV_PORT`          | Local, optional              | Default 5173; this chat's preview uses 43730          |

No Client Secret is used by PKCE. Do not add one to a `VITE_` variable. Public Client ID supplied for this project: `063552a8b317485b922392717dc4159e`.

The callback is constructed from the active frontend origin plus `/callback`; production never contains a hard-coded localhost callback.

## Local development

Use Node.js 22.12+ (recommended: Node 22 LTS) and npm.

```sh
npm ci
npm run dev:api
```

In another terminal:

```sh
npm run dev
```

Defaults: frontend `http://127.0.0.1:5173`, API port 3001. Use `127.0.0.1` for the Spotify redirect URI: Spotify does not accept `localhost` as a redirect host. With this chat's `.env.local`, frontend/API ports are 43730/43731.

For a production build preview:

```sh
npm run build
npm run preview -- --port 43730 --strictPort
```

The API must also be running. A local preview is for development/QA and is not the cloud delivery.

## Spotify Developer setup

In the existing application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

1. Verify that this Client ID belongs to the Spotify application you want Lunara to use.
2. Enable the Web API and Web Playback SDK.
3. Add the exact development callback matching the frontend port. For this preview: `http://127.0.0.1:43730/callback`. Default developer setup: `http://127.0.0.1:5173/callback`.
4. After deployment, add `https://YOUR-STABLE-VERCEL-DOMAIN/callback` exactly.
5. In Development Mode, add the Premium test users, including the professor's account, to the application's allowed users.
6. Connect Spotify from Lunara and approve the requested playback scopes yourself.
7. Wait for **Player ready**, search an arbitrary song, add it, and press Play.

An invalid redirect is fixed in the Developer Dashboard, not by inserting a secret into the frontend. Follow Spotify's current [redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) and [SDK guide](https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started).

## Cloud deployment

Use Vercel for the frontend and Railway for the backend as requested. See `DEPLOYMENT.md` for exact settings and verification. `vercel.json`, `railway.json` and a multi-stage non-root Dockerfile are included. The backend uses only built-in Node modules at runtime.

## Testing and demonstration

```sh
npm run check
npm test
npm run build
```

Tests cover list operations and bidirectional invariants; current-node removal; linked snapshot restoration; shuffle history/repeat; PKCE challenge/state validation/token refresh; device-targeted SDK commands/state/seek/volume/end detection; API origin checks, request validation and sanitized rate-limit errors. Regression tests exercise repeated Add/Play, existing-track queue moves, late SDK events and polling results, failed Next, protected-audio failure, and reversible duplicate cleanup.

To demonstrate the workshop: connect Spotify, create a playlist, search and add three songs using each insertion mode, open Developer View, press Next/Previous, reorder and remove the current song, inspect the queue, then show shuffle/repeat. Import an owned MP3 as a secondary source and navigate between the Spotify and local nodes. Verify the production URL in a clean browser before presenting.

## Known limitations

- Local OAuth, profile, search and a ready SDK device have been verified. Sustained Lunara streaming and Next/Previous with live audio still require verification in an external supported browser. The generic SDK error observed in the embedded browser does not identify its cause; the official Spotify web player advanced in that same browser. Unit mocks are not evidence of live streaming.
- The app's playlists and MP3s are browser-local, not cloud-synchronized and not exported into Spotify's own playlists. Another browser/device has its own library.
- MP3 tags use the original ID3v1 parser; files with only newer ID3 tags fall back to the filename.
- MP3 import is limited to 50 MB per file and browser storage availability. Clearing site data removes local songs/playlists.
- Browser autoplay/DRM restrictions can require another Play click or a supported browser. The UI reports SDK readiness, errors and autoplay failures.
- Spotify app Development Mode has account/allowlist restrictions. These are Spotify platform constraints; public hosting does not remove them. Consult [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).
- Cloud URLs and live production playback must be verified after account access and deployment. They are intentionally not claimed here.
