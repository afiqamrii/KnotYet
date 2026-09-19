import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const html = `<!doctype html><html><body><script type="module">import * as questions from '/src/utils/questionManager.ts';import { WHEEL_SEGMENTS, SWIPE_CARDS, MATCH_QUESTIONS } from '/src/data/questions.ts';window.questionHistory=questions;window.questionData={ WHEEL_SEGMENTS, SWIPE_CARDS, MATCH_QUESTIONS };document.body.textContent='ready';</script></body></html>`;

try {
  const context = await browser.newContext();
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/question-history-fixture') return route.fulfill({ contentType: 'text/html', body: html });
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(`${base}/question-history-fixture`);
  await page.waitForFunction(() => Boolean(window.questionHistory));
  const result = await page.evaluate(() => {
    const api = window.questionHistory;
    const fullMatchPool = api.getShuffledMatchQuestions(1000).map(item => item.id);
    const firstMatchDeck = api.getShuffledMatchQuestions(10);
    for (let i = 0; i < 25; i++) api.markQuestionAsSeen(`m-${i}`);
    const remainingMatchPool = api.getShuffledMatchQuestions(1000).map(item => item.id);
    api.markQuestionAsSeen('gq-0');
    const afterSpotlightSeen = api.getShuffledMatchQuestions(1000).map(item => item.id);
    localStorage.clear();
    const initialGuess = api.getShuffledGuessQuestions(10).map(item => item.id);
    const skippedMidway = initialGuess.slice(0, 4);
    localStorage.setItem('knotyet_seen_questions', JSON.stringify(skippedMidway));
    const nextGuess = api.getShuffledGuessQuestions(10).map(item => item.id);
    const remainingGuess = api.getShuffledGuessQuestions(10_000).map(item => item.id);
    const allGuessIds = [...new Set([...skippedMidway, ...nextGuess, ...remainingGuess])];
    localStorage.setItem('knotyet_seen_questions', JSON.stringify(allGuessIds));
    const exhaustedGuess = api.getShuffledGuessQuestions(10).map(item => item.id);
    const excludedSwipe = api.getShuffledSwipeCards('all', 10, ['tt-1', 'vc-1']).map(item => item.id);
    const guessStored = JSON.parse(localStorage.getItem('knotyet_seen_questions'));
    localStorage.clear();
    const sharedIds = ['vc-0', 'sm-0-0'];
    sharedIds.forEach(id => api.markQuestionAsSeen(id));
    const wheelIds = window.questionData.WHEEL_SEGMENTS.flatMap(segment => segment.promptIds);
    const swipeIds = new Set(window.questionData.SWIPE_CARDS.map(card => card.id));
    const wheelSeen = [];
    let wheelSelection = api.getRandomUnseenWheelSelection();
    while (wheelSelection) {
      wheelSeen.push(wheelSelection.questionId);
      api.markQuestionAsSeen(wheelSelection.questionId);
      wheelSelection = api.getRandomUnseenWheelSelection();
    }
    const stored = JSON.parse(localStorage.getItem('knotyet_seen_questions'));
    localStorage.clear();
    const reservedSelection = api.getRandomUnseenWheelSelection(wheelIds.filter(id => id !== 'vc-2'));
    api.markQuestionAsSeen('vc-1');
    const swipeAfterWheel = api.getShuffledSwipeCards('all', 10_000).map(card => card.id);
    return { fullMatchPool, firstMatchDeck, remainingMatchPool, afterSpotlightSeen, matchQuestions: window.questionData.MATCH_QUESTIONS, skippedMidway, nextGuess, allGuessIds, exhaustedGuess, excludedSwipe, guessStored, wheelSeen, wheelIds, sharedIds, sharedCount: wheelIds.filter(id => swipeIds.has(id)).length, exhaustedWheel: wheelSelection, stored, swipeAfterWheel, reservedSelection };
  });
  assert.equal(result.fullMatchPool.length, 130, 'Couple Match loads 50 compatibility and 80 spotlight questions');
  assert.equal(new Set(result.fullMatchPool).size, 130, 'Couple Match question IDs are unique');
  assert.equal(result.firstMatchDeck.filter(question => question.kind === 'compatibility').length, 5, 'each full deck mixes five compatibility rounds');
  assert.equal(result.firstMatchDeck.filter(question => question.kind === 'spotlight').length, 5, 'each full deck mixes five spotlight rounds');
  assert.equal(result.fullMatchPool.filter(id => id.startsWith('m-')).length, 50, 'both compatibility sets are available');
  assert.equal(result.fullMatchPool.filter(id => id.startsWith('gq-')).length, 80, 'all four-choice Guess My Heart prompts are available as spotlight rounds');
  assert.equal(result.remainingMatchPool.length, 105, 'the rest of the pool remains after the first 25 compatibility questions are seen');
  assert.equal(result.remainingMatchPool.some(id => id.startsWith('m-') && Number(id.slice(2)) < 25), false, 'seen Couple Match questions do not repeat');
  assert.equal(result.afterSpotlightSeen.length, 104, 'spotlight history is shared with Guess My Heart');
  assert.equal(result.afterSpotlightSeen.includes('gq-0'), false, 'a seen spotlight question is excluded from Couple Match');
  assert.equal(result.matchQuestions.every(question => question.options.length === 4), true, 'every Couple Match prompt has four choices');
  assert.equal(result.matchQuestions.filter(question => question.kind === 'spotlight' && question.targetPlayer === 'host').length, 40, 'spotlight rounds alternate the person being guessed');
  assert.equal(result.matchQuestions.filter(question => question.kind === 'spotlight' && question.targetPlayer === 'partner').length, 40, 'both players get an equal share of spotlight rounds');
  assert.equal(result.nextGuess.some(id => result.skippedMidway.includes(id)), false, 'questions seen before abandoning a deck never return');
  assert.deepEqual(result.exhaustedGuess, [], 'an exhausted pool stays exhausted instead of recycling prompts');
  assert.deepEqual(result.guessStored, result.allGuessIds, 'guess exhaustion does not erase history');
  assert.equal(result.excludedSwipe.includes('tt-1') || result.excludedSwipe.includes('vc-1'), false, 'cloud-history IDs are excluded from swipe decks');
  assert.equal(result.wheelIds.length, 257, 'the wheel includes the existing prompts plus all vibe and mature conversation questions');
  assert.equal(result.sharedCount, 239, 'imported wheel questions share their Icebreaker history IDs');
  assert.equal(result.wheelSeen.length, result.wheelIds.length - result.sharedIds.length, 'every unseen wheel prompt is selected exactly once');
  assert.equal(result.wheelSeen.some(id => result.sharedIds.includes(id)), false, 'questions seen in Icebreaker do not repeat on the wheel');
  assert.equal(result.swipeAfterWheel.includes('vc-1'), false, 'questions seen on the wheel do not repeat in a newly selected Icebreaker deck');
  assert.equal(result.reservedSelection.questionId, 'vc-2', 'wheel selection excludes questions already queued in another game');
  assert.equal(new Set(result.wheelSeen).size, result.wheelSeen.length, 'wheel prompts never repeat');
  assert.equal(result.exhaustedWheel, null, 'the wheel stays exhausted instead of recycling prompts');
  assert.deepEqual(result.stored, [...result.sharedIds, ...result.wheelSeen], 'wheel history stays stored after exhaustion');
  console.log('Question history: persisted, cloud exclusions, and no automatic recycling passed');
  await context.close();
} finally { await browser.close(); }
