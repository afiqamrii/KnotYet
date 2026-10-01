import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base=process.env.KNOTYET_TEST_URL||'http://localhost:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
const preamble=`<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
const fixture=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>${preamble}</head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import { ThisOrThatGame } from '/src/components/ThisOrThatGame.tsx';import '/src/index.css';import '/src/styles/play.css';import '/src/styles/play-layout.css';
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'arcade-play','data-playing':'true'},React.createElement('div',{className:'play-console'},React.createElement('main',{className:'arcade-play-main'},React.createElement(ThisOrThatGame)))));
</script></body></html>`;
const multiplayerMock=`import React from '/node_modules/.vite/deps/react.js';
const params=new URL(location.href).searchParams;const role=params.get('role');const listeners=new Set(),messages=new Set();window.sent=[];
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
let state={status:role?'connected':'disconnected',roomCode:role?(params.get('room')||'ROOM42'):null,isHost:role==='host',remoteProfile:{name:role==='host'?'Alex':'Jamie'},sendMessage:message=>{window.sent.push(message);void window.relayMessage(message)},subscribeMessage:fn=>{messages.add(fn);return()=>messages.delete(fn)}};
window.deliver=message=>messages.forEach(fn=>fn(message));window.setRoom=next=>{state={...state,...next};listeners.forEach(fn=>fn())};
export const useMultiplayer=()=>React.useSyncExternalStore(subscribe,()=>state);`;
const gameMock=`const role=new URL(location.href).searchParams.get('role');export const useGame=()=>({profile:{name:role==='guest'?'Alex':'Jamie'},partner:{name:'Alex'}});`;

async function makePage({role,viewport={width:1280,height:900},relay=async()=>{}}={}) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.exposeBinding('relayMessage',(_,message)=>relay(message));
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/choices-fixture') return route.fulfill({contentType:'text/html',body:fixture});
    if(url.pathname==='/src/store/MultiplayerContext.tsx') return route.fulfill({contentType:'application/javascript',body:multiplayerMock});
    if(url.pathname==='/src/store/GameContext.tsx') return route.fulfill({contentType:'application/javascript',body:gameMock});
    if(url.hostname!=='localhost'&&url.hostname!=='127.0.0.1') return route.fulfill({status:204,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(`${role||'local'}: ${error.message}`));
  await page.goto(`${base}/choices-fixture${role?`?role=${role}`:''}`);
  await page.locator('.choices-game').waitFor();
  return {context,page};
}
async function stored(page,role) {return page.evaluate(key=>{const saved=JSON.parse(sessionStorage.getItem(key));return saved?.round||saved},`choices_${role||'local'}`)}
async function next(page){await page.getByRole('button',{name:/^(Next choice|Finish round)/}).click()}
async function assertFits(page,width){const metrics=await page.locator('.choices-game').evaluate(el=>({width:document.documentElement.scrollWidth,rect:el.getBoundingClientRect().toJSON()}));assert.ok(metrics.width<=width+1&&metrics.rect.left>=-1&&metrics.rect.right<=width+1,`layout overflow ${width}: ${JSON.stringify(metrics)}`)}

