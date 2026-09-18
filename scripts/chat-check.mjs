import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const base = process.env.SMOKE_URL || 'http://localhost:5174';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await mkdir('artifacts', { recursive: true });
const errors = [];
const clients = [];
async function client(id) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(id => {
    if (!location.protocol.startsWith('http')) return;
    if (!localStorage.getItem('knotyet_guest_id')) {
      localStorage.setItem('knotyet_guest_active', 'true');
      localStorage.setItem('knotyet_guest_id', id);
      localStorage.setItem('jodohdeck_profile', JSON.stringify({ name: 'Guest Player', avatarId: 'sunny', heartPoints: 320 }));
    }
  }, id);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /peer|error/i.test(message.text())) console.log(id, message.text()); });
  clients.push({ context, page, id });
  return clients.at(-1);
}
const a = await client('guest-chat-test-a');
const b = await client('guest-chat-test-b');
try {
  await a.page.goto(`${base}/play`);
  await a.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await a.page.getByRole('button', { name: 'Invite your person', exact: true }).click();
  await a.page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const link = await a.page.locator('.chat-link-preview').innerText();
  assert.ok(link.startsWith(`${base}/invite?`));
  assert.ok(new URL(link).searchParams.get('cid'));
  await b.page.goto(link);
  await b.page.getByRole('button', { name: 'Accept & connect', exact: true }).click();
  await a.page.locator('.chat-friend').first().waitFor({ timeout: 45000 });
  await a.page.locator('.chat-friend').first().click();
  await a.page.getByText('Here with you', { exact: false }).waitFor({ timeout: 45000 });
  await b.page.waitForFunction(() => JSON.parse(localStorage.getItem('knotyet_chats_v2:guest-chat-test-b')).friends[0].isOnline);
  await a.page.getByRole('textbox', { name: 'Message Guest Player' }).fill('Test hello A to B');
  await a.page.getByRole('button', { name: 'Send message', exact: true }).click();
  await b.page.waitForFunction(() => JSON.parse(localStorage.getItem('knotyet_chats_v2:guest-chat-test-b')).friends[0].unreadCount === 1);
  await b.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await b.page.locator('.chat-friend').first().click();
  await b.page.locator('.chat-bubble').getByText('Test hello A to B', { exact: true }).waitFor({ timeout: 20000 });
  await a.page.getByText('Delivered', { exact: true }).waitFor();
  assert.equal(await b.page.locator('.chat-message:not(.is-mine) .chat-bubble').last().innerText(), 'Test hello A to B');
  await b.page.getByRole('button', { name: 'Ready to play?', exact: true }).click();
  await a.page.locator('.chat-message:not(.is-mine) .chat-bubble').filter({ hasText: 'Ready to play?' }).waitFor();
  await a.page.screenshot({ path: 'artifacts/chat-two-clients.png' });
  await a.page.getByRole('button', { name: 'Close friends and messages', exact: true }).click();
  await b.page.getByRole('textbox', { name: 'Message Guest Player' }).fill('Unread note from B');
  await b.page.getByRole('button', { name: 'Send message', exact: true }).click();
  await a.page.waitForFunction(() => JSON.parse(localStorage.getItem('knotyet_chats_v2:guest-chat-test-a')).friends[0].unreadCount === 1);
  await a.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await a.page.locator('.chat-friend').first().click();
  await a.page.waitForFunction(() => JSON.parse(localStorage.getItem('knotyet_chats_v2:guest-chat-test-a')).friends[0].unreadCount === 0);
  await b.page.goto('about:blank');
  await a.page.getByText('Away right now', { exact: false }).waitFor({ timeout: 20000 });
  await a.page.getByRole('textbox', { name: 'Message Guest Player' }).fill('Test queued while B is away');
  await a.page.getByRole('button', { name: 'Send message', exact: true }).click();
  await a.page.getByText('Waiting for partner', { exact: true }).waitFor();
  await a.page.reload();
  await a.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await a.page.locator('.chat-friend').first().click();
  await a.page.locator('.chat-bubble').getByText('Test queued while B is away', { exact: true }).waitFor();
  await b.page.goto(`${base}/play`);
  await b.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await b.page.locator('.chat-friend').first().click();
  await b.page.locator('.chat-bubble').getByText('Test queued while B is away', { exact: true }).waitFor({ timeout: 45000 });
  assert.equal(await b.page.locator('.chat-bubble').filter({ hasText: 'Test queued while B is away' }).count(), 1);
  await a.page.locator('.chat-message').filter({ hasText: 'Test queued while B is away' }).getByText('Delivered', { exact: true }).waitFor();
  await a.page.getByRole('button', { name: 'Invite Guest Player to play', exact: true }).click();
  await b.page.getByRole('button', { name: 'Join their room', exact: true }).waitFor();
  await b.page.getByRole('button', { name: 'Join their room', exact: true }).click();
  await a.page.getByRole('region', { name: 'Your shared game room' }).waitFor({ timeout: 30000 });
  await b.page.getByRole('region', { name: 'Your shared game room' }).waitFor({ timeout: 30000 });
  await a.page.getByRole('button', { name: 'Open in-game chat', exact: true }).click();
  await b.page.getByRole('button', { name: 'Open in-game chat', exact: true }).click();
  await a.page.getByRole('textbox', { name: 'Message Guest Player' }).fill('Room chat A to B');
  await a.page.getByRole('button', { name: 'Send message', exact: true }).click();
  await b.page.locator('.chat-message:not(.is-mine) .chat-bubble').filter({ hasText: 'Room chat A to B' }).waitFor();
  await b.page.getByRole('textbox', { name: 'Message Guest Player' }).fill('Room reply B to A');
  await b.page.getByRole('button', { name: 'Send message', exact: true }).click();
  await a.page.locator('.chat-message:not(.is-mine) .chat-bubble').filter({ hasText: 'Room reply B to A' }).waitFor();
  await b.page.screenshot({ path: 'artifacts/chat-room-receiver.png' });
  for (const { page } of clients) {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${base}/play`);
  }
  await a.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await a.page.locator('.chat-friend').first().click();
  await a.page.getByRole('button', { name: 'Remove Guest Player from your circle', exact: true }).click();
  await a.page.getByRole('button', { name: 'Remove chat', exact: true }).click();
  await b.page.reload();
  await b.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  await new Promise(resolve => setTimeout(resolve, 11000));
  assert.equal(await a.page.locator('.chat-friend').count(), 0, 'Removed friend must not silently reappear on peer reconnect');
  await a.page.reload();
  await a.page.getByRole('button', { name: 'Friends and messages', exact: true }).click();
  assert.equal(await a.page.locator('.chat-friend').count(), 0, 'Removal survives reload');
  assert.deepEqual(errors, []);
  console.log('PASS: real PeerJS pairing, bidirectional DM and quick reply, acknowledged delivery, recipient attribution, offline queue preserved through reload, reconnect without duplicates, unread counts, game invite received, joined shared room and bidirectional room chat, persistent friend removal.');
} catch (error) {
  console.log('FAIL', error.message);
  for (const { page, id } of clients) {
    if (!page.isClosed()) {
      await page.screenshot({ path: `artifacts/${id}-failure.png` });
      console.log(id, await page.locator('body').innerText());
    }
  }
  throw error;
} finally { await browser.close(); }
