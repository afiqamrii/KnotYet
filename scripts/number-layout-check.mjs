import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Local visual regression: real PlayScreen, Number Guesser and chat; room/auth are fixtures.
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const out = 'artifacts/number-redesign';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
await import('/src/index.css');const {PlayScreen}=await import('/src/screens/PlayScreen.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Suspense,{fallback:'Loading'},React.createElement(PlayScreen)));
</script></body></html>`;
const mocks = {
  '/src/store/GameContext.tsx': `import {i18n} from '/src/data/i18n.ts';const state={profile:{name:'Alex',avatarId:'sunny',heartPoints:0},partner:null,lang:'en',t:i18n.en,addHeartPoints:()=>{},recordAnsweredQuestion:()=>{}};export const useGame=()=>state;export const HEART_POINTS={COMPLETE_QUIZ:10};`,
  '/src/store/AuthContext.tsx': `const state={couple:null,progress:{answered_questions:[]},isLoading:false,checkLimit:()=>true,incrementPlayCount:()=>{}};export const useAuth=()=>state;`,
  '/src/store/FriendsContext.tsx': `const state={friends:[],unreadTotal:0,setActiveChatFriendId:()=>{}};export const useFriends=()=>state;`,
  '/src/store/MultiplayerContext.tsx': `const listeners=new Set();window.receiveNumber=message=>listeners.forEach(fn=>fn(message));window.sent=[];
  const state={status:'connected',activeGame:'number',isHost:true,roomCode:'LAYOUT',numberSecret:75,questionDecks:{},questionIndices:{},chatMessages:[],unreadChatCount:0,remoteProfile:{name:'Jamie',avatarId:'mochi'},sendMessage:message=>window.sent.push(message),subscribeMessage:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},hostRoom:()=>{},joinRoom:()=>{},leaveRoom:()=>{},setGame:()=>{},clearUnreadChatCount:()=>{},sendChatMessage:()=>true};export const useMultiplayer=()=>state;`,
};

async function checkSurface(page, viewport, state) {
  const guess = page.getByLabel('Your guess');
  await guess.fill(String(Math.floor((Number(await guess.getAttribute('min')) + Number(await guess.getAttribute('max'))) / 2)));
  const metrics = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const input = document.querySelector('#number-guess-input');
    const button = document.querySelector('.number-lock-button');
    const bounds = button?.getBoundingClientRect();
    const main = document.querySelector('.arcade-play-main');
    const header = document.querySelector('.arcade-brand-strip');
    return { width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight,
      button: rect('.number-lock-button'), input: rect('#number-guess-input'), panel: rect('.number-play-panel'), history: rect('.number-history-panel'),
      range: rect('.number-range-card'), clue: rect('.number-latest-clue'), form: rect('.number-guess-form'),
      mainScroll: [main.clientHeight, main.scrollHeight],
      reachable: bounds ? button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) : false,
      stepper: [...document.querySelectorAll('.number-stepper button')].map(el => ({ width: el.offsetWidth, height: el.offsetHeight })),
      focusedInput: input === document.activeElement,
      headerFits: header.scrollWidth <= header.clientWidth + 1,
      headerButtons: [...header.querySelectorAll('button')].map(el => ({...el.getBoundingClientRect().toJSON(), name:el.getAttribute('aria-label') || el.textContent.trim()})),
    };
  });
  assert.ok(metrics.docWidth <= metrics.width + 1, `${viewport.width} ${state}: no horizontal overflow`);
  assert.ok(metrics.headerFits, `${viewport.width} ${state}: the shared playing header has no clipped content`);
  assert.ok(metrics.headerButtons.every(button => button.left >= 0 && button.right <= metrics.width && button.width >= 44 && button.height >= 44 && button.name), 'header controls remain labeled, visible, and touch-friendly');
  assert.ok(metrics.button.top >= 0 && metrics.button.bottom < metrics.height, `${viewport.width} ${state}: CTA visible without scrolling ${JSON.stringify(metrics)}`);
  assert.ok(metrics.reachable, `${viewport.width} ${state}: chat does not cover the guess action`);
  assert.ok(metrics.form.top - (metrics.clue || metrics.range).bottom < 20, 'guess controls stay beside their clue, without flexible blank space');
  assert.ok(metrics.stepper.every(size => size.width >= 44 && size.height >= 44), 'stepper touch targets stay at least 44px');
  if (viewport.width >= 900) {
    assert.ok(metrics.mainScroll[1] <= metrics.mainScroll[0] + 2, `${viewport.width} ${state}: game fits the desktop surface ${JSON.stringify(metrics)}`);
    assert.ok(metrics.history.width >= 250, 'desktop history has readable width');
  } else assert.equal(await page.locator('.room-chat-dock').count(), 0, 'mobile multiplayer starts with chat minimized');
  await page.screenshot({ path: `${out}/${viewport.width}x${viewport.height}-${state}.png`, fullPage: true });
}

try {
  for (const viewport of [{width:320,height:740},{width:390,height:844},{width:1366,height:768},{width:1536,height:800},{width:1280,height:600}].filter(item => !process.env.NUMBER_WIDTH || item.width === Number(process.env.NUMBER_WIDTH))) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      sessionStorage.setItem('knotyet_introShown', JSON.stringify({number:true}));
      localStorage.setItem('knotyet_activeTab', 'number');
      sessionStorage.setItem('num_session', JSON.stringify({roomCode:'LAYOUT',round:1,secret:75,guesses:[],stage:'guess',winnerName:null}));
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/number-layout-fixture') return route.fulfill({contentType:'text/html',body:html});
      if (mocks[url.pathname]) return route.fulfill({contentType:'application/javascript',body:mocks[url.pathname]});
      if (url.origin !== new URL(base).origin) return route.fulfill({status:204,body:''});
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(`${viewport.width}: ${error.message}`));
    await page.goto(`${base}/number-layout-fixture`);
    await page.locator('.game-primary-action').click();
    await page.getByLabel('Your guess').waitFor();
    await checkSurface(page, viewport, 'first-turn');
    await page.getByLabel('Your guess').fill('50');
    await page.getByRole('button',{name:'Lock in 50'}).click();
    await page.getByText('Jamie is thinking', {exact:true}).waitFor();
    assert.equal(await page.getByLabel('Your guess').count(), 0, 'partner turn retains waiting state');
    await page.evaluate(() => window.receiveNumber({type:'NUM_GUESS',payload:{val:90,name:'Jamie',round:1}}));
    await page.getByLabel('Your guess').waitFor();
    assert.equal(await page.getByLabel('Your guess').getAttribute('min'), '51');
    assert.equal(await page.getByLabel('Your guess').getAttribute('max'), '89');
    await checkSurface(page, viewport, 'clues');
    for (const [mine, theirs] of [[60,85],[65,80]]) {
      await page.getByLabel('Your guess').fill(String(mine));
      await page.getByRole('button',{name:`Lock in ${mine}`}).click();
      await page.getByText('Jamie is thinking', {exact:true}).waitFor();
      await page.evaluate(val => window.receiveNumber({type:'NUM_GUESS',payload:{val,name:'Jamie',round:1}}), theirs);
      await page.getByLabel('Your guess').waitFor();
    }
    assert.equal(await page.locator('.number-history-list li').count(), 6);
    await checkSurface(page, viewport, 'history');
    await page.getByLabel('Your guess').fill('75');
    await page.getByRole('button',{name:'Lock in 75'}).click();
    await page.getByRole('heading',{name:'Alex Guessed It!'}).waitFor();
    const next = await page.getByRole('button',{name:'Play Next Round'}).boundingBox();
    assert.ok(next.y >= 0 && next.y + next.height <= viewport.height, 'next round remains visible');
    await page.screenshot({path:`${out}/${viewport.width}x${viewport.height}-complete.png`,fullPage:true});
    await page.getByRole('button',{name:'Play Next Round'}).click();
    await page.getByLabel('Your guess').waitFor();
    assert.equal(await page.locator('.number-history-list li').count(), 0, 'next round resets the trail');
    assert.equal(await page.getByLabel('Your guess').getAttribute('min'), '1');
    console.log(`${viewport.width}x${viewport.height}: first turn, partner wait, clues, six-guess history, completion and next round passed`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
