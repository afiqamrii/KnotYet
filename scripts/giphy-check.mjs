import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5174';
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const fixture = `<!doctype html><html><body><main id="root"></main><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  const React = (await import('/@id/react')).default;
  const ReactDOMClient = (await import('/@id/react-dom/client')).default;
  const { GiphyReaction } = await import('/src/components/GiphyReaction.tsx');
  ReactDOMClient.createRoot(document.getElementById('root')).render(React.createElement(GiphyReaction, { mood: 'match', seed: 'fun-check' }));
</script></body></html>`;

const openFixture = async (context) => {
  await context.route('**/giphy-reaction-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${baseUrl}/giphy-reaction-fixture`);
  await page.locator('.giphy-reaction').waitFor({ timeout: 8_000 }).catch(() => {
    throw new Error(`Reaction fixture did not render: ${errors.join(' | ') || 'no browser error reported'}`);
  });
  return page;
};

try {
  const liveContext = await browser.newContext({ reducedMotion: 'no-preference' });
  const tinyGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
  await liveContext.route('https://media.giphy.com/**', route => route.fulfill({ status: 200, contentType: 'image/gif', body: tinyGif }));
  const livePage = await openFixture(liveContext);
  const image = livePage.locator('.giphy-reaction img');
  await livePage.waitForFunction(() => {
    const gif = document.querySelector('.giphy-reaction img');
    return gif?.complete && gif.naturalWidth > 0;
  });
  assert.match(await image.getAttribute('src'), /\/giphy\.gif$/, 'animated GIPHY reaction loads automatically');
  assert.ok((await livePage.locator('.giphy-caption').textContent())?.length > 10, 'a playful reaction caption is visible');
  assert.ok((await livePage.locator('.giphy-mood-sticker').textContent())?.length > 0, 'the comic mood sticker is visible');
  await livePage.getByRole('button', { name: 'Pause GIF' }).click();
  await livePage.waitForFunction(() => document.querySelector('.giphy-reaction img')?.getAttribute('src')?.endsWith('/giphy_s.gif'));
  await livePage.getByRole('button', { name: 'Play GIF' }).click();
  await liveContext.close();

  const offlineContext = await browser.newContext();
  await offlineContext.route('https://media.giphy.com/**', route => route.abort());
  const offlinePage = await openFixture(offlineContext);
  await offlinePage.getByText('GIF took a snack break. Local silliness activated.').waitFor();
  assert.equal(await offlinePage.locator('.giphy-reaction img').count(), 0, 'a failed GIF never leaves a broken image');
  assert.equal(await offlinePage.getByRole('button', { name: 'Retry GIF from GIPHY' }).count(), 1, 'offline fallback offers a retry');
  await offlineContext.close();

  console.log('GIPHY: automatic animation, funny caption, pause/play, colorful sticker, and offline retry passed.');
} finally {
  await browser.close();
}
