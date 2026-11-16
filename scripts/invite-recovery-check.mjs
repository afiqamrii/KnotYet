import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl=process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const token='12345678-1234-1234-1234-123456789abc';
const fixture=`<!doctype html><html><body><main id="root"></main><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
const scenario=new URLSearchParams(location.search).get('case');
const valid={id:'cloud',token:'${token}',name:'Mochi',avatar:'sunny',rel:'friend'};
if(scenario==='broken')sessionStorage.setItem('knotyet_pending_friend_invite',JSON.stringify({...valid,name:{unexpected:true}}));
else sessionStorage.setItem('knotyet_pending_friend_invite',JSON.stringify(valid));
if(scenario==='blocked') {
  Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};
  Storage.prototype.removeItem=()=>{throw new DOMException('Blocked','SecurityError');};
}
const React=(await import('/@id/react')).default;
const ReactDOM=(await import('/@id/react-dom/client')).default;
const source=await (await fetch('/src/screens/InviteScreen.tsx')).text();
const routerUrl=source.match(/from "([^"\\n]*react-router-dom[^"\\n]*)"/)[1];
const {MemoryRouter,Routes,Route}=await import(routerUrl);
const {InviteScreen}=await import('/src/screens/InviteScreen.tsx');
const path=scenario==='blocked'?'/invite?chat=${token}&n=Mochi&a=sunny&r=friend':'/invite';
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(Routes,null,
React.createElement(Route,{path:'/invite',element:React.createElement(InviteScreen)}),
React.createElement(Route,{path:'/play',element:React.createElement('p',null,'Invitation accepted')}))));
</script></body></html>`;

try {
  const context=await browser.newContext();
  await context.route('**/invite-fixture*',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await context.route('**/src/store/AuthContext.tsx*',route=>route.fulfill({contentType:'text/javascript',body:`export const useAuth=()=>({user:{id:'fixture-user'},isLoading:false,refreshCouple:async()=>{},signInWithGoogle:async()=>{}});`}));
  await context.route('**/src/lib/supabase.ts*',route=>route.fulfill({contentType:'text/javascript',body:`window.inviteCalls=[];export const supabase={rpc:(name,args)=>{window.inviteCalls.push({name,args});return new Promise(resolve=>{window.resolveInvite=()=>resolve({error:null});});}};`}));
  await context.route('**/src/utils/audio.ts*',route=>route.fulfill({contentType:'text/javascript',body:'export const sounds={playSuccess(){}};'}));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.goto(`${baseUrl}/invite-fixture?case=broken`);
  await page.getByRole('heading',{name:'A fresh invite, please.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Accept & connect'}).count(),0,'malformed cached invite is not actionable');
  await page.goto(`${baseUrl}/invite-fixture?case=stored`);
  await page.getByRole('heading',{name:'Mochi saved you a spot.'}).waitFor();
  await page.getByRole('button',{name:'Accept & connect'}).click();
  await page.getByRole('button',{name:'Connecting…'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.inviteCalls),[{name:'accept_chat_invite',args:{invite_token:token}}],'only validated token is submitted');
  await page.evaluate(()=>window.resolveInvite());
  await page.getByText('Invitation accepted',{exact:true}).waitFor();
  await page.goto(`${baseUrl}/invite-fixture?case=blocked`);
  await page.getByRole('heading',{name:'Mochi saved you a spot.'}).waitFor();
  await page.getByRole('button',{name:'Accept & connect'}).click();
  await page.waitForFunction(()=>window.resolveInvite);
  await page.evaluate(()=>window.resolveInvite());
  await page.getByText('Invitation accepted',{exact:true}).waitFor();
  assert.deepEqual(errors,[],'invalid or blocked invite storage never crashes the page');
  console.log('Invite recovery: malformed cache rejected, valid cache restored, correct acceptance status, blocked storage opening and successful acceptance passed.');
} finally { await browser.close(); }
