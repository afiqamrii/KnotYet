import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
await mkdir('artifacts', {recursive:true});
const baseUrl='http://localhost:5174';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
// Isolated UI fixture: room transport is intentionally simulated. Live delivery is
// checked separately; this verifies failure feedback, draft retention and layout.
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import { InGameChat } from '/src/components/InGameChat.tsx';import '/src/index.css';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(InGameChat));</script></body></html>`;
const mock=`import React from '/node_modules/.vite/deps/react.js';
const listeners=new Set();
const publish=()=>listeners.forEach(fn=>fn());
let current={status:'connected',chatMessages:[{id:'incoming',senderId:'partner',senderName:'Mochi',senderAvatar:'mochi',text:'I knew you would pick that one!',timestamp:Date.now()}],unreadChatCount:1,latestIncomingMessage:null,remoteProfile:{name:'Mochi',avatarId:'mochi'}};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const sendChatMessage=(text,isQuickReaction)=>{if(window.failSend)return false;current={...current,chatMessages:[...current.chatMessages,{id:crypto.randomUUID(),senderId:'me',senderName:'Alex',senderAvatar:'sunny',text,timestamp:Date.now(),isQuickReaction}]};publish();return true;};
const clearUnreadChatCount=()=>{if(!current.unreadChatCount&&!current.latestIncomingMessage)return;current={...current,unreadChatCount:0,latestIncomingMessage:null};publish();};
window.disconnectChat=()=>{current={...current,status:'partner_left'};publish();};
export const useMultiplayer=()=>({...React.useSyncExternalStore(subscribe,()=>current),sendChatMessage,clearUnreadChatCount});`;
try{
 for(const viewport of [{width:320,height:640},{width:1366,height:768}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/room-chat-ui-fixture')return route.fulfill({contentType:'text/html',body:html});if(url.pathname==='/src/store/MultiplayerContext.tsx')return route.fulfill({contentType:'application/javascript',body:mock});return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.log(error.message)});await page.goto(baseUrl+'/room-chat-ui-fixture');
  const trigger=page.getByRole('button',{name:/Open in-game chat/});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'A little banter'});await dialog.waitFor();
  const input=page.getByRole('textbox',{name:'Message Mochi'});await input.fill('My draft should survive a failed send.');
  await page.evaluate(()=>window.failSend=true);await page.getByRole('button',{name:'Send message',exact:true}).click();
  assert.equal(await input.inputValue(),'My draft should survive a failed send.');await page.getByRole('alert').waitFor();
  await page.evaluate(()=>window.failSend=false);await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal(await input.inputValue(),'');
  assert.equal(await page.locator('.chat-message.is-mine').count(),1);assert.equal(await page.locator('.chat-message:not(.is-mine)').count(),1);
  await page.getByRole('button',{name:'Good game!',exact:true}).click();assert.equal(await page.locator('.chat-message.is-mine').count(),2);
  const bounds=await dialog.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(bounds.rect.left>=0&&bounds.rect.right<=bounds.width&&bounds.rect.bottom<=bounds.height&&bounds.scroll<=bounds.client+1);
  await page.screenshot({path:`artifacts/chat-room-${viewport.width}.png`});
  await page.getByRole('button',{name:'Close in-game chat'}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  await trigger.click();await input.fill('Please keep this draft.');await page.evaluate(()=>window.disconnectChat());await page.getByText('Your room is disconnected',{exact:true}).waitFor();assert.equal(await input.inputValue(),'Please keep this draft.');assert.equal(await input.isDisabled(),true);await page.getByRole('button',{name:'Close in-game chat'}).click();assert.equal(await trigger.count(),0);
  console.log(`${viewport.width}x${viewport.height}: room chat layout, failed-send draft, successful send, quick reply, sender sides, focus trap, disconnect passed`);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
