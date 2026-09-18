// Login is external, so the main smoke entry point uses isolated authenticated UI
// fixtures for multiplayer surfaces and separately verifies the public auth gate.
await import('./chat-room-ui-check.mjs');
await import('./chat-check.mjs');
await import('./multiplayer-ux-check.mjs');
