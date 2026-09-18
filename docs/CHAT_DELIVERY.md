# Chat delivery repair

## What was broken

- Manually added friends had local `friend-*` IDs, while receivers listened on channels named after their authentication ID. Those addresses did not match. A message appeared in the sender's local history even when nobody could receive it.
- Direct messages used a one-shot, unchecked Supabase broadcast. There was no durable outbox, acknowledgement, retry state, or receiver receipt. The workspace has no configured Supabase environment; its client uses the placeholder URL. The connected Supabase workspace exposes an unrelated ZeroFinder project, which was not modified.
- InviteScreen rendered its redirect before its effect parsed the invite. App also dropped the inviter ID, and PlayScreen automatically treated pending links as accepted. Old profile-sharing links could not establish a real two-way contact.
- In-room chat sent every message with `senderId: 'me'`, including on the receiver. The receiver therefore rendered the other person's message as its own. Closed connections silently discarded sends.

## Implemented behavior

Friends now use the existing PeerJS/WebRTC capability rather than an unconfigured cloud broadcast. A random, stable identity is stored per signed-in or guest browser profile. Invite links include a private pairing token and the current origin. Explicit acceptance starts a token-validated handshake; both people become contacts. Display names are never routing addresses. Old name/avatar-only profiles remain visible as local profiles, with messaging disabled until connected through an invite.

Messages enter an account-scoped local outbox first. The sender shows **Waiting for partner**, then **Sending**, and **Delivered** only after the receiver has saved the message and acknowledged its ID. Interrupted delivery is retried on reconnect, IDs prevent duplicates, and unconfirmed sends expose a Retry control. Conversations are React state rather than an untracked localStorage read. Unread counts clear when the thread is actually open. Removing a contact clears their local conversation and persists a tombstone so reconnect cannot silently recreate them. Explicitly accepting a new invite can pair them again.

In-room chat identifies received messages as incoming, validates text, reports send failure without discarding the draft, and marks disconnected rooms immediately. The room provider cleans up peers on unmount, cancels old disconnect timers, and rejects a third connection while the pair is connected.

## Delivery limits shown in the interface

- Both paired browsers must have KnotYet open for direct-message delivery. If a person is away, queued messages stay in the sender's browser until both return.
- Contacts and history belong to this browser profile. They do not sync to a different device or survive clearing browser storage.
- The invitation grants access to this browser's chat identity. Share it with the intended person.
- This is not server-hosted offline messaging. Supabase account sync and Google sign-in still require the project's actual configuration. No unrelated cloud database was changed.
- WebRTC depends on network connectivity and the PeerJS signalling service. Tests below used two separate browser contexts on this machine; restrictive networks and real devices on separate networks were not tested.

## Verification

Run `node scripts/chat-check.mjs` against the dev server (`SMOKE_URL` defaults to `http://localhost:5174`). It creates two isolated synthetic guest clients and uses real PeerJS signalling/WebRTC, not a transport mock:

1. Generate an invite in Friends and accept it in the second browser.
2. Verify reciprocal contacts and online presence.
3. Send text and quick replies in both directions; verify receiver attribution and Delivered acknowledgement.
4. Close the recipient app, queue a message, reload the sender, reopen the receiver, and verify exactly one delivered message.
5. Verify unread increments while the modal is closed and clears when the thread opens.
6. Send a game invite, join the actual shared room, and exchange room messages in both directions.
7. Remove the contact, reconnect the other browser, and reload; verify the removed contact stays removed.

The complete flow passed. No messages were sent to real contacts and no production records were created. Screenshots: `artifacts/chat-two-clients.png` and `artifacts/chat-room-receiver.png`.

`node scripts/chat-ui-check.mjs` covers the redesigned drawers at 1366x768, 390x844, 320x640 and 844x390, including keyboard focus, local-only profiles, invitation controls, queued/failed statuses and retry. `npm run typecheck` passes.
