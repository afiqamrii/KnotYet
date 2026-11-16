import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React = (await import('/@id/react')).default;
const ReactDOM = (await import('/@id/react-dom/client')).default;
await import('/src/index.css');
const {PlayScreen}=await import('/src/screens/PlayScreen.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Suspense,{fallback:'Loading'},React.createElement(PlayScreen)));
</script></body></html>`;
const game = `import {i18n} from '/src/data/i18n.ts';const state={profile:{name:'Alex',avatarId:'sunny',heartPoints:0},partner:null,lang:'en',t:i18n.en,addHeartPoints:()=>{},recordAnsweredQuestion:()=>{}};export const useGame=()=>state;export const HEART_POINTS={COMPLETE_DECK:10};`;
const auth = `const state={couple:null,progress:{answered_questions:[]},isLoading:false,checkLimit:()=>true,incrementPlayCount:()=>{}};export const useAuth=()=>state;`;
const friends = `const state={friends:[],unreadTotal:0,setActiveChatFriendId:()=>{}};export const useFriends=()=>state;`;
const multiplayer = `import React from '/@id/react';const listeners=new Set();const messages=new Set();const notify=()=>listeners.forEach(fn=>fn());const update=next=>{state={...state,...next};notify()};
let state={status:'disconnected',activeGame:'lobby',isHost:true,questionDecks:{},questionIndices:{},roomCode:null,chatMessages:[],unreadChatCount:0,remoteProfile:{name:'Sam',avatarId:'sunny'},sendMessage:()=>{},subscribeMessage:fn=>{messages.add(fn);return()=>messages.delete(fn)},hostRoom:()=>{},joinRoom:()=>{},leaveRoom:()=>update({status:'disconnected',activeGame:'lobby',roomCode:null}),setGame:activeGame=>update({activeGame}),clearUnreadChatCount:()=>{}};
window.setRoom=update;export const useMultiplayer=()=>React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state);`;

async function setup(width=390, storage={intro:'null', tab:'swipe'}, height=900) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await context.addInitScript(({intro,tab})=>{sessionStorage.setItem('knotyet_introShown',intro);localStorage.setItem('knotyet_activeTab',tab);}, storage);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/navigation-fixture') return route.fulfill({contentType:'text/html',body:html});
    const mocks={'/src/store/GameContext.tsx':game,'/src/store/AuthContext.tsx':auth,'/src/store/FriendsContext.tsx':friends,'/src/store/MultiplayerContext.tsx':multiplayer};
    if(mocks[url.pathname])return route.fulfill({contentType:'application/javascript',body:mocks[url.pathname]});
    if(url.origin!==new URL(base).origin) return route.fulfill({status:204,body:''});
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/navigation-fixture`);
  await page.locator('.arcade-play').waitFor();
  return {context,page};
}

