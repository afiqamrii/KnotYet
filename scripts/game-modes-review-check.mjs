import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const multiplayerMock = `export const useMultiplayer = () => window.testRoom;`;
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><main id="root"></main><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/src/index.css');
const React=(await import('/@id/react')).default;const ReactDOM=(await import('/@id/react-dom/client')).default;
const {GameProvider}=await import('__GAME_CONTEXT__');
const bank=await import('/src/data/questions.ts');
const params=new URLSearchParams(location.search), game=params.get('game'), mode=params.get('mode')||'local';
sessionStorage.clear();localStorage.clear();
localStorage.setItem('jodohdeck_profile',JSON.stringify({name:'Alex',avatarId:'sunny',heartPoints:0}));localStorage.setItem('jodohdeck_lang','en');
if(game==='quiz'){sessionStorage.setItem('guess_questions',JSON.stringify(bank.GUESS_QUIZ_LIST.slice(0,2)));}
if(game==='match'){sessionStorage.setItem('match_questions',JSON.stringify(bank.MATCH_QUESTIONS.slice(0,2)));}
if(params.has('stale')){sessionStorage.setItem('guess_questions',JSON.stringify([{id:'old-deleted-id'}]));sessionStorage.setItem('guess_stage','reveal');sessionStorage.setItem('guess_completed','true');}
window.sent=[];window.listeners=new Set();
window.testRoom={status:mode==='local'?'disconnected':'connected',isHost:mode==='host',remoteProfile:{name:'Robin'},numberSecret:75,questionDecks:{quiz:bank.GUESS_QUIZ_LIST.slice(0,2).map(q=>q.id),match:bank.MATCH_QUESTIONS.slice(0,2).map(q=>q.id)},questionIndices:{},sendMessage:m=>window.sent.push(m),subscribeMessage:f=>{window.listeners.add(f);return()=>window.listeners.delete(f)}};
window.receive=m=>window.listeners.forEach(f=>f(m));
const names={number:'NumberGuesserGame',letter:'LetterRaceGame',quiz:'CoupleGuessGame',match:'MatchGame',wheel:'SpinWheel'};
const module=await import('/src/components/'+names[game]+'.tsx');
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(GameProvider,null,React.createElement('div',{className:'arcade-play','data-game':game,style:{padding:16,minHeight:'100vh'}},React.createElement(module[names[game]]))));
</script></body></html>`;

const contexts=[];
const errors=[];
async function open(game,mode='local',extra=''){
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});contexts.push(ctx);
 await ctx.route('**/src/store/MultiplayerContext.tsx*',r=>r.fulfill({contentType:'text/javascript',body:multiplayerMock}));
 const names={number:'NumberGuesserGame',letter:'LetterRaceGame',quiz:'CoupleGuessGame',match:'MatchGame',wheel:'SpinWheel'};
 const source=await(await fetch(base+'/src/components/'+names[game]+'.tsx')).text();
 const provider=source.match(/import \{ useGame.*?\} from "([^"]+)"/)[1];
 await ctx.route('**/game-mode-review*',r=>r.fulfill({contentType:'text/html',body:fixture.replace('__GAME_CONTEXT__',provider)}));
 const p=await ctx.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/game-mode-review?game='+game+'&mode='+mode+extra);await p.locator('.game-toolbar').waitFor({timeout:10000}).catch(async()=>{throw new Error(errors.join(' | ')+' '+await p.locator('body').innerText())});return p;
}
async function points(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('jodohdeck_profile')).heartPoints);}
try{
 const number=await open('number');
 await number.getByRole('button',{name:'Solo',exact:true}).click();await number.getByRole('button',{name:'Start Game!'}).click();
 const secret=await number.evaluate(()=>Number(sessionStorage.getItem('num_secret')));
 const wrong=secret>50?50:51;
 await number.getByLabel('Your guess').fill(String(wrong));await number.getByRole('button',{name:'Lock in '+wrong,exact:true}).click();
 assert.match(await number.locator('#number-turn-heading').innerText(),/Alex/,'solo keeps the same player');
 await number.getByLabel('Your guess').fill(String(wrong));assert.equal(await number.locator('button[type=submit]').isDisabled(),true,'repeat guesses disabled');
 await number.locator('.number-guess-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(await number.evaluate(()=>JSON.parse(sessionStorage.getItem('num_guesses')).length),1,'handler rejects a repeated guess');
 await number.getByLabel('Your guess').fill(String(secret));await number.locator('.number-guess-form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 await number.getByText('Alex Guessed It!').waitFor();assert.equal(await points(number),10,'winning twice in one tick rewards only once');
 console.log('Number solo passed');
 const localNumber=await open('number');await localNumber.getByRole('button',{name:'Two players',exact:true}).click();await localNumber.getByRole('button',{name:'Start Game!'}).click();const localSecret=await localNumber.evaluate(()=>Number(sessionStorage.getItem('num_secret')));await localNumber.getByLabel('Your guess').fill(String(localSecret===1?2:1));await localNumber.locator('button[type=submit]').click();assert.match(await localNumber.locator('#number-turn-heading').innerText(),/Player 2/,'same-device number advances to the second player');
 const quiz=await open('quiz');
 for(let round=0;round<2;round++){
  const option=await quiz.locator('.answer-grid button').first().innerText();
  await quiz.locator('.answer-grid button').first().click();await quiz.getByRole('button',{name:"I'm Ready to Guess!"}).click();
  assert.ok((await quiz.locator('.answer-grid button').first().innerText()).includes(option.trim()));
  await quiz.locator('.answer-grid button').first().evaluate(b=>{b.click();b.click();});
  await quiz.getByRole('dialog').waitFor();await quiz.locator('[data-result-next]').evaluate(b=>{b.click();b.click();});
 }
 await quiz.locator('.completion-inline').waitFor();assert.equal(await points(quiz),70,'two correct guesses and perfect bonus, once each');
 console.log('Quiz local passed'); const stale=await open('quiz','local','&stale=1');await stale.locator('.answer-grid button').first().waitFor();assert.equal(await stale.locator('.completion-inline').count(),0,'outdated saved decks rebuild safely');
 const guest=await open('quiz','guest');await guest.getByText(/Alex|Robin/).first().waitFor();assert.equal(await guest.locator('.answer-grid button').count(),0,'guest cannot race host to choose first secret');
 await guest.evaluate(async()=>{const bank=await import('/src/data/questions.ts');window.receive({type:'QUIZ_ACTUAL',payload:bank.GUESS_QUIZ_LIST[0].options[0]});});
 await guest.locator('.answer-grid button').first().click();await guest.getByRole('dialog').waitFor();assert.equal(await guest.locator('[data-result-next]').isDisabled(),true,'only host advances online quiz');
 console.log('Quiz guest passed'); const match=await open('match');const first=await match.locator('.answer-grid button').first().innerText();await match.locator('.answer-grid button').first().click();await match.getByRole('button',{name:'I’m ready to choose'}).waitFor();assert.equal(await match.getByText(first.trim(),{exact:true}).count(),0,'handover hides first answer');await match.getByRole('button',{name:'I’m ready to choose'}).click();await match.locator('.answer-grid button').first().click();await match.getByRole('dialog').waitFor();assert.equal(await points(match),15,'same-device match completes');
 console.log('Match local passed'); const letter=await open('letter');await letter.getByRole('button',{name:'Solo',exact:true}).click();await letter.getByRole('button',{name:/Start Race!/}).click();await letter.locator('input').waitFor({timeout:5000});const char=await letter.locator('h2.text-6xl').innerText();await letter.locator('input').fill(char);assert.equal(await letter.locator('button[type=submit]').isDisabled(),true,'one letter is not a word');await letter.locator('input').fill(char+'AT');await letter.locator('button[type=submit]').click();await letter.getByText('Alex Wins!').waitFor();assert.equal(await points(letter),10);
 const localLetter=await open('letter');await localLetter.getByRole('button',{name:'Two players',exact:true}).click();await localLetter.getByRole('button',{name:/Start Race!/}).click();await localLetter.locator('.letter-player-one').waitFor({timeout:5000});await localLetter.locator('.letter-player-one').evaluate(b=>{b.click();b.click();});await localLetter.getByText('Partner Wins!').waitFor();assert.equal(await points(localLetter),10,'same-device tap race declares a single winner');
 const host=await open('letter','host');await host.getByRole('button',{name:/Start Race!/}).click();await host.locator('input').waitFor({timeout:5000});const started=await host.evaluate(()=>window.sent.find(m=>m.type==='LETTER_START').payload);
 await host.evaluate(start=>{window.receive({type:'LETTER_WORD_SUBMIT',payload:{word:start.letter+'AT',roundId:'stale'}});},started);assert.equal(await host.locator('input').count(),1,'old round submissions ignored');
 await host.evaluate(start=>{window.receive({type:'LETTER_WORD_SUBMIT',payload:{word:start.letter+'AT',roundId:start.roundId}});window.receive({type:'LETTER_WORD_SUBMIT',payload:{word:start.letter+'AT',roundId:start.roundId}});},started);
 await host.getByText('Robin Wins!').waitFor();assert.equal(await host.evaluate(()=>window.sent.filter(m=>m.type==='LETTER_RESULT').length),1,'one host decision for duplicate submissions');assert.equal(await points(host),10);
 assert.deepEqual(errors,[]);console.log('GAME MODES: solo number, duplicate rewards, complete/perfect quiz, stale decks, online quiz turns, private shared-device match, solo Letter validation, host Letter adjudication passed.');
}finally{for(const c of contexts)await c.close();await browser.close();}
