import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Isolated visual/interaction check: actual PlayScreen, race and chat; external account/room data is simulated.
const base=process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const out='artifacts/secret-race-redesign';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
const html=`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
await import('/src/index.css');const {PlayScreen}=await import('/src/screens/PlayScreen.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Suspense,{fallback:'Loading'},React.createElement(PlayScreen)));
</script></body></html>`;
const mocks={
 '/src/store/GameContext.tsx':`import {i18n} from '/src/data/i18n.ts';const state={profile:{accountId:'alex',name:'Alex',avatarId:'sunny',heartPoints:0},partner:null,lang:'en',t:i18n.en,addHeartPoints:()=>{},recordAnsweredQuestion:()=>{}};export const useGame=()=>state;export const HEART_POINTS={COMPLETE_QUIZ:10};`,
 '/src/store/AuthContext.tsx':`const state={user:{id:'alex'},couple:null,progress:{answered_questions:[]},isLoading:false,checkLimit:()=>true,incrementPlayCount:()=>{}};export const useAuth=()=>state;`,
 '/src/store/FriendsContext.tsx':`const state={friends:[],unreadTotal:0,setActiveChatFriendId:()=>{}};export const useFriends=()=>state;`,
 '/src/store/MultiplayerContext.tsx':`const listeners=new Set();window.receiveRace=message=>listeners.forEach(fn=>fn(message));window.sent=[];const state={status:'connected',activeGame:'secret-race',isHost:false,roomCode:'LAYOUT',questionDecks:{},questionIndices:{},chatMessages:[],unreadChatCount:0,remoteProfile:{accountId:'jamie',name:'Jamie',avatarId:'mochi'},sendMessage:message=>window.sent.push(message),subscribeMessage:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},hostRoom:()=>{},joinRoom:()=>{},leaveRoom:()=>{},setGame:()=>{},clearUnreadChatCount:()=>{},sendChatMessage:()=>true};window.raceRoom=state;export const useMultiplayer=()=>state;`,
};
const initial={matchId:'visual-round-1',round:1,operation:'+',phase:'picking',hostLocked:false,partnerLocked:false,scores:{host:0,partner:0}};

async function state(page,value){await page.evaluate(payload=>window.receiveRace({type:'SECRET_RACE_STATE',payload}),value);}
async function check(page,viewport,name,action){
 if(action)await page.locator(action).first().waitFor();
 const metrics=await page.evaluate(selector=>{
  const card=document.querySelector('.secret-race-card');const main=document.querySelector('.arcade-play-main');const button=selector?document.querySelector(selector):null;const rect=button?.getBoundingClientRect();
  return{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,main:[main.clientHeight,main.scrollHeight],card:card.getBoundingClientRect().toJSON(),action:rect?.toJSON(),reachable:rect?button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)):true,
   buttons:[...card.querySelectorAll('button')].map(element=>({name:element.getAttribute('aria-label')||element.textContent.trim(),width:element.offsetWidth,height:element.offsetHeight})),
   scoreLabels:[...card.querySelectorAll('.secret-race-score small')].map(element=>({text:element.textContent,display:getComputedStyle(element).display,width:element.offsetWidth}))};
 },action);
 assert.ok(metrics.docWidth<=metrics.width+1,`${viewport.width} ${name}: no horizontal overflow ${JSON.stringify(metrics)}`);
 assert.ok(metrics.buttons.every(button=>button.name&&button.width>=44&&button.height>=44),`${name}: named 44px controls ${JSON.stringify(metrics.buttons)}`);
 assert.ok(metrics.scoreLabels.every(label=>label.text&&label.display!=='none'&&label.width>0),`${name}: both player labels visible`);
 if(action){assert.ok(metrics.action.top>=0&&metrics.action.bottom<=viewport.height,`${viewport.width} ${name}: primary action onscreen ${JSON.stringify(metrics)}`);assert.ok(metrics.reachable,`${name}: action is unobscured by chat`);}
 if(viewport.width>=900)assert.ok(metrics.main[1]<=metrics.main[0]+2,`${viewport.width} ${name}: fits desktop play area ${JSON.stringify(metrics)}`);
 await page.screenshot({path:`${out}/${viewport.width}x${viewport.height}-${name}.png`,fullPage:true});
}

