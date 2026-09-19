import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5173';
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/index.css');
  sessionStorage.setItem('num_stage', 'guess');
  sessionStorage.setItem('num_secret', '75');
  sessionStorage.setItem('num_round', '2');
  sessionStorage.setItem('num_p1', 'Afiq');
  sessionStorage.setItem('num_p2', 'Partner');
  localStorage.setItem('jodohdeck_profile', JSON.stringify({ name: 'Afiq', avatarId: 'sunny', heartPoints: 320 }));
  const React = (await import('/@id/react')).default;
  const ReactDOMClient = (await import('/@id/react-dom/client')).default;
  const { AuthProvider } = await import('/src/store/AuthContext.tsx');
  const { GameProvider } = await import('/src/store/GameContext.tsx');
  const { MultiplayerProvider } = await import('/src/store/MultiplayerContext.tsx');
  const { NumberGuesserGame } = await import('/src/components/NumberGuesserGame.tsx');
  const app = React.createElement(AuthProvider, null,
    React.createElement(GameProvider, null,
      React.createElement(MultiplayerProvider, null,
        React.createElement('div', { className: 'arcade-play', 'data-game': 'number', style: { padding: 16, minHeight: '100vh' } },
          React.createElement(NumberGuesserGame)
        )
      )
    )
  );
  ReactDOMClient.createRoot(document.getElementById('root')).render(app);
</script></body></html>`;

const verifyAt = async (viewport) => {
  const context = await browser.newContext({ viewport });
  await context.route('**/number-guesser-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await context.route('https://media.giphy.com/**', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${baseUrl}/number-guesser-fixture`);
  await page.getByRole('heading', { name: 'Afiq, take your shot!' }).waitFor({ timeout: 10_000 }).catch(async () => {
    throw new Error(`Number Guesser fixture did not render: ${errors.join(' | ') || await page.locator('body').innerText()}`);
  });

  const input = page.getByLabel('Your guess');
  await page.getByRole('button', { name: 'Increase guess' }).click();
  assert.equal(await input.inputValue(), '1', 'the first stepper tap starts at the lower bound without suggesting a midpoint');
  await input.fill('50');
  await page.getByRole('button', { name: 'Lock in 50' }).click();
  await page.locator('.number-latest-clue strong').filter({ hasText: 'Go higher!' }).waitFor();
  assert.equal(await page.getByLabel('Your guess').count(), 1, 'feedback never blocks the next turn controls');
  assert.equal(await page.locator('.number-range-values span').first().textContent(), 'LOW51', 'the possible range narrows after a guess');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'layout does not overflow the viewport');

  const stepperSize = await page.getByRole('button', { name: 'Decrease guess' }).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert.ok(stepperSize.width >= 44 && stepperSize.height >= 44, 'stepper controls remain touch friendly');
  await context.close();
};

try {
  await verifyAt({ width: 390, height: 844 });
  await verifyAt({ width: 900, height: 700 });
  console.log('NUMBER GUESSER: range, feedback, responsive layout, and touch controls passed.');
} finally {
  await browser.close();
}
