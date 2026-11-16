import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const source = await readFile(new URL('../src/utils/numberSession.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateNumberSnapshot, restoreNumberSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const saved = { roomCode: 'TEST42', round: 2, secret: 75, guesses: [{ value: 50, hint: 'higher', guesser: 'Host' }], stage: 'guess', winnerName: null };
assert.equal(validateNumberSnapshot(saved), true);
for (const change of [{ secret: -1 }, { guesses: null }, { guesses: [{ value: 90, hint: 'higher' }] }, { guesses: [saved.guesses[0], saved.guesses[0]] }, { stage: 'reveal', winnerName: null }, { round: 0 }]) assert.equal(validateNumberSnapshot({ ...saved, ...change }), false);
const memory = values => ({ getItem: key => values[key] ?? null });
assert.deepEqual(restoreNumberSession(memory({ num_session: JSON.stringify(saved) }), 'TEST42', true), saved);
assert.equal(restoreNumberSession(memory({ num_session: JSON.stringify(saved) }), 'OTHER', true), null, 'a new room never inherits a previous room turn');
assert.equal(restoreNumberSession(memory({ num_stage: 'guess', num_secret: '75', num_guesses: 'null' }), null, false), null, 'invalid local guess history cannot crash the game');

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const fixture = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/src/index.css');
const role=new URL(location.href).searchParams.get('role');window.listeners=new Set();window.receive=message=>window.listeners.forEach(fn=>fn(message));window.sent=[];window.points=Number(sessionStorage.getItem('points')||0);
window.mp={status:'connected',roomCode:'TEST42',isHost:role==='host',numberSecret:75,remoteProfile:{name:role==='host'?'Guest':'Host'},sendMessage:message=>{window.sent.push(message);void window.relay(message);},subscribeMessage:fn=>{window.listeners.add(fn);return()=>window.listeners.delete(fn)}};
window.game={profile:{name:role==='host'?'Host':'Guest'},partner:null,addHeartPoints:amount=>{window.points+=amount;sessionStorage.setItem('points',String(window.points));}};
if(role==='host'&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');sessionStorage.setItem('num_session',JSON.stringify(${JSON.stringify(saved)}));}
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;const {NumberGuesserGame}=await import('/src/components/NumberGuesserGame.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'arcade-play','data-game':'number'},React.createElement(NumberGuesserGame)));
</script></body></html>`;
const pages = {}, pending = { host: [], guest: [] }, errors = [];
async function flush(role) {
  const messages = pending[role].splice(0);
  for (const message of messages) await pages[role].evaluate(message => window.receive(message), message);
}
async function open(role) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.exposeBinding('relay', async (_source, message) => {
    const target = role === 'host' ? 'guest' : 'host';
    if (!pages[target] || !await pages[target].evaluate(() => Boolean(window.listeners?.size)).catch(() => false)) pending[target].push(message);
    else await pages[target].evaluate(message => window.receive(message), message).catch(() => pending[target].push(message));
  });
  await context.route('**/number-recovery-fixture*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await context.route('**/src/store/MultiplayerContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useMultiplayer=()=>window.mp;' }));
  await context.route('**/src/store/GameContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const HEART_POINTS={COMPLETE_QUIZ:10};export const useGame=()=>window.game;' }));
  await context.route('**/src/store/AuthContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useAuth=()=>({checkLimit:()=>true,incrementPlayCount:()=>{}});' }));
  const page = pages[role] = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/number-recovery-fixture?role=${role}`);
  await page.waitForFunction(() => window.listeners?.size > 0);
  await flush(role);
  return page;
}
const count = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('num_guesses')).length);
try {
  const host = await open('host'), guest = await open('guest');
  await guest.getByLabel('Your guess').waitFor();
  assert.equal(await count(host), 1);
  assert.equal(await count(guest), 1, 'a joining guest receives the host turn history');
  await guest.getByLabel('Your guess').fill('60');
  await guest.getByRole('button', { name: 'Lock in 60', exact: true }).click();
  await host.getByLabel('Your guess').waitFor();
  assert.equal(await count(host), 2);
  await guest.reload();
  await guest.waitForFunction(() => window.listeners?.size > 0);
  await flush('guest');
  await guest.waitForFunction(() => JSON.parse(sessionStorage.getItem('num_guesses') || '[]').length === 2);
  assert.equal(await guest.getByLabel('Your guess').count(), 0, 'refresh preserves that it is the host turn');
  await host.getByLabel('Your guess').fill('70');
  await host.getByRole('button', { name: 'Lock in 70', exact: true }).click();
  await guest.getByLabel('Your guess').waitFor();
  await host.reload();
  await host.waitForFunction(() => window.listeners?.size > 0);
  await flush('host');
  await guest.waitForFunction(() => JSON.parse(sessionStorage.getItem('num_guesses') || '[]').length === 3);
  assert.equal(await count(host), 3, 'host refresh preserves the narrowed range and turn');
  assert.equal(await host.getByLabel('Your guess').count(), 0);
  await host.evaluate(() => window.receive({ type: 'NUM_GUESS', payload: { val: 72, name: 'Guest', round: 1 } }));
  assert.equal(await count(host), 3, 'a delayed prior-round guess is ignored');
  await guest.getByLabel('Your guess').fill('75');
  await guest.getByRole('button', { name: 'Lock in 75', exact: true }).click();
  await host.getByText('Guest Guessed It!').waitFor();
  await guest.getByText('Guest Guessed It!').waitFor();
  assert.equal(await guest.evaluate(() => window.points), 10);
  await guest.reload();
  await guest.waitForFunction(() => window.listeners?.size > 0);
  await flush('guest');
  await guest.getByText('Guest Guessed It!').waitFor();
  assert.equal(await guest.evaluate(() => window.points), 10, 'restoring the reveal never rewards it again');
  assert.deepEqual(errors, []);
  console.log('Number recovery: host/guest refresh, room isolation, corrupted saves, turn restoration, stale guesses, and once-only restored rewards passed.');
} finally { await browser.close(); }
