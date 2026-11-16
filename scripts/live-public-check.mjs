import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Production UI only: no route interception, mocked providers, or seeded state.
const base=(process.env.LIVE_URL||'https://knotyetapp.me').replace(/\/$/,'');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const artifacts=`artifacts/live/public-${stamp}`;
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={base,startedAt:new Date().toISOString(),mocked:false,artifacts,deployments:[],results:[],pageErrors:[],consoleErrors:[],networkFailures:[]};
const viewports=[{name:'phone-320',width:320,height:740},{name:'phone-390',width:390,height:844},{name:'tablet-768',width:768,height:1024},{name:'desktop',width:1440,height:900},{name:'landscape',width:844,height:390}].filter(view=>!process.env.LIVE_VIEWPORT||view.name===process.env.LIVE_VIEWPORT);

async function layout(page,label,selector='main button,main input,main textarea'){
 const value=await page.evaluate(selector=>({viewport:innerWidth,width:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll(selector)].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left < -1||r.right>innerWidth+1)}).map(el=>(el.getAttribute('aria-label')||el.textContent||el.tagName).slice(0,100))}),selector);
 assert.ok(value.width<=value.viewport+1,`${label}: horizontal overflow ${JSON.stringify(value)}`);assert.deepEqual(value.clipped,[],`${label}: controls fit the viewport`);
}
async function snapshot(page,name){await page.screenshot({path:`${artifacts}/${name}.png`,fullPage:true});}
const cardLabel=async (page,index)=>page.locator('.memory-card').nth(index).getAttribute('aria-label');
async function solveMemory(page){
 const known=new Map();
 for(let turn=0;turn<50;turn++){
  if(await page.locator('.local-result').count())return;
  const cards=await page.locator('.memory-card').evaluateAll(nodes=>nodes.map((node,index)=>({index,matched:node.getAttribute('data-matched')==='true',revealed:node.getAttribute('data-revealed')==='true'})));
  const available=cards.filter(card=>!card.matched);const open=available.find(card=>card.revealed);
  let first=open?.index;
  if(first===undefined){
   let pair;
   for(const candidate of available){const name=known.get(candidate.index);if(name&&available.some(other=>other.index!==candidate.index&&known.get(other.index)===name)){pair=candidate;break;}}
   first=(pair||available.find(card=>!known.has(card.index))||available[0]).index;
   await page.locator('.memory-card').nth(first).click();
  }
  const firstName=(await cardLabel(page,first)).split(': ')[1];known.set(first,firstName);
  const second=(available.find(card=>card.index!==first&&known.get(card.index)===firstName)||available.find(card=>card.index!==first&&!known.has(card.index))||available.find(card=>card.index!==first)).index;
  await page.locator('.memory-card').nth(second).click();
  if(await page.locator('.local-result').count())return;
  const secondName=(await cardLabel(page,second))?.split(': ')[1]?.replace(', matched','');if(secondName)known.set(second,secondName);
  const next=page.getByRole('button',{name:'Hide cards & pass'});
  if(await next.count())await next.click();
 }
 throw new Error('Memory game failed to finish within 50 UI turns');
}

