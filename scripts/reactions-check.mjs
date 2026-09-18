import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const baseUrl=process.env.SMOKE_URL ?? 'http://localhost:5174';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];
await mkdir('artifacts',{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseUrl);await page.getByRole('button',{name:'Start playing',exact:true}).first().click();
  await page.getByRole('navigation',{name:'Choose your game'}).getByRole('button',{name:/^Guess My Heart/}).click();
  await page.locator('.game-primary-action').click();
  await page.locator('.option-btn').first().click();
  await page.getByRole('button',{name:"I'm Ready to Guess!"}).click();
  await page.locator('.option-btn').first().click();
  const dialog=page.getByRole('dialog',{name:'You get each other!'});
  await dialog.waitFor();
  await page.waitForFunction(()=>{const img=document.querySelector('.giphy-reaction img');return img?.complete && img.naturalWidth>0;});
  assert.match(await dialog.locator('img').getAttribute('src'),/\/giphy\.gif$/,'Happy result animates by default');
  assert.equal(await dialog.locator('.reaction-answers p').first().evaluate(el=>getComputedStyle(el).webkitLineClamp),'none','Answers remain complete');
  assert.equal(await page.locator('[data-result-next]').evaluate(el=>el===document.activeElement),true,'Results focus the next action');
  await dialog.getByRole('button',{name:'Pause GIF'}).click();
  await page.waitForFunction(()=>{const img=document.querySelector('.giphy-reaction img');return img?.complete&&img.src.endsWith('/giphy_s.gif');});
  await dialog.getByRole('button',{name:'Play GIF'}).click();
  await page.screenshot({path:'artifacts/reaction-happy-laptop.png'});
  await page.reload();await dialog.waitFor();
  assert.equal(await dialog.locator('.reaction-answers p').count(),2,'Reload preserves the revealed answers');
  await dialog.getByRole('button',{name:/Next Question/}).click();
  await page.locator('.option-btn').first().click();
  await page.getByRole('button',{name:"I'm Ready to Guess!"}).click();
  await page.route('https://media.giphy.com/**',route=>route.abort());
  await page.locator('.option-btn').nth(1).click();
  await page.getByRole('dialog',{name:'A new thing about you!'}).waitFor();
  await page.getByText('The reaction is taking a break.').waitFor();
  assert.equal(await page.locator('.giphy-reaction img').count(),0,'Failed GIF becomes local art, never a broken image');
  await page.getByRole('button',{name:/Next Question/}).click();
  await page.locator('.option-btn').first().waitFor();
  console.log('GIPHY: real animated reaction, pause/still, play, full answers, next-action focus, reload recovery and offline fallback passed.');
  await context.close();

  const audioContext=await browser.newContext();
  await audioContext.addInitScript(()=>{
    window.audioProbe={sources:0,gains:[],contexts:0};
    const Native=window.AudioContext;
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);window.audioProbe.contexts++;}
      createOscillator(){window.audioProbe.sources++;return super.createOscillator();}
      createBufferSource(){window.audioProbe.sources++;return super.createBufferSource();}
      createGain(){const node=super.createGain();window.audioProbe.gains.push(node);return node;}
    };
  });
  const audioPage=await audioContext.newPage();await audioPage.goto(baseUrl);
  const playSource=await(await fetch(`${baseUrl}/src/screens/PlayScreen.tsx`)).text();
  const audioUrl=playSource.match(/import \{ sounds \} from "([^"]+)"/)[1];
  const success=await audioPage.evaluate(async url=>{const {sounds}=await import(url);sounds.playSuccess();const result=window.audioProbe.sources;sounds.setEffectVolume(.4);sounds.toggleMute();return result;},audioUrl);
  assert.ok(success>=7,'Happy success plays an arpeggio plus a major chord');
  await audioPage.waitForTimeout(200);
  const muted=await audioPage.evaluate(async url=>{const {sounds}=await import(url);const before=window.audioProbe.sources;for(const method of ['playFlip','playSwipe','playTick','playSuccess','playMismatch','playChatPop','playChatSent'])sounds[method]();return {before,after:window.audioProbe.sources,gain:window.audioProbe.gains[0].gain.value,saved:JSON.parse(localStorage.getItem('knotyet_sound_preferences'))};},audioUrl);
  assert.equal(muted.before,muted.after);assert.ok(muted.gain<.001);assert.deepEqual(muted.saved,{muted:true,volume:.4});
  await audioPage.reload();
  const restored=await audioPage.evaluate(async url=>{const {sounds}=await import(url);sounds.playSuccess();return {muted:sounds.isMuted,volume:sounds.effectVolume,contexts:window.audioProbe.contexts};},audioUrl);
  assert.deepEqual(restored,{muted:true,volume:.4,contexts:0},'A muted reload creates no audio context');
  console.log('Audio: happy major fanfare, every effect obeys mute, active graph silence, and volume/mute reload persistence passed.');
  assert.deepEqual(errors,[],'No browser runtime errors');
} finally {await browser.close();}
