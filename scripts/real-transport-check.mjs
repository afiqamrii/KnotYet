// Local isolated harness + REAL PeerJS signaling/WebRTC. This is not a live
// signed-in account test and never mounts the harness on the deployed origin.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'The isolated harness may only run on a local development server.');
const componentSource = await (await fetch(`${base}/src/components/NumberGuesserGame.tsx`)).text();
const gameContext = componentSource.match(/import \{[^}]*useGame[^}]*\} from "([^"]+)"/)[1];
const roomContext = componentSource.match(/import \{[^}]*useMultiplayer[^}]*\} from "([^"]+)"/)[1];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const code = `T${randomBytes(4).toString('hex').toUpperCase()}`;
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/src/index.css');const role=new URL(location.href).searchParams.get('role');
const profile={name:role==='host'?'Transport Host':'Transport Guest',avatarId:role==='host'?'sunny':'mochi',heartPoints:0};
localStorage.setItem('jodohdeck_profile',JSON.stringify(profile));localStorage.setItem('jodohdeck_lang','en');
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
const {GameProvider}=await import('${gameContext}');const {MultiplayerProvider,useMultiplayer}=await import('${roomContext}');
const names={number:'NumberGuesserGame',letter:'LetterRaceGame',choices:'ThisOrThatGame',quiz:'CoupleGuessGame',match:'MatchGame',wheel:'SpinWheel','secret-race':'SecretNumberRaceGame'};
const games={};for(const [key,name]of Object.entries(names)){games[key]=(await import('/src/components/'+name+'.tsx'))[name];}
function Harness(){const room=useMultiplayer();const booted=React.useRef(false);React.useEffect(()=>{window.room=room;window.profile=profile;},[room]);React.useEffect(()=>{if(booted.current)return;booted.current=true;const saved=sessionStorage.getItem('mp_roomCode');if(saved){if(role==='host')room.hostRoom(saved,profile,true);else room.joinRoom(saved,profile,true);}},[]);const Game=games[room.activeGame];return React.createElement('main',{className:'arcade-play','data-game':room.activeGame},React.createElement('p',{id:'transport-status'},room.status),Game?React.createElement(Game):React.createElement('h1',null,'Isolated real transport harness'));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement(MultiplayerProvider,null,React.createElement(Harness))));
</script></body></html>`;
const errors = [], diagnostics = [], pages = {};
async function open(role, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.route('**/real-transport-fixture*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = pages[role] = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
  page.on('websocket', socket => {
    socket.on('framereceived', frame => {
      try { if (JSON.parse(String(frame.payload)).type === 'OPEN') page.signalReady = true; } catch {}
    });
    socket.on('socketerror', () => diagnostics.push(`${role}: signaling socket error`));
  });
  page.on('console', message => { if (message.type() === 'error' && /Could not connect|Lost connection|peer-unavailable|server-error/i.test(message.text())) diagnostics.push(`${role}: ${message.text().slice(0,200)}`); });
  await page.goto(`${base}/real-transport-fixture?role=${role}`);
  await page.waitForFunction(() => Boolean(window.room));
  return page;
}
async function connected() {
  await Promise.all(Object.values(pages).map(page => page.waitForFunction(() => window.room?.status === 'connected' && window.room.remoteProfile, undefined, { timeout: 35000 })));
}
async function select(game) {
  await pages.host.evaluate(game => window.room.setGame(game), game);
  await pages.guest.waitForFunction(game => window.room.activeGame === game, game);
}
try {
  const host = await open('host', { width: 1280, height: 850 });
  const guest = await open('guest', { width: 390, height: 844 });
  await host.evaluate(code => window.room.hostRoom(code, window.profile), code);
  const deadline = Date.now() + 20000;
  while (!host.signalReady && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(host.signalReady, `Real PeerJS host signaling did not open. ${diagnostics.join(' | ')}`);
  await guest.evaluate(code => window.room.joinRoom(code, window.profile), code);
  await connected();
  console.log('REAL TRANSPORT: two isolated clients joined via PeerJS signaling/WebRTC.');

  await select('number');
  await host.getByLabel('Your guess').waitFor();
  const secret = await host.evaluate(() => Number(sessionStorage.getItem('num_secret')));
  const wrong = secret === 50 ? 49 : 50;
  await host.getByLabel('Your guess').fill(String(wrong));
  await host.getByRole('button', { name: `Lock in ${wrong}`, exact: true }).click();
  await guest.getByLabel('Your guess').waitFor();
  await guest.reload();
  await connected();
  await guest.getByLabel('Your guess').waitFor();
  assert.equal(await guest.evaluate(() => JSON.parse(sessionStorage.getItem('num_guesses')).length), 1, 'real guest reconnection restores turn history');
  await host.reload();
  await connected();
  await guest.getByLabel('Your guess').waitFor();
  assert.equal(await host.evaluate(() => JSON.parse(sessionStorage.getItem('num_guesses')).length), 1, 'real host reconnection preserves turn history');
  assert.equal(await host.getByLabel('Your guess').count(), 0, 'host reload does not steal the guest turn');
  await guest.getByLabel('Your guess').fill(String(secret));
  await guest.getByRole('button', { name: `Lock in ${secret}`, exact: true }).click();
  await host.getByText('Transport Guest Guessed It!').waitFor();
  await guest.getByText('Transport Guest Guessed It!').waitFor();
  console.log('REAL TRANSPORT: Number Guesser host/guest reloads, automatic reconnect, turn recovery, and result sync passed.');

  await select('letter');
  await host.getByRole('button', { name: /Start Race!/ }).click();
  await guest.getByRole('textbox').waitFor();
  const letter = await guest.locator('h2.text-6xl').innerText();
  await guest.reload();
  await connected();
  await guest.getByLabel(`Word starting with ${letter}`).waitFor();
  await guest.getByLabel(`Word starting with ${letter}`).fill(letter + 'AT');
  await guest.getByRole('button', { name: 'Submit!', exact: true }).click();
  await host.getByText('Transport Guest Wins!').waitFor();
  await guest.getByText('Transport Guest Wins!').waitFor();
  console.log('REAL TRANSPORT: Letter Race guest reload, active letter recovery, and host result adjudication passed.');

  await select('choices');
  await host.locator('.choices-option').first().click();
  await guest.locator('.choices-option').first().click();
  await host.locator('.choices-followup').waitFor();
  await guest.locator('.choices-followup').waitFor();
  await host.getByRole('button', { name: /Next choice/ }).click();
  await guest.waitForFunction(() => JSON.parse(sessionStorage.getItem('choices_guest')).round.index === 1);
  console.log('REAL TRANSPORT: This or That picks, reveal, and round advance passed.');

  await select('match');
  await host.locator('.answer-grid button').first().click();
  await guest.locator('.answer-grid button').first().click();
  await host.getByRole('dialog').waitFor();
  await guest.getByRole('dialog').waitFor();
  await host.locator('[data-result-next]').click();
  await guest.waitForFunction(() => sessionStorage.getItem('match_currentIndex') === '1');
  console.log('REAL TRANSPORT: Couple Match deck, choices, reveal, and advance passed.');

  await select('quiz');
  await host.locator('.answer-grid button').first().click();
  await guest.locator('.answer-grid button').first().click();
  await host.getByRole('dialog').waitFor();
  await guest.getByRole('dialog').waitFor();
  await host.locator('[data-result-next]').click();
  await guest.waitForFunction(() => sessionStorage.getItem('guess_currentIndex') === '1');
  console.log('REAL TRANSPORT: Guess My Heart secret, guess, reveal, and advance passed.');

  await select('wheel');
  await host.getByRole('button', { name: 'SPIN!', exact: true }).click();
  await Promise.all([host, guest].map(page => page.getByRole('dialog', { name: 'Wheel result' }).waitFor()));
  await host.getByLabel('Your answer or reaction').fill('Synthetic transport check');
  await host.getByRole('button', { name: 'Submit & Reveal', exact: true }).click();
  await guest.getByLabel('Your answer or reaction').fill('Synthetic peer reply');
  await guest.getByRole('button', { name: 'Submit & Reveal', exact: true }).click();
  await host.getByText('Synthetic peer reply', { exact: true }).waitFor();
  await guest.getByText('Synthetic transport check', { exact: true }).waitFor();
  await host.getByRole('button', { name: 'Continue together' }).click();
  await guest.getByRole('dialog', { name: 'Wheel result' }).waitFor({ state: 'detached' });
  console.log('REAL TRANSPORT: Spin Wheel prompt, private answers, reveal, and dismissal passed.');

  await select('secret-race');
  await host.getByLabel('Your secret number').fill('3');
  await host.getByRole('button', { name: /Lock in my number/ }).click();
  await guest.getByLabel('Your secret number').fill('7');
  await guest.getByRole('button', { name: /Lock in my number/ }).click();
  await host.getByLabel('Your answer', { exact: true }).waitFor();
  const operation = await host.locator('.secret-race-equation i').innerText();
  const answer = operation === '+' ? 10 : operation === '−' ? -4 : 21;
  await guest.getByLabel('Your answer', { exact: true }).fill(String(answer));
  await guest.getByRole('button', { name: /Submit answer/ }).click();
  await host.getByText('Transport Guest took this one!', { exact: true }).waitFor();
  await guest.getByText('You won this round!', { exact: true }).waitFor();
  console.log('REAL TRANSPORT: Secret Number Race private locks, countdown, equation, and result passed.');

  assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile fixture has no horizontal overflow');
  assert.deepEqual(errors, []);
  await host.evaluate(() => window.room.leaveRoom());
  await guest.waitForFunction(() => window.room.status === 'partner_left');
  console.log('REAL TRANSPORT PASSED. Scope: local real game components and actual network transport; production OAuth, account permissions, contacts, and cloud persistence were not tested by this harness.');
} catch (error) {
  const states = await Promise.all(Object.entries(pages).map(async ([role, page]) => ({ role, state: await page.evaluate(() => ({ status: window.room?.status, game: window.room?.activeGame, error: window.room?.error })).catch(() => null) })));
  console.error('Real transport diagnostics:', JSON.stringify({ states, diagnostics, errors }));
  throw error;
} finally { await browser.close(); }
