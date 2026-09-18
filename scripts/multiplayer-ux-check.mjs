import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

await mkdir('artifacts', { recursive: true });
const base = 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const preamble = `<script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
const waitingHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>${preamble}</head><body><div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import { MultiplayerWaitingRoom } from '/src/components/MultiplayerWaitingRoom.tsx';import '/src/index.css';window.cancelled=0;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MultiplayerWaitingRoom,{status:new URL(location.href).searchParams.get('state')==='joining'?'joining':'hosting',roomCode:'KNOT42',profile:{name:'Afiq',avatarId:'sunny',heartPoints:320},onCancel:()=>window.cancelled++}));</script></body></html>`;
const adHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>${preamble}</head><body><div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import { AdModal } from '/src/components/AdModal.tsx';import '/src/index.css';window.rewarded=0;window.adClosed=0;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AdModal,{title:'You used today’s free plays',description:'Watch one short sponsor break to keep your date-night arcade going.',rewardText:'1 Multiplayer Session',onClose:()=>window.adClosed++,onRewardEarned:()=>window.rewarded++}));</script></body></html>`;
const audioHtml = `<!doctype html><html><body><script type="module">import { sounds } from '/src/utils/audio.ts';window.testSounds=sounds;document.body.textContent='ready';</script></body></html>`;

async function assertFits(page, selector, label) {
  const metrics = await page.locator(selector).evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), pageWidth: innerWidth, pageHeight: innerHeight, documentWidth: document.documentElement.scrollWidth }));
  assert.ok(metrics.rect.left >= -1 && metrics.rect.right <= metrics.pageWidth + 1, `${label} horizontal fit: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.documentWidth <= metrics.pageWidth + 1, `${label} page overflow`);
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1536, height: 800 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedRoom = data; } }); });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/waiting-fixture') return route.fulfill({ contentType: 'text/html', body: waitingHtml });
      if (url.pathname === '/ad-fixture') return route.fulfill({ contentType: 'text/html', body: adHtml });
      if (url.hostname !== 'localhost') return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(`${viewport.width}: ${error.message}`); console.error(`${viewport.width} page error:`, error.message); });

    await page.goto(`${base}/waiting-fixture`);
    await page.getByRole('heading', { name: /Your person is/ }).waitFor();
    await assertFits(page, '.waiting-console', `${viewport.width} waiting host`);
    await page.getByRole('button', { name: 'Copy code' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'KNOT42');
    await page.getByRole('button', { name: 'Share invite' }).click();
    assert.match(await page.evaluate(() => window.sharedRoom.text), /KNOT42/);
    await page.screenshot({ path: `artifacts/waiting-room-${viewport.width}.png`, fullPage: true });

    await page.goto(`${base}/waiting-fixture?state=joining`);
    await page.getByRole('heading', { name: /Joining the/ }).waitFor();
    await assertFits(page, '.waiting-console', `${viewport.width} waiting join`);

    await page.goto(`${base}/ad-fixture`);
    if (await page.getByRole('dialog').count() === 0) console.error('Ad fixture body:', (await page.locator('body').innerText()).slice(0, 1000));
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await assertFits(page, '.ad-modal', `${viewport.width} ad idle`);
    await page.screenshot({ path: `artifacts/ad-reward-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Watch a short ad/ }).click();
    await page.getByText('Your ad plays here').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Close' }).count(), 0, 'ad cannot be accidentally closed while playing');
    await page.getByRole('heading', { name: 'Bonus unlocked!' }).waitFor({ timeout: 9000 });
    await page.waitForFunction(() => window.rewarded === 1, null, { timeout: 4000 });
    await assertFits(page, '.ad-modal', `${viewport.width} ad success`);
    console.log(`${viewport.width}x${viewport.height}: waiting host/join, share/copy, ad placement and reward lifecycle passed`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/audio-fixture') return route.fulfill({ contentType: 'text/html', body: audioHtml });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`auth: ${error.message}`));
  await page.goto(`${base}/audio-fixture`);
  await page.waitForFunction(() => Boolean(window.testSounds));
  const audioState = await page.evaluate(() => {
    const sound = window.testSounds;
    const start = { music: sound.musicMuted, effects: sound.effectsMuted };
    sound.toggleMusicMute();
    const musicOnly = { music: sound.musicMuted, effects: sound.effectsMuted };
    sound.toggleEffectsMute();
    const both = { music: sound.musicMuted, effects: sound.effectsMuted };
    sound.toggleEffectsMute();
    sound.setMusicVolume(.35);
    sound.setEffectVolume(.7);
    return { start, musicOnly, both, saved: JSON.parse(localStorage.getItem('knotyet_sound_preferences')) };
  });
  assert.deepEqual(audioState.start, { music: false, effects: false });
  assert.deepEqual(audioState.musicOnly, { music: true, effects: false }, 'music mute leaves game sounds on');
  assert.deepEqual(audioState.both, { music: true, effects: true });
  assert.equal(audioState.saved.musicVolume, .35);
  assert.equal(audioState.saved.effectVolume, .7);
  assert.equal(audioState.saved.musicMuted, true);
  assert.equal(audioState.saved.effectsMuted, false);
  console.log('Audio mixer: independent mute states, volumes, and saved preferences passed');
  await page.goto(`${base}/play`);
  await page.getByRole('button', { name: /Sign in.*play/i }).first().waitFor();
  assert.equal(new URL(page.url()).pathname, '/', 'protected play route redirects to sign in');
  assert.equal(await page.evaluate(() => localStorage.getItem('knotyet_guest_active')), null, 'no guest session is created');
  assert.equal(await page.getByText('Guest Player', { exact: true }).count(), 0, 'landing has no guest identity');
  console.log('Login boundary: protected play route redirects and no guest session is created');
  await context.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
