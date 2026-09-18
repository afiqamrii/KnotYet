import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
let activePage;
// Import the exact Vite URL used by the application, including any HMR timestamp.
const playSource = await (await fetch(`${baseUrl}/src/screens/PlayScreen.tsx`)).text();
const soundModuleUrl = playSource.match(/import \{ sounds \} from "([^"]+)"/)[1];
await mkdir('artifacts', { recursive: true });
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => ({
    viewport: innerWidth, width: document.documentElement.scrollWidth,
    fonts: [...document.querySelectorAll('.question-text')].map(el => getComputedStyle(el).fontFamily),
    emojiImages: document.querySelectorAll('img.emoji, img[src*="pass-phone"]').length,
  }));
  assert.ok(layout.width <= layout.viewport + 1, `${name}: no horizontal overflow`);
  if (name.endsWith('-wheel-prompt') || name.endsWith('-quiz-result')) {
    const overlay = await page.locator(name.endsWith('-wheel-prompt') ? '.modal-overlay' : '.result-panel').evaluate((el, isWheel) => { const rect = (isWheel ? el : el.parentElement).getBoundingClientRect(); return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight }; }, name.endsWith('-wheel-prompt'));
    assert.ok(Math.abs(overlay.top) < 1 && Math.abs(overlay.left) < 1 && Math.abs(overlay.width - overlay.vw) < 1 && Math.abs(overlay.height - overlay.vh) < 1, `${name}: overlay covers the viewport`);
  }
  assert.equal(layout.emojiImages, 0, `${name}: no decorative emoji or stock handover artwork`);
  if (await page.locator('.giphy-reaction img').count()) {
    await page.waitForFunction(() => [...document.querySelectorAll('.giphy-reaction img')].every(img => img.complete && img.naturalWidth > 0));
    assert.ok(await page.locator('.giphy-reaction a[href*="giphy.com"]').count(), `${name}: linked GIPHY attribution`);
  }
  for (const font of layout.fonts) assert.match(font, /Outfit/, `${name}: question typography`);
  await page.screenshot({ path: `artifacts/cards-${name}.png`, fullPage: true });
}
async function end(page) {
  await page.getByRole('button', { name: 'End Game', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, End Game', exact: true }).click();
  await page.getByRole('navigation', { name: 'Choose your game' }).waitFor();
}
async function start(page, name) {
  await page.getByRole('navigation', { name: 'Choose your game' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.locator('.game-primary-action').click();
  await page.locator('.game-toolbar').waitFor();
}
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      window.audioCheck = { sources: 0, gains: [] };
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        createOscillator() { window.audioCheck.sources++; return super.createOscillator(); }
        createBufferSource() { window.audioCheck.sources++; return super.createBufferSource(); }
        createGain() { const node = super.createGain(); window.audioCheck.gains.push(node); return node; }
      };
    });
    const page = await context.newPage();
    activePage = page;
    page.on('pageerror', error => errors.push(error.message));
    page.on('load', () => console.log(`${width}px: document loaded ${page.url()}`));
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Start playing', exact: true }).first().click();
    await page.locator('#intro-swipe').waitFor();
    await page.evaluate(url => { window.soundModuleUrl = url; }, soundModuleUrl);
    if (width === 390) {
      await page.getByRole('button', { name: 'Sound settings' }).click();
      const slider = page.getByRole('slider', { name: /Tap & game sounds/ });
      await slider.fill('20');
      await slider.press('ArrowRight');
      assert.equal(await slider.inputValue(), '25');
      await page.waitForTimeout(100);
      const audible = await page.evaluate(async () => { const { sounds } = await import(window.soundModuleUrl); sounds.playSuccess(); return window.audioCheck.sources; });
      assert.ok(audible > 0, 'Sound effects create real Web Audio sources');
      await page.getByRole('button', { name: 'Mute all sound', exact: true }).click();
      await page.waitForTimeout(150);
      const muted = await page.evaluate(async () => {
        const { sounds } = await import(window.soundModuleUrl);
        const before = window.audioCheck.sources;
        for (const method of ['playFlip','playSwipe','playTick','playSuccess','playMismatch','playChatPop','playChatSent']) sounds[method]();
        return { before, after: window.audioCheck.sources, master: window.audioCheck.gains[0].gain.value, stored: JSON.parse(localStorage.getItem('knotyet_sound_preferences')) };
      });
      assert.equal(muted.before, muted.after, 'All seven sound triggers respect mute');
      assert.ok(muted.master < .001, 'Mute silences the existing audio graph');
      assert.deepEqual(muted.stored, { muted: true, volume: .25 });
      await capture(page, `${width}-sound-settings`);
      await page.reload();
      await page.evaluate(url => { window.soundModuleUrl = url; }, soundModuleUrl);
      await page.getByRole('button', { name: 'Sound settings' }).click();
      await page.getByRole('button', { name: 'Unmute all sound' }).waitFor();
      assert.equal(await slider.inputValue(), '25', 'Preferences survive reload');
      await page.getByRole('button', { name: 'Unmute all sound' }).click();
      await slider.fill('0');
      const silent = await page.evaluate(async () => { const { sounds } = await import(window.soundModuleUrl); const before = window.audioCheck.sources; sounds.playFlip(); sounds.playSuccess(); return window.audioCheck.sources === before; });
      assert.equal(silent, true, 'Zero effect volume prevents effects');
      await slider.fill('35');
      await page.getByRole('button', { name: 'Sound settings' }).click();
      console.log('Sound: real audio sources, every effect respects mute, master silence, keyboard volume, zero volume, reload persistence passed.');
    }
    await start(page, 'Icebreaker Cards');
    const riddles = page.getByRole('button', { name: 'Riddles', exact: true });
    await riddles.click();
    assert.equal(await riddles.getAttribute('aria-pressed'), 'true', 'Riddles is selected');
    await capture(page, `${width}-swipe-front`);
    assert.equal(await riddles.getAttribute('aria-pressed'), 'true', 'Riddles stays selected after layout settles');
    const reachable = await page.locator('.conversation-face[aria-hidden="false"] .conversation-question').last().evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.firstElementChild.getBoundingClientRect().top >= box.top - 1;
    });
    assert.ok(reachable, 'Question label is reachable without scrolling upward beyond zero');
    await page.locator('.game-action-flip').click();
    await page.waitForTimeout(500);
    await capture(page, `${width}-swipe-back`);
    await end(page);
    await start(page, 'Guess My Heart');
    await capture(page, `${width}-quiz`);
    await page.locator('.option-btn').first().click();
    await capture(page, `${width}-handover`);
    await page.getByRole('button', { name: "I'm Ready to Guess!" }).click();
    await page.locator('.option-btn').first().click();
    await page.getByRole('button', { name: /Next Question/ }).waitFor();
    await capture(page, `${width}-quiz-result`);
    await page.getByRole('button', { name: /Next Question/ }).click();
    await end(page);
    await start(page, 'Spin Wheel');
    await capture(page, `${width}-wheel`);
    await page.getByRole('button', { name: 'SPIN!', exact: true }).click();
    await page.locator('.wheel-prompt').waitFor({ timeout: 8000 });
    await capture(page, `${width}-wheel-prompt`);
    await page.getByRole('button', { name: 'Close wheel prompt' }).click();
    await end(page);
    await start(page, 'Number Guesser');
    await page.getByRole('button', { name: 'Start Game!', exact: true }).click();
    await capture(page, `${width}-number`);
    const secret = await page.evaluate(() => sessionStorage.getItem('num_secret'));
    await page.getByPlaceholder('?').fill(secret);
    await page.getByRole('button', { name: 'Submit Guess!' }).click();
    await page.getByRole('heading', { name: /Guessed It!/ }).waitFor();
    await capture(page, `${width}-number-winner`);
    await end(page);
    await start(page, 'Letter Race');
    await page.getByRole('button', { name: /Start Race/ }).click();
    await page.getByRole('button', { name: /TAP IF YOU GOT IT!/i }).first().waitFor({ timeout: 6000 });
    await capture(page, `${width}-letter`);
    await page.getByRole('button', { name: /TAP IF YOU GOT IT!/i }).first().click();
    await page.getByRole('heading', { name: /Wins!/ }).waitFor();
    await capture(page, `${width}-letter-winner`);
    console.log(`${width}px: every public game card, Outfit questions, reveals, GIPHY results, reduced-motion stills and horizontal layout passed.`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No browser exceptions');
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: 'artifacts/card-sound-failure.png', fullPage: true });
    console.error(await activePage.locator('body').innerText());
  }
  console.error('Browser errors:', errors);
  throw error;
} finally { await browser.close(); }
