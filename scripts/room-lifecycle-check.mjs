// Actual AuthProvider, App/ProtectedRoute, PlayRoute and MultiplayerProvider.
// Only external auth/database/PeerJS boundaries and the screen UI are isolated.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Fixtures must stay on the local development server.');
const source = async path => (await fetch(new URL(path, base))).text();
const appSource = await source('/src/App.tsx');
const routeSource = await source('/src/routing/PlayRoute.tsx');
const importUrl = (code, name) => code.match(new RegExp(`from "([^"\\n]*${name}[^"\\n]*)"`))[1];
const authUrl = importUrl(appSource, 'AuthContext');
const roomUrl = importUrl(routeSource, 'MultiplayerContext');
const routerUrl = importUrl(appSource, 'react-router-dom');
const peerUrl = importUrl(await source(roomUrl), 'peerjs');
const peerMock = `
class Emitter { handlers={}; on(event,fn){(this.handlers[event]??=[]).push(fn);return this;} emit(event,value){for(const fn of this.handlers[event]||[])fn(value);} }
class Connection extends Emitter { open=false; closed=false; sent=[]; send(value){this.sent.push(value);} ready(){this.open=true;this.emit('open');} close(){if(this.closed)return;this.closed=true;this.open=false;this.emit('close');} }
window.mockPeers=[];window.Connection=Connection;
export default class Peer extends Emitter {
  open=false;destroyed=false;connections=[];reconnects=0;
  constructor(id){super();this.id=typeof id==='string'?id:'fixture-peer';window.mockPeers.push(this);}
  ready(){this.open=true;this.emit('open',this.id);}
  connect(id){const conn=new Connection();conn.peer=id;this.connections.push(conn);return conn;}
  incoming(){const conn=new Connection();this.connections.push(conn);this.emit('connection',conn);return conn;}
  reconnect(){this.reconnects++;}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.open=false;for(const conn of this.connections)conn.close();this.emit('close');}
}`;
const supabaseMock = `
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const mock=window.mock={id:null,listeners:new Set(),bootstrap:deferred(),profileRequest:null,profileReads:0,
  emit(id,event='SIGNED_IN'){this.id=id;const session=id?{user:{id},access_token:'isolated-fixture'}:null;for(const fn of this.listeners)fn(event,session);},
  deferProfile(){return this.profileRequest=deferred();},
};
export const supabase={
  auth:{getSession:()=>mock.bootstrap.promise,onAuthStateChange(fn){mock.listeners.add(fn);return{data:{subscription:{unsubscribe(){mock.listeners.delete(fn);}}}};},signOut:async()=>{mock.emit(null,'SIGNED_OUT');return{error:null};}},
  realtime:{setAuth:async()=>{}},rpc:async()=>({data:null,error:null}),
  from(table){const filters={};return{
    select(){return this;},eq(key,value){filters[key]=value;return this;},or(){return this;},is(){return this;},abortSignal(){return this;},single(){return this;},maybeSingle(){return this;},update(){return this;},upsert(){return this;},
    then(resolve,reject){const id=filters.id||filters.user_id||mock.id;let data=null;
      if(table==='profiles'){mock.profileReads++;if(mock.profileRequest){const pending=mock.profileRequest;mock.profileRequest=null;return pending.promise.then(resolve,reject);}data={id,name:'Fixture Player',avatar_id:'sunny'};}
      if(table==='user_progress')data={user_id:id,heart_points:0,answered_questions:[],solo_play_count:0,multiplayer_play_count:0,last_reset_date:new Date().toISOString().slice(0,10)};
      return Promise.resolve({data,error:null}).then(resolve,reject);
    }
  };},
  channel(){return{on(){return this;},subscribe(){return this;}};},removeChannel:async()=>{},
};`;
const preamble = `import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;`;
const screen = `import React from '/@id/react';import {useMultiplayer} from '${roomUrl}';
export function PlayScreen(){const room=useMultiplayer();window.room=room;React.useEffect(()=>{window.mounts=(window.mounts||0)+1;return()=>{window.unmounts=(window.unmounts||0)+1;};},[]);return React.createElement('p',{id:'room-status'},room.status);}`;
const authFixture = `<!doctype html><html><body><div id="root"></div><script type="module">${preamble}
localStorage.setItem('jodohdeck_migrated_to_cloud','true');
const {AuthProvider,useAuth}=await import('${authUrl}');const {BrowserRouter}=await import('${routerUrl}');const {App}=await import('/src/App.tsx');
function Probe(){window.auth=useAuth();return null;}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(Probe),React.createElement(BrowserRouter,null,React.createElement(App))));
</script></body></html>`;
const transportFixture = `<!doctype html><html><body><div id="root"></div><script type="module">${preamble}
const {MultiplayerProvider,useMultiplayer}=await import('${roomUrl}');
function Probe(){window.room=useMultiplayer();return React.createElement('p',null,window.room.status);}
const root=ReactDOM.createRoot(document.getElementById('root'));window.unmount=()=>root.unmount();root.render(React.createElement(MultiplayerProvider,null,React.createElement(Probe)));
</script></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const profile = { name: 'Fixture Player', avatarId: 'sunny', heartPoints: 0 };
async function context() {
  const ctx = await browser.newContext();
  await ctx.route(`**${new URL(peerUrl, base).pathname}*`, route => route.fulfill({ contentType: 'text/javascript', body: peerMock }));
  await ctx.route('**/src/lib/supabase.ts*', route => route.fulfill({ contentType: 'text/javascript', body: supabaseMock }));
  await ctx.route('**/src/utils/audio.ts*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const sounds={playChatPop(){},playChatSent(){}};' }));
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { ctx, page };
}
const status = (page, expected) => page.waitForFunction(expected => window.room?.status === expected, expected);
try {
  const { ctx, page } = await context();
  await ctx.route('**/src/screens/PlayScreen.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: screen }));
  await ctx.route('**/src/store/FriendsContext.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const FriendsProvider=({children})=>children;' }));
  await ctx.route('**/src/screens/LandingPage.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const LandingPage=()=>null;' }));
  await ctx.route('**/play', route => route.fulfill({ contentType: 'text/html', body: authFixture }));
  await page.goto(`${base}/play`);
  await page.waitForFunction(() => window.auth && window.mock);
  assert.equal(await page.evaluate(() => window.auth.isLoading), true, 'bootstrap blocks protected game routes');
  await page.evaluate(() => { window.pendingProfile=window.mock.deferProfile();window.mock.emit('account-a'); });
  await page.waitForFunction(() => window.mock.profileReads === 1);
  assert.equal(await page.evaluate(() => window.mounts || 0), 0, 'new account waits for canonical profile');
  await page.evaluate(() => window.pendingProfile.resolve({data:{id:'account-a',name:'Fixture Player',avatar_id:'sunny'},error:null}));
  await status(page, 'disconnected');
  await page.evaluate(profile => { window.room.hostRoom('3541',profile); }, profile);
  await status(page, 'hosting');
  await page.evaluate(() => { window.originalPeer=window.mockPeers.at(-1);window.originalPeer.ready();window.originalConnection=window.originalPeer.incoming();window.originalConnection.ready(); });
  await status(page, 'connected');
  await page.evaluate(() => { sessionStorage.setItem('num_session','private-round');sessionStorage.setItem('secret_race_host_session','private-picks');sessionStorage.setItem('story_session','local-story'); });
  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED']) {
    const reads = await page.evaluate(() => window.mock.profileReads);
    await page.evaluate(event => { window.pendingProfile=window.mock.deferProfile();window.mock.emit('account-a',event); }, event);
    await page.waitForFunction(reads => window.mock.profileReads > reads, reads);
    assert.deepEqual(await page.evaluate(() => ({loading:window.auth.isLoading,mounts:window.mounts,unmounts:window.unmounts||0,destroyed:window.originalPeer.destroyed,status:window.room.status})),
      {loading:false,mounts:1,unmounts:0,destroyed:false,status:'connected'}, `${event} keeps the actual protected game route and peer connection alive while account reads are pending`);
    await page.evaluate(event => window.pendingProfile.resolve({data:{id:'account-a',name:event,avatar_id:'sunny'},error:null}), event);
    await page.waitForFunction(event => window.auth.profile?.name === event, event);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('num_session')), 'private-round', 'same-account refresh preserves the current game snapshot');
  }
  await page.evaluate(() => { window.pendingProfile=window.mock.deferProfile();window.mock.emit('account-b'); });
  await page.waitForFunction(() => window.auth.isLoading && window.originalPeer.destroyed);
  assert.equal(await page.evaluate(() => window.unmounts), 1, 'switching accounts still unmounts the prior protected room');
  assert.deepEqual(await page.evaluate(() => ['mp_roomCode','mp_isHost','mp_activeGame','num_session','secret_race_host_session'].map(key=>sessionStorage.getItem(key))), [null,null,null,null,null], 'account switch clears room restoration and private round state');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('story_session')), 'local-story', 'public local activities remain available');
  await page.evaluate(() => window.pendingProfile.resolve({data:{id:'account-b',name:'Other Player',avatar_id:'sunny'},error:null}));
  await page.waitForFunction(() => window.mounts >= 2 && !window.auth.isLoading && window.auth.progress?.user_id === 'account-b');
  await page.evaluate(() => { sessionStorage.setItem('mp_roomCode','9876');sessionStorage.setItem('guess_actualAnswer','private-answer');window.mock.emit(null,'SIGNED_OUT'); });
  await page.waitForFunction(() => window.unmounts === window.mounts && !window.auth.isLoading && !window.auth.user);
  assert.deepEqual(await page.evaluate(() => ['mp_roomCode','guess_actualAnswer'].map(key=>sessionStorage.getItem(key))), [null,null], 'sign-out clears the next account’s room and private answers');
  await ctx.close();
  console.log('Room lifecycle: actual protected route survives same-account SIGNED_IN/TOKEN_REFRESHED; account switch and sign-out still unmount.');

  const transport = await context();
  await transport.ctx.route('**/transport-lifecycle-fixture', route => route.fulfill({ contentType: 'text/html', body: transportFixture }));
  const p = transport.page;
  await p.clock.install();
  await p.goto(`${base}/transport-lifecycle-fixture`);
  await status(p, 'disconnected');
  await p.evaluate(profile => window.room.joinRoom('3541',profile), profile);
  await status(p, 'joining');
  await p.evaluate(() => window.mockPeers.at(-1).ready());
  await p.clock.fastForward(15001);
  await status(p, 'error');
  assert.match(await p.evaluate(() => window.room.error), /timed out/i, 'stalled data channel gives an actionable error instead of joining forever');
  assert.equal(await p.evaluate(() => window.mockPeers.at(-1).destroyed), true, 'timed-out transport is released');

  // Restore in a fresh provider: no previous connection exists in its refs.
  await p.reload();
  await status(p, 'disconnected');
  await p.evaluate(profile => window.room.hostRoom('3541',profile,true), profile);
  await status(p, 'hosting');
  await p.evaluate(() => window.mockPeers.at(-1).emit('error',{type:'unavailable-id'}));
  await status(p, 'partner_left');
  await p.clock.fastForward(4001);
  await status(p, 'hosting');
  assert.equal(await p.evaluate(() => window.mockPeers.length), 2, 'restored host retries temporary ID ownership after refresh');
  await p.evaluate(() => { const peer=window.mockPeers.at(-1);peer.ready();peer.incoming().ready(); });
  await status(p, 'connected');
  await p.clock.fastForward(20000);
  await status(p, 'connected');

  await p.evaluate(profile => window.room.joinRoom('3541',profile,true), profile);
  await status(p, 'joining');
  await p.clock.fastForward(15001);
  await status(p, 'partner_left');
  const attempts = await p.evaluate(() => window.mockPeers.length);
  await p.clock.fastForward(4001);
  await status(p, 'joining');
  assert.equal(await p.evaluate(() => window.mockPeers.length), attempts+1, 'restored guest retries a timed-out attempt');
  await p.evaluate(profile => window.room.hostRoom('9876',profile), profile);
  await status(p, 'hosting');
  await p.evaluate(() => window.mockPeers.at(-1).ready());
  await p.clock.fastForward(30000);
  assert.equal(await p.evaluate(() => window.mockPeers.at(-1).destroyed), false, 'old join deadline cannot close a newer waiting host');
  await status(p, 'hosting');

  await p.evaluate(profile => window.room.joinRoom('3541',profile,true), profile);
  await status(p, 'joining');
  await p.evaluate(() => window.room.leaveRoom());
  await p.clock.fastForward(101);
  await status(p, 'disconnected');
  const cancelledAttempts = await p.evaluate(() => window.mockPeers.length);
  await p.clock.fastForward(30000);
  assert.equal(await p.evaluate(() => window.mockPeers.length), cancelledAttempts, 'cancel prevents deadlines or retries from reviving a room');
  assert.equal(await p.evaluate(() => sessionStorage.getItem('mp_roomCode')), null);

  await p.evaluate(profile => window.room.joinRoom('3541',profile), profile);
  await status(p, 'joining');
  await p.evaluate(() => { const peer=window.mockPeers.at(-1);peer.ready();peer.connections[0].ready(); });
  await status(p, 'connected');
  await p.evaluate(() => { const peer=window.mockPeers.at(-1);peer.emit('disconnected');peer.ready(); });
  assert.deepEqual(await p.evaluate(() => { const peer=window.mockPeers.at(-1);return {connections:peer.connections.length,closed:peer.connections[0].closed,reconnects:peer.reconnects}; }),
    {connections:1,closed:false,reconnects:1}, 'signaling reconnect retains an existing healthy WebRTC channel');
  await status(p, 'connected');

  await p.evaluate(profile => window.room.hostRoom('3541',profile), profile);
  await status(p, 'hosting');
  await p.evaluate(() => window.mockPeers.at(-1).emit('error',{type:'unavailable-id'}));
  await status(p, 'error');
  const duplicates = await p.evaluate(() => window.mockPeers.length);
  await p.clock.fastForward(30000);
  assert.equal(await p.evaluate(() => window.mockPeers.length), duplicates, 'new duplicate rooms fail visibly without silently retrying another host');
  assert.deepEqual(errors, []);
  console.log('Room lifecycle: signaling/data deadlines, restored host ID collision retry, guest retry, cancellation and stale attempt isolation passed.');
} finally { await browser.close(); }