try{
 for(const viewport of [{width:1366,height:768},{width:320,height:740},{width:390,height:844},{width:1536,height:800},{width:1280,height:600}].filter(item=>!process.env.SECRET_RACE_WIDTH||item.width===Number(process.env.SECRET_RACE_WIDTH))){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/secret-race-layout-fixture')return route.fulfill({contentType:'text/html',body:html});if(mocks[url.pathname])return route.fulfill({contentType:'text/javascript',body:mocks[url.pathname]});if(url.origin!==new URL(base).origin)return route.fulfill({status:204,body:''});return route.continue();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(`${viewport.width}: ${error.message}`));
  await page.goto(base+'/secret-race-layout-fixture');await page.locator('.game-primary-action').waitFor();
  await page.evaluate(()=>window.receiveRace({type:'START_GAME',payload:{game:'secret-race'}}));
  await page.getByRole('heading',{name:'Setting up the race…'}).waitFor();
  await check(page,viewport,'loading');
  await state(page,initial);await page.locator('#secret-number-input').fill('7');
  await check(page,viewport,'pick','.secret-race-lock');
  if(process.env.SECRET_RACE_PREVIEW){console.log('Desktop preview ready');break;}
  await page.getByRole('button',{name:'Increase secret number'}).click();assert.equal(await page.locator('#secret-number-input').inputValue(),'8');
  await page.getByRole('button',{name:'Decrease secret number'}).click();assert.equal(await page.locator('#secret-number-input').inputValue(),'7');
  await page.locator('#secret-number-input').focus();await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Your number is locked.'}).waitFor();assert.equal(await page.locator('#secret-number-input').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.sent.some(message=>message.type==='SECRET_RACE_LOCK'&&message.payload.number===7)),true,'keyboard form submit sends chosen number');
  await check(page,viewport,'waiting','.secret-race-lock');
  await state(page,{...initial,phase:'countdown',hostLocked:true,partnerLocked:true});
  await page.locator('.secret-race-count').waitFor();await check(page,viewport,'countdown');
  const subtraction={...initial,matchId:'visual-round-2',round:2,operation:'−',phase:'answering',hostLocked:true,partnerLocked:true,equation:{hostNumber:2,partnerNumber:7,answer:-5}};
  await state(page,subtraction);await page.getByLabel('Your answer',{exact:true}).fill('5');
  await page.getByRole('button',{name:'Toggle answer sign'}).click();assert.equal(await page.getByLabel('Your answer',{exact:true}).inputValue(),'-5');
  await check(page,viewport,'negative-answer','.secret-race-answer-form > button');
  await page.getByRole('button',{name:'Submit answer',exact:true}).click();assert.equal(await page.evaluate(()=>window.sent.some(message=>message.type==='SECRET_RACE_ANSWER'&&message.payload.answer===-5)),true,'sign toggle submits a negative number');
  await page.evaluate(()=>window.receiveRace({type:'SECRET_RACE_WRONG',payload:{matchId:'visual-round-2',delayMs:2000}}));
  await page.getByRole('alert').filter({hasText:'Not quite'}).waitFor();assert.equal(await page.getByRole('button',{name:'Toggle answer sign'}).isDisabled(),true);
  await check(page,viewport,'retry-answer','.secret-race-answer-form > button');
  const tied={...subtraction,phase:'result',winner:'tie'};await state(page,tied);await page.getByRole('heading',{name:'Photo finish — it’s a tie!'}).waitFor();
  await check(page,viewport,'tie','.secret-race-next');await page.getByRole('button',{name:'Next round',exact:true}).click();assert.equal(await page.evaluate(()=>window.sent.some(message=>message.type==='SECRET_RACE_NEXT')),true);
  await page.evaluate(()=>{window.raceRoom.remoteProfile.name='Alexandria the Magnificent';});
  await state(page,{...subtraction,phase:'complete',round:5,winner:'host',scores:{host:3,partner:1}});
  await page.getByText('Alexandria the Magnificent wins the best-of-five match!',{exact:true}).waitFor();
  await check(page,viewport,'complete-long-name','.secret-race-actions button');await page.getByRole('button',{name:'Play again',exact:true}).click();assert.equal(await page.evaluate(()=>window.sent.some(message=>message.type==='SECRET_RACE_RESTART')),true);
  console.log(`${viewport.width}x${viewport.height}: full-shell loading, pick/stepper/keyboard lock, partner wait, countdown, negative answer toggle, cooldown, tie/next, completion/rematch passed`);
  await context.close();
 }
 assert.deepEqual(errors,[],'race layout has no uncaught browser errors');
}finally{await browser.close();}