try{
 for(const viewport of viewports){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.width<900,hasTouch:viewport.width<900,reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const failuresBefore=report.pageErrors.length;
  page.on('pageerror',error=>report.pageErrors.push({viewport:viewport.name,message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({viewport:viewport.name,message:message.text(),location:message.location().url});});
  page.on('requestfailed',request=>report.networkFailures.push({viewport:viewport.name,url:request.url(),error:request.failure()?.errorText}));
  try{
   const response=await page.goto(base,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,'published landing HTTP200');await page.locator('#hero-title').waitFor();
   const liveOrigin=new URL(page.url()).origin;
   await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:liveOrigin});
   report.deployments.push({viewport:viewport.name,url:page.url(),status:response.status(),headers:{etag:response.headers().etag,vercelId:response.headers()['x-vercel-id'],cache:response.headers()['x-vercel-cache']},scripts:await page.locator('script[src]').evaluateAll(nodes=>nodes.map(node=>node.src))});
   assert.equal(await page.locator('.date-game-tile').count(),9,'live catalogue includes nine games');
   const filters=page.getByRole('group',{name:'Filter games by mood'});
   for(const [label,count] of [['Get closer',3],['Just for laughs',5],['Get creative',1],['All games',9]]){await filters.getByRole('button',{name:new RegExp(`^${label}`)}).click();assert.equal(await page.locator('.date-game-tile').count(),count);}
   await page.getByRole('searchbox',{name:'Find a game'}).fill('nothing matches this');await page.getByRole('button',{name:'Show all games'}).click();
   assert.equal(await page.getByRole('searchbox',{name:'Find a game'}).evaluate(el=>el===document.activeElement),true,'live landing reset retains focus');
   await layout(page,'landing');await snapshot(page,`${viewport.name}-landing`);
   await page.goto(`${base}/try`);const player=page.getByRole('article',{name:'Current conversation card'});await player.waitFor();
   const firstQuestion=await player.locator('h3').innerText();await page.getByRole('button',{name:'Reveal a follow-up'}).click();await page.getByRole('button',{name:'Save card',exact:true}).click();await page.getByRole('button',{name:'Next question'}).click();
   const secondQuestion=await player.locator('h3').innerText();assert.notEqual(firstQuestion,secondQuestion);await page.reload();await player.waitFor();assert.equal(await player.locator('h3').innerText(),secondQuestion,'live deck resumes after refresh');
   await page.getByRole('button',{name:'Previous',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Card saved',exact:true}).getAttribute('aria-pressed'),'true');
   await layout(page,'free deck');await snapshot(page,`${viewport.name}-deck`);
   for(let card=0;card<5;card++)await page.getByRole('button',{name:'Next question'}).click();await page.getByRole('button',{name:'Finish deck'}).click();await page.getByRole('heading',{name:'That’s this deck.'}).waitFor();assert.equal(await player.evaluate(el=>el===document.activeElement),true);
   await page.getByRole('button',{name:'Try under the surface'}).click();await page.getByRole('button',{name:/^Saved cards/}).click();await page.locator('.public-deck-library-grid li button').click();assert.equal(await player.locator('h3').innerText(),firstQuestion);
   await page.getByRole('button',{name:'Card saved',exact:true}).click();await page.getByRole('button',{name:'Explore all cards'}).click();assert.equal(await page.locator('.public-deck-library-grid li').count(),18);
   await page.goto(`${base}/arcade`);await page.getByRole('heading',{name:'Pick your little escape.'}).waitFor();await layout(page,'free arcade');await snapshot(page,`${viewport.name}-arcade`);
   await page.getByRole('button',{name:'Play Memory Match',exact:true}).click();await page.getByRole('button',{name:'Two of us'}).click();await page.getByRole('button',{name:/8 pairs/}).click();await page.getByRole('button',{name:'Deal the cards'}).click();await page.getByRole('button',{name:'Card 1: face down',exact:true}).click();const revealed=await cardLabel(page,0);await page.reload();await page.locator('.memory-grid').waitFor();assert.equal(await cardLabel(page,0),revealed,'live memory survives refresh');
   await layout(page,'memory active');await snapshot(page,`${viewport.name}-memory`);await solveMemory(page);await page.getByRole('heading',{name:'A perfect little team.'}).waitFor();await snapshot(page,`${viewport.name}-memory-complete`);
   await page.getByRole('button',{name:'Play a fresh board'}).click();await page.getByRole('button',{name:'Free arcade',exact:true}).click();await page.getByRole('button',{name:'Play Story Builder',exact:true}).click();
   await page.getByLabel('First storyteller').fill('Live test Alex');await page.getByLabel('Second storyteller').fill('Live test Sam');await page.getByRole('button',{name:/A letter from tomorrow/}).click();await page.getByRole('button',{name:'Begin our story'}).click();
   await page.locator('#story-next-line').fill('A small paper boat appeared at the kitchen door.');await page.reload();await page.locator('#story-next-line').waitFor();assert.equal(await page.locator('#story-next-line').inputValue(),'A small paper boat appeared at the kitchen door.','live story draft survives refresh');
   await page.getByRole('button',{name:'Add to the story'}).click();await page.locator('#story-next-line').fill('Inside was an invitation written in blue ink.');await page.getByRole('button',{name:'Add to the story'}).click();await page.getByRole('button',{name:'Undo last line'}).click();assert.equal(await page.locator('#story-next-line').inputValue(),'Inside was an invitation written in blue ink.');await page.getByRole('button',{name:'Add to the story'}).click();
   await layout(page,'story writing');await snapshot(page,`${viewport.name}-story-writing`);await page.getByLabel('Story title').fill('The Paper Boat');
   for(let line=2;line<8;line++){await page.locator('#story-next-line').fill(`Together we followed clue ${line+1} and found another small surprise.`);await page.getByRole('button',{name:line===7?'Add our ending':'Add to the story',exact:true}).click();}
   await page.getByRole('heading',{name:'That’s a story worth keeping.'}).waitFor();await page.getByRole('button',{name:'Copy story'}).click();await page.getByText('Story copied. Ready to keep or share.').waitFor();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.match(copied,/The Paper Boat/);
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download .txt'}).click();const download=await downloadPromise;const downloaded=await readFile(await download.path(),'utf8');assert.equal(downloaded.replace(/\r\n/g,'\n'),copied.replace(/\r\n/g,'\n'),'real downloaded story matches live clipboard export');await download.saveAs(`${artifacts}/${viewport.name}-story.txt`);
   await layout(page,'story complete');await snapshot(page,`${viewport.name}-story-complete`);
   await page.getByRole('button',{name:'Start a new story',exact:true}).click();const confirmation=page.getByRole('dialog',{name:'A new beginning?'});await confirmation.waitFor();const bounds=await confirmation.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height,`story reset dialog fits ${viewport.name}`);await confirmation.getByRole('button',{name:'Keep this story'}).click();
   await page.goto(`${base}/arcade?game=unknown`);await page.getByRole('heading',{name:'Pick your little escape.'}).waitFor();await page.goto(`${base}/play`);await page.waitForURL(`${liveOrigin}/`);await page.locator('#hero-title').waitFor();
   assert.equal(report.pageErrors.length,failuresBefore,'no live runtime exceptions');report.results.push({viewport:viewport.name,status:'passed',flows:['landing discovery','free deck complete/save/restore','memory 8 pairs complete/restore','story 8 lines/undo/restore/copy/download','unknown route','signed-out auth gate']});console.log(`${viewport.name}: LIVE public flows passed`);
  }catch(error){report.results.push({viewport:viewport.name,status:'failed',url:page.url(),error:error.message});await snapshot(page,`${viewport.name}-FAILURE`).catch(()=>{});console.log(`${viewport.name}: FAILED ${error.message}`);}
  finally{await context.close();await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));}
 }
}finally{await browser.close();report.finishedAt=new Date().toISOString();await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));}
console.log(`Live evidence: ${artifacts}/report.json`);if(report.results.some(result=>result.status==='failed'))process.exitCode=1;
