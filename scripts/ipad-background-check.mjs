import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

await mkdir('artifacts', { recursive: true });
const base = 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const authMock = `
  const user={id:'ipad-layout-account',email:'ipad@example.test'};
  const auth={session:{user},user,profile:{id:user.id,name:'Afiq',avatar_id:'sunny'},progress:{user_id:user.id,heart_points:320,answered_questions:[],play_together_count:0,solo_play_count:0,is_premium:false},couple:null,isLoading:false,signInWithGoogle:async()=>{},signOut:async()=>{},refreshProgress:async()=>{},refreshCouple:async()=>{},incrementPlayCount:async()=>{},awardBonusPlay:async()=>{},checkLimit:()=>true};
  export const useAuth=()=>auth;export const AuthProvider=({children})=>children;
`;

try {
  for (const viewport of [{ width: 768, height: 1024, name: 'portrait' }, { width: 1024, height: 768, name: 'landscape' }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('jodohdeck_profile', JSON.stringify({ name: 'Afiq', avatarId: 'sunny', heartPoints: 320 })));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/src/store/AuthContext.tsx') return route.fulfill({ contentType: 'application/javascript', body: authMock });
      if (url.hostname !== 'localhost') return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${base}/play`);
    const decoration = page.locator('.arcade-decoration-star');
    await decoration.locator('svg').waitFor();
    assert.equal((await decoration.innerText()).trim(), '', `${viewport.name}: background art contains no platform emoji glyph`);
    assert.equal(await decoration.locator('svg').count(), 1, `${viewport.name}: one deterministic SVG decoration`);
    const metrics = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    assert.ok(metrics.documentWidth <= metrics.width + 1, `${viewport.name}: no horizontal overflow`);
    await page.screenshot({ path: `artifacts/ipad-background-${viewport.name}.png`, fullPage: true });
    console.log(`iPad ${viewport.name}: SVG background art and responsive fit passed`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
