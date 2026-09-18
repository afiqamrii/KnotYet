import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors=[];
try {
for (const viewport of [{width:1536,height:695},{width:1366,height:650},{width:1280,height:600},{width:1024,height:600},{width:1440,height:900},{width:1920,height:880}]) {
 const context = await browser.newContext({ viewport,reducedMotion:'reduce' });
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});
 await page.goto('http://localhost:5174');
 await page.getByRole('button',{name:'Start playing',exact:true}).first().click();
 await page.locator('#intro-swipe').waitFor();
 for(const [id,name] of [['swipe','Icebreaker Cards'],['quiz','Guess My Heart'],['wheel','Spin Wheel'],['number','Number Guesser'],['letter','Letter Race']]) {
  await page.getByRole('navigation',{name:'Choose your game'}).getByRole('button',{name:new RegExp(`^${name}`)}).click();
  await page.locator(`#intro-${id}`).waitFor();
  const intro=await page.evaluate(()=>{const c=document.querySelector('.game-primary-action').getBoundingClientRect();return{width:innerWidth,height:innerHeight,docHeight:document.documentElement.scrollHeight,docWidth:document.documentElement.scrollWidth,button:c.toJSON(),console:document.querySelector('.play-console').getBoundingClientRect().toJSON(),panel:document.querySelector('.arcade-intro-content').getBoundingClientRect().toJSON()};});
  assert.ok(intro.docHeight<=intro.height+1,`${viewport.width}x${viewport.height} ${id}: lobby fits window (${JSON.stringify(intro)})`);
  assert.ok(intro.button.bottom<intro.height && intro.button.top>0 && intro.button.bottom<=intro.panel.bottom,`${id}: Start stays fully in view`);
  assert.ok(intro.console.width<=1180,`${id}: console stays at a comfortable width`);
  if(id==='wheel')await page.screenshot({path:`artifacts/laptop-${viewport.width}x${viewport.height}-lobby.png`});
  console.log('Starting',viewport.width,viewport.height,id);
  await page.locator('.game-primary-action').click();
  await page.locator('.game-toolbar').waitFor({timeout:10000}).catch(async error=>{console.log('FAILED SCREEN',await page.locator('body').innerText());await page.screenshot({path:'artifacts/laptop-failure.png'});throw error;});
  const active=await page.evaluate(()=>({width:innerWidth,height:innerHeight,docHeight:document.documentElement.scrollHeight,docWidth:document.documentElement.scrollWidth,mainScroll:[document.querySelector('.arcade-play-main').clientHeight,document.querySelector('.arcade-play-main').scrollHeight],main:document.querySelector('.arcade-play-main').getBoundingClientRect().toJSON(),end:document.querySelector('.global-end-game').getBoundingClientRect().toJSON()}));
  assert.ok(active.docWidth<=active.width+1 && active.docHeight<=active.height+1,`${viewport.width}x${viewport.height} ${id}: game fits window (${JSON.stringify(active)})`);
  assert.ok(active.mainScroll[1] <= active.mainScroll[0] + 2,`${id}: game surface requires no extra scrolling (${active.mainScroll})`);
  assert.ok(active.end.bottom<100,`${id}: End Game is in top strip`);
  await page.screenshot({path:`artifacts/laptop-${viewport.width}x${viewport.height}-${id}.png`});
  await page.getByRole('button',{name:'End Game',exact:true}).click();
  await page.getByRole('button',{name:'Yes, End Game',exact:true}).click();
  await page.getByRole('navigation',{name:'Choose your game'}).waitFor();
 }
 console.log(`${viewport.width}x${viewport.height}: all five lobby + game screens fit at 100%, global End Game visible.`);
 await context.close();
}
assert.deepEqual(errors,[]);
}finally{await browser.close();}
