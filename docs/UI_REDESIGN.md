# KnotYet UI audit and redesign

## Review and improvements — 16 November 2026

This review covers the current public deck, game picker, saved gameplay, account lifecycle, and cloud chat implementation. The older sections below are historical notes; their guest-entry, environment, and peer-only chat descriptions should not be treated as current behavior. The current app gates `/play` behind sign-in and stores direct messages in Supabase.

### User experience changes

- **Free deck:** a compact introduction, themes beside the card on desktop, and a compact theme row on phones bring the activity closer to the top of the page. The cream, purple, lime, and outlined arcade styling is retained.
- **Save cards:** bookmark individual prompts and filter the library to saved cards, with an actionable empty state. Only card identifiers are stored in this browser; no answers are collected by this feature.
- **Resume and navigate:** the selected card, asking player, and follow-up state survive refresh within the same tab. Previous restores the preceding question. Choosing the already-active theme no longer resets the conversation. Invalid or blocked browser storage falls back safely.
- **Complete a deck:** the sixth card leads to a deliberate completion view with a new-theme action and replay, rather than unexpectedly looping. Follow-up toggles retain focus, library selections move focus to the player, and completion transitions keep keyboard users in the activity.
- **Choose a game:** full titles replace ambiguous mobile abbreviations. The two-column phone picker provides larger targets, and “Surprise me” selects a different available offline game without immediately starting it.
- **Free arcade:** `/arcade` offers Memory Match and Story Builder without signing in. Both also appear in the signed-in game picker; they are clearly described as solo/same-screen games, with no unsupported online mode.
- **Memory Match:** shuffled 6/8-pair boards, solo or cooperative turns, explicit mismatch dismissal, accessible card labels, progress recovery, and a completion summary.
- **Story Builder:** six original starters, alternating authors, editable names/title, eight-line or early completion, undo, draft recovery, copy, and a downloadable text story. Destructive resets require confirmation; ending unrelated games preserves saved creations.
- **Game library:** nine-game catalog, search, mood filters, solo filtering, browser-saved favourites, recent games, useful empty states, and focus-contained navigation. Landing cards show approximate durations and supported play modes.
- **Chat:** people search, persistent drafts, durable account-scoped unsent messages, retry/discard actions, and scroll-preserving earlier-message loading.

### Bugs repaired

| Severity | Before | Result |
| --- | --- | --- |
| High | Account bootstrap, progress, and couple requests could resolve after sign-out/account change and repopulate stale state. Failed loading could leave a spinner. | Account identity/version guards reject obsolete results; loading settles on errors. |
| High | Queued question-history RPCs could run under the next signed-in account. | Each account has its own queue and abort signal; old requests and late results are discarded. |
| High | Chat polling replaced local conversation state, losing failed messages and their Retry controls. | Server messages merge by ID, preserving pending/failed messages and read receipts. Rejected sends become retryable failures. |
| Medium | Chat fetched the oldest 1,000 messages across all contacts, eventually omitting new replies and crowding out quieter conversations. | Fetch 50 messages per conversation with a stable timestamp/ID cursor, load earlier pages on demand, and count unread messages independently of the loaded page. |
| High | Rapid rewards and daily-count resets wrote stale absolute totals; both peers awarded the same shared result. | Conditional compare-and-swap updates retry confirmed conflicts, local queues preserve order, and only the host awards a shared couple when the room participant matches the other member. Uncertain network failures are surfaced instead of blindly replayed. |
| High | Legacy migration could overwrite newer cloud progress and mark failed imports complete. | Preserve cloud profile details, merge points with max, union question history through the existing atomic RPC, claim the cache for one account, and mark complete only after successful writes. Concurrent realtime refreshes share one in-flight import; failures can resume. |
| Medium | Failed question history was marked locally seen with no later retry. | Account-scoped pending IDs retry on reconnect, focus, or the next login; old accounts cannot replay into new ones. |
| Medium | Saved contacts were all presented as online; duplicate realtime events inflated unread counts; hidden tabs could mark messages read. | Presence remains unknown until known, labels say “Connected account,” duplicates do not add unread counts, and hidden threads do not mark messages read. |
| Medium | Quiz/Match restored indices, stages, and completion independently of their decks. | Validate deck, answers, index, stage, and completion together; incomplete saves restart cleanly. |
| Medium | One damaged history cache discarded its healthy companion; reset missed Number winner and Letter round keys. | Parse each history source independently and reset the missing keys. |
| Medium | JSON `null` in intro state crashed the picker; an online-only saved game left no offline selection. | Validate intro shape and restore an available offline game. |
| Medium | Held keys advanced multiple cards; gameplay shortcuts ran behind a disconnected-partner overlay. | Ignore repeated/composing keys and pause shortcuts under the overlay. Leave-room dialogs now contain and restore keyboard focus. |

