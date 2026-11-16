// Current public routes plus real providers with controlled account responses.
// OAuth itself remains external; no real accounts or contacts are mutated.
await import('./public-experience-check.mjs');
await import('./public-deck-check.mjs');
await import('./chat-room-ui-check.mjs');
await import('./account-chat-regression-check.mjs');
await import('./invite-recovery-check.mjs');
await import('./profile-save-check.mjs');
await import('./multiplayer-ux-check.mjs');
await import('./room-refresh-check.mjs');
await import('./room-recovery-check.mjs');
