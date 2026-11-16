import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const mockSource = `
const pending = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const mock = window.mock = {
  bootstrap: pending(), authListener: null, messages: [], contacts: [], members: [], queries: [], channels: [], userId: null,
  progress: { heart_points: 10, answered_questions: [], last_reset_date: new Date().toISOString().slice(0,10) },
  couple: { id: 'pair-a' },
  defer(key) { this[key] = pending(); return this[key]; },
  emit(id) { this.userId = id; this.authListener(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id }, access_token: 'fixture' } : null); },
  event(table, event, row) { for (const c of this.channels) for (const h of c.handlers) if (h.filter.table === table && h.filter.event === event) h.fn({new:row}); },
};
export const supabase = {
  auth: {
    getSession: () => mock.bootstrap.promise,
    onAuthStateChange: fn => { mock.authListener=fn; return {data:{subscription:{unsubscribe(){mock.authListener=null;}}}}; },
    signOut: async () => { mock.emit(null); return {error:null}; },
  },
  realtime: {setAuth: async () => {}},
  rpc: async name => {
    if (name === 'list_chat_contacts') {
      const snapshot = structuredClone(mock.contacts);
      const deferred = mock.contactsRequest; mock.contactsRequest=null;
      if (deferred) return deferred.promise;
      return {data:snapshot,error:null};
    }
    return {data:null,error:null};
  },
  from(table) {
    const query = {table, action:'select', ascending:true, count:Infinity, filters:[]};
    const builder = {
      select(columns,options){query.head=options?.head; return this;},
      eq(key,value){query.filters.push(row=>row[key]===value);return this;},
      neq(key,value){query.filters.push(row=>row[key]!==value);return this;},
      gt(key,value){query.filters.push(row=>row[key]>value);return this;},
      or(value){if(table==='chat_messages'){const match=value.match(/^created_at.lt.([^,]+),and\\(created_at.eq.[^,]+,id.lt.([^)]*)\\)$/);if(match)query.filters.push(row=>row.created_at<match[1] || (row.created_at===match[1] && row.id<match[2]));}return this;},
      in(){return this;}, is(){return this;}, abortSignal(){return this;},
      order(key, options){query.ascending=options?.ascending !== false; return this;},
      limit(count){query.count=count; return this;},
      update(data){query.action='update'; query.data=data; return this;},
      upsert(data){query.action='upsert'; query.data=data; return this;},
      single(){return this;}, maybeSingle(){return this;},
      then(resolve,reject) {
        mock.queries.push(query);
        let data=null;
        if (table==='profiles') data={id:mock.userId,name:'Tester',avatar_id:'sunny'};
        if (table==='user_progress') {
          if (mock.progressRequest) { const d=mock.progressRequest; mock.progressRequest=null; return d.promise.then(resolve,reject); }
          data={...mock.progress,user_id:mock.userId};
        }
        if (table==='couples') data=mock.couple;
        if (table==='chat_members') data=query.action==='update'?{last_read_at:query.data.last_read_at}:mock.members;
        if (table==='chat_messages') {
          if (query.action==='upsert') {
            if(mock.sendRequest) { const d=mock.sendRequest; mock.sendRequest=null; return d.promise.then(resolve,reject); }
          } else {
            const matching=mock.messages.filter(row=>query.filters.every(filter=>filter(row)));
            if(query.head)return Promise.resolve({data:null,error:null,count:matching.length}).then(resolve,reject);
            if(mock.historyError && query.filters.length>1)return Promise.resolve({data:null,error:{message:'Offline'}}).then(resolve,reject);
            data=[...matching].sort((a,b)=>(Date.parse(a.created_at)-Date.parse(b.created_at) || a.id.localeCompare(b.id))*(query.ascending?1:-1)).slice(0,query.count);
          }
        }
        return Promise.resolve({data:structuredClone(data),error:null}).then(resolve,reject);
      }
    };
    return builder;
  },
  channel() {
    const c={handlers:[],on(type,filter,fn){this.handlers.push({filter,fn});return this;},subscribe(fn){queueMicrotask(()=>fn?.('SUBSCRIBED'));return this;}};
    mock.channels.push(c); return c;
  },
  removeChannel(c){mock.channels=mock.channels.filter(x=>x!==c);},
};`;
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
  localStorage.setItem('jodohdeck_migrated_to_cloud','true');
  const React=(await import('/@id/react')).default;
  const ReactDOM=(await import('/@id/react-dom/client')).default;
  await import('/src/index.css');
  const modalSource=await (await fetch('/src/components/FriendsModal.tsx')).text();
  const friendsUrl=modalSource.match(/from "([^"\\n]*FriendsContext[^"\\n]*)"/)[1];
  // Match Vite's current HMR URL so both providers share one auth context.
  const friendsSource=await (await fetch(friendsUrl)).text();
  const authUrl=friendsSource.match(/from "([^"\\n]*AuthContext[^"\\n]*)"/)[1];
  const {AuthProvider,useAuth}=await import(authUrl);
  const {FriendsProvider,useFriends}=await import(friendsUrl);
  const {FriendsModal}=await import('/src/components/FriendsModal.tsx');
  function Harness(){ const auth=useAuth(); const friends=useFriends(); const [open,setOpen]=React.useState(false); window.api={auth,friends}; return React.createElement(React.Fragment,null,React.createElement('p',null,auth.isLoading?'Loading':'Ready'),React.createElement('button',{onClick:()=>setOpen(true)},'Open friends'),React.createElement(FriendsModal,{isOpen:open,onClose:()=>setOpen(false)})); }
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(FriendsProvider,null,React.createElement(Harness))));
</script></body></html>`;

try {
  const context = await browser.newContext();
  await context.route('**/src/lib/supabase.ts*', route => route.fulfill({ contentType: 'text/javascript', body: mockSource }));
  await context.route('**/src/store/GameContext.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: `const profile={name:'Tester',avatarId:'sunny'}; const setPartner=()=>{}; export const useGame=()=>({profile,setPartner});` }));
  await context.route('**/src/store/MultiplayerContext.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: `export const useMultiplayer=()=>({status:'disconnected',roomCode:null});` }));
  await context.route('**/src/utils/audio.ts*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const sounds={playChatPop(){},playChatSent(){},playFlip(){}};' }));
  await context.route('**/account-chat-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => { pageErrors.push(error.message); console.error(error.message); });
  await page.goto(`${baseUrl}/account-chat-fixture`);
  await page.waitForFunction(() => window.api);
  assert.equal(await page.evaluate(() => window.api.auth.isLoading), true, 'session bootstrap keeps protected content loading');
  await page.evaluate(() => window.mock.bootstrap.reject(new Error('Offline')));
  await page.waitForFunction(() => !window.api.auth.isLoading);
  assert.equal(await page.evaluate(() => window.api.auth.user), null, 'bootstrap network failure exits loading');

  await page.evaluate(() => {
    window.mock.contacts=[{friend_id:'friend-a',conversation_id:'room-a',friend_name:'Friend A',friend_avatar:'sunny',relationship_type:'friend',last_read_at:null}];
    window.mock.emit('account-a');
  });
  await page.waitForFunction(() => window.api.friends.friends.length===1 && window.api.auth.progress?.heart_points===10);
  assert.equal(await page.evaluate(() => window.api.friends.friends[0].isOnline), undefined, 'contact membership does not claim live presence');
  await page.evaluate(() => {
    window.pendingSend=window.mock.defer('sendRequest');
    window.sendResult=window.api.friends.sendDirectMessage('friend-a','Keep this draft');
  });
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a')[0]?.status==='sending');
  await page.evaluate(() => window.api.friends.refreshContacts());
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a')[0]?.status), 'sending', 'poll retains pending messages');
  await page.evaluate(async () => { window.pendingSend.resolve({error:{message:'Offline'}}); await window.sendResult; });
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a')[0]?.status==='failed');
  await page.evaluate(() => window.api.friends.refreshContacts());
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a')[0]?.status), 'failed', 'poll retains failed messages and retry action');
  const failedId=await page.evaluate(() => window.api.friends.getConversation('friend-a')[0].id);
  await page.reload();
  await page.waitForFunction(() => window.api && window.mock);
  await page.evaluate(() => {
    window.mock.contacts=[{friend_id:'friend-a',conversation_id:'room-a',friend_name:'Friend A',friend_avatar:'sunny',relationship_type:'friend',last_read_at:null}];
    window.mock.emit('account-b');
  });
  await page.waitForFunction(() => window.api.friends.friends.length===1);
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a').length),0,'outbox never appears in another account');
  await page.evaluate(() => window.mock.emit('account-a'));
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a')[0]?.status==='failed');
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a')[0].id),failedId,'reload preserves the original retry id');
  await page.evaluate(() => {
    window.pendingSend=window.mock.defer('sendRequest');
    const id=window.api.friends.getConversation('friend-a')[0].id;
    window.sendResult=window.api.friends.retryDirectMessage('friend-a',id);
  });
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a')[0]?.status==='sending');
  await page.evaluate(() => window.mock.event('chat_members','UPDATE',{conversation_id:'room-a',user_id:'friend-a',last_read_at:new Date(Date.now()+1000).toISOString()}));
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a')[0]?.status==='read');
  await page.evaluate(async () => { window.pendingSend.resolve({error:null}); await window.sendResult; });
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a')[0]?.status), 'read', 'late acknowledgement cannot downgrade read receipt');
  assert.equal(await page.evaluate(async () => (await import('/src/utils/chatPersistence.ts')).readOutbox('account-a').length),0,'acknowledgement clears durable outbox');

  for (const viewport of [{width:1366,height:768},{width:390,height:844},{width:320,height:640}]) {
    await page.setViewportSize(viewport);
    const trigger=page.getByRole('button',{name:'Open friends',exact:true});
    await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Your little circle'});
    await dialog.waitFor();
    await page.locator('.chat-friend').click();
    await page.getByText('Friend · Connected account',{exact:true}).waitFor();
    const draft=page.getByRole('textbox',{name:'Message Friend A'});
    if(viewport.width===1366)await draft.fill('A draft worth keeping');
    else assert.equal(await draft.inputValue(),'A draft worth keeping','closing the modal preserves its draft');
    assert.equal(await page.getByRole('button',{name:'Invite Friend A to play'}).isEnabled(),true,'unknown presence never blocks invitations');
    const bounds=await dialog.evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,overflow:el.scrollWidth>el.clientWidth+1};});
    assert.ok(bounds.left>=0 && bounds.top>=0 && bounds.right<=viewport.width && bounds.bottom<=viewport.height,`chat fits ${viewport.width}px viewport`);
    assert.equal(bounds.overflow,false,'chat has no horizontal overflow');
    await page.screenshot({path:`artifacts/chat-upgrade-${viewport.width}.png`});
    await page.getByRole('button',{name:'Close friends and messages'}).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'chat traps keyboard focus');
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'chat restores focus');
  }

  await page.reload();
  await page.waitForFunction(() => window.api && window.mock);
  await page.evaluate(() => {
    window.mock.contacts=[{friend_id:'friend-a',conversation_id:'room-a',friend_name:'Friend A',friend_avatar:'sunny',relationship_type:'friend',last_read_at:null}];
    window.mock.emit('account-a');
  });
  await page.waitForFunction(() => window.api.friends.friends.length===1);
  await page.getByRole('button',{name:'Open friends',exact:true}).click();
  await page.locator('.chat-friend').click();
  assert.equal(await page.getByRole('textbox',{name:'Message Friend A'}).inputValue(),'A draft worth keeping','draft survives page reload');
  await page.keyboard.press('Escape');

  await page.evaluate(async () => {
    window.mock.messages=Array.from({length:1002},(_,i)=>({id:'message-'+i,conversation_id:'room-a',sender_id:'friend-a',body:'Message '+i,metadata:null,created_at:new Date(1700000000000+i*1000).toISOString()}));
    window.mock.contacts.push({friend_id:'friend-b',conversation_id:'room-b',friend_name:'Friend B',friend_avatar:'sunny',relationship_type:'friend',last_read_at:null});
    window.mock.messages.push(...Array.from({length:60},(_,i)=>({id:'tie-'+String(i).padStart(3,'0'),conversation_id:'room-b',sender_id:'friend-b',body:'Tied '+i,metadata:null,created_at:'2020-01-01T00:00:00.000Z'})));
    await window.api.friends.refreshContacts();
  });
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a').some(m=>m.id==='message-1001'));
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-a').length),50,'latest history is bounded per conversation');
  assert.equal(await page.evaluate(() => window.api.friends.getConversation('friend-b').length),50,'busy chat cannot starve another conversation');
  assert.equal(await page.evaluate(() => window.api.friends.friends.find(f=>f.id==='friend-a').unreadCount),1002,'unread count includes messages outside loaded page');
  await page.evaluate(() => window.api.friends.loadOlderMessages('friend-b'));
  await page.waitForFunction(() => window.api.friends.getConversation('friend-b').length===60);
  assert.equal(await page.evaluate(() => window.api.friends.getHistoryState('friend-b').hasMore),false,'timestamp ties page without omissions');
  await page.evaluate(async () => {
    window.mock.messages.push(...Array.from({length:120},(_,i)=>({id:'after-sleep-'+i,conversation_id:'room-b',sender_id:'friend-b',body:'After sleep '+i,metadata:null,created_at:new Date(1800000000000+i*1000).toISOString()})));
    await window.api.friends.refreshContacts();
  });
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-b').some(m=>m.id==='after-sleep-119'));
  assert.equal(await page.evaluate(()=>window.api.friends.getHistoryState('friend-b').hasMore),true,'a new window after sleep reopens history instead of hiding the gap');
  await page.evaluate(()=>window.api.friends.loadOlderMessages('friend-b'));
  await page.evaluate(()=>window.api.friends.loadOlderMessages('friend-b'));
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-b').length===180);
  assert.ok(await page.evaluate(()=>window.api.friends.getConversation('friend-b').some(m=>m.id==='after-sleep-0')),'pagination recovers the missing middle after a large incoming burst');
  await page.evaluate(async () => { window.mock.historyError=true; await window.api.friends.loadOlderMessages('friend-a'); });
  assert.ok(await page.evaluate(() => window.api.friends.getHistoryState('friend-a').error),'older history exposes a retryable error');
  await page.evaluate(async () => { window.mock.historyError=false; await window.api.friends.loadOlderMessages('friend-a'); });
  await page.waitForFunction(() => window.api.friends.getConversation('friend-a').length===100);
  await page.getByRole('button',{name:'Open friends',exact:true}).click();
  const peopleSearch=page.getByRole('searchbox',{name:'Search your people'});
  await peopleSearch.fill('nobody');
  await page.getByText('No one matches “nobody”.',{exact:true}).waitFor();
  await peopleSearch.fill('Friend A');
  await page.locator('.chat-friend').click();
  const feed=page.getByRole('log',{name:'Conversation with Friend A'});
  await feed.evaluate(el=>{el.scrollTop=0;});
  await page.getByRole('button',{name:'Load earlier messages',exact:true}).click();
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-a').length===150);
  assert.ok(await feed.evaluate(el=>el.scrollTop>100),'loading older history preserves position near previous first message');
  await page.getByRole('textbox',{name:'Message Friend A'}).fill('Send first');
  await page.evaluate(()=>{window.pendingSend=window.mock.defer('sendRequest');});
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Friend A'}).fill('Keep while sending');
  await page.evaluate(()=>window.pendingSend.resolve({error:null}));
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-a').some(m=>m.text==='Send first' && m.status==='sent'));
  assert.equal(await page.getByRole('textbox',{name:'Message Friend A'}).inputValue(),'Keep while sending','send acknowledgement cannot erase a newer draft');
  await page.keyboard.press('Escape');

  await page.evaluate(()=>{
    window.mock.defer('sendRequest');
    void window.api.friends.sendDirectMessage('friend-a','Pending through reload');
  });
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-a').some(m=>m.text==='Pending through reload' && m.status==='sending'));
  await page.reload();
  await page.waitForFunction(()=>window.api && window.mock);
  await page.evaluate(()=>{
    window.mock.contacts=[{friend_id:'friend-a',conversation_id:'room-a',friend_name:'Friend A',friend_avatar:'sunny',relationship_type:'friend',last_read_at:null}];
    window.mock.emit('account-a');
  });
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-a').some(m=>m.text==='Pending through reload' && m.status==='failed'));
  await page.evaluate(()=>{
    const message=window.api.friends.getConversation('friend-a').find(m=>m.text==='Pending through reload');
    window.api.friends.discardFailedMessage('friend-a',message.id);
  });
  await page.waitForFunction(()=>window.api.friends.getConversation('friend-a').length===0);
  assert.equal(await page.evaluate(async () => (await import('/src/utils/chatPersistence.ts')).readOutbox('account-a').length),0,'discard removes the durable pending message');

  const concurrentOutbox=await page.evaluate(async()=>{
    const storage=await import('/src/utils/chatPersistence.ts');
    const entry=(id,owner='two-tabs')=>({conversationId:'room',message:{id,friendId:'friend',senderId:owner,senderName:'Me',senderAvatar:'sunny',text:id,timestamp:Date.now(),status:'sending'}});
    const nativeSet=Storage.prototype.setItem;
    let interleaved=false;
    Storage.prototype.setItem=function(key,value){
      if(!interleaved && key.includes('outbox') && value.includes('"id":"first"')) {
        interleaved=true;
        storage.saveOutboxMessage('two-tabs',entry('second'));
      }
      return nativeSet.call(this,key,value);
    };
    try { storage.saveOutboxMessage('two-tabs',entry('first')); }
    finally { Storage.prototype.setItem=nativeSet; }
    const afterSends=storage.readOutbox('two-tabs').map(e=>e.message.id).sort();
    storage.removeOutboxMessage('two-tabs','first');
    const afterAck=storage.readOutbox('two-tabs').map(e=>e.message.id);
    localStorage.setItem('knotyet_chat_outbox:v1:legacy',JSON.stringify([entry('legacy-message','legacy')]));
    const recovered=storage.readOutbox('legacy').map(e=>e.message.id);
    storage.removeOutboxMessage('legacy','legacy-message');
    localStorage.setItem('knotyet_chat_outbox:v2:two-tabs:corrupt','{broken');
    return {afterSends,afterAck,recovered,legacyAfterAck:storage.readOutbox('legacy').length,afterCorruption:storage.readOutbox('two-tabs').map(e=>e.message.id)};
  });
  assert.deepEqual(concurrentOutbox,{afterSends:['first','second'],afterAck:['second'],recovered:['legacy-message'],legacyAfterAck:0,afterCorruption:['second']},'interleaved tab sends and acknowledgements retain other messages and recover v1 data');

  const storageChecks=await page.evaluate(async()=>{
    const storage=await import('/src/utils/chatPersistence.ts');
    localStorage.setItem('knotyet_chat_outbox:v1:broken','{invalid');
    const malformed=storage.readOutbox('broken');
    const nativeGet=Storage.prototype.getItem;
    const nativeSet=Storage.prototype.setItem;
    Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError');};
    Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};
    try{return {malformed,blocked:storage.readOutbox('blocked'),saved:storage.saveOutboxMessage('blocked',{conversationId:'room',message:{senderId:'blocked',id:'test'}})};}
    finally{Storage.prototype.getItem=nativeGet;Storage.prototype.setItem=nativeSet;}
  });
  assert.deepEqual(storageChecks,{malformed:[],blocked:[],saved:false},'invalid or blocked storage degrades safely');

  await page.evaluate(async () => { window.mock.couple=null; await window.api.auth.refreshCouple(); });
  await page.waitForFunction(() => window.api.auth.couple===null);

  await page.evaluate(() => {
    window.pendingContacts=window.mock.defer('contactsRequest');
    window.contactsResult=window.api.friends.refreshContacts();
    window.pendingProgress=window.mock.defer('progressRequest');
    window.progressResult=window.api.auth.refreshProgress();
  });
  await page.waitForFunction(() => window.mock.progressRequest===null && window.mock.contactsRequest===null);
  await page.evaluate(() => window.mock.emit(null));
  await page.waitForFunction(() => window.api.friends.friends.length===0 && window.api.auth.user===null);
  await page.evaluate(async () => {
    window.pendingContacts.resolve({data:[{friend_id:'leaked',conversation_id:'old',friend_name:'Old account'}],error:null});
    window.pendingProgress.resolve({data:{heart_points:999,last_reset_date:new Date().toISOString().slice(0,10)},error:null});
    await Promise.all([window.contactsResult,window.progressResult]);
  });
  assert.equal(await page.evaluate(() => window.api.friends.friends.length), 0, 'late contact response cannot restore signed-out data');
  assert.equal(await page.evaluate(() => window.api.auth.progress), null, 'late progress response cannot restore signed-out data');

  await page.reload();
  await page.waitForFunction(() => window.api && window.mock);
  await page.evaluate(() => { window.mock.emit('account-a'); window.mock.emit(null); window.mock.bootstrap.resolve({data:{session:{user:{id:'account-a'},access_token:'old'}}}); });
  await page.waitForFunction(() => !window.api.auth.isLoading);
  assert.equal(await page.evaluate(() => window.api.auth.user), null, 'stale bootstrap cannot undo sign-out');
  await page.evaluate(()=>window.mock.emit('storage-account'));
  await page.waitForFunction(()=>window.api.auth.user?.id==='storage-account' && !window.api.auth.isLoading);
  const signoutWithBlockedStorage=await page.evaluate(()=>{
    const remove=Storage.prototype.removeItem;
    Storage.prototype.removeItem=()=>{throw new DOMException('Blocked','SecurityError');};
    try { window.mock.emit(null); return true; }
    finally { Storage.prototype.removeItem=remove; }
  });
  assert.equal(signoutWithBlockedStorage,true,'optional cache cleanup cannot throw out of the auth callback');
  await page.waitForFunction(()=>window.api.auth.user===null && window.api.auth.progress===null && !window.api.auth.isLoading);
  assert.deepEqual(pageErrors, [], 'no uncaught runtime errors');
  console.log('Account/chat regressions passed: auth races, durable account-scoped outbox, safe retries/discard, draft recovery, per-thread cursor history with timestamp ties, exact unread counts, storage failures, responsive dialog and keyboard navigation.');
} finally { await browser.close(); }
