import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const errors = [];
await mkdir('artifacts/public-deck', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/try`);
  const player = page.getByRole('article', { name: 'Current conversation card' });
  await player.waitFor();
  const first = await player.locator('h3').innerText();
  assert.equal(await page.getByRole('button', { name: 'Previous', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Reveal a follow-up' }).click();
  assert.equal(await page.getByRole('button', { name: 'Hide follow-up' }).getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('Hide follow-up')), true, 'revealing follow-up retains focus');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  assert.match(await player.locator('.public-deck-turn').innerText(), /PLAYER 2 ASKS/);
  const second = await player.locator('h3').innerText();
  assert.notEqual(second, first);
  await page.reload();
  await player.waitFor();
  assert.equal(await player.locator('h3').innerText(), second, 'refresh keeps current card');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  assert.equal(await player.locator('h3').innerText(), first);
  assert.equal(await page.getByRole('button', { name: 'Card saved', exact: true }).getAttribute('aria-pressed'), 'true');
  // Re-selecting the current theme must not silently restart the conversation.
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  await page.getByRole('group', { name: 'Conversation themes' }).getByRole('button', { name: /The little things/ }).click();
  assert.equal(await player.locator('h3').innerText(), second);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next question', exact: true }).click();
  await page.getByRole('button', { name: 'Finish deck' }).click();
  await player.getByRole('heading', { name: 'That’s this deck.' }).waitFor();
  assert.equal(await player.evaluate(el => el === document.activeElement), true, 'completion retains focus in player');
  await page.reload();
  await player.getByRole('heading', { name: 'That’s this deck.' }).waitFor();
  await page.getByRole('button', { name: 'Try under the surface' }).click();
  assert.equal(await player.evaluate(el => el === document.activeElement), true, 'starting next theme retains focus in player');
  assert.match(await player.locator('.public-deck-card-top').innerText(), /Under the surface/);
  await page.getByRole('button', { name: /^Saved cards/ }).click();
  assert.equal(await page.locator('.public-deck-library-grid li').count(), 1);
  await page.locator('.public-deck-library-grid li button').click();
  assert.equal(await player.locator('h3').innerText(), first);
  assert.equal(await player.evaluate(el => el === document.activeElement), true, 'library selection transfers keyboard focus to player');
  await page.getByRole('button', { name: 'Card saved', exact: true }).click();
  await page.getByRole('heading', { name: 'Keep a good question close.' }).waitFor();
  await page.getByRole('button', { name: 'Explore all cards' }).click();
  assert.equal(await page.locator('#public-deck-library-title').evaluate(el => el === document.activeElement), true, 'empty saved collection returns focus to its heading');
  assert.equal(await page.locator('.public-deck-library-grid li').count(), 18);
  for (const [width, height] of [[320,740], [390,844], [768,1024], [1440,1000]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
      clipped: [...document.querySelectorAll('#play-card button, .public-deck-themes button')].filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1; }).map(el => el.textContent),
    }));
    assert.ok(layout.content <= layout.width + 1, `No overflow at ${width}`);
    assert.deepEqual(layout.clipped, [], `Controls fit at ${width}`);
    await page.screenshot({ path: `artifacts/public-deck/after-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { sessionStorage.setItem('knotyet_public_deck_v1', '{"deckId":"little-things","cardIndex":99}'); localStorage.setItem('knotyet_saved_cards_v1', '["bad-key",null,"little-things:0","little-things:0"]'); });
  await page.reload();
  await player.waitFor();
  assert.equal(await player.locator('h3').innerText(), first, 'corrupt position resets safely');
  await page.getByRole('button', { name: /^Saved cards/ }).click();
  assert.equal(await page.locator('.public-deck-library-grid li').count(), 1, 'saved keys validated and deduplicated');
  // Private/restricted storage must not stop an otherwise local activity.
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (/knotyet_(public_deck|saved_cards)/.test(key)) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (/knotyet_(public_deck|saved_cards)/.test(key)) throw new DOMException('Blocked', 'SecurityError'); return set.call(this, key, value); };
  });
  await page.reload();
  await page.getByText('Browser storage is unavailable.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  assert.equal(await player.locator('h3').innerText(), second);
  assert.deepEqual(errors, []);
  console.log('Public deck passed: save/remove, refresh recovery, previous/turns, completion, theme selection, keyboard focus, corrupt/restricted storage, and 320/390/768/1440 layouts.');
} finally { await browser.close(); }
