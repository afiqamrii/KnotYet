# KnotYet UI audit and redesign

## Project structure

KnotYet is a React 18 / TypeScript / Vite application. Tailwind utilities, Lucide icons, Framer Motion, and canvas-confetti support its interface and game feedback; no additional UI framework was needed.

| Area | Responsibility |
| --- | --- |
| `src/App.tsx` | Public landing, protected `/setup` and `/play`, and partner `/invite` routes. |
| `AuthContext` / `GameContext` | Google sign-in through Supabase, local guest entry, player/partner profiles, language, and progress. |
| `PlayRoute` / `PlayScreen` | Lazy-loaded games, game selection, session controls, friends and room surfaces. |
| `MultiplayerContext` | PeerJS room connections and synchronized game messages. |
| `src/data/questions.ts` | Converts the Malaysian/Malay question dataset into playable cards, quizzes, and wheel topics. |

Five games are exposed in the main picker: Icebreaker Cards, Guess My Heart, Spin Wheel, Number Guesser, and Letter Race. The connected-room lobby offers six games, including Couple Match.

The data audit found 623 conversation-card records: 352 riddles, 115 vibe checks, 124 mature discussion prompts, and 32 challenges. These contain 617 distinct question texts and no blanks. All 80 heart quizzes have four choices; 25 Match prompts are valid. The wheel adds 18 prompts. The five public modes therefore contain 721 prompt records; including Match gives 746. Existing duplicate text was preserved.

## Design changes

- Replaced the understated landing with a colorful date-night arcade: cream background, violet/pink/lime accents, bold outlines, tactile button shadows, Outfit headings, and DM Sans body text.
- Added shared lightweight vector/CSS game artwork, a two-character mascot, interactive question preview, mood filters, and direct game launch tiles.
- Rebuilt the play shell and game introductions around distinct mode colors, clearer player actions, and responsive layouts. The existing game mechanics and persistence remain in place.
- Refreshed profile setup, character selection, partner-room entry, online-room UI, and the connected lobby. Added labeled inputs, keyboard focus treatment, dialog focus containment/restoration, numeric room-code entry, and reduced-motion styles.

The visual audit also identified conflicting global shortcuts: quiz answer digits overlapped mode selection, and some game handlers consumed Enter/Space intended for focused buttons. The UI follow-up addresses these conflicts and clarifies the automatically generated secret number instructions.

## Game cards, window fit, reactions, and chat

The follow-up unifies all six game surfaces: conversation-card fronts and reveals, heart/match questions and choices, wheel prompts, number feedback, and letter-race controls. Questions use Outfit, as do the interface headings and buttons. Platform emoji avatars and reaction decorations are replaced with drawn SVG characters and consistent Lucide icons. Existing avatar IDs and authored question content are preserved.

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
npm run smoke
```

`npm run smoke` runs `scripts/ui-check.mjs` through the existing smoke entry point. It defaults to `http://localhost:5174` and Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Set `SMOKE_URL`, `CHROME_PATH`, or `UI_ARTIFACT_DIR` to override these defaults. The development server must already be running.

The browser sweep passed at **320×740, 390×844, 768×1024, 844×390 landscape, and 1440×1000**. The final sweep also passed against the compiled production bundle served with `vite preview` on port 4174; those screenshots are in `artifacts/production/`. Checks cover landing filters (5/2/3 games), keyboard question preview, all five direct launch tiles, guest entry, partner-room launch, room input/focus/Escape behavior, every game introduction, card advancement, and phone quiz handover/reveal, wheel results, number feedback, and letter-race completion. No uncaught page exceptions, horizontal overflow, or horizontally clipped primary game controls were observed.


Targeted UI fixtures also passed at 320px and 1440px: room-code focus remains stable across a 1.5-second parent-clock update; focus trapping, Escape, and scroll restoration still work. In the connected lobby, all six host game buttons are enabled, all six guest game buttons are disabled, Enter/Space invoke the expected game callbacks, and waiting/leave-room controls work. Controls meet 44px sizing with no horizontal overflow or uncaught page errors.

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

The laptop sweep checks all five public modes, introductions, Start buttons, game surfaces, and top-bar End Game controls at **1536x695, 1366x650, 1280x600, 1024x600, 1440x900, and 1920x880**. The checked scenes fit without document or main-surface scrolling; the Start button also stays fully inside its panel. On very short windows, instructions can scroll independently above the Start button. Extremely long content can scroll in its dedicated area; smaller phone/landscape layouts use normal document flow.

Connected-card fixtures cover Couple Match and simultaneous conversation answers at 320px and 1440px. These particular fixtures simulate a partner. Separately, the chat suite uses two isolated browser sessions with real PeerJS signaling/WebRTC to verify invitation acceptance, message receipt/acknowledgement, offline queue/reload/reconnect, deduplication, unread counts, joining a shared game room, and both directions of room chat.

## Profile refresh

The profile now opens in a centered, 1,040px arcade frame, with a pink player pass, a lavender heart-point panel, separate partner/chat tiles, and an account strip. The main dashboard fits at 1280x600 and 1536x695 without scrolling. Phones use a readable single-column layout. The edit view includes a live character/name preview; invitation and confirmation screens use the same styling. Keyboard focus stays inside the profile, Escape returns through subviews, and closing returns focus to the lobby control.

Guest accounts are labelled as browser-local profiles rather than cloud-synced accounts. Guest names, characters, and heart points now restore from local storage on refresh; starting a new guest session saves its own defaults. Guest profile/progress changes no longer attempt cloud writes. The profile keeps Google sign-in available when the cloud environment is configured. Live OAuth and cloud unlinking remain unverified in this checkout because that environment is absent.

Run `node scripts/profile-check.mjs` for dashboard, edit/save/cancel, refresh persistence, invitation creation/copy, cancelled sharing, chat navigation, and keyboard checks at 1536x695, 1280x600, 768x1024, 390x844, and 320x740. `node scripts/profile-states-check.mjs` checks local partner display/unlink/cancel, clipboard denial fallback, focus trapping, guest sign-out, and a fresh guest reload. Native sharing is stubbed in isolated test browsers; no invitations are sent to real contacts. The partner-state check uses a local fixture, not a cloud account.

## External flows and limits

Google OAuth, new cloud-profile creation, and cloud progress persistence were not verified. This checkout has no configured Supabase environment; the connected Supabase account did not contain a matching KnotYet project, so no unrelated database was changed.

Friend chat pairs browser profiles through invitation links. Both apps must be open together for delivery; queued messages/history remain in this browser, rather than a cloud inbox. Previously saved manual profiles need a new invitation to establish a real connection. Browser/device changes require pairing again. Details and test commands are in the chat delivery notes.

Google-hosted fonts, GIPHY, advertising, and PeerJS signaling still depend on network availability. Font and reaction-image fallbacks are configured. Verification used Chrome with several viewport/touch settings and two real browser sessions; it is not physical-device or Safari/Firefox certification.