### Verification

The follow-up review also repaired these reproducible issues:

- Number Guesser and Letter Race lost shared turn/countdown/result state after refresh. Room-scoped snapshots and host synchronization now restore the current round and reject stale updates.
- Completing an Icebreaker deck could leave the last card stuck after choosing the same category, trap a guest without an exit, or leave a dialog over the lobby. Completion now contains keyboard focus, offers explicit exits, respects host restart authority, and pauses beneath reconnect UI.
- Malformed peer packets could reach game handlers unchecked; duplicate room-chat packets increased unread counts; an old leave timer could close a newly joined room. Incoming protocol validation, message deduplication, and connection-specific cleanup cover these cases.
- Chat refreshes after more than 50 incoming messages could leave an unreachable history gap. Pagination now re-anchors safely, and per-message outbox records prevent concurrent browser tabs from overwriting one another's unsent messages.
- Blocked browser storage could interrupt account transitions or invitation acceptance. Cache operations are optional, and restored invitation data is validated before use.
- Profile edits previously reported success before the cloud write completed and could later revert to stale account data. Saving now waits for confirmation, refreshes the canonical profile, preserves unsaved edits on failure, and guards late responses after account changes.
- Filter/reset actions removed focused UI controls, some library touch targets were too small, and long story author names overflowed phones. Focus destinations, 44px targets, accurate filtered-empty messages, and wrapping names address these issues.

Run a Vite server with `npm run dev -- --host 127.0.0.1 --port 5174`, then use:

```powershell
npm run build
npm run test:public
npm run test:games
npm run test:accounts
npm run smoke
```

The new public-deck regression checks cover saving/removing, refresh, previous/turn order, completion, reselecting themes, focus, malformed/restricted storage, and 320/390/768/1440px layouts. Navigation fixtures cover five widths plus short laptop viewports. Screenshots are under `artifacts/public-deck/`, `artifacts/upgrade/`, `artifacts/local-activities/`, `artifacts/library-*.png`, and `artifacts/chat-upgrade-*.png`. The gameplay suite includes local activities, concurrent progress writes, midnight resets, migration retries, saved-session recovery, account-switch history, and existing game logic checks. Public smoke coverage uses actual routes; provider fixtures use controlled cloud responses.

Auth/chat regression fixtures exercise the actual providers with controlled responses, including late bootstrap, sign-out during reads, latest-history ordering, failed/retrying sends, read receipts, and contact refresh races. These establish client behavior; they do not verify production RLS, a live Google OAuth round-trip, or real account delivery. No hosted data, schema, or deployment was changed.

The legacy `scripts/chat-ui-check.mjs` fails at its removed “Start playing” guest CTA and seeds the retired local chat store. It has not been treated as a passing check; the new account/chat suite verifies the current providers and FriendsModal at 320/390/1366px, including focus containment/restoration and enabled invitations for connected contacts.

The older `profile-check.mjs` and `profile-states-check.mjs` also target retired guest/unsigned-invite flows. Current profile saving is covered by `profile-save-check.mjs` using the real providers and screens, including failed saves, retry, setup, account switching, and canonical profile refresh.

### Remaining production boundaries

1. **Live verification:** exercise sign-in, invite acceptance, account switching, message retry/read receipts, and room reconnect with two dedicated test accounts against deployed database policies. Local fixture checks do not establish these production guarantees.
2. **Authoritative reward ledger:** conditional writes fix lost updates, but a transport error can still leave the client uncertain whether a reward committed. Exactly-once retry across devices needs server-owned event IDs and an idempotent reward endpoint. Peer profile IDs support normal game association; they are not a security boundary or proof of identity. Database policies remain responsible for access control.
3. **Device-local recovery:** chat outbox/drafts and saved favourites remain on this browser. Story/Memory progress remains in the current tab. These features deliberately explain where data is retained; they do not promise cross-device sync.

Supabase API behavior was checked against its [auth event documentation](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) and installed client types while reviewing account lifecycle and cancellation.

## Project structure

KnotYet is a React 18 / TypeScript / Vite application. Tailwind utilities, Lucide icons, Framer Motion, and canvas-confetti support its interface and game feedback; no additional UI framework was needed.