try {
  await mkdir('artifacts',{recursive:true});
  for(const width of [320,390,768,1024,1440]) {
    const {context,page}=await setup(width);
    const nav=page.getByRole('navigation',{name:'Choose your game'});
    await nav.waitFor();
    assert.equal(await nav.getByRole('button').count(),9,'malformed intro storage recovers to the full picker');
    const previous=await nav.locator('[aria-current="page"]').getAttribute('aria-label');
    await page.getByRole('button',{name:/Surprise me/}).click();
    assert.notEqual(await nav.locator('[aria-current="page"]').getAttribute('aria-label'),previous,'surprise picks a different game');
    const metrics=await nav.evaluate(el=>({width:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...el.querySelectorAll('button')].map(button=>{const bounds=button.getBoundingClientRect();const label=button.querySelector('.game-mode-label');return {left:bounds.left,right:bounds.right,height:bounds.height,labelFits:label.scrollWidth<=label.clientWidth+1};})}));
    assert.ok(metrics.width<=metrics.viewport+1,`no horizontal overflow at ${width}`);
    assert.ok(metrics.buttons.every(button=>button.left>=0&&button.right<=width+1&&button.height>=44&&button.labelFits),`full game titles and touch controls fit at ${width}`);
    if(width===390||width===1440)await page.screenshot({path:`artifacts/navigation-${width}.png`,fullPage:true});
    await context.close();
  }
  for(const width of [320,1440]) {
    const {context,page}=await setup(width);
    if(width===1440)await page.setViewportSize({width,height:600});
    const trigger=page.getByRole('button',{name:/Explore games/});await trigger.click();
    const library=page.getByRole('dialog',{name:'What feels good today?'});await library.waitFor();
    assert.equal(await library.locator('.library-game').count(),9);
    assert.equal(await library.getByRole('button',{name:'Close game library'}).evaluate(el=>el===document.activeElement),true,'library takes keyboard focus');
    await library.getByLabel('Works solo').check();assert.equal(await library.locator('.library-game').count(),7,'solo filter excludes the two partner-only games');
    await library.getByLabel('Works solo').uncheck();
    await library.getByRole('group',{name:'Game library filters'}).getByRole('button',{name:'Make something'}).click();
    assert.equal(await library.locator('.library-game').count(),1);await library.getByRole('heading',{name:'Story Builder',exact:true}).waitFor();
    await library.getByRole('group',{name:'Game library filters'}).getByRole('button',{name:'All games'}).click();
    await library.getByLabel('Search games').fill('memory');assert.equal(await library.locator('.library-game').count(),1);
    await library.getByRole('button',{name:'Save Memory Match',exact:true}).click();
    await library.getByLabel('Search games').fill('');await library.getByRole('button',{name:/^Favourites/}).click();
    assert.equal(await library.locator('.library-game').count(),1);assert.equal(await library.getByRole('button',{name:'Unsave Memory Match'}).getAttribute('aria-pressed'),'true');
    await library.getByRole('button',{name:'Choose Memory Match'}).click();await page.locator('#intro-memory').waitFor();
    await trigger.click();await library.getByRole('button',{name:/^Favourites/}).click();assert.equal(await library.locator('.library-game').count(),1,'favourite survives reopening');
    await library.getByRole('button',{name:'Unsave Memory Match'}).click();await library.getByRole('heading',{name:'Your favourites live here.'}).waitFor();
    assert.equal(await library.getByLabel('Search games').evaluate(el=>el===document.activeElement),true,'removing a filtered favourite keeps focus in the library');
    await library.getByRole('button',{name:'Explore all games'}).click();await library.getByLabel('Search games').fill('no-such-game-zzzz');
    await library.getByRole('heading',{name:'Nothing here just yet.'}).waitFor();
    await library.getByRole('button',{name:'Explore all games'}).click();assert.equal(await library.locator('.library-game').count(),9,'empty-state reset clears filters');
    assert.equal(await library.getByLabel('Search games').evaluate(el=>el===document.activeElement),true,'empty-state reset returns focus to search');
    await library.getByRole('button',{name:'Save Guess My Heart',exact:true}).click();await library.getByRole('button',{name:/^Favourites/}).click();await library.getByLabel('Works solo').check();
    await library.getByRole('heading',{name:'Nothing here just yet.'}).waitFor();
    assert.equal(await library.getByRole('heading',{name:'Your favourites live here.'}).count(),0,'filtered favourites are not misreported as an empty collection');
    await library.getByRole('button',{name:'Explore all games'}).click();
    const smallControls=await library.evaluate(el=>[...el.querySelectorAll('button,.library-solo')].filter(control=>control.getBoundingClientRect().height<43).map(control=>control.getAttribute('aria-label')||control.textContent));
    assert.deepEqual(smallControls,[],'library controls meet 44px target size');
    const overflow=await library.evaluate(el=>({width:document.documentElement.scrollWidth,viewport:innerWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    assert.ok(overflow.width<=overflow.viewport+1&&overflow.left>=0&&overflow.right<=overflow.viewport+1,'library stays within phone/desktop viewport');
    await page.screenshot({path:`artifacts/library-${width}.png`,fullPage:true});
    await library.getByRole('button',{name:'Close game library'}).focus();await page.keyboard.press('Shift+Tab');
    assert.equal(await library.evaluate(el=>el.contains(document.activeElement)),true,'library traps keyboard focus');
    await page.keyboard.press('Escape');assert.equal(await library.count(),0);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'closing restores picker focus');
    await context.close();
  }
  for(const width of [1024,1366]) {
    const {context,page}=await setup(width, {intro:'{}',tab:'swipe'}, 600);
    await page.locator('.game-primary-action').waitFor();
    const bounds=await page.locator('.game-primary-action').boundingBox();
    assert.ok(bounds.y>=0&&bounds.y+bounds.height<=600,`Start stays visible on ${width}x600 laptop`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'short laptop console fits the viewport');
    await context.close();
  }
  {
    const {context,page}=await setup(390,{intro:'{"secret-race":true,"swipe":"true"}',tab:'secret-race'});
    await page.locator('#intro-swipe').waitFor();
    assert.equal(await page.locator('.game-mode-swipe').getAttribute('aria-current'),'page','online-only saved game returns to offline picker');
    await context.close();
  }
  {
    const {context,page}=await setup(390,{intro:'{"swipe":true}',tab:'swipe'});
    await page.locator('.arcade-card-stack').waitFor();
    const index=await page.evaluate(()=>sessionStorage.getItem('swipe_index'));
    await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',repeat:true,bubbles:true})));
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('swipe_index')),index,'held arrow cannot skip cards');
    await page.evaluate(()=>window.setRoom({status:'partner_left'}));
    const dialog=page.getByRole('alertdialog',{name:'Your partner disconnected'});await dialog.waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByRole('button',{name:'Leave room'}).evaluate(el=>el===document.activeElement),true,'partner-away keyboard focus stays in dialog');
    await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('swipe_index')),index,'paused-room shortcut cannot change cards');
    await context.close();
  }
  {
    const {context,page}=await setup();
    await page.evaluate(()=>window.setRoom({status:'connected',activeGame:'lobby'}));
    await page.getByRole('button',{name:'Leave room',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Disconnect?'});await dialog.waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Cancel'}).evaluate(el=>el===document.activeElement),true,'disconnect opens with safe action focused');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button',{name:'Disconnect',exact:true}).evaluate(el=>el===document.activeElement),true,'disconnect wraps keyboard focus');
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(),0,'Escape closes confirmation');
    await context.close();
  }
  {
    const {context,page}=await setup(390,{intro:'{"swipe":true}',tab:'swipe'});
    await page.locator('.arcade-card-stack').waitFor();
    await page.evaluate(()=>{sessionStorage.setItem('knotyet_story_v1','saved-story');sessionStorage.setItem('knotyet_memory_v1','saved-board')});
    await page.locator('.global-end-game').click();
    await page.getByRole('button',{name:'Yes, End Game',exact:true}).click();
    await page.locator('#intro-swipe').waitFor();
    assert.deepEqual(await page.evaluate(()=>[sessionStorage.getItem('knotyet_story_v1'),sessionStorage.getItem('knotyet_memory_v1')]),['saved-story','saved-board'],'ending another game preserves local creations');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Navigation: 9 games at 5 widths, short laptops, Surprise me, library search/filters/favourites/empty states/focus, restoration, repeat and paused-room keys passed.');
} finally {await browser.close();}
