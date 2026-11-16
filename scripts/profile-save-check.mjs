import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base=process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const backend=`
const listeners=new Set();
const mock=window.profileMock={userId:'alice',profiles:{alice:{id:'alice',name:'Alice',avatar_id:'sunny'},bob:{id:'bob',name:'Bob',avatar_id:'mochi'}},fail:false,defer:false,writes:[],
emit(id){this.userId=id;for(const fn of listeners)fn(id?'SIGNED_IN':'SIGNED_OUT',id?{user:{id},access_token:'fixture'}:null);}};
if(new URLSearchParams(location.search).get('case')==='welcome')mock.profiles.alice=null;
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'alice'},access_token:'fixture'}}}),onAuthStateChange(fn){listeners.add(fn);return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};}},realtime:{setAuth:async()=>{}},
from(table){const q={table,action:'select',id:null};const b={select(){return this;},eq(k,id){q.id=id;return this;},or(){return this;},is(){return this;},single(){return this;},maybeSingle(){return this;},abortSignal(signal){q.signal=signal;return this;},upsert(data){q.action='upsert';q.data=data;return this;},update(data){q.action='update';q.data=data;return this;},then(resolve,reject){
const result=()=>{
if(table==='profiles'){
 if(q.action==='upsert'){if(mock.fail)return {data:null,error:{message:'Offline'}};mock.profiles[q.data.id]={...q.data};return{data:{...q.data},error:null};}
 return {data:mock.profiles[q.id]??null,error:null};}
if(table==='user_progress')return{data:{user_id:q.id,heart_points:40,answered_questions:[],last_reset_date:new Date().toISOString().slice(0,10)},error:null};
return{data:null,error:null};};
if(table==='profiles'&&q.action==='select'&&mock.deferRead){mock.deferRead=false;const snapshot=result();return new Promise(done=>{mock.releaseRead=()=>done(snapshot);}).then(resolve,reject);}
if(q.action==='upsert'){mock.writes.push(q.data);if(mock.defer){mock.defer=false;return new Promise(done=>{mock.release=()=>done(result());}).then(resolve,reject);}}
return Promise.resolve(result()).then(resolve,reject);
}};return b;},rpc:()=>({abortSignal:async()=>({data:[],error:null})}),channel(){return{on(){return this;},subscribe(){return this;}};},removeChannel:async()=>{}};
`;
const fixture=`<!doctype html><html><body><main id="root"></main><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
localStorage.setItem('jodohdeck_migrated_to_cloud','true');
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
await import('/src/index.css');
const profileSource=await(await fetch('/src/screens/ProfileScreen.tsx')).text();
const gameUrl=profileSource.match(/from "([^"\\n]*GameContext[^"\\n]*)"/)[1];
const gameSource=await(await fetch(gameUrl)).text();
const authUrl=gameSource.match(/from "([^"\\n]*AuthContext[^"\\n]*)"/)[1];
const {AuthProvider,useAuth}=await import(authUrl);const {GameProvider,useGame}=await import(gameUrl);
const {ProfileScreen}=await import('/src/screens/ProfileScreen.tsx');const {WelcomeScreen}=await import('/src/screens/WelcomeScreen.tsx');
function Harness(){const game=useGame();const auth=useAuth();window.profileApi={game,auth};const[finished,setFinished]=React.useState(false);return new URLSearchParams(location.search).get('case')==='welcome'?(finished?React.createElement('p',null,'Setup complete'):React.createElement(WelcomeScreen,{onComplete:()=>setFinished(true)})):React.createElement(ProfileScreen,{onClose:()=>{}});}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(GameProvider,null,React.createElement(Harness))));
</script></body></html>`;
try{
 const context=await browser.newContext();
 await context.route('**/profile-save-fixture*',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await context.route('**/src/lib/supabase.ts*',route=>route.fulfill({contentType:'text/javascript',body:backend}));
 await context.route('**/src/store/FriendsContext.tsx*',route=>route.fulfill({contentType:'text/javascript',body:`const value={friends:[],unreadTotal:0,createInviteLink:async()=>''};export const useFriends=()=>value;`}));
 await context.route('**/src/utils/audio.ts*',route=>route.fulfill({contentType:'text/javascript',body:'export const sounds={playSuccess(){},playFlip(){}};'}));
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.goto(base+'/profile-save-fixture');
 await page.waitForFunction(()=>window.profileApi?.game.profile?.name==='Alice');
 for(const viewport of [{width:1366,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]){
  await page.setViewportSize(viewport);
  const metrics=await page.locator('.profile-page').evaluate(element=>({width:innerWidth,scrollWidth:element.scrollWidth,emptyButtons:[...element.querySelectorAll('button')].filter(button=>!button.textContent.trim()&&!button.getAttribute('aria-label')).length}));
  assert.ok(metrics.scrollWidth<=metrics.width+1,`profile fits at ${viewport.width}px`);
  assert.equal(metrics.emptyButtons,0,`profile controls have accessible names at ${viewport.width}px`);
 }
 await page.getByRole('button',{name:'Back to games',exact:true}).focus();
 await page.keyboard.press('Shift+Tab');
 assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).evaluate(button=>button===document.activeElement),true,'profile traps backward keyboard focus');
 await page.keyboard.press('Tab');
 assert.equal(await page.getByRole('button',{name:'Back to games',exact:true}).evaluate(button=>button===document.activeElement),true,'profile traps forward keyboard focus');
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.locator('#profile-name').fill('Alice Updated');
 await page.evaluate(()=>{window.profileMock.fail=true;});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();
 assert.equal(await page.locator('#profile-name').inputValue(),'Alice Updated','failed save preserves draft');
 assert.equal(await page.evaluate(()=>window.profileApi.game.profile.name),'Alice','failed save cannot claim the new profile');
 for(const width of [320,390,1366]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.locator('.profile-page').evaluate(element=>element.scrollWidth<=innerWidth+1),true,`save error fits at ${width}px`);
  assert.equal(await page.getByRole('alert').filter({hasText:'could not be saved'}).isVisible(),true,'save error stays visible');
 }
 await page.evaluate(()=>{window.profileMock.fail=false;});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.waitForFunction(()=>window.profileApi.game.profile?.name==='Alice Updated' && window.profileApi.auth.profile?.name==='Alice Updated');
 await page.evaluate(()=>window.profileApi.auth.refreshProgress());
 assert.equal(await page.evaluate(()=>window.profileApi.game.profile.name),'Alice Updated','progress refresh preserves the canonical saved name');

 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.locator('#profile-name').fill('Newer saved edit');
 await page.evaluate(()=>{window.profileMock.deferRead=true;window.profileMock.emit('alice');});
 await page.waitForFunction(()=>window.profileMock.releaseRead);
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.waitForFunction(()=>window.profileApi.auth.profile?.name==='Newer saved edit');
 await page.evaluate(()=>window.profileMock.releaseRead());
 await page.waitForFunction(()=>!window.profileApi.auth.isLoading);
 assert.equal(await page.evaluate(()=>window.profileApi.auth.profile.name),'Newer saved edit','an older same-account bootstrap read cannot replace a confirmed profile');

 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.locator('#profile-name').fill('Saved without cache');
 await page.evaluate(()=>{window.nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.waitForFunction(()=>window.profileApi.game.profile?.name==='Saved without cache');
 await page.evaluate(()=>{Storage.prototype.setItem=window.nativeSet;});
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await page.locator('#profile-name').fill('Stale Alice');
 await page.evaluate(()=>{window.profileMock.defer=true;});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.waitForFunction(()=>window.profileMock.release);
 await page.evaluate(()=>window.profileMock.emit('bob'));
 await page.waitForFunction(()=>window.profileApi.game.profile?.name==='Bob');
 await page.evaluate(()=>window.profileMock.release());
 assert.equal(await page.evaluate(()=>window.profileApi.game.profile.name),'Bob','late save cannot overwrite the new account');
 assert.equal(await page.locator('.profile-edit-layout').count(),0,'account changes close the old edit view');

 await page.goto(base+'/profile-save-fixture?case=welcome');
 await page.getByRole('button',{name:"Let's make it you"}).click();
 await page.getByRole('button',{name:"That's my character"}).click();
 await page.getByLabel('Your player name',{exact:true}).fill('New Player');
 await page.evaluate(()=>{window.profileMock.fail=true;window.profileMock.defer=true;});
 await page.getByRole('button',{name:"Let's play",exact:true}).click();
 await page.waitForFunction(()=>window.profileMock.release);
 for(const width of [320,390,1366]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`pending setup fits at ${width}px`);
  assert.match(await page.getByRole('status').innerText(),/Saving your player profile/,'setup announces pending save');
 }
 await page.evaluate(()=>window.profileMock.release());
 await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();
 assert.equal(await page.getByLabel('Your player name',{exact:true}).inputValue(),'New Player','setup retains name after failed save');
 assert.equal(await page.getByText('Setup complete',{exact:true}).count(),0,'setup cannot complete before a confirmed save');
 await page.evaluate(()=>{window.profileMock.fail=false;});
 await page.getByRole('button',{name:"Let's play",exact:true}).click();
 await page.getByText('Setup complete',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.profileApi.auth.profile.name),'New Player','setup refreshes the canonical profile');
 assert.deepEqual(errors,[],'profile save paths have no uncaught browser errors');
 console.log('Profile saves: failed edits/setup remain retryable, confirmed canonical profile survives progress refresh and older same-account reads, blocked cache is optional, stale account results are rejected, and responsive/keyboard checks passed.');
}finally{await browser.close();}