| Area | Responsibility |
| --- | --- |
| `src/App.tsx` | Public landing, protected `/setup` and `/play`, and partner `/invite` routes. |
| `AuthContext` / `GameContext` | Google sign-in through Supabase, local guest entry, player/partner profiles, language, and progress. |
| `PlayRoute` / `PlayScreen` | Lazy-loaded games, game selection, session controls, friends and room surfaces. |
| `MultiplayerContext` | PeerJS room connections and synchronized game messages. |
| `src/data/questions.ts` | Converts the Malaysian/Malay question dataset into playable cards, quizzes, and wheel topics. |

Seven games are exposed in the main picker: Icebreaker Cards, Guess My Heart, Spin Wheel, Number Guesser, Letter Race, Couple Match, and This or That. The connected-room lobby adds Secret Number Race for eight online choices.

The refreshed English bank contains 152 conversation cards, 40 Guess My Heart prompts, 72 Couple Match prompts, 86 wheel prompts, and 32 This or That choices. Shared prompts reuse stable IDs across games, while rewritten content has fresh IDs so earlier history does not hide it. Content checks reject blanks, duplicate prompts, repeated options, source markers, and leftover Malay playable text.

## Design changes

- Replaced the understated landing with a colorful date-night arcade: cream background, violet/pink/lime accents, bold outlines, tactile button shadows, Outfit headings, and DM Sans body text.
- Added shared lightweight vector/CSS game artwork, a two-character mascot, interactive question preview, mood filters, and direct game launch tiles.
- Rebuilt the play shell and game introductions around distinct mode colors, clearer player actions, and responsive layouts. The existing game mechanics and persistence remain in place.
- Refreshed profile setup, character selection, partner-room entry, online-room UI, and the connected lobby. Added labeled inputs, keyboard focus treatment, dialog focus containment/restoration, numeric room-code entry, and reduced-motion styles.

The visual audit also identified conflicting global shortcuts: quiz answer digits overlapped mode selection, and some game handlers consumed Enter/Space intended for focused buttons. The UI follow-up addresses these conflicts and clarifies the automatically generated secret number instructions.

## Game cards, window fit, reactions, and chat

The follow-up unifies all eight game surfaces: conversation-card fronts and reveals, heart/match questions and choices, wheel prompts, number feedback, letter-race controls, This or That, and Secret Number Race. Questions use Outfit, as do the interface headings and buttons. Platform emoji avatars and reaction decorations are replaced with drawn SVG characters and consistent Lucide icons. Existing avatar IDs are preserved.

On laptop-sized windows, the console uses a centered 1,180px maximum width and follows the available viewport height up to 820px, keeping wide screens from stretching the game panels. A compact lobby keeps the Start button visible; active games use the main console directly instead of a second bordered panel. Quiz and Match put the question and choices side by side. End Game and a sound toggle sit beside the session timer. Mobile layouts retain readable text, touch targets, and scrolling where content needs it.

GIPHY reactions are restored for results, number hints/wins, and letter-race wins. The shared reaction component includes attribution, pause/play, still frames for reduced motion, and a local illustration fallback if the network image fails. Result dialogs show complete answers, contain keyboard focus, and render above the entire viewport.

Audio uses cheerful synthesized plucks/pops and a short major-key victory tune. All effects share a master mute; effect volume and mute survive reload. Sound can also be muted from the active-game top bar.

Friends and room chat now use the same visual system, with a desktop conversation sidebar, a mobile thread view, fixed message composer, delivery/retry states, and clear distinction between a saved local profile and a connected person. See [CHAT_DELIVERY.md](CHAT_DELIVERY.md) for the delivery repair and live two-client verification.

## Verification

From the project directory:

```powershell
npm run check
npm run dev -- --host 127.0.0.1 --port 5174
```

With that server running, use a second terminal:

```powershell
npm run test:games
npm run smoke
```

`npm run test:games` covers the question bank, saved history, introductions, all local player modes, synchronized actions, This or That, and the shared wheel/card flows.

`npm run smoke` runs the public, account/chat, invite, profile-save, and multiplayer UI/recovery scripts listed in `scripts/smoke.mjs`. It defaults to the Vite server on port 5174 and Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Set `SMOKE_URL` or `CHROME_PATH` to override these defaults. The development server must already be running. See [the November 16 live QA notes](LIVE_QA_2026-11-16.md) for the Number Guesser readjustment, current verification layers, and production findings. Older environment and feature notes below describe their original verification sessions.

