import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await mkdir('artifacts/upgrade', { recursive: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('#hero-title').waitFor();
  const filters = page.getByRole('group', { name: 'Filter games by mood' });
  assert.equal(await page.locator('.date-game-tile').count(), 9);
  for (const [label, count] of [['Get closer', 3], ['Just for laughs', 5], ['Get creative', 1], ['All games', 9]]) {
    await filters.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    assert.equal(await page.locator('.date-game-tile').count(), count, `${label} count`);
  }
  await page.getByRole('searchbox', { name: 'Find a game' }).fill('not a real game');
  await page.getByRole('heading', { name: 'No games found. Let’s try another mood.' }).waitFor();
  await page.getByRole('button', { name: 'Show all games' }).click();
  assert.equal(await page.getByRole('searchbox', { name: 'Find a game' }).evaluate(el => el === document.activeElement), true, 'empty landing results return focus to search');
  await page.getByRole('searchbox', { name: 'Find a game' }).fill('memory');
  assert.equal(await page.locator('.date-game-tile').count(), 1);
  await page.getByRole('button', { name: 'Play Memory Match for free' }).click();
  await page.waitForURL('**/arcade?game=memory');
  await page.getByRole('button', { name: 'Deal the cards' }).waitFor();
  await page.getByRole('button', { name: 'Deal the cards' }).click();
  await page.getByRole('button', { name: 'Card 1: face down', exact: true }).click();
  const revealed = await page.locator('.memory-card[data-revealed=true]').getAttribute('aria-label');
  await page.reload();
  await page.locator('.memory-card[data-revealed=true]').waitFor();
  assert.equal(await page.locator('.memory-card[data-revealed=true]').getAttribute('aria-label'), revealed, 'real route resumes game after refresh');
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await page.getByRole('dialog', { name: 'Start a fresh board?' }).getByRole('button', { name: 'New board', exact: true }).click();
  assert.equal(await page.locator('.memory-setup h3').evaluate(el => el === document.activeElement), true, 'reset returns keyboard focus to Memory setup');
  await page.getByRole('button', { name: 'Deal the cards' }).click();
  await page.getByRole('button', { name: 'Free arcade', exact: true }).click();
  await page.getByRole('heading', { name: 'Pick your little escape.' }).waitFor();
  assert.equal(await page.title(), 'Free games for a little us time | KnotYet');
  await page.getByRole('button', { name: 'Play Story Builder', exact: true }).click();
  await page.getByRole('heading', { name: 'Story Builder', exact: true }).waitFor();
  assert.ok((await page.url()).includes('game=story'));
  await page.getByRole('button', { name: 'Begin our story' }).click();
  await page.getByRole('button', { name: 'Start a new story', exact: true }).click();
  await page.getByRole('dialog', { name: 'A new beginning?' }).getByRole('button', { name: 'Start a new story', exact: true }).click();
  assert.equal(await page.locator('.story-setup-heading h3').evaluate(el => el === document.activeElement), true, 'reset returns keyboard focus to Story setup');
  await page.goBack();
  await page.getByRole('heading', { name: 'Pick your little escape.' }).waitFor();
  for (const [width, height] of [[320,740], [390,844], [768,1024], [1440,1000]]) {
    await page.setViewportSize({ width, height });
    for (const [route, name, selector] of [['/', 'landing', '#hero-title'], ['/arcade', 'arcade', '#free-arcade-games'], ['/arcade?game=memory', 'memory', '.memory-grid'], ['/arcade?game=story', 'story', '.story-game']]) {
      await page.goto(`${base}${route}`);
      await page.locator(selector).waitFor();
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, error: Boolean(document.querySelector('vite-error-overlay')) }));
      assert.equal(metrics.error, false);
      assert.ok(metrics.page <= metrics.viewport + 1, `${name} no overflow at ${width}: ${metrics.page}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `artifacts/upgrade/${name}-${width}.png`, fullPage: true });
    }
  }
  await page.goto(`${base}/arcade?game=unknown`);
  await page.getByRole('heading', { name: 'Pick your little escape.' }).waitFor();
  await page.goto(`${base}/play`);
  await page.waitForURL(`${base}/`);
  await page.locator('#hero-title').waitFor();
  assert.deepEqual(errors, [], 'public routes have no runtime exceptions');
  console.log('Public experience: 9-game search/mood discovery, free launches, route refresh/back, safe unknown-game fallback, auth gate and 4 responsive widths passed.');
  await context.close();
} finally { await browser.close(); }
