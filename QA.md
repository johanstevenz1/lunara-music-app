# Lunara verification record

Date: September 30, 2026 (America/Bogota).

## Verified locally

- Dependencies installed from npm with lockfile; initial install reported no vulnerabilities.
- Strict TypeScript check and production frontend/backend build passed.
- 15 automated tests passed at the recorded run; see `npm test` for current output.
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
- No errors or warnings were present in the captured browser console logs.
- Browser reload restored playlist metadata and MP3 references from IndexedDB.
- Mobile playlist and circular now-playing screen inspected at 390 × 844. The document had no horizontal overflow at that width.
- Desktop design inspected with original Lunara identity; no existing Auralis project was modified.

Only explicit test MP3s were used for local audio QA. They live in the chat's `work/` directory and are not part of the production source catalog.

## Automated test boundaries

Spotify OAuth, search API and SDK behavior are tested with controlled responses. These tests verify state transitions, URI/device forwarding and error handling; they do not prove real account authorization, DRM audio or cloud connectivity.

## Still requiring external access

The live OAuth attempt reached Spotify's authorization endpoint with the supplied Client ID, S256 challenge and requested scopes. Spotify returned `redirect_uri: Not matching configuration` for `http://127.0.0.1:43730/callback`. That exact callback must be registered before the local Premium-account test can proceed.

- GitHub repository creation/push.
- Vercel frontend deployment and Railway backend deployment.
- Exact production URL and HTTPS verification.
- Spotify Developer Dashboard callback registration and test-user allowlist.
- Real Spotify authentication, profile retrieval, arbitrary live searches and ready device.
- Audible Premium streaming and full production playback checks.
- Production testing in a clean browser session.

Do not mark the cloud application or Spotify streaming complete until those checks are performed.
