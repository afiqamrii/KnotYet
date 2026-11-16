import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const fixture = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
window.authListeners=new Set();window.renderListeners=new Set();window.calls=[];window.releases=[];window.signals=[];window.refreshes=[];
window.setAccount=id=>{window.auth={user:id?{id}:null,profile:id?{name:id,avatar_id:'sunny'}:null,progress:id?{user_id:id,heart_points:0,answered_questions:[]}:null,couple:null,refreshProgress:async()=>window.refreshes.push(id),refreshCouple:async()=>{}};window.authListeners.forEach(fn=>fn(id?'SIGNED_IN':'SIGNED_OUT',id?{user:{id}}:null));window.renderListeners.forEach(fn=>fn());};
window.setAccount('alice');
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
const {GameProvider,useGame}=await import('/src/store/GameContext.tsx');const {useAuth}=await import('/src/store/AuthContext.tsx');
function Probe(){const game=useGame();const auth=useAuth();React.useEffect(()=>{window.game=game;window.renderedUser=auth.user?.id??null;},[game,auth]);return React.createElement('p',null,'ready');}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement(Probe)));
</script></body></html>`;
const authMock = `import React from '/node_modules/.vite/deps/react.js';const subscribe=fn=>{window.renderListeners.add(fn);return()=>window.renderListeners.delete(fn)};export const useAuth=()=>React.useSyncExternalStore(subscribe,()=>window.auth);`;
const supabaseMock = `export const supabase={auth:{onAuthStateChange:fn=>{window.authListeners.add(fn);return{data:{subscription:{unsubscribe:()=>window.authListeners.delete(fn)}}}}},rpc:(_name,{p_question_id})=>{window.calls.push({user:window.auth.user?.id,question:p_question_id});return{abortSignal:signal=>{window.signals.push(signal);return new Promise(resolve=>window.releases.push(()=>resolve({data:window.rpcFailure?null:[p_question_id],error:window.rpcFailure?new Error('offline'):null})))}}}};`;
try {
  const context = await browser.newContext();
  await context.route('**/history-account-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await context.route('**/src/store/AuthContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: authMock }));
  await context.route('**/src/lib/supabase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: supabaseMock }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/history-account-fixture`);
  await page.waitForFunction(() => window.renderedUser === 'alice');
  await page.evaluate(() => { window.game.recordAnsweredQuestion('alice-first'); window.game.recordAnsweredQuestion('alice-queued'); });
  await page.waitForFunction(() => window.calls.length === 1);
  await page.evaluate(() => { window.setAccount(null); window.setAccount('bob'); localStorage.removeItem('jodohdeck_answered'); localStorage.removeItem('knotyet_seen_questions'); });
  await page.waitForFunction(() => window.renderedUser === 'bob');
  assert.equal(await page.evaluate(() => window.signals[0].aborted), true, 'changing account aborts the in-flight request');
  await page.evaluate(() => window.game.recordAnsweredQuestion('bob-first'));
  await page.waitForFunction(() => window.calls.length === 2);
  await page.evaluate(async () => { window.releases[0](); window.releases[1](); await new Promise(resolve => setTimeout(resolve, 30)); });
  assert.deepEqual(await page.evaluate(() => window.calls), [{ user: 'alice', question: 'alice-first' }, { user: 'bob', question: 'bob-first' }], 'queued Alice writes never execute under Bob');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jodohdeck_answered'))), ['bob-first'], 'late Alice results cannot merge into Bob history');
  assert.deepEqual(await page.evaluate(() => window.refreshes), ['bob'], 'only the active account refreshes progress');
  await page.evaluate(() => { window.rpcFailure = true; window.game.recordAnsweredQuestion('bob-pending'); });
  await page.waitForFunction(() => window.calls.length === 3);
  await page.evaluate(() => window.releases[2]());
  await page.waitForFunction(() => Boolean(window.game.progressSaveError));
  assert.equal(await page.evaluate(() => localStorage.getItem('knotyet_pending_question:bob:bob-pending')), '1', 'failed history stays in an account-scoped retry outbox');
  await page.evaluate(() => { window.rpcFailure = false; window.dispatchEvent(new Event('online')); });
  await page.waitForFunction(() => window.calls.length === 4);
  await page.evaluate(() => window.releases[3]());
  await page.waitForFunction(() => localStorage.getItem('knotyet_pending_question:bob:bob-pending') === null);
  assert.equal(await page.evaluate(() => window.calls.at(-1).question), 'bob-pending', 'reconnection retries only the active account history');
  assert.deepEqual(errors, []);
  console.log('History accounts: queued writes cancelled, in-flight requests aborted, late results isolated, and new account queue independent, and failed history retried on reconnect.');
} finally { await browser.close(); }
