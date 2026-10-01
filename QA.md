# Lunara verification record

Date: September 30, 2026 (America/Bogota).

## Verified locally

- Dependencies installed from npm with lockfile; initial install reported no vulnerabilities.
- Strict TypeScript check and production frontend/backend build passed.
- 22 automated tests passed at the recorded run; see `npm test` for current output.
- Actual compiled frontend and Node API were started and inspected in the browser.
- Browser playlist creation and deletion were exercised in Lunara's independent storage namespace, including a second disposable QA playlist.
- Local MP3 import decoded an 8-second generated test fixture, parsed ID3v1 title/artist/album, and displayed actual duration.
- Browser audio playback emitted actual play/pause/timeupdate events and updated the progress UI.
- Beginning and intermediate insertion updated the linked nodes; multiple-file import was tested after fixing live FileList invalidation.
- Next/previous selected the adjacent nodes; Developer View showed matching current/previous/next.
- Reordering retained the current node's identity and updated head and neighbors.
- Removing the current node stopped its audio, selected the next neighbor and updated all pointers and size.
- Playlist renaming was verified in the sidebar and main heading.
- The queue displayed the active list's upcoming nodes and updated after playlist changes.
- Initial local MP3 QA had no captured console errors; the later live Spotify SDK test reported playback warnings, described below.
- Browser reload restored playlist metadata and MP3 references from IndexedDB.
- Mobile playlist and circular now-playing screen inspected at 390 × 844. The document had no horizontal overflow at that width.
- Desktop design inspected with original Lunara identity; no existing Auralis project was modified.

Only explicit test MP3s were used for local audio QA. They live in the chat's `work/` directory and are not part of the production source catalog.

## Published source

Project source is published to the independent public repository [johanstevenz1/lunara-music-app](https://github.com/johanstevenz1/lunara-music-app). No local environment file, token, dependency directory or QA audio fixture is included in the source delivery.

## Duplicate and playback regression fixes

- Repeated Add and Play of a Spotify search result now reuse one node identified by source URI; Queue next moves an existing node rather than duplicating it.
- The browser's existing Workshop playlist was cleaned from four nodes to two distinct tracks. Undo restored all four in their original order; cleanup was then reapplied.
- The search UI marks existing songs as added and disables the Add action.
- Delayed SDK events for the old URI cannot rewind the current node or pause the requested track. Polls begun before a track change cannot overwrite newer state.
- HTTP 204 is no longer treated as successful audio. Play waits for a matching unpaused SDK state; failures restore the cursor and unlock controls.
- Controlled tests cover these transitions, duplicate cleanup while a duplicate is current, exact order restoration, and unsupported protected audio.

## Live Spotify verification

The development callback is now registered. Authorization Code with PKCE completed, profile retrieval succeeded, arbitrary Spotify searches returned real results, and the SDK reported a ready Lunara device.

Lunara's SDK emitted repeated generic `playback_error` messages for Basket Case and Sin Tu Amor in the Codex embedded browser. Chromium protected-media capability detection passed; this does **not** establish that protected streaming works inside the SDK iframe. The official Spotify web player in the same browser was able to select its own device and advance Basket Case's position beyond 20 seconds. This contrast does not establish a DRM, account, track or network cause for the SDK error.

Sustained audio and real Next/Previous transitions in Lunara remain unverified. Test the app in a current external Chrome, Edge, Firefox or Safari browser with a ready Spotify device. Do not describe the controlled SDK tests as proof of audible streaming.

## Automated test boundaries

Spotify OAuth, search API and SDK behavior are tested with controlled responses. These tests verify state transitions, URI/device forwarding and error handling; they do not prove real account authorization, DRM audio or cloud connectivity.

## Still requiring external access

- Vercel frontend deployment and Railway backend deployment, explicitly deferred by the user.
- Exact production URL and HTTPS verification.
- Production callback registration and professor/test-account allowlist.
- Audible Premium streaming and full production playback checks.
- Production testing in a clean browser session.

Do not mark the cloud application or Spotify streaming complete until those checks are performed.
