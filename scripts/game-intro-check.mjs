import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.KNOTYET_TEST_URL || 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const preamble = `<script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>${preamble}</head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import { GameIntro } from '/src/components/GameIntro.tsx';
import { GameModeNav } from '/src/components/GameModeNav.tsx';
import '/src/index.css';import '/src/styles/play.css';import '/src/styles/play-layout.css';
window.starts=0;
function App(){const [game,setGame]=React.useState('swipe');const [show,setShow]=React.useState(true);window.changeGame=setGame;window.showIntro=setShow;
return React.createElement('div',{className:'arcade-play'},React.createElement('div',{className:'play-console'},React.createElement('header',{className:'play-header'},React.createElement(GameModeNav,{currentTab:game,onSelect:setGame,labels:{swipe:'Icebreaker Cards',quiz:'Guess My Heart',wheel:'Spin Wheel',number:'Number Guesser',letter:'Letter Race',match:'Couple Match',choices:'This or That'}})),React.createElement('main',{className:'arcade-play-main'},show?React.createElement(GameIntro,{gameType:game,onStart:()=>window.starts++}):React.createElement('p',null,'Closed'))));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>`;
const mock = `import React from '/node_modules/.vite/deps/react.js';
const listeners=new Set();const messages=new Set();window.sent=[];
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
let state={status:'disconnected',isHost:false,remoteProfile:{name:'Alex'},sendMessage:message=>window.sent.push(message),subscribeMessage:fn=>{messages.add(fn);return()=>messages.delete(fn)}};
window.setRoom=next=>{state={...state,...next};listeners.forEach(fn=>fn())};
window.deliver=message=>messages.forEach(fn=>fn(message));
export const useMultiplayer=()=>React.useSyncExternalStore(subscribe,()=>state);`;
const errors=[];
async function setup(viewport={width:1280,height:850}) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/intro-fixture') return route.fulfill({contentType:'text/html',body:fixture});
    if(url.pathname==='/src/store/MultiplayerContext.tsx') return route.fulfill({contentType:'application/javascript',body:mock});
    if(url.hostname!=='localhost') return route.fulfill({status:204,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();await page.goto(`${base}/intro-fixture`);
  await page.getByRole('heading',{name:'Icebreaker Cards',exact:true}).waitFor();
  return {context,page};
}
try {
  {
    const {context,page}=await setup();
    await page.getByRole('button',{name:'Start with a card'}).evaluate(el=>{el.click();el.click()});
    await page.clock.runFor(4000);
    assert.equal(await page.evaluate(()=>window.starts),1,'rapid double start completes once');
    await context.close();
  }
  {
    const {context,page}=await setup();
    await page.getByRole('button',{name:'Start with a card'}).click();
    await page.evaluate(()=>window.showIntro(false));await page.getByText('Closed',{exact:true}).waitFor();
    await page.clock.runFor(4000);
    assert.equal(await page.evaluate(()=>window.starts),0,'unmounted intro cannot start later');
    await context.close();
  }
  {
    const {context,page}=await setup();
    await page.getByRole('button',{name:'Start with a card'}).click();
    await page.evaluate(()=>window.changeGame('choices'));await page.getByRole('heading',{name:'This or That',exact:true}).waitFor();
    await page.clock.runFor(4000);
    assert.equal(await page.evaluate(()=>window.starts),0,'changing game cancels previous countdown');
    await context.close();
  }
  {
    const {context,page}=await setup();
    await page.evaluate(()=>window.setRoom({status:'connected',isHost:false}));
    await page.getByRole('button',{name:'Waiting for the host'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Waiting for the host'}).isDisabled(),true);
    await page.evaluate(()=>{window.deliver({type:'START_COUNTDOWN',payload:{game:'quiz'}});window.deliver({type:'START_GAME',payload:{game:'quiz'}})});
    assert.equal(await page.evaluate(()=>window.starts),0,'another game cannot start this intro');
    await page.getByRole('heading',{name:'Icebreaker Cards',exact:true}).waitFor();
    await page.evaluate(()=>{window.deliver({type:'START_COUNTDOWN',payload:{game:'swipe'}});window.deliver({type:'START_COUNTDOWN',payload:{game:'swipe'}})});
    await page.clock.runFor(4000);
    assert.equal(await page.evaluate(()=>window.starts),0,'guest waits for host start commit');
    await page.evaluate(()=>{window.deliver({type:'START_GAME',payload:{game:'swipe'}});window.deliver({type:'START_GAME',payload:{game:'swipe'}})});
    assert.equal(await page.evaluate(()=>window.starts),1,'duplicate start packet completes once');
    await context.close();
  }
  {
    const {context,page}=await setup();
    await page.evaluate(()=>window.setRoom({status:'connected',isHost:true}));
    await page.getByRole('button',{name:'Start together'}).waitFor();
    await page.evaluate(()=>window.deliver({type:'START_GAME',payload:{game:'swipe'}}));
    assert.equal(await page.evaluate(()=>window.starts),0,'guest cannot start the host game');
    await page.getByRole('button',{name:'Start together'}).evaluate(el=>{el.click();el.click()});
    await page.clock.runFor(4000);
    assert.deepEqual(await page.evaluate(()=>window.sent.map(message=>message.type)),['START_COUNTDOWN','START_GAME']);
    assert.equal(await page.evaluate(()=>window.starts),1);
    await context.close();
  }
  await mkdir('artifacts',{recursive:true});
  for(const width of [320,390,1024,1440]) {
    const {context,page}=await setup({width,height:900});
    const nav=page.getByRole('navigation',{name:'Choose your game'});
    assert.equal(await nav.getByRole('button').count(),7,'all offline games are discoverable');
    const metrics=await nav.evaluate(el=>({width:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...el.querySelectorAll('button')].map(button=>({left:button.getBoundingClientRect().left,right:button.getBoundingClientRect().right,height:button.getBoundingClientRect().height}))}));
    assert.ok(metrics.width<=width+1,`picker overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.buttons.every(button=>button.left>=0&&button.right<=width+1&&button.height>=44),'picker controls remain visible and touch sized');
    await nav.getByRole('button',{name:'This or That'}).click();
    await page.getByRole('heading',{name:'This or That',exact:true}).waitFor();
    if(width===390||width===1440) await page.screenshot({path:`artifacts/game-picker-${width}.png`,fullPage:true});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Game intro: timer cleanup, duplicate/cross-game packets, host authority, and 7-game picker at 320/390/1024/1440 passed');
} finally {await browser.close();}
