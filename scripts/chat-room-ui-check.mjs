import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

await mkdir('artifacts', { recursive: true });
const baseUrl = 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><main class="play-shell arcade-play"><div class="play-console" style="min-height:700px"></div></main><div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import { InGameChat } from '/src/components/InGameChat.tsx';import '/src/index.css';import '/src/styles/play.css';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(InGameChat));</script></body></html>`;
const mock = `import React from '/node_modules/.vite/deps/react.js';
const listeners=new Set();const publish=()=>listeners.forEach(fn=>fn());
let current={status:'connected',chatMessages:[{id:'incoming',senderId:'partner',senderName:'Mochi',senderAvatar:'mochi',text:'I knew you would pick that one!',timestamp:Date.now()}],unreadChatCount:1,latestIncomingMessage:null,remoteProfile:{name:'Mochi',avatarId:'mochi'}};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const sendChatMessage=(text,isQuickReaction)=>{if(window.failSend)return false;current={...current,chatMessages:[...current.chatMessages,{id:crypto.randomUUID(),senderId:'me',senderName:'Alex',senderAvatar:'sunny',text,timestamp:Date.now(),isQuickReaction}]};publish();return true;};
const clearUnreadChatCount=()=>{if(!current.unreadChatCount&&!current.latestIncomingMessage)return;current={...current,unreadChatCount:0,latestIncomingMessage:null};publish();};
window.disconnectChat=()=>{current={...current,status:'partner_left'};publish();};
export const useMultiplayer=()=>({...React.useSyncExternalStore(subscribe,()=>current),sendChatMessage,clearUnreadChatCount});`;

try {
  for (const viewport of [{ width: 320, height: 640 }, { width: 1536, height: 800 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/room-chat-ui-fixture') return route.fulfill({ contentType: 'text/html', body: html });
      if (url.pathname === '/src/store/MultiplayerContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: mock });
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${viewport.width}: ${error.message}`));
    await page.goto(`${baseUrl}/room-chat-ui-fixture`);
    const dock = page.locator('.room-chat-dock');
    if (viewport.width >= 1440) {
      await dock.waitFor();
      assert.equal(await page.locator('html').evaluate(el => el.classList.contains('room-chat-docked')), true, 'wide layout reserves a chat rail');
      const gameRight = await page.locator('.arcade-play').evaluate(el => el.getBoundingClientRect().right);
      const dockLeft = await dock.evaluate(el => el.getBoundingClientRect().left);
      assert.ok(gameRight <= dockLeft, `game remains beside the dock (${gameRight} <= ${dockLeft})`);
    } else {
      assert.equal(await dock.count(), 0, 'small screens start with chat tucked away');
      await page.getByRole('button', { name: /Open room chat/ }).click();
      await dock.waitFor();
    }
    assert.equal(await page.locator('.chat-overlay').count(), 0, 'room chat never adds a blocking overlay');
    const input = page.getByRole('textbox', { name: 'Message Mochi' });
    await input.fill('My draft should survive a failed send.');
    await page.evaluate(() => { window.failSend = true; });
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    assert.equal(await input.inputValue(), 'My draft should survive a failed send.');
    await page.getByRole('alert').waitFor();
    await page.evaluate(() => { window.failSend = false; });
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    assert.equal(await input.inputValue(), '');
    await page.getByRole('button', { name: 'Good game!', exact: true }).click();
    assert.equal(await page.locator('.chat-message.is-mine').count(), 2);
    const metrics = await dock.evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.rect.left >= 0 && metrics.rect.right <= metrics.width && metrics.rect.bottom <= metrics.height + 1);
    assert.ok(metrics.scroll <= metrics.width + 1, 'no horizontal page overflow');
    await page.screenshot({ path: `artifacts/chat-room-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Minimize room chat' }).click();
    await page.getByRole('button', { name: /Open room chat/ }).waitFor();
    await page.getByRole('button', { name: /Open room chat/ }).click();
    await page.evaluate(() => window.disconnectChat());
    await page.locator('.room-chat-dock').waitFor({ state: 'detached' });
    console.log(`${viewport.width}x${viewport.height}: side chat, sending, draft retention, quick replies, layout, collapse, and disconnect passed`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
