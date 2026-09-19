import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = 'http://localhost:5174';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const preamble = `<script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
const fixture = `<!doctype html><html><head>${preamble}</head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import { MultiplayerProvider, useMultiplayer } from '/src/store/MultiplayerContext.tsx';
function Probe() {
  const room = useMultiplayer();
  window.roomProbe = room;
  return React.createElement('p', { id: 'room-state' }, [room.status, room.roomCode, room.activeGame].join(':'));
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MultiplayerProvider, null, React.createElement(Probe)));
</script></body></html>`;

try {
  for (const isHost of [true, false]) {
    const context = await browser.newContext();
    await context.addInitScript(role => {
      sessionStorage.setItem('mp_roomCode', 'KNOT42');
      sessionStorage.setItem('mp_isHost', String(role));
      sessionStorage.setItem('mp_activeGame', 'match');
    }, isHost);
    await context.route('**/room-refresh-fixture', route =>
      route.fulfill({ contentType: 'text/html', body: fixture }));
    const page = await context.newPage();
    await page.goto(`${base}/room-refresh-fixture`);
    await page.getByText('disconnected:KNOT42:match').waitFor();
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => ({
      code: sessionStorage.getItem('mp_roomCode'),
      role: window.roomProbe.isHost,
      game: sessionStorage.getItem('mp_activeGame'),
    })), { code: 'KNOT42', role: isHost, game: 'match' },
    'a fresh provider must keep the saved room and game until reconnect');
    await page.evaluate(() => window.roomProbe.leaveRoom());
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => ({
      code: sessionStorage.getItem('mp_roomCode'),
      role: sessionStorage.getItem('mp_isHost'),
      game: sessionStorage.getItem('mp_activeGame'),
    })), { code: null, role: null, game: null },
    'explicit leave must clear the saved room');
    await context.close();
  }
  console.log('Room refresh: host and partner retain the active match; explicit leave clears it');
} finally {
  await browser.close();
}

