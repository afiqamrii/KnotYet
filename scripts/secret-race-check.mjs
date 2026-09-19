import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const peerMock = `
class Emitter { constructor(){this.handlers=new Map()} on(n,h){this.handlers.set(n,[...(this.handlers.get(n)||[]),h])} emit(n,v){for(const h of this.handlers.get(n)||[])h(v)} }
const peers=new Map(),connections=new Set();
class Connection extends Emitter { constructor(){super();this.open=false;this.other=null} send(v){if(this.open&&this.other?.open)queueMicrotask(()=>this.other?.emit('data',v))} close(){if(!this.open)return;this.open=false;connections.delete(this);const o=this.other;this.emit('close');if(o?.open){o.open=false;connections.delete(o);o.emit('close')}} }
class Peer extends Emitter { constructor(id){super();this.id=typeof id==='string'?id:'guest-'+Math.random().toString(36).slice(2);this.open=false;this.destroyed=false;peers.set(this.id,this);queueMicrotask(()=>{this.open=true;this.emit('open',this.id)})} connect(id){const host=peers.get(id),mine=new Connection(),theirs=new Connection();mine.other=theirs;theirs.other=mine;queueMicrotask(()=>{if(!host?.open){this.emit('error',{type:'peer-unavailable'});return}host.emit('connection',theirs);mine.open=true;theirs.open=true;connections.add(mine);connections.add(theirs);queueMicrotask(()=>{mine.emit('open');theirs.emit('open')})});return mine} destroy(){this.destroyed=true;this.open=false;peers.delete(this.id);for(const c of [...connections])c.close()} reconnect(){this.open=true;this.emit('open',this.id)} }
window.__peerMock={drop:()=>{for(const c of [...connections])c.close()}};
export default Peer;`;
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
const {MultiplayerProvider,useMultiplayer}=await import('/src/store/MultiplayerContext.tsx');
const {GameProvider,useGame}=await import('/src/store/GameContext.tsx');
const {SecretNumberRaceGame}=await import('/src/components/SecretNumberRaceGame.tsx');
function Profile({name,avatar,children}){const game=useGame();React.useEffect(()=>game.setProfile({name,avatarId:avatar,heartPoints:0}),[]);return children}
function Player({role}){const room=useMultiplayer();React.useEffect(()=>{window[role+'Api']=room},[room,role]);return React.createElement('section',{id:role},React.createElement(SecretNumberRaceGame,{onEndGame:()=>{}}))}
function App(){return React.createElement(React.Fragment,null,React.createElement(MultiplayerProvider,null,React.createElement(GameProvider,null,React.createElement(Profile,{name:'Host',avatar:'sunny'},React.createElement(Player,{role:'host'})))),React.createElement(MultiplayerProvider,null,React.createElement(GameProvider,null,React.createElement(Profile,{name:'Guest',avatar:'mochi'},React.createElement(Player,{role:'guest'})))))}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>`;

try {
  const context = await browser.newContext();
  await context.route('**/node_modules/.vite/deps/peerjs.js*', route => route.fulfill({ contentType: 'text/javascript', body: peerMock }));
  await context.route('**/secret-race-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl + '/secret-race-fixture');
  await page.waitForFunction(() => Boolean(window.hostApi && window.guestApi));
  await page.evaluate(() => { window.hostApi.hostRoom('9876', { name: 'Host', avatarId: 'sunny', heartPoints: 0 }); window.guestApi.joinRoom('9876', { name: 'Guest', avatarId: 'mochi', heartPoints: 0 }); });
  await page.waitForFunction(() => window.hostApi.status === 'connected' && window.guestApi.status === 'connected');
  await page.waitForTimeout(1_000);
  assert.equal(await page.locator('#host').count(), 1, 'host race fixture stays mounted: ' + errors.join(' | '));
  assert.match(await page.locator('#host').innerText(), /Pick a number/, 'the host starts the first shared round after both players connect');
  await page.locator('#host .secret-race-number-form').waitFor();
  await page.locator('#host #secret-number-input').fill('7');
  await page.locator('#host').getByRole('button', { name: /Lock in my number/ }).click();
  await page.locator('#guest #secret-number-input').fill('4');
  await page.locator('#guest').getByRole('button', { name: /Lock in my number/ }).click();
  await page.locator('#host .secret-race-answer-form').waitFor({ timeout: 8000 });
  const equation = await page.locator('#host .secret-race-equation').innerText();
  const values = equation.match(/-?\d+/g).map(Number);
  const op = await page.locator('#host .secret-race-round strong').innerText();
  const correct = op === '+' ? values[0] + values[1] : op === '−' ? values[0] - values[1] : values[0] * values[1];
  await page.locator('#guest #secret-race-answer').fill('999');
  await page.locator('#guest').getByRole('button', { name: /Submit answer/ }).click();
  await page.locator('#guest').getByText(/Try again in/).waitFor();
  await page.waitForTimeout(2100);
  await page.locator('#host #secret-race-answer').fill(String(correct));
  await page.locator('#guest #secret-race-answer').fill(String(correct));
  await Promise.all([page.locator('#host').getByRole('button', { name: /Submit answer/ }).click(), page.locator('#guest').getByRole('button', { name: /Submit answer/ }).click()]);
  await page.getByText('Photo finish — it’s a tie!').first().waitFor({ timeout: 3000 });
  assert.match(await page.locator('#host').innerText(), /Photo finish/, 'near-simultaneous correct submissions result in a tie');
  await page.locator('#host').getByRole('button', { name: /Next round/ }).click();
  await page.locator('#host .secret-race-number-form').waitFor();
  await page.locator('#host #secret-number-input').fill('6');
  await page.locator('#host').getByRole('button', { name: /Lock in my number/ }).click();
  await page.evaluate(() => window.__peerMock.drop());
  await page.waitForFunction(() => window.hostApi.status === 'partner_left' && window.guestApi.status === 'partner_left');
  await page.waitForFunction(() => window.hostApi.status === 'connected' && window.guestApi.status === 'connected', { timeout: 10000 });
  await page.locator('#guest').getByText(/Host is ready/).waitFor();
  assert.equal(await page.locator('#guest .secret-race-number-form').count(), 1, 'a rejoined player returns to the current secret-number round');
  const solveCurrentRound = async () => {
    await page.locator('#host .secret-race-answer-form').waitFor({ timeout: 8000 });
    const equationText = await page.locator('#host .secret-race-equation').innerText();
    const equationNumbers = equationText.match(/-?\d+/g).map(Number);
    const operation = await page.locator('#host .secret-race-round strong').innerText();
    const answerValue = operation === '+' ? equationNumbers[0] + equationNumbers[1] : operation === '−' ? equationNumbers[0] - equationNumbers[1] : equationNumbers[0] * equationNumbers[1];
    await page.locator('#host #secret-race-answer').fill(String(answerValue));
    await page.locator('#host').getByRole('button', { name: /Submit answer/ }).click();
    await page.locator('#host .secret-race-result').waitFor({ timeout: 3000 });
  };
  await page.locator('#guest #secret-number-input').fill('4');
  await page.locator('#guest').getByRole('button', { name: /Lock in my number/ }).click();
  await solveCurrentRound();
  for (let round = 3; round <= 5; round += 1) {
    await page.locator('#host').getByRole('button', { name: /Next round/ }).click();
    await page.locator('#host .secret-race-number-form').waitFor();
    await page.locator('#host #secret-number-input').fill('6');
    await page.locator('#host').getByRole('button', { name: /Lock in my number/ }).click();
    await page.locator('#guest #secret-number-input').fill('3');
    await page.locator('#guest').getByRole('button', { name: /Lock in my number/ }).click();
    await solveCurrentRound();
  }
  await page.locator('#host').getByText(/best-of-five match/).waitFor();
  await page.locator('#host').getByRole('button', { name: /Play again/ }).click();
  await page.locator('#host').getByText('ROUND 1 OF 5').waitFor();
  assert.match(await page.locator('#host .secret-race-score').innerText(), /0[\s\S]*0/, 'Play again starts a clean best-of-five score');
  assert.deepEqual(errors, [], 'no browser errors during the race flow');
  console.log('SECRET RACE: private lock, wrong-answer delay, tie window, reconnect, best-of-five, and rematch passed.');
  await context.close();
} finally { await browser.close(); }
