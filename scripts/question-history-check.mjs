import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const html = `<!doctype html><html><body><script type="module">import * as questions from '/src/utils/questionManager.ts';window.questionHistory=questions;document.body.textContent='ready';</script></body></html>`;

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
    const wheelSeen = [];
    let wheelSelection = api.getRandomUnseenWheelSelection();
    while (wheelSelection) {
      wheelSeen.push(wheelSelection.questionId);
      api.markQuestionAsSeen(wheelSelection.questionId);
      wheelSelection = api.getRandomUnseenWheelSelection();
    }
    return { skippedMidway, nextGuess, allGuessIds, exhaustedGuess, excludedSwipe, guessStored, wheelSeen, exhaustedWheel: wheelSelection, stored: JSON.parse(localStorage.getItem('knotyet_seen_questions')) };
  });
  assert.equal(result.nextGuess.some(id => result.skippedMidway.includes(id)), false, 'questions seen before abandoning a deck never return');
  assert.deepEqual(result.exhaustedGuess, [], 'an exhausted pool stays exhausted instead of recycling prompts');
  assert.deepEqual(result.guessStored, result.allGuessIds, 'guess exhaustion does not erase history');
  assert.equal(result.excludedSwipe.includes('tt-1') || result.excludedSwipe.includes('vc-1'), false, 'cloud-history IDs are excluded from swipe decks');
  assert.equal(result.wheelSeen.length, 18, 'every wheel prompt is selected exactly once');
  assert.equal(new Set(result.wheelSeen).size, result.wheelSeen.length, 'wheel prompts never repeat');
  assert.equal(result.exhaustedWheel, null, 'the wheel stays exhausted instead of recycling prompts');
  assert.deepEqual(result.stored, result.wheelSeen, 'wheel history stays stored after exhaustion');
  console.log('Question history: persisted, cloud exclusions, and no automatic recycling passed');
  await context.close();
} finally { await browser.close(); }
