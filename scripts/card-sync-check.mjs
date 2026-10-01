import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const screenSource = await (await fetch(`${base}/src/screens/PlayScreen.tsx`)).text();
const gameContextUrl = screenSource.match(/import \{[^}]*useGame[^}]*\} from "([^"]+)"/)[1];
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/src/index.css');
localStorage.setItem('jodohdeck_profile',JSON.stringify({name:'Alex',avatarId:'sunny',heartPoints:0}));
sessionStorage.setItem('swipe_category','vibe-check');
const { SWIPE_CARDS } = await import('/src/data/questions.ts');
const deck=SWIPE_CARDS.filter(c=>c.category==='vibe-check').slice(0,4).map(c=>c.id);
sessionStorage.setItem('swipe_deck',JSON.stringify({category:'vibe-check',ids:deck}));
const listeners=new Set();window.sent=[];window.receive=msg=>listeners.forEach(fn=>fn(msg));
const host=!location.search.includes('guest');
window.mp={status:'connected',isHost:host,isConnected:true,activeGame:'swipe',roomCode:'123456',remoteProfile:{name:'Jamie',avatarId:'mochi'},questionDecks:{swipe:deck},questionIndices:{swipe:0},chatMessages:[],unreadChatCount:0,latestIncomingMessage:null,subscribeMessage:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},sendMessage:msg=>window.sent.push(msg),clearUnreadChatCount:()=>{},sendChatMessage:()=>true};
const React=(await import('/@id/react')).default;const {createRoot}=(await import('/@id/react-dom/client')).default;
const {GameProvider}=await import('${gameContextUrl}');const {PlayScreen}=await import('/src/screens/PlayScreen.tsx');
createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement(React.Suspense,{fallback:'Loading'},React.createElement(PlayScreen))));
</script></body></html>`;
try {
  for (const guest of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/card-sync-fixture') return route.fulfill({ contentType: 'text/html', body: fixture });
      if (url.pathname === '/src/store/MultiplayerContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'export const useMultiplayer=()=>window.mp;' });
      if (url.pathname === '/src/store/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: `const auth={user:null,profile:null,progress:null,couple:null,isLoading:false,checkLimit:()=>true,incrementPlayCount:()=>{},refreshProgress:()=>{},refreshCouple:()=>{}};export const useAuth=()=>auth;` });
      if (url.pathname === '/src/store/FriendsContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: 'const friends={unreadTotal:0,friends:[],getConversation:()=>[],getUnreadCount:()=>0,markConversationRead:()=>{}};export const useFriends=()=>friends;' });
      if (url.origin !== base) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/card-sync-fixture${guest ? '?guest' : ''}`);
    await page.locator('#intro-swipe').waitFor({timeout: 10000}).catch(async e => { throw new Error(errors.join(' | ') || await page.locator('body').innerText() || e.message); });
    if (guest) await page.evaluate(() => window.receive({ type: 'START_GAME', payload: { game: 'swipe' } }));
    else await page.getByRole('button', { name: 'Start together' }).click();
    await page.locator('.game-action-skip').waitFor();
    assert.equal(await page.locator('.game-action-skip').isEnabled(), true, 'skip stays available without answers');
    assert.equal(await page.locator('.game-action-next').isDisabled(), true);
    if (guest) {
      assert.equal(await page.locator('.game-category-pill:enabled').count(), 0, 'guest cannot replace host deck');
      await page.locator('.game-action-skip').click();
      assert.equal(await page.evaluate(() => window.sent.filter(m => m.type === 'SWIPE_REQUEST').length), 1);
    } else {
      const before = await page.evaluate(() => window.sent.filter(m => m.type === 'SYNC_QUESTION_IDS').at(-1).payload);
      await page.evaluate(cardId => { const msg={type:'SWIPE_REQUEST',payload:{direction:'left',cardId}};window.receive(msg);window.receive(msg); }, before.questionIds[0]);
      await page.waitForFunction(() => window.sent.filter(m => m.type === 'SYNC_QUESTION_IDS').at(-1).payload.currentIndex === 1);
      assert.equal(await page.evaluate(() => window.sent.filter(m => m.type === 'SWIPE_ACTION').length), 1, 'simultaneous requests advance once');
      await page.evaluate(cardId => window.receive({type:'CARD_SUBMIT',payload:{cardId,answer:'Old answer'}}), before.questionIds[0]);
      await page.getByRole('button', { name: /Share your answers/i }).click();
      await page.getByLabel('Your answer', { exact: true }).fill('A walk after dinner.');
      await page.getByRole('button', { name: /Submit & reveal/i }).click();
      assert.equal(await page.locator('.game-action-next').isDisabled(), true, 'stale prior-card answer cannot complete current card');
      await page.evaluate(cardId => window.receive({type:'CARD_SUBMIT',payload:{cardId,answer:'A quiet morning.'}}), before.questionIds[1]);
      await page.waitForFunction(() => !document.querySelector('.game-action-next').disabled);
      await page.getByRole('button', { name: 'Real Talk', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.game-action-next').disabled);
      assert.equal(await page.locator('.paired-answers').count(), 0, 'category change clears old answers');
      await page.screenshot({ path: 'artifacts/review-cards-mobile.png', fullPage: true });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Card shell: skip, single host advancement, stale-answer rejection, category reset and guest controls passed.');
} finally { await browser.close(); }
