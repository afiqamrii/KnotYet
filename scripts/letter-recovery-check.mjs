import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const source = await readFile(new URL('../src/utils/letterSession.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateLetterSnapshot, restoreLetterSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const saved = { roomCode: 'TEST42', roundId: 'letter-existing', stage: 'race', letter: 'A', winner: null, remainingMs: 0, countdownEndsAt: 0 };
assert.equal(validateLetterSnapshot(saved), true);
for (const change of [{ letter: null }, { letter: 'AB' }, { stage: 'winner', winner: null }, { remainingMs: -1 }, { stage: 'wait', letter: 'A' }]) assert.equal(validateLetterSnapshot({ ...saved, ...change }), false);
const memory = values => ({ getItem: key => values[key] ?? null });
assert.deepEqual(restoreLetterSession(memory({ letter_session: JSON.stringify(saved) }), 'TEST42', true), saved);
assert.equal(restoreLetterSession(memory({ letter_session: JSON.stringify(saved) }), 'OTHER', true), null);
assert.equal(restoreLetterSession(memory({ letter_stage: 'winner', letter_char: 'A', letter_winner: 'null' }), null, false), null, 'missing saved winner cannot strand the result screen');
const countdown = { ...saved, stage: 'countdown', countdownEndsAt: 5000, remainingMs: 3000 };
assert.equal(restoreLetterSession(memory({ letter_session: JSON.stringify(countdown) }), 'TEST42', true, 4000).remainingMs, 1000, 'refresh uses the remaining countdown');
assert.equal(restoreLetterSession(memory({ letter_session: JSON.stringify(countdown) }), 'TEST42', true, 6000).stage, 'race', 'elapsed countdown resumes the race');

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const fixture = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/src/index.css');const role=new URL(location.href).searchParams.get('role');window.listeners=new Set();window.receive=message=>window.listeners.forEach(fn=>fn(message));window.sent=[];window.points=Number(sessionStorage.getItem('points')||0);
window.mp={status:'connected',roomCode:'TEST42',isHost:role==='host',remoteProfile:{name:role==='host'?'Guest':'Host'},sendMessage:message=>{window.sent.push(message);void window.relay(message);},subscribeMessage:fn=>{window.listeners.add(fn);return()=>window.listeners.delete(fn)}};
window.game={profile:{name:role==='host'?'Host':'Guest'},partner:null,addHeartPoints:amount=>{window.points+=amount;sessionStorage.setItem('points',String(window.points));}};
if(role==='host'&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');sessionStorage.setItem('letter_session',JSON.stringify(${JSON.stringify(saved)}));}
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;const {LetterRaceGame}=await import('/src/components/LetterRaceGame.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'arcade-play','data-game':'letter'},React.createElement(LetterRaceGame)));
</script></body></html>`;
const pages = {}, pending = { host: [], guest: [] }, errors = [];
async function flush(role) { for (const message of pending[role].splice(0)) await pages[role].evaluate(message => window.receive(message), message); }
async function open(role) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.exposeBinding('relay', async (_source, message) => {
    const target = role === 'host' ? 'guest' : 'host';
    if (!pages[target] || !await pages[target].evaluate(() => Boolean(window.listeners?.size)).catch(() => false)) pending[target].push(message);
    else await pages[target].evaluate(message => window.receive(message), message).catch(() => pending[target].push(message));
  });
  await context.route('**/letter-recovery-fixture*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await context.route('**/src/store/MultiplayerContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useMultiplayer=()=>window.mp;' }));
  await context.route('**/src/store/GameContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const HEART_POINTS={COMPLETE_QUIZ:10};export const useGame=()=>window.game;' }));
  await context.route('**/src/store/AuthContext.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const useAuth=()=>({checkLimit:()=>true,incrementPlayCount:()=>{}});' }));
  const page = pages[role] = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/letter-recovery-fixture?role=${role}`);
  await page.waitForFunction(() => window.listeners?.size > 0);
  await flush(role);
  return page;
}
async function reload(role) { await pages[role].reload(); await pages[role].waitForFunction(() => window.listeners?.size > 0); await flush(role); }
try {
  const host = await open('host'), guest = await open('guest');
  await guest.getByLabel('Word starting with A').waitFor();
  await reload('guest');
  await guest.getByLabel('Word starting with A').waitFor();
  await guest.getByLabel('Word starting with A').fill('APPLE');
  await guest.getByRole('button', { name: 'Submit!', exact: true }).click();
  await host.getByText('Guest Wins!').waitFor();
  await guest.getByText('Guest Wins!').waitFor();
  assert.equal(await guest.evaluate(() => window.points), 10);
  await reload('host');
  await host.getByText('Guest Wins!').waitFor();
  await reload('guest');
  await guest.getByText('Guest Wins!').waitFor();
  assert.equal(await guest.evaluate(() => window.points), 10, 'restoring the result never awards twice');
  await guest.evaluate(() => window.receive({ type: 'LETTER_STATE', payload: { roomCode: 'TEST42', roundId: 'letter-existing', stage: 'race', letter: 'A', winner: null, remainingMs: 0 } }));
  await guest.getByText('Guest Wins!').waitFor();
  await host.getByRole('button', { name: /Play Next Round/ }).click();
  await host.getByRole('button', { name: /Start Race!/ }).click();
  await host.getByText('Get ready...', { exact: true }).waitFor();
  await host.waitForTimeout(1100);
  await reload('host');
  await reload('guest');
  await host.getByRole('textbox').waitFor({ timeout: 2500 });
  await guest.getByRole('textbox').waitFor({ timeout: 2500 });
  const letter = await host.locator('h2.text-6xl').innerText();
  assert.equal(await guest.locator('h2.text-6xl').innerText(), letter, 'both players resume the same countdown and letter');
  await host.evaluate(letter => window.receive({ type: 'LETTER_WORD_SUBMIT', payload: { word: letter + 'AT', roundId: 'letter-existing' } }), letter);
  assert.equal(await host.getByRole('textbox').count(), 1, 'the prior round cannot win the resumed race');
  await guest.getByRole('textbox').fill(letter + 'AT');
  await guest.getByRole('button', { name: 'Submit!', exact: true }).click();
  await host.getByText('Guest Wins!').waitFor();
  assert.deepEqual(errors, []);
  console.log('Letter recovery: active race, host/guest result refresh, countdown remainder, room isolation, stale snapshots/submissions, and once-only rewards passed.');
} finally { await browser.close(); }
