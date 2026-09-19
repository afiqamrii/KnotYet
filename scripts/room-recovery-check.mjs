import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const peerMock = `
class Emitter {
  constructor() { this.handlers = new Map(); }
  on(name, handler) { const list = this.handlers.get(name) || []; list.push(handler); this.handlers.set(name, list); }
  emit(name, value) { for (const handler of this.handlers.get(name) || []) handler(value); }
}
const peers = new Map();
const connections = new Set();
class Connection extends Emitter {
  constructor() { super(); this.open = false; this.other = null; }
  send(value) { if (this.open && this.other?.open) queueMicrotask(() => this.other?.emit('data', value)); }
  close() {
    if (!this.open) return;
    this.open = false;
    connections.delete(this);
    const other = this.other;
    this.emit('close');
    if (other?.open) { other.open = false; connections.delete(other); other.emit('close'); }
  }
}
class Peer extends Emitter {
  constructor(idOrOptions) {
    super();
    this.id = typeof idOrOptions === 'string' ? idOrOptions : 'guest-' + Math.random().toString(36).slice(2);
    this.open = false;
    this.destroyed = false;
    peers.set(this.id, this);
    queueMicrotask(() => { if (!this.destroyed) { this.open = true; this.emit('open', this.id); } });
  }
  connect(id) {
    const host = peers.get(id);
    const mine = new Connection();
    const theirs = new Connection();
    mine.other = theirs;
    theirs.other = mine;
    queueMicrotask(() => {
      if (!host?.open) { this.emit('error', { type: 'peer-unavailable' }); return; }
      host.emit('connection', theirs);
      mine.open = true;
      theirs.open = true;
      connections.add(mine);
      connections.add(theirs);
      queueMicrotask(() => { mine.emit('open'); theirs.emit('open'); });
    });
    return mine;
  }
  destroy() { this.destroyed = true; this.open = false; peers.delete(this.id); for (const conn of [...connections]) conn.close(); }
  reconnect() { this.open = true; this.emit('open', this.id); }
}
window.__peerMock = { drop: () => { for (const conn of [...connections]) conn.close(); } };
export default Peer;
`;
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  const React = (await import('/@id/react')).default;
  const ReactDOMClient = (await import('/@id/react-dom/client')).default;
  const { MultiplayerProvider, useMultiplayer } = await import('/src/store/MultiplayerContext.tsx');
  function Harness({ role }) {
    const room = useMultiplayer();
    React.useEffect(() => { window[role + 'Api'] = room; }, [room, role]);
    return React.createElement('div', { id: role }, room.status);
  }
  ReactDOMClient.createRoot(document.getElementById('root')).render(
    React.createElement(React.Fragment, null,
      React.createElement(MultiplayerProvider, null, React.createElement(Harness, { role: 'host' })),
      React.createElement(MultiplayerProvider, null, React.createElement(Harness, { role: 'guest' }))
    )
  );
</script></body></html>`;

try {
  const context = await browser.newContext();
  await context.route('**/node_modules/.vite/deps/peerjs.js*', route => route.fulfill({ contentType: 'text/javascript', body: peerMock }));
  await context.route('**/room-recovery-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/room-recovery-fixture`);
  await page.waitForFunction(() => Boolean(window.hostApi && window.guestApi && window.__peerMock), { timeout: 10_000 }).catch(() => {
    throw new Error(`Room fixture did not render: ${errors.join(' | ')}`);
  });
  await page.evaluate(() => {
    window.hostApi.hostRoom('1234', { name: 'Host', avatarId: 'sunny', heartPoints: 0 });
    window.guestApi.joinRoom('1234', { name: 'Guest', avatarId: 'mochi', heartPoints: 0 });
  });
  await page.waitForFunction(() => window.hostApi.status === 'connected' && window.guestApi.status === 'connected');
  await page.evaluate(() => {
    window.receivedByScreen = [];
    window.receivedByGame = [];
    window.guestApi.subscribeMessage(message => window.receivedByScreen.push(message.type));
    window.guestApi.subscribeMessage(message => window.receivedByGame.push(message.type));
    window.hostApi.setGame('quiz');
    window.hostApi.sendMessage({ type: 'SYNC_QUESTION_IDS', payload: { game: 'quiz', questionIds: ['q1', 'q2', 'q3'], currentIndex: 2 } });
  });
  await page.waitForFunction(() => window.guestApi.questionIndices.quiz === 2);
  const subscriptions = await page.evaluate(() => ({
    screen: window.receivedByScreen,
    game: window.receivedByGame,
  }));
  assert.ok(subscriptions.screen.includes('SYNC_QUESTION_IDS'), 'play screen receives the question sync');
  assert.ok(subscriptions.game.includes('SYNC_QUESTION_IDS'), 'active game also receives the same sync');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.__peerMock.drop();
  });
  await page.waitForFunction(() => window.hostApi.status === 'partner_left' && window.guestApi.status === 'partner_left');
  assert.equal(await page.evaluate(() => window.hostApi.roomCode), '1234', 'temporary drop retains the host room');
  await page.waitForTimeout(4500);
  assert.equal(await page.evaluate(() => window.guestApi.status), 'partner_left', 'the room is preserved while WhatsApp backgrounds the tab');
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }));
  await page.waitForFunction(() => window.hostApi.status === 'connected' && window.guestApi.status === 'connected', { timeout: 10_000 });
  const restored = await page.evaluate(() => ({
    game: window.guestApi.activeGame,
    deck: window.guestApi.questionDecks.quiz,
    index: window.guestApi.questionIndices.quiz,
  }));
  assert.equal(restored.game, 'quiz', 'the current game resumes');
  assert.deepEqual(restored.deck, ['q1', 'q2', 'q3'], 'the same question deck is restored');
  assert.equal(restored.index, 2, 'the same question position is restored');
  await page.evaluate(() => window.guestApi.leaveRoom());
  await page.waitForFunction(() => window.hostApi.status === 'partner_left' && window.guestApi.status === 'disconnected');
  await page.waitForTimeout(4500);
  assert.equal(await page.evaluate(() => window.hostApi.status), 'partner_left', 'an explicit leave does not trigger reconnection');
  console.log('ROOM: background drop reconnects, restores the game, and explicit leave stays closed.');
  await context.close();
} finally {
  await browser.close();
}