The browser sweep passed at **320×740, 390×844, 768×1024, 844×390 landscape, and 1440×1000**. The final sweep also passed against the compiled production bundle served with `vite preview` on port 4174; those screenshots are in `artifacts/production/`. Checks cover landing filters (5/2/3 games), keyboard question preview, all five direct launch tiles, guest entry, partner-room launch, room input/focus/Escape behavior, every game introduction, card advancement, and phone quiz handover/reveal, wheel results, number feedback, and letter-race completion. No uncaught page exceptions, horizontal overflow, or horizontally clipped primary game controls were observed.


Targeted UI fixtures also passed at 320px and 1440px: room-code focus remains stable across a 1.5-second parent-clock update; focus trapping, Escape, and scroll restoration still work. In the connected lobby, all eight host game buttons are enabled, guest game buttons remain host-controlled, Enter/Space invoke the expected callbacks, and waiting/leave-room controls work. Controls meet 44px sizing with no horizontal overflow or uncaught page errors.

These additional local fixtures can be rerun against the Vite development server:

```powershell
node artifacts/verify-onboarding.mjs
node artifacts/verify-lobby.mjs
```

The lobby fixture replaces the multiplayer hook only inside an isolated browser context and uses the real GameProvider. It validates the lobby UI and callbacks; it does not establish a live PeerJS connection.

Before/after screenshots are written to `artifacts/`. Files ending in `landing-initial.png` capture the landing before interacting with its question preview. These checks use desktop Chrome and emulated viewport/touch settings; they do not constitute physical-device or Safari/Firefox certification.

## Additional checks

With the development server running:

```powershell
node scripts/laptop-fit-check.mjs
node scripts/card-sound-check.mjs
node scripts/connected-card-check.mjs
node scripts/reactions-check.mjs
node scripts/chat-ui-check.mjs
node scripts/chat-room-ui-check.mjs
node scripts/chat-check.mjs
```

The picker and introduction sweep checks all seven offline modes at 320, 390, 1024, and 1440 pixels wide. The broader laptop sweep covers the original game surfaces and top-bar controls at **1536x695, 1366x650, 1280x600, 1024x600, 1440x900, and 1920x880**. Checked scenes fit without horizontal overflow; short windows use dedicated content scrolling where needed.

Connected-card fixtures cover Couple Match and simultaneous conversation answers at 320px and 1440px. These particular fixtures simulate a partner. Separately, the chat suite uses two isolated browser sessions with real PeerJS signaling/WebRTC to verify invitation acceptance, message receipt/acknowledgement, offline queue/reload/reconnect, deduplication, unread counts, joining a shared game room, and both directions of room chat.

## Profile refresh

The profile now opens in a centered, 1,040px arcade frame, with a pink player pass, a lavender heart-point panel, separate partner/chat tiles, and an account strip. The main dashboard fits at 1280x600 and 1536x695 without scrolling. Phones use a readable single-column layout. The edit view includes a live character/name preview; invitation and confirmation screens use the same styling. Keyboard focus stays inside the profile, Escape returns through subviews, and closing returns focus to the lobby control.

Guest accounts are labelled as browser-local profiles rather than cloud-synced accounts. Guest names, characters, and heart points now restore from local storage on refresh; starting a new guest session saves its own defaults. Guest profile/progress changes no longer attempt cloud writes. The profile keeps Google sign-in available when the cloud environment is configured. Live OAuth and cloud unlinking remain unverified in this checkout because that environment is absent.

Run `node scripts/profile-check.mjs` for dashboard, edit/save/cancel, refresh persistence, invitation creation/copy, cancelled sharing, chat navigation, and keyboard checks at 1536x695, 1280x600, 768x1024, 390x844, and 320x740. `node scripts/profile-states-check.mjs` checks local partner display/unlink/cancel, clipboard denial fallback, focus trapping, guest sign-out, and a fresh guest reload. Native sharing is stubbed in isolated test browsers; no invitations are sent to real contacts. The partner-state check uses a local fixture, not a cloud account.

## External flows and limits

Google OAuth, new cloud-profile creation, and cloud progress persistence were not verified. This checkout has no configured Supabase environment; the connected Supabase account did not contain a matching KnotYet project, so no unrelated database was changed.

Friend chat pairs browser profiles through invitation links. Both apps must be open together for delivery; queued messages/history remain in this browser, rather than a cloud inbox. Previously saved manual profiles need a new invitation to establish a real connection. Browser/device changes require pairing again. Details and test commands are in the chat delivery notes.

Google-hosted fonts, GIPHY, advertising, and PeerJS signaling still depend on network availability. Font and reaction-image fallbacks are configured. Verification used Chrome with several viewport/touch settings and two real browser sessions; it is not physical-device or Safari/Firefox certification.
