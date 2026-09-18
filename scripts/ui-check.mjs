import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5174';
const executablePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = process.env.UI_ARTIFACT_DIR ?? 'artifacts';
const browserErrors = [];
const results = [];
const browser = await chromium.launch({ executablePath, headless: true });
await mkdir(artifactDir, { recursive: true });

const viewports = [
  { width: 320, height: 740, name: 'small-phone' },
  { width: 390, height: 844, name: 'phone' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 844, height: 390, name: 'landscape' },
  { width: 1440, height: 1000, name: 'desktop' },
];

const modes = [
  { id: 'swipe', name: 'Icebreaker Cards' },
  { id: 'quiz', name: 'Guess My Heart' },
  { id: 'wheel', name: 'Spin Wheel' },
  { id: 'number', name: 'Number Guesser' },
  { id: 'letter', name: 'Letter Race' },
];

async function checkLayout(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    contentLength: document.body.innerText.trim().length,
    errorOverlay: Boolean(document.querySelector('vite-error-overlay, #webpack-dev-server-client-overlay')),
    clippedControls: [...document.querySelectorAll('.game-mode-tab, .game-primary-action, .game-action')].filter(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && (bounds.left < -1 || bounds.right > innerWidth + 1);
    }).map(element => element.getAttribute('aria-label') || element.textContent.trim()),
  }));
  assert.ok(metrics.contentLength > 100, `${label}: meaningful content should render`);
  assert.deepEqual(metrics.clippedControls, [], `${label}: game controls remain inside the viewport`);
  assert.equal(metrics.errorOverlay, false, `${label}: no framework error overlay`);
  assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1, `${label}: horizontal overflow ${metrics.documentWidth}px > ${metrics.viewportWidth}px`);
}

async function selectMode(page, mode, keyboard = false) {
  const tab = page.getByRole('navigation', { name: 'Choose your game' }).getByRole('button', { name: new RegExp(`^${mode.name}`) });
  if (keyboard) {
    await tab.focus();
    await tab.press('Enter');
  } else {
    await tab.click();
  }
  await page.locator(`#intro-${mode.id}`).waitFor();
  assert.equal(await tab.getAttribute('aria-current'), 'page', `${mode.name}: selected mode is exposed accessibly`);
  await checkLayout(page, `${mode.name} intro`);
}

