# Lunara project instructions

This project implements the user's Music Player / Doubly Linked List + Spotify workshop requirements. The full requirements were supplied in the chat. These instructions preserve their critical implementation and verification constraints for future changes.

## Scope

- The application is named **Lunara**. It is independent from Auralis.
- Never open, modify, overwrite or deploy an existing Auralis project as part of this task.
- Use TypeScript in strict mode. Source identifiers, comments and documentation are in English.
- Preserve the supplied dark/green reference design, circular mobile player, responsive desktop sidebar and persistent controls.

## Academic structure

- `DoublyLinkedList<T>` and `ListNode<T>` must remain original implementations.
- Playlists and the active queue must be genuine linked nodes with previous/next pointers, head, tail, current and size.
- Forward/backward navigation must follow current.next/current.previous.
- Support beginning/end/arbitrary insertion, all removal cases, reordering and current-node identity.
- Never replace a playlist with an array or third-party data structure.
- Arrays are allowed only at API/render/export/test boundaries, consistent with the supplied specification.
- Developer View must reflect live nodes, not a disconnected demonstration.

## Real playback

- Spotify is the primary source, using the official Web API, PKCE OAuth and Web Playback SDK.
- Never ship a hard-coded song catalog, fake authentication, simulated progress or placeholder playback.
- Local MP3 is the secondary source explicitly requested by the user.
- Handle state synchronization, automatic advance, shuffle history, repeat modes, readiness, account errors, expiry and browser autoplay restrictions.
- Shuffle must retain the original list and avoid immediate repetition.
- Never commit secrets or tokens. Tokens are runtime data; environment files must be ignored.

## Delivery and verification

- Target Vercel for the frontend and Railway for the API, with new Lunara projects.
- Deliver source, README, environment example, deployment/configuration instructions, repository and a public HTTPS URL once access permits.
- Run TypeScript checks, meaningful tests, production build, startup and browser checks after functional changes.
- Verify desktop/mobile, empty/error/loading states, keyboard controls and actual node operations.
- Never claim live Spotify playback, production OAuth, GitHub publication or cloud deployment unless actually verified.
- Record external blockers and verification boundaries in QA.md. Account access and the Spotify callback registration are currently pending.
