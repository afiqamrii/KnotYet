import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const errors = [];
async function checkBounds(page, tag) {
  const result = await page.locator('.chat-window').evaluate(el => {
    const b=el.getBoundingClientRect();
    const controls=[...el.querySelectorAll('button,input')].filter(c=>c.getClientRects().length && !c.closest('.chat-quick-replies') && !c.closest('.chat-add-view'));
    return { viewport: [innerWidth,innerHeight], dialog: [b.left,b.top,b.right,b.bottom], overflow: el.scrollWidth>el.clientWidth+1, clipped:controls.filter(c=>{const r=c.getBoundingClientRect();return r.left<b.left || r.right>b.right+1}).map(c=>c.textContent) };
  });
  assert.ok(result.dialog[0]>=0 && result.dialog[1]>=0 && result.dialog[2]<=result.viewport[0] && result.dialog[3]<=result.viewport[1],`${tag}: dialog fits screen`);
  assert.equal(result.overflow,false,`${tag}: no horizontal dialog overflow`);
  assert.deepEqual(result.clipped,[],`${tag}: controls fit`);
}
try {
  for (const viewport of [{width:1366,height:768},{width:390,height:844},{width:320,height:640},{width:844,height:390}]) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce',permissions:['clipboard-write','clipboard-read']});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:5174');
    await page.getByRole('button',{name:'Start playing',exact:true}).first().click();
    await page.waitForURL('**/play');
    const trigger=page.getByRole('button',{name:'Friends and messages',exact:true});
    await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Your little circle'}); await dialog.waitFor();
    await checkBounds(page,`${viewport.width} empty`);
    await page.screenshot({path:`artifacts/chat-${viewport.width}-empty.png`});
    await dialog.getByRole('button',{name:'Invite your person',exact:true}).click();
    await dialog.getByRole('button',{name:'Copy link',exact:true}).click();
    await dialog.getByRole('button',{name:'Copied',exact:true}).waitFor();
    const url = await page.locator('.chat-link-preview').innerText();
    assert.match(url,/^http:\/\/localhost:5174\/invite\?cid=/);assert.ok(new URL(url).searchParams.get('key'));
    await checkBounds(page,`${viewport.width} add`);
    await page.screenshot({path:`artifacts/chat-${viewport.width}-add.png`});
    await page.locator('.chat-manual summary').click();
    await page.locator('#saved-friend-name').fill('My test person');
    await dialog.getByRole('button',{name:'Save profile on this device',exact:true}).click();
    await page.getByText('This profile is saved on your device. Share an invite to connect your browsers and chat.',{exact:true}).waitFor();
    assert.equal(await page.locator('.chat-composer').count(),0,'Local profile never falsely offers message delivery');
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Focus restored after closing');
    await page.evaluate(()=>{
      const owner=localStorage.getItem('knotyet_guest_id');
      const identity=JSON.parse(localStorage.getItem(`knotyet_chat_identity:${owner}`));
      const id=crypto.randomUUID();
      const messages=[
        {id:'incoming',friendId:id,senderId:id,senderName:'Mochi',senderAvatar:'mochi',text:'I bet I know your answer already.',timestamp:Date.now()-60000},
        {id:'outgoing',friendId:id,senderId:identity.id,senderName:'Guest Player',senderAvatar:'sunny',text:'One more round? You are on!',timestamp:Date.now()-30000,status:'delivered'},
        {id:'failed',friendId:id,senderId:identity.id,senderName:'Guest Player',senderAvatar:'sunny',text:'Save a spot for me.',timestamp:Date.now(),status:'failed',error:'Delivery was not confirmed.'}
      ];
      localStorage.setItem(`knotyet_chats_v2:${owner}`,JSON.stringify({friends:[{id,name:'Mochi',avatarId:'mochi',relationshipType:'lover',linked:true,isOnline:false,addedAt:new Date().toISOString(),inviteToken:crypto.randomUUID(),lastMessage:'Save a spot for me.',unreadCount:1}],conversations:{[id]:messages}}));
    });
    await page.reload(); await trigger.click();await dialog.waitFor();
    await page.locator('.chat-friend').filter({hasText:'Mochi'}).click();
    await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
    assert.equal(await page.locator('.chat-message.is-mine').count(),2,'Outgoing message identity is accurate');
    await checkBounds(page,`${viewport.width} thread`);
    await page.screenshot({path:`artifacts/chat-${viewport.width}-thread.png`});
    const input=page.getByRole('textbox',{name:'Message Mochi',exact:true});
    await input.fill('A fresh message for this test.');
    await input.focus();await page.waitForTimeout(1300);assert.equal(await input.evaluate(el=>el===document.activeElement),true,'Timer updates do not steal focus');
    await page.getByRole('button',{name:'Send message',exact:true}).click();
    assert.equal(await input.inputValue(),'','Successful queue clears draft');
    await page.getByText('Waiting for partner',{exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Retry',exact:true}).count(),0,'Retry puts failed message back into outbox');
    const close=page.getByRole('button',{name:'Close friends and messages'});await close.focus();await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,'Focus is trapped');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    results.push(`${viewport.width}x${viewport.height}: empty, invite, local profile, transcript, queued/retry, keyboard passed`);
    await context.close();
  }
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log(results.join('\n'));
} finally { await browser.close(); }