async function startMode(page, mode) {
  if (await page.locator('.game-toolbar').isVisible()) {
    await page.getByRole('button', { name: 'End Game', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, End Game', exact: true }).click();
    await page.getByRole('navigation', { name: 'Choose your game' }).waitFor();
  }
  await selectMode(page, mode);
  await page.locator('.game-primary-action').click();
  await page.locator('.game-toolbar').waitFor({ timeout: 10_000 });
  await checkLayout(page, `${mode.name} active`);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 768,
      hasTouch: viewport.width < 1024,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push(`${viewport.name}: ${error.message}`));
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, `${viewport.name}: landing HTTP 200`);
    await page.locator('#hero-title').waitFor();
    assert.match(await page.locator('#hero-title').innerText(), /Your next\s+date night/i);
    await checkLayout(page, `${viewport.name} landing`);

    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${artifactDir}/ui-after-${viewport.name}-landing-initial.png`, fullPage: true });
    const filters = page.getByRole('group', { name: 'Filter games by mood' });
    for (const [label, count] of [['Get closer', 2], ['Just for laughs', 3], ['All games', 5]]) {
      await filters.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      assert.equal(await page.locator('.date-game-tile').count(), count, `${label}: expected visible game count`);
    }
    const preview = page.getByRole('button', { name: 'Another question' });
    const beforePreview = await page.locator('body').innerText();
    await preview.press('Enter');
    await page.waitForFunction(before => document.body.innerText !== before, beforePreview);
    assert.notEqual(await page.locator('body').innerText(), beforePreview, 'Preview question responds to keyboard activation');
    await page.screenshot({ path: `${artifactDir}/ui-after-${viewport.name}-landing.png`, fullPage: true });

    await page.getByRole('button', { name: 'Start playing', exact: true }).first().click();
    await page.waitForURL('**/play');
    await page.locator('#intro-swipe').waitFor();
    await checkLayout(page, `${viewport.name} game room`);

    const roomTrigger = page.getByRole('button', { name: 'Play Together', exact: true });
    await roomTrigger.click();
    const roomDialog = page.getByRole('dialog', { name: 'Play Together (Online)' });
    await roomDialog.waitFor();
    await roomDialog.getByRole('button', { name: 'Join Room', exact: true }).click();
    const roomInput = roomDialog.locator('#partner-room-code');
    await roomInput.fill('12a3');
    assert.equal(await roomInput.inputValue(), '123', 'Room code removes nonnumeric characters');
    await roomInput.fill('1234');
    assert.equal(await roomInput.inputValue(), '1234', 'Room code accepts four numeric digits');
    assert.equal(await roomInput.getAttribute('inputmode'), 'numeric', 'Room code requests a mobile numeric keyboard');
    await roomInput.focus();
    await page.waitForTimeout(1300);
    assert.equal(await roomInput.evaluate(element => element === document.activeElement), true, 'Room code retains focus across session clock updates');
    await checkLayout(page, `${viewport.name} room dialog`);
    await page.screenshot({ path: `${artifactDir}/ui-after-${viewport.name}-room.png`, fullPage: true });
    await roomDialog.getByRole('button', { name: 'Close room dialog' }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await roomDialog.evaluate(dialog => dialog.contains(document.activeElement)), true, 'Room dialog traps keyboard focus');
    await page.keyboard.press('Escape');
    await roomDialog.waitFor({ state: 'hidden' });
    assert.equal(await roomTrigger.evaluate(element => element === document.activeElement), true, 'Closing room dialog restores focus');
    for (const mode of modes) await selectMode(page, mode, viewport.width === 1440);
    const match = page.getByRole('navigation', { name: 'Choose your game' }).getByRole('button', { name: /^Couple Match/ });
    if (await match.count()) await selectMode(page, { id: 'match', name: 'Couple Match' });
    await selectMode(page, modes[0]);
    await page.screenshot({ path: `${artifactDir}/ui-after-${viewport.name}-play.png`, fullPage: true });
    await startMode(page, modes[0]);
    await page.locator('.swipe-card').first().waitFor();
    await page.locator('.game-action-next').click();
    // Let the existing Framer Motion card spring settle before capturing its pixels.
    await page.waitForTimeout(500);
    await checkLayout(page, `${viewport.name} card play`);
    await page.screenshot({ path: `${artifactDir}/ui-after-${viewport.name}-cards.png`, fullPage: true });

    if (viewport.width === 390) {
      await startMode(page, modes[1]);
      await page.locator('.option-btn').first().click();
      await page.getByRole('button', { name: "I'm Ready to Guess!" }).click();
      await page.locator('.option-btn').first().click();
      await page.getByRole('button', { name: /Next Question/ }).waitFor();
      await checkLayout(page, 'Guess My Heart result');
      await page.getByRole('button', { name: /Next Question/ }).click();

      await startMode(page, modes[2]);
      await page.getByRole('button', { name: 'SPIN!', exact: true }).click();
      await page.locator('.modal-overlay').waitFor({ timeout: 8_000 });
      await checkLayout(page, 'Wheel result');
      await page.keyboard.press('Escape');

      await startMode(page, modes[3]);
      await page.getByPlaceholder('Player 1 Name').fill('You');
      await page.getByPlaceholder('Player 2 Name').fill('Your partner');
      await page.getByRole('button', { name: 'Start Game!', exact: true }).click();
      await page.getByPlaceholder('?').fill('50');
      await page.getByRole('button', { name: 'Submit Guess!', exact: true }).click();
      await page.waitForFunction(() => /HIGHER!|LOWER!|Guessed It!/.test(document.body.innerText));
      await checkLayout(page, 'Number guess feedback');

      await startMode(page, modes[4]);
      await page.getByRole('button', { name: /Start Race/ }).click();
      await page.getByRole('button', { name: /TAP IF YOU GOT IT!/i }).first().waitFor({ timeout: 6_000 });
      await page.getByRole('button', { name: /TAP IF YOU GOT IT!/i }).first().click();
      await page.getByRole('heading', { name: /Wins!/ }).waitFor();
      await checkLayout(page, 'Letter Race winner');
    }

    results.push(`${viewport.width}px: landing, preview, all game intros, guest entry, card play`);
    console.log(results.at(-1));
    await context.close();
  }

  for (const mode of modes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push(`direct ${mode.id}: ${error.message}`));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: `Play ${mode.name}`, exact: true }).click();
    await page.waitForURL('**/play');
    await page.locator(`#intro-${mode.id}`).waitFor();
    await context.close();
  }
  const joinContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const joinPage = await joinContext.newPage();
  joinPage.on('pageerror', error => browserErrors.push(`join partner: ${error.message}`));
  await joinPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await joinPage.getByRole('button', { name: 'Join your partner', exact: true }).click();
  await joinPage.waitForURL('**/play');
  await joinPage.getByRole('dialog', { name: 'Play Together (Online)' }).waitFor();
  await joinContext.close();
  console.log('Landing filters, all five direct game tiles, and Join your partner flow passed.');
  assert.deepEqual(browserErrors, [], `Browser errors: ${browserErrors.join('; ')}`);
  console.log(`UI checks passed:\n${results.join('\n')}\nPhone gameplay: quiz handover/reveal, wheel result, number feedback, letter-race winner.\nScreenshots: ${artifactDir}`);
} finally {
  await browser.close();
}










