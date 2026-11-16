import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
window.authListeners=new Set();window.renderListeners=new Set();window.db={user_progress:{user_id:'alice',heart_points:100,answered_questions:[]},couples:{id:'pair',user1_id:'alice',user2_id:'bob',couple_points:20}};window.writes=[];window.failWrite=false;window.paired=false;
window.refresh=()=>{window.auth={user:{id:'alice'},profile:{id:'alice',name:'Alice',avatar_id:'sunny'},progress:{...window.db.user_progress},couple:window.paired?{...window.db.couples}:null,refreshProgress:async()=>window.refresh(),refreshCouple:async()=>window.refresh()};window.renderListeners.forEach(fn=>fn());};window.refresh();
const {GameProvider,useGame}=await import('/src/store/GameContext.tsx');
function Probe(){const game=useGame();React.useEffect(()=>{window.game=game;},[game]);return React.createElement('p',null,game.profile?.heartPoints);}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement(Probe)));
</script></body></html>`;
const authMock = `import React from '/node_modules/.vite/deps/react.js';const subscribe=fn=>{window.renderListeners.add(fn);return()=>window.renderListeners.delete(fn)};export const useAuth=()=>React.useSyncExternalStore(subscribe,()=>window.auth);`;
const supabaseMock = `export const supabase={auth:{onAuthStateChange:fn=>{window.authListeners.add(fn);return{data:{subscription:{unsubscribe:()=>window.authListeners.delete(fn)}}}}},from:table=>{const filters=[];let patch=null,signal;return{select(){return this;},single(){return this;},maybeSingle(){return this;},update(value){patch=value;return this;},eq(key,value){filters.push([key,value]);return this;},is(key,value){filters.push([key,value]);return this;},abortSignal(value){signal=value;return this;},async then(resolve,reject){try{signal?.throwIfAborted();await new Promise(r=>setTimeout(r,5));signal?.throwIfAborted();const row=window.db[table];if(patch){window.writes.push({table,patch});if(window.failWrite)return resolve({data:null,error:new Error('offline')});if(!filters.every(([key,value])=>row[key]===value))return resolve({data:null,error:null});Object.assign(row,patch);}return resolve({data:{...row},error:null});}catch(error){return reject(error);}}}}};`;
try {
  const context = await browser.newContext();
  await context.route('**/progress-provider-fixture', route => route.fulfill({ contentType: 'text/html', body: html }));
  await context.route('**/src/store/AuthContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: authMock }));
  await context.route('**/src/lib/supabase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: supabaseMock }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/progress-provider-fixture`);
  await page.waitForFunction(() => window.game?.profile?.heartPoints === 100);
  await page.evaluate(() => { window.game.addHeartPoints(15); window.game.addHeartPoints(10); window.game.deductHeartPoints(5); });
  await page.waitForFunction(() => !window.game.isSavingProgress && window.db.user_progress.heart_points === 120);
  assert.equal(await page.evaluate(() => window.game.profile.heartPoints), 120, 'rapid authenticated rewards accumulate in the UI and cloud');
  assert.deepEqual(await page.evaluate(() => window.writes.map(item => item.patch.heart_points)), [115, 125, 120], 'same-browser reward ordering preserves deductions');

  await page.evaluate(() => { window.paired = true; window.refresh(); });
  await page.waitForFunction(() => window.auth.couple?.id === 'pair');
  // Let the provider consume the new account snapshot before invoking its API.
  await page.waitForTimeout(30);
  await page.evaluate(() => { window.game.addHeartPoints(5, true, false, 'bob'); window.game.addHeartPoints(5, true, true, 'bob'); });
  await page.waitForFunction(() => !window.game.isSavingProgress && window.db.couples.couple_points === 25);
  assert.equal(await page.evaluate(() => window.writes.filter(item => item.table === 'couples').length), 1, 'one shared result produces one host-owned reward');
  assert.equal(await page.evaluate(() => window.game.profile.heartPoints), 120, 'shared points do not change individual points');

  await page.evaluate(() => { window.failWrite = true; window.game.addHeartPoints(15); });
  await page.waitForFunction(() => Boolean(window.game.progressSaveError) && !window.game.isSavingProgress);
  assert.equal(await page.evaluate(() => window.game.profile.heartPoints), 120, 'a failed save never displays unconfirmed permanent hearts');
  assert.equal(await page.evaluate(() => window.writes.length), 5, 'uncertain failures are not retried by the provider');
  await page.evaluate(() => window.game.clearProgressSaveError());
  await page.waitForFunction(() => window.game.progressSaveError === null);
  await page.evaluate(() => { window.failWrite = false; window.paired = false; window.refresh(); });
  await page.waitForTimeout(30);
  await page.evaluate(() => window.game.addHeartPoints(15, true, false));
  await page.waitForFunction(() => !window.game.isSavingProgress && window.db.user_progress.heart_points === 135);
  assert.equal(await page.evaluate(() => window.game.profile.heartPoints), 135, 'an unpaired online guest still receives personal hearts');
  await page.evaluate(() => { window.paired = true; window.refresh(); });
  await page.waitForTimeout(30);
  await page.evaluate(() => window.game.addHeartPoints(15, true, false, 'another-friend'));
  await page.waitForFunction(() => !window.game.isSavingProgress && window.db.user_progress.heart_points === 150);
  assert.equal(await page.evaluate(() => window.db.couples.couple_points), 25, 'playing another friend cannot change unrelated couple points');
  assert.equal(await page.evaluate(() => window.game.profile.accountId), 'alice', 'room profile carries the current account identity');
  assert.deepEqual(errors, []);
  console.log('Progress provider: sequential rewards, shared host authority, confirmed totals, and visible save failure passed.');
} finally { await browser.close(); }