try {
  {
    const {context,page}=await makePage();
    for(let index=0;index<8;index++){
      await page.locator('.choices-option').nth(index%2).click();
      assert.equal((await stored(page)).index,index);
      await page.locator('.choices-followup').waitFor();
      if(index===2){const before=await stored(page);await page.reload();await page.locator('.choices-followup').waitFor();assert.deepEqual(await stored(page),before,'solo committed answer survives refresh')}
      await next(page);
    }
    await page.getByRole('heading',{name:'A little more you.'}).waitFor();
    assert.equal((await stored(page)).index,8);
    await page.getByRole('button',{name:'Play another round'}).click();
    assert.equal((await stored(page)).index,0);
    assert.deepEqual((await stored(page)).picks,[null,null]);
    await context.close();
    console.log('This or That: solo eight-round completion, saved answer, and restart passed');
  }
  {
    const {context,page}=await makePage();
    await page.getByRole('button',{name:'Pass the phone',exact:true}).click();
    for(let index=0;index<8;index++){
      await page.locator('.choices-option').first().click();
      await page.getByRole('heading',{name:'Pass to Alex'}).waitFor();
      assert.equal(await page.locator('.choices-option').count(),0,'handover hides both options and first choice');
      if(index===0){await page.reload();await page.getByRole('heading',{name:'Pass to Alex'}).waitFor();assert.deepEqual((await stored(page)).picks,[0,null],'reload preserves private first pick')}
      await page.getByRole('button',{name:'I’m ready'}).click();
      assert.equal(await page.locator('.choice-first').count(),0,'second player cannot see first pick before choosing');
      await page.locator('.choices-option').nth(index%2).click();
      await page.locator('.choices-followup').waitFor();
      assert.equal(await page.locator('.choices-votes > span').count(),2);
      await next(page);
    }
    await page.getByRole('heading',{name:'Eight choices. Plenty to talk about.'}).waitFor();
    assert.equal((await stored(page)).matches,4,'matching count includes each round once');
    await context.close();
    console.log('This or That: private pass-phone handover, refresh, reveal, and score passed');
  }
  {
    let host,guest;let dropped=false;
    const relayTo=target=>async message=>{const page=target==='host'?host?.page:guest?.page;if(!dropped&&page&&!page.isClosed())await page.evaluate(message=>window.deliver?.(message),message).catch(error=>{if(!/Execution context was destroyed/.test(error.message))throw error})};
    host=await makePage({role:'host',relay:relayTo('guest')});
    guest=await makePage({role:'guest',relay:relayTo('host')});
    // Attach the receiver before its first request; early startup responses may
    // arrive before the test has assigned the guest page handle.
    await guest.page.evaluate(()=>window.relayMessage({type:'CHOICES_REQUEST'}));
    await guest.page.locator('.choices-option').first().waitFor();
    let firstRound;
    for(let index=0;index<8;index++){
      await Promise.all([host.page.locator('.choices-option').first().click(),guest.page.locator('.choices-option').nth(index%2).click()]);
      await host.page.locator('.choices-followup').waitFor();await guest.page.locator('.choices-followup').waitFor();
      const current=await stored(host.page,'host');assert.deepEqual(await stored(guest.page,'guest'),current,'paired clients reveal the same state');
      if(index===0){
        firstRound=current.roundId;
        await host.page.evaluate(id=>{window.deliver({type:'CHOICES_PICK',payload:{roundId:id,choice:1}});window.deliver({type:'CHOICES_PICK',payload:{roundId:'stale-round',choice:1}})},firstRound);
        assert.deepEqual(await stored(host.page,'host'),current,'duplicate and stale submissions cannot change locked choices');
        await guest.page.reload();await guest.page.locator('.choices-followup').waitFor();assert.deepEqual(await stored(guest.page,'guest'),current,'guest reload requests current host state');
        await host.page.reload();await host.page.locator('.choices-followup').waitFor();assert.deepEqual(await stored(host.page,'host'),current,'host reload restores the room-scoped state');
        assert.equal(await guest.page.getByRole('button',{name:/^(Next choice|Finish round)/}).count(),0,'host owns progression');
      }
      await next(host.page);
      if(index<7){await guest.page.waitForFunction(index=>JSON.parse(sessionStorage.getItem('choices_guest'))?.round?.index===index,index+1);await guest.page.locator('.choices-option').first().waitFor();}
      if(index===0){
        const nextRound=await stored(host.page,'host');
        await host.page.evaluate(id=>window.deliver({type:'CHOICES_PICK',payload:{roundId:id,choice:1}}),firstRound);
        assert.deepEqual(await stored(host.page,'host'),nextRound,'a delayed prior-round pick is ignored');
        dropped=true;await Promise.all([host.page.evaluate(()=>window.setRoom({status:'partner_left'})),guest.page.evaluate(()=>window.setRoom({status:'partner_left'}))]);
        await host.page.getByText('Your round is paused while your partner reconnects.').waitFor();
        assert.equal(await host.page.getByRole('button',{name:'Solo',exact:true}).count(),0,'disconnected room stays in paired mode');
        assert.equal(await host.page.getByRole('button',{name:'Sync round'}).isDisabled(),true);
        dropped=false;await host.page.evaluate(()=>window.setRoom({status:'connected'}));await guest.page.evaluate(()=>window.setRoom({status:'connected'}));
        await guest.page.locator('.choices-option').first().waitFor();
        assert.deepEqual(await stored(host.page,'host'),nextRound,'reconnect preserves host round');
      }
    }
    await host.page.getByRole('heading',{name:'Eight choices. Plenty to talk about.'}).waitFor();await guest.page.getByRole('heading',{name:'Eight choices. Plenty to talk about.'}).waitFor();
    assert.equal((await stored(host.page,'host')).matches,4);
    await host.page.getByRole('button',{name:'Play another round'}).click();
    await guest.page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('choices_guest'))?.round?.index===0);
    assert.deepEqual((await stored(guest.page,'guest')).picks,[null,null]);
    const lastId=(await stored(host.page,'host')).roundId;
    dropped=true;await host.page.goto(`${base}/choices-fixture?role=host&room=OTHERROOM`);await host.page.locator('.choices-option').first().waitFor();await host.page.locator('.choices-option').first().click();
    assert.notEqual((await stored(host.page,'host')).roundId,lastId,'another room cannot inherit the previous room round');
    assert.equal(await host.page.evaluate(()=>JSON.parse(sessionStorage.getItem('choices_host')).roomCode),'OTHERROOM');
    await host.context.close();await guest.context.close();
    console.log('This or That: host/guest relay, stale and duplicate picks, reload, disconnect recovery, completion, restart, and room isolation passed');
  }
  await mkdir('artifacts',{recursive:true});
  for(const width of [320,390,1440]){
    const {context,page}=await makePage({viewport:{width,height:900}});
    await assertFits(page,width);await page.locator('.choices-option').first().click();await page.locator('.choices-followup').waitFor();await assertFits(page,width);
    await page.screenshot({path:`artifacts/this-or-that-${width}.png`,fullPage:true});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('This or That: 320/390/1440 responsive play and reveal screens passed without page errors');
}finally{await browser.close()}
