import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const source = await (await fetch(`${base}/src/components/SecretNumberRaceGame.tsx`)).text();
const roomUrl = source.match(/import \{ useMultiplayer.*?\} from "([^"]+)"/)[1];
const peerMock = `
class Emitter { handlers={};on(type,fn){(this.handlers[type]??=[]).push(fn);}emit(type,value){for(const fn of this.handlers[type]||[])fn(value);} }
const peers=new Map();window.raceTraffic=[];window.dropSnapshots=false;
class Connection extends Emitter {open=false;other=null;send(message){window.raceTraffic.push(message);if(window.dropSnapshots&&['SECRET_RACE_START','SECRET_RACE_STATE'].includes(message.type))return;if(this.open&&this.other?.open)queueMicrotask(()=>this.other.emit('data',message));}close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other?.open){this.other.open=false;this.other.emit('close');}}}
export default class Peer extends Emitter {open=false;destroyed=false;connections=[];constructor(id){super();this.id=typeof id==='string'?id:'guest-'+Math.random();peers.set(this.id,this);queueMicrotask(()=>{this.open=true;this.emit('open',this.id);});}connect(id){const local=new Connection(),remote=new Connection();local.other=remote;remote.other=local;this.connections.push(local);queueMicrotask(()=>{const host=peers.get(id);host.connections.push(remote);host.emit('connection',remote);local.open=remote.open=true;queueMicrotask(()=>{local.emit('open');remote.emit('open');});});return local;}destroy(){this.destroyed=true;this.open=false;peers.delete(this.id);this.connections.forEach(conn=>conn.close());}reconnect(){this.open=true;this.emit('open',this.id);}}
`;
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
const {MultiplayerProvider,useMultiplayer}=await import('${roomUrl}');const {SecretNumberRaceGame}=await import('/src/components/SecretNumberRaceGame.tsx');
window.rewards=[];function Player({role}){const room=useMultiplayer();const [mounted,setMounted]=React.useState(false);window[role+'Api']=room;window[role+'Mount']=setMounted;return React.createElement('section',{id:role},mounted?React.createElement(SecretNumberRaceGame):null);}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,...['host','guest'].map(role=>React.createElement(MultiplayerProvider,{key:role},React.createElement(Player,{role})))));
</script></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
async function open() {
  const ctx = await browser.newContext();
  await ctx.route('**/node_modules/.vite/deps/peerjs.js*', route => route.fulfill({ contentType:'text/javascript',body:peerMock }));
  await ctx.route('**/src/store/GameContext.tsx*', route => route.fulfill({ contentType:'text/javascript',body:'export const HEART_POINTS={COMPLETE_QUIZ:10};export const useGame=()=>({partner:null,addHeartPoints:(...args)=>window.rewards.push(args)});' }));
  await ctx.route('**/src/utils/audio.ts*', route => route.fulfill({ contentType:'text/javascript',body:'export const sounds={playSuccess(){},playFlip(){},playTick(){},playMismatch(){}};' }));
  await ctx.route('**/secret-startup-fixture', route => route.fulfill({ contentType:'text/html',body:fixture }));
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto(`${base}/secret-startup-fixture`);
  await page.waitForFunction(() => window.hostApi && window.guestApi);
  await page.evaluate(() => { window.hostApi.hostRoom('6392',{name:'Host',avatarId:'sunny',heartPoints:0});window.guestApi.joinRoom('6392',{name:'Guest',avatarId:'mochi',heartPoints:0}); });
  await page.waitForFunction(() => window.hostApi.status==='connected' && window.guestApi.status==='connected');
  return {ctx,page};
}
const requests = page => page.evaluate(() => window.raceTraffic.filter(message=>message.type==='SECRET_RACE_REQUEST').length);
try {
  const lateGuest = await open();
  await lateGuest.page.evaluate(() => window.hostMount(true));
  await lateGuest.page.locator('#host #secret-number-input').waitFor();
  await lateGuest.page.waitForFunction(() => window.raceTraffic.some(message=>message.type==='SECRET_RACE_STATE'));
  await lateGuest.page.evaluate(() => window.guestMount(true));
  await lateGuest.page.locator('#guest #secret-number-input').waitFor({timeout:2500});
  assert.equal(await lateGuest.page.locator('#host #secret-number-input').inputValue(),'','late guest syncs without the host locking a number');
  const settledRequests = await requests(lateGuest.page);
  await lateGuest.page.clock.fastForward(20000);
  assert.equal(await requests(lateGuest.page),settledRequests,'requests stop after a snapshot arrives');
  await lateGuest.page.locator('#host #secret-number-input').fill('7');
  await lateGuest.page.locator('#host .secret-race-number-form').evaluate(form=>form.requestSubmit());
  const roundId = await lateGuest.page.evaluate(()=>JSON.parse(sessionStorage.getItem('secret_race_host_session')).state.matchId);
  await lateGuest.page.evaluate(()=>window.hostMount(false));
  await lateGuest.page.locator('#host #secret-number-input').waitFor({state:'hidden'});
  await lateGuest.page.evaluate(()=>window.hostMount(true));
  await lateGuest.page.locator('#host #secret-number-input').waitFor();
  assert.equal(await lateGuest.page.locator('#host #secret-number-input').inputValue(),'7','host refresh retains its locked private number');
  assert.equal(await lateGuest.page.locator('#host #secret-number-input').isDisabled(),true);
  assert.equal(await lateGuest.page.evaluate(()=>JSON.parse(sessionStorage.getItem('secret_race_host_session')).state.matchId),roundId,'host refresh keeps the same round');
  assert.equal(await lateGuest.page.evaluate(()=>window.raceTraffic.filter(message=>message.type==='SECRET_RACE_STATE').at(-1).payload.equation),undefined,'state replay never exposes picks before GO');
  await lateGuest.page.locator('#guest #secret-number-input').fill('4');
  await lateGuest.page.locator('#guest .secret-race-number-form').evaluate(form=>form.requestSubmit());
  await lateGuest.page.locator('#host .secret-race-countdown').waitFor();
  await lateGuest.page.clock.runFor(1100);
  await lateGuest.page.evaluate(()=>window.hostMount(false));
  await lateGuest.page.locator('#host .secret-race-countdown').waitFor({state:'hidden'});
  await lateGuest.page.evaluate(()=>window.hostMount(true));
  await lateGuest.page.locator('#host .secret-race-countdown').waitFor();
  await lateGuest.page.clock.runFor(2000);
  await lateGuest.page.locator('#host #secret-race-answer').waitFor({timeout:1500});
  const answer = await lateGuest.page.evaluate(()=>JSON.parse(sessionStorage.getItem('secret_race_host_session')).state.equation.answer);
  await lateGuest.page.locator('#host #secret-race-answer').fill(String(answer));
  await lateGuest.page.locator('#host .secret-race-answer-form').evaluate(form=>form.requestSubmit());
  // Reload during the tie window: preserve the first correct response.
  await lateGuest.page.evaluate(()=>window.hostMount(false));
  await lateGuest.page.locator('#host #secret-race-answer').waitFor({state:'hidden'});
  await lateGuest.page.evaluate(()=>window.hostMount(true));
  await lateGuest.page.locator('#host #secret-race-answer').waitFor();
  await lateGuest.page.clock.runFor(351);
  await lateGuest.page.locator('#host .secret-race-result').waitFor();
  await lateGuest.page.locator('#guest .secret-race-result').waitFor();
  await lateGuest.page.waitForFunction(()=>window.rewards.length===2);
  await lateGuest.page.evaluate(()=>{window.hostMount(false);window.guestMount(false);});
  await lateGuest.page.locator('.secret-race-result').waitFor({state:'hidden'});
  await lateGuest.page.evaluate(()=>window.hostMount(true));
  await lateGuest.page.locator('#host .secret-race-result').waitFor();
  await lateGuest.page.evaluate(()=>window.guestMount(true));
  await lateGuest.page.locator('#guest .secret-race-result').waitFor();
  assert.equal(await lateGuest.page.evaluate(()=>window.rewards.length),2,'host and guest result recovery cannot award the round again');
  assert.equal(await lateGuest.page.evaluate(()=>JSON.parse(sessionStorage.getItem('secret_race_host_session')).state.scores.host),1,'host refresh preserves the match score');
  await lateGuest.ctx.close();

  const earlyGuest = await open();
  await earlyGuest.page.evaluate(() => { window.dropSnapshots=true;window.guestMount(true); });
  await earlyGuest.page.waitForFunction(() => window.raceTraffic.some(message=>message.type==='SECRET_RACE_REQUEST'));
  await earlyGuest.page.evaluate(() => window.hostMount(true));
  await earlyGuest.page.locator('#host #secret-number-input').waitFor();
  await earlyGuest.page.evaluate(() => { window.dropSnapshots=false; });
  await earlyGuest.page.clock.fastForward(1001);
  await earlyGuest.page.locator('#guest #secret-number-input').waitFor({timeout:2500});
  assert.ok(await requests(earlyGuest.page)>=2,'lost initial request and broadcasts recover with a bounded state request retry');
  await earlyGuest.ctx.close();

  const missingHost = await open();
  await missingHost.page.evaluate(() => window.guestMount(true));
  await missingHost.page.waitForFunction(() => window.raceTraffic.some(message=>message.type==='SECRET_RACE_REQUEST'));
  await missingHost.page.clock.runFor(16000);
  await missingHost.page.getByRole('button',{name:'Retry round sync'}).waitFor({timeout:2500});
  const exhausted = await requests(missingHost.page);
  assert.ok(exhausted <= 16 && exhausted > 1,'retry burst is bounded');
  await missingHost.page.clock.runFor(20000);
  assert.equal(await requests(missingHost.page),exhausted,'timeout stops background requests');
  await missingHost.page.getByRole('button',{name:'Retry round sync'}).click();
  await missingHost.page.waitForFunction(previous=>window.raceTraffic.filter(message=>message.type==='SECRET_RACE_REQUEST').length>previous,exhausted);
  await missingHost.page.evaluate(() => window.hostMount(true));
  await missingHost.page.locator('#guest #secret-number-input').waitFor({timeout:2500});
  await missingHost.ctx.close();
  assert.deepEqual(errors,[]);
  console.log('Secret Race recovery: delayed mounts, lost initial snapshots, bounded/manual retry, private picks, host countdown/adjudication recovery, score retention and once-only restored rewards passed.');
} finally { await browser.close(); }
