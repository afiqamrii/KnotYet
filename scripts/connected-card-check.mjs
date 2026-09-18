import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const matchSource = await (await fetch(`${baseUrl}/src/components/MatchGame.tsx`)).text();
const gameContextUrl = matchSource.match(/import \{ useGame.*?\} from "([^"]+)"/)[1];
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import { GameProvider } from '${gameContextUrl}';
import { MatchGame } from '/src/components/MatchGame.tsx';
import { SwipeCard } from '/src/components/SwipeCard.tsx';
import { SWIPE_CARDS } from '/src/data/questions.ts';
import '/src/index.css'; import '/src/styles/play.css';
window.sent = [];
window.fixtureMp = {status:'connected',isHost:true, remoteProfile:{name:'Jamie',avatarId:'mochi'},messageListener:{current:null},sendMessage:msg=>window.sent.push(msg)};
function Cards(){
 const [flipped,setFlipped]=React.useState(false); const [answer,setAnswer]=React.useState(null);
 const card=SWIPE_CARDS.filter(card=>card.category==='vibe-check').sort((a,b)=>b.question.length-a.question.length)[0];
 return React.createElement('div',{className:'arcade-card-game',style:{width:'100%',maxWidth:576}},React.createElement('div',{className:'arcade-card-stack relative',style:{height:500}},React.createElement(SwipeCard,{card,isTop:true,isFlipped:flipped,onToggleFlip:setFlipped,myAnswer:answer,partnerAnswer:'A little time together.',onSubmitAnswer:setAnswer,onSwipe:()=>{}})));
}
const mode=new URLSearchParams(location.search).get('mode');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement('div',{className:'play-shell arcade-play','data-game':mode,'data-playing':'true'},React.createElement('div',{className:'play-console'},React.createElement('main',{className:'arcade-play-main'},React.createElement(mode==='match'?MatchGame:Cards))))));
</script></body></html>`;
try {
 for(const width of (process.env.CHECK_WIDTHS ?? '320,1440').split(',').map(Number)) {
  for(const mode of ['match','swipe']) {
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript(()=>{localStorage.setItem('jodohdeck_profile',JSON.stringify({name:'Alex',avatarId:'sunny',heartPoints:10}));});
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/connected-card-fixture')return route.fulfill({contentType:'text/html',body:html});
    if(url.pathname==='/src/store/MultiplayerContext.tsx')return route.fulfill({contentType:'application/javascript',body:'export const useMultiplayer=()=>window.fixtureMp;'});
    if(url.hostname!=='localhost' && !url.hostname.endsWith('googleapis.com') && !url.hostname.endsWith('gstatic.com'))return route.fulfill({contentType:'application/json',body:'null'});
    return route.continue();
   });
   const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`${baseUrl}/connected-card-fixture?mode=${mode}`);
   await page.locator('.question-text').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:`artifacts/cards-${width}-connected-${mode}.png`,fullPage:true});
   if(mode==='match') {
    const selected=await page.locator('.option-btn').first().locator('span').first().innerText();
    await page.locator('.option-btn').first().click();
    assert.equal(await page.evaluate(()=>window.sent.some(msg=>msg.type==='MATCH_SELECT')),true);
    await page.evaluate(answer=>window.fixtureMp.messageListener.current({type:'MATCH_SELECT',payload:answer}),selected);
    await page.getByRole('heading',{name:'Great minds, same answer!'}).waitFor();
    await page.screenshot({path:`artifacts/cards-${width}-match-result.png`,fullPage:true});
    await page.getByRole('button',{name:/Next Question/}).click();
    await page.locator('.option-btn').first().waitFor();
   }else{
    const question=page.locator('.conversation-question');
    assert.equal(await question.evaluate(el=>el.firstElementChild.getBoundingClientRect().top>=el.getBoundingClientRect().top),true,'Long question starts inside its scroll area');
    await page.getByRole('button',{name:'Share your answers'}).click();
    await page.waitForTimeout(500);
    await page.getByLabel('Your answer',{exact:true}).fill('Coffee and a walk together.');
    await page.getByRole('button',{name:/Submit & reveal/i}).click();
    await page.locator('.paired-answers').waitFor({timeout:8000}).catch(async error=>{console.log(await page.locator('body').innerText());await page.screenshot({path:'artifacts/connected-answer-failure.png',fullPage:true});throw error;});
    assert.match(await page.locator('.paired-answers').innerText(),/Coffee and a walk together/);
    assert.match(await page.locator('.paired-answers').innerText(),/A little time together/);
    await page.waitForTimeout(500);
    await page.screenshot({path:`artifacts/cards-${width}-connected-answers.png`,fullPage:true});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   for(const font of await page.locator('.question-text').evaluateAll(els=>els.map(el=>getComputedStyle(el).fontFamily)))assert.match(font,/Outfit/);
   await context.close();
   console.log(`${width}px ${mode}: connected-card UI fixture, answer interactions, font and overflow checks passed (simulated partner).`);
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
