import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5174';
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/index.css');
  localStorage.setItem('jodohdeck_profile', JSON.stringify({ name: 'Player', avatarId: 'sunny', heartPoints: 0 }));
  const questions = await import('/src/utils/questionManager.ts');
  window.questionManager = questions;
  const React = (await import('/@id/react')).default;
  const ReactDOMClient = (await import('/@id/react-dom/client')).default;
  const { AuthProvider } = await import('/src/store/AuthContext.tsx');
  const { GameProvider } = await import('/src/store/GameContext.tsx');
  const { MultiplayerProvider } = await import('/src/store/MultiplayerContext.tsx');
  const { SpinWheel } = await import('/src/components/SpinWheel.tsx');
  ReactDOMClient.createRoot(document.getElementById('root')).render(
    React.createElement(AuthProvider, null,
      React.createElement(GameProvider, null,
        React.createElement(MultiplayerProvider, null,
          React.createElement('div', { className: 'arcade-play', 'data-game': 'wheel', style: { padding: 16 } },
            React.createElement(SpinWheel)
          )
        )
      )
    )
  );
</script></body></html>`;

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/gameplay-regression-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/gameplay-regression-fixture`);
  await page.getByRole('heading', { name: 'Anti-Awkward Wheel' }).waitFor({ timeout: 10_000 }).catch(async () => {
    throw new Error(`Wheel fixture did not render: ${errors.join(' | ') || await page.locator('body').innerText()}`);
  });

  const syncedDeck = await page.evaluate(() => {
    const api = window.questionManager;
    const match = api.getShuffledMatchQuestions(2).map(item => item.id);
    const guess = api.getShuffledGuessQuestions(2).map(item => item.id);
    const swipe = api.getShuffledSwipeCards('all', 2).map(item => item.id);
    localStorage.setItem('knotyet_seen_questions', JSON.stringify([...match, ...guess, ...swipe]));
    return {
      match,
      guess,
      swipe,
      receivedMatch: api.getMatchQuestionsByIds(match).map(item => item.id),
      receivedGuess: api.getGuessQuestionsByIds(guess).map(item => item.id),
      receivedSwipe: api.getSwipeCardsByIds(swipe).map(item => item.id),
    };
  });
  assert.deepEqual(syncedDeck.receivedMatch, syncedDeck.match, 'partner gets every host match question in order');
  assert.deepEqual(syncedDeck.receivedGuess, syncedDeck.guess, 'partner gets every host quiz question in order');
  assert.deepEqual(syncedDeck.receivedSwipe, syncedDeck.swipe, 'partner gets every host icebreaker card in order');
  await page.evaluate(() => localStorage.removeItem('knotyet_seen_questions'));

  await page.getByRole('button', { name: 'SPIN!' }).click();
  const result = page.getByRole('dialog', { name: 'Wheel result' });
  await result.waitFor({ timeout: 7_000 });
  await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
  assert.equal(await result.isVisible(), true, 'tapping outside does not dismiss the wheel result');
  await page.keyboard.press('Escape');
  assert.equal(await result.isVisible(), true, 'Escape does not dismiss the wheel result');
  await result.locator('button.btn-green').click();
  assert.equal(await result.count(), 0, 'the result closes through its action button');
  console.log('Gameplay: host question order and wheel button-only dismissal passed.');
  await context.close();
} finally {
  await browser.close();
}
