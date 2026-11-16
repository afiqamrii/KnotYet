import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base=process.env.SMOKE_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
const widths=(process.env.CHECK_WIDTHS||'320,390,1440').split(',').map(Number);
const fixture=`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
await import('/src/index.css');await import('/src/styles/play.css');await import('/src/styles/play-layout.css');
const {MemoryMatchGame}=await import('/src/components/MemoryMatchGame.tsx');const {StoryBuilderGame}=await import('/src/components/StoryBuilderGame.tsx');
const mode=new URLSearchParams(location.search).get('mode');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'arcade-play','data-playing':'true'},React.createElement('div',{className:'play-console'},React.createElement('div',{className:'arcade-brand-strip'},'KnotYet · one screen, a little closer'),React.createElement('main',{className:'arcade-play-main'},React.createElement(mode==='memory'?MemoryMatchGame:StoryBuilderGame,{onEndGame:()=>window.left=true})))));
</script></body></html>`;
async function setup(mode,width=390,corrupt=false){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});
 if(corrupt)await context.addInitScript(()=>{if(sessionStorage.getItem('activity_fixture_initialized'))return;sessionStorage.setItem('activity_fixture_initialized','true');sessionStorage.setItem('knotyet_memory_v1','{"phase":"playing","deck":[0,0,0]}');sessionStorage.setItem('knotyet_story_v1','{"phase":"complete","lines":null}');});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/local-activity-fixture')return route.fulfill({contentType:'text/html',body:fixture});if(url.origin!==new URL(base).origin)return route.fulfill({status:204,body:''});return route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(`${base}/local-activity-fixture?mode=${mode}`);await page.locator('.local-activity').waitFor();return {context,page};
}
async function layout(page,label){
 const metrics=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('.local-activity button,.local-activity input,.local-activity textarea')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left<0||r.right>innerWidth+1||r.height<43)}).map(el=>el.getAttribute('aria-label')||el.textContent)}));
 assert.ok(metrics.docWidth<=metrics.width+1,`${label}: no horizontal overflow`);assert.deepEqual(metrics.bad,[],`${label}: controls fit and meet 44px`);
}
const memoryState=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('knotyet_memory_v1')));
const storyState=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('knotyet_story_v1')));
try{
 await mkdir('artifacts/local-activities',{recursive:true});
 for(const width of widths){
  const {context,page}=await setup('memory',width,true);await page.getByRole('button',{name:'Two of us'}).click();
  await layout(page,`memory setup ${width}`);
  await page.getByRole('button',{name:'Deal the cards'}).click();
  assert.equal(await page.locator('.memory-card').count(),12);
  assert.equal(await page.locator('.memory-card').first().evaluate(el=>el===document.activeElement),true,'dealing puts keyboard focus on the first card');
  const state=await memoryState(page);const first=0;const miss=state.deck.findIndex(symbol=>symbol!==state.deck[first]);
  await page.getByRole('button',{name:`Card ${first+1}: face down`,exact:true}).click();
  assert.equal((await memoryState(page)).open.length,1);
  await page.reload();await page.locator('.memory-grid').waitFor();
  assert.equal((await memoryState(page)).open.length,1,'refresh keeps one revealed card');
  await page.getByRole('button',{name:`Card ${miss+1}: face down`,exact:true}).click();
  await page.getByRole('button',{name:'Hide cards & pass'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Hide cards & pass'}).evaluate(el=>el===document.activeElement),true,'mismatch moves focus to its continuation action');
  assert.equal(await page.locator('.memory-card:not(:disabled)').count(),0,'no third card can be opened while comparing');
  await page.reload();await page.getByRole('button',{name:'Hide cards & pass'}).click();
  assert.equal((await memoryState(page)).player,1,'a miss passes to player 2, including after refresh');
  assert.equal(await page.locator('.memory-card:not(:disabled)').first().evaluate(el=>el===document.activeElement),true,'passing returns focus to the board');
  for(let symbol=0;symbol<6;symbol++){
   const indices=state.deck.flatMap((value,index)=>value===symbol?[index]:[]);
   for(const index of indices)await page.getByRole('button',{name:`Card ${index+1}: face down`,exact:true}).click();
   if(symbol<5)assert.equal(await page.locator('.memory-card:not(:disabled)').first().evaluate(el=>el===document.activeElement),true,'matching a pair focuses the next available card');
  }
  await page.getByRole('heading',{name:'A perfect little team.'}).waitFor();
  assert.equal((await memoryState(page)).moves,7,'six matches and one miss use seven turns');
  assert.deepEqual((await memoryState(page)).finds,[0,6],'a match keeps the cooperative turn');
  assert.equal(await page.getByRole('heading',{name:'A perfect little team.'}).evaluate(el=>el===document.activeElement),true,'completion receives keyboard focus');
  await page.reload();await page.getByRole('heading',{name:'A perfect little team.'}).waitFor();
  await page.getByRole('button',{name:'Play a fresh board'}).click();await page.getByRole('button',{name:/8 pairs/}).click();await page.getByRole('button',{name:'Deal the cards'}).click();
  assert.equal(await page.locator('.memory-card').count(),16);
  await layout(page,`memory active ${width}`);await page.screenshot({path:`artifacts/local-activities/memory-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'New board',exact:true}).click();await page.getByRole('dialog',{name:'Start a fresh board?'}).waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.memory-card').count(),16,'cancel preserves board');
  await context.close();
 }
 for(const width of widths){
  const {context,page}=await setup('story',width,true);
  await page.getByLabel('First storyteller').fill('Alex');await page.getByLabel('Second storyteller').fill('Sam');
  await page.getByRole('button',{name:/A letter from tomorrow/}).click();
  await layout(page,`story setup ${width}`);await page.getByRole('button',{name:'Begin our story'}).click();
  const input=page.getByLabel('Alex, what happens next?');await input.fill('The ink was still warm.');
  await page.reload();await page.getByLabel('Alex, what happens next?').waitFor();
  assert.equal(await page.getByLabel('Alex, what happens next?').inputValue(),'The ink was still warm.','draft survives refresh');
  await page.getByRole('button',{name:'Add to the story'}).click();await page.getByLabel('Sam, what happens next?').fill('We decided to follow the directions.');
  assert.equal(await page.getByRole('button',{name:'Undo last line'}).isDisabled(),true,'undo cannot overwrite a draft');
  await page.getByRole('button',{name:'Add to the story'}).click();await page.getByRole('button',{name:'Undo last line'}).click();
  assert.equal(await page.getByLabel('Sam, what happens next?').inputValue(),'We decided to follow the directions.','undo returns last line to its author');
  assert.equal((await storyState(page)).lines.length,1);
  await page.getByRole('button',{name:'Add to the story'}).click();await page.getByLabel('Story title').fill('A Little Tomorrow');
  await layout(page,`story writing ${width}`);await page.screenshot({path:`artifacts/local-activities/story-writing-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'This feels like an ending'}).click();
  await page.getByRole('heading',{name:'That’s a story worth keeping.'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'That’s a story worth keeping.'}).evaluate(el=>el===document.activeElement),true);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download .txt'}).click();const download=await downloaded;
  const text=await readFile(await download.path(),'utf8');assert.match(text,/A Little Tomorrow\nBy Alex & Sam/);assert.match(text,/The ink was still warm/);assert.match(text,/We decided to follow/);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedStory=text;}}}));
  await page.getByRole('button',{name:'Copy story'}).click();await page.getByText('Story copied. Ready to keep or share.').waitFor();assert.equal(await page.evaluate(()=>window.copiedStory),text);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied')}}}));
  await page.getByRole('button',{name:'Copy story'}).click();await page.getByText('Copy is unavailable here.',{exact:false}).waitFor();
  await layout(page,`story complete ${width}`);await page.screenshot({path:`artifacts/local-activities/story-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Edit our last line'}).click();assert.equal((await storyState(page)).lines.length,1);await page.getByRole('button',{name:'Add to the story'}).click();
  await page.getByRole('button',{name:'Start a new story',exact:true}).click();await page.getByRole('dialog',{name:'A new beginning?'}).getByRole('button',{name:'Keep this story'}).click();assert.equal((await storyState(page)).lines.length,2);
  for(let index=2;index<8;index++){
   await page.locator('#story-next-line').fill(`This is line ${index+1}, and the adventure keeps going.`);
   await page.getByRole('button',{name:index===7?'Add our ending':'Add to the story',exact:true}).click();
   if(index<7&&width<700){const bounds=await page.locator('#story-next-line').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=900,'next writer can see the composer after a sentence is added');}
  }
  await page.getByRole('heading',{name:'That’s a story worth keeping.'}).waitFor();assert.equal((await storyState(page)).lines.length,8,'eight lines complete the story automatically');
  await context.close();
 }
 {
  const {context,page}=await setup('story',320);
  await page.getByLabel('First storyteller').fill('W'.repeat(24));await page.getByLabel('Second storyteller').fill('M'.repeat(24));await page.getByRole('button',{name:'Begin our story'}).click();
  await layout(page,'long storyteller names on small phone');
  await page.locator('#story-next-line').fill('This story fits even when our names are long.');await page.getByRole('button',{name:'Add to the story'}).click();
  await layout(page,'long second storyteller name on small phone');
  await context.close();
 }
 {
  const {context,page}=await setup('memory');
  await page.evaluate(async()=>{const api=await import('/src/utils/localActivities.ts');const state=api.startMemory('solo',6);const first=api.flipMemory(state,0);if(api.flipMemory(first,0)!==first)throw new Error('Duplicate card selection changed state');const miss=state.deck.findIndex(value=>value!==state.deck[0]);if(api.hideMemoryMiss(api.flipMemory(first,miss)).player!==0)throw new Error('Solo turn changed player');let story={...api.storySetup(),mode:'solo',phase:'writing',draft:'First line.'};story=api.addStoryLine(story);story=api.addStoryLine({...story,draft:'Second line.'});if(story.lines.some(line=>line.author!==0))throw new Error('Solo story changed author');window.validationPassed=!api.isMemorySession({...state,deck:Array(12).fill(0)})&&!api.isStorySession({...api.storySetup(),phase:'complete'});});
  assert.equal(await page.evaluate(()=>window.validationPassed),true,'corrupt session invariants rejected');
  await context.close();
 }
 {
  const {context,page}=await setup('story');
  await context.addInitScript(()=>{const get=Storage.prototype.getItem;const set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='knotyet_story_v1')throw new DOMException('Blocked','SecurityError');return get.call(this,key)};Storage.prototype.setItem=function(key,value){if(key==='knotyet_story_v1')throw new DOMException('Blocked','SecurityError');return set.call(this,key,value)};});
  await page.reload();await page.getByText('Your browser can’t save this draft.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Just me'}).click();await page.getByRole('button',{name:'Begin our story'}).click();await page.getByLabel('What happens next?').fill('A local story still works.');await page.getByRole('button',{name:'Add to the story'}).click();await page.getByText('A local story still works.',{exact:true}).waitFor();
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log(`Local activities passed: matching/turns/refresh/finish/6+8 pairs, story drafts/authors/undo/8-line finish/copy failure/download, solo/storage recovery, and ${widths.join('/')} layouts.`);
}finally{await browser.close();}
