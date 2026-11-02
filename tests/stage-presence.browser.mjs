import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run against a local server. Stream messages and time are controlled entirely
// inside this browser context; the running TikTok connection is never changed.
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required']
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const now = Date.now.bind(Date);
    window.__timeOffset = 0;
    Date.now = () => now() + window.__timeOffset;
    window.EventSource = class {
      constructor() {
        window.__emitLive = (event) => this.onmessage?.({ data: JSON.stringify(event) });
        setTimeout(() => this.onopen?.(), 0);
      }
      close() {}
    };
  });
  for (const name of ['club-scene', 'live']) {
    const body = await readFile(`src/main/resources/static/js/${name}.js`);
    await page.route(`**/js/${name}.js*`, (route) => route.fulfill({ contentType: 'text/javascript', body }));
  }
  await page.route('**/api/stage/settings', (route) => route.fulfill({
    json: { hostName: 'Chủ sàn', cameraMode: 'overview', revision: 0 }
  }));
  await page.goto(process.env.SCENE_BASE_URL || 'http://localhost:8080/?quality=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().animatedCount === 1);
  const emit = (type, data) => page.evaluate((event) => window.__emitLive(event), { type, data });
  const advance = (ms) => page.evaluate((delta) => { window.__timeOffset += delta; }, ms);
  const snapshot = () => page.evaluate(() => window.clubScene.getSnapshot());
  const user = (uniqueId) => ({ uniqueId, nickname: uniqueId });
  const state = (connected) => ({ connected, connecting: false, username: 'presence-test', viewerCount: 3, lastError: null });
  const gift = (uniqueId) => ({ ...user(uniqueId), count: 1, giftName: 'Hoa hồng' });

  await advance(600001);
  await page.waitForTimeout(1100);
  assert.equal((await snapshot()).actorCount, 1, 'The permanent host does not expire');
  assert.equal((await snapshot()).participants[0].isHost, true);
  assert.equal((await snapshot()).hostName, 'Chủ sàn');
  await emit('state', state(true));
  assert.equal((await snapshot()).actorCount, 1, 'Connecting keeps only the permanent host');
  for (const type of ['member', 'like', 'follow', 'share']) await emit(type, { ...user('spectator'), count: 2 });
  assert.equal((await snapshot()).actorCount, 1, 'Joining/likes/follows/shares cannot enter the floor');
  await page.locator('#test-gift').click();
  assert.equal((await snapshot()).actorCount, 1, 'Testing gifts uses the host without inserting preview dancers');
  await page.evaluate(() => window.clubScene.resetCamera());

  await emit('chat', { ...user('commenter'), comment: 'Xin chào' });
  await emit('chat', { ...user('commenter'), comment: 'Vẫn là tôi' });
  assert.equal((await snapshot()).actorCount, 2, 'A comment admits one avatar without duplication');
  await emit('like', { ...user('spectator'), count: 5 });
  assert.equal((await snapshot()).actorCount, 2);
  await emit('gift', gift('gifter'));
  await emit('gift', gift('queued-gifter'));
  const focused = await snapshot();
  assert.equal(focused.actorCount, 4, 'Gifts admit participants');
  assert.equal(focused.focusedUser, 'gifter');
  assert.equal(focused.queueLength, 1);
  assert.equal(focused.inactivityTimeoutMs, 600000);
  await advance(600001);
  await page.waitForFunction(() => window.clubScene.getSnapshot().actorCount === 1);
  const expired = await snapshot();
  assert.equal(expired.animatedCount, 1, 'Expired animations are released; the host keeps dancing');
  assert.equal(expired.queueLength, 0, 'Expired queued gifts are removed');
  assert.equal(expired.cameraMode, 'overview', 'An expired focused user resets the camera');
  assert.equal(await page.locator('.character-label').count(), 1);
  assert.equal(await page.locator('#gift-feature').isVisible(), false);
  assert.equal(await page.locator('#dancer-count').textContent(), '1');
  console.log('PASS admission is comment/gift only; 10-minute expiry removes models, labels, mixers and camera jobs.');

  await emit('chat', { ...user('active-viewer'), comment: 'Lên lại sàn' });
  await advance(9 * 60000);
  await emit('like', { ...user('active-viewer'), count: 3 });
  const refreshed = (await snapshot()).participants.find((actor) => actor.id === 'active-viewer').lastActiveAt;
  await advance(61000);
  await page.waitForTimeout(1100);
  assert.equal((await snapshot()).actorCount, 2, 'An existing viewer keeps their place by interacting');
  assert.equal((await snapshot()).participants.find((actor) => actor.id === 'active-viewer').lastActiveAt, refreshed);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await advance(9 * 60000);
  await page.waitForFunction(() => window.clubScene.getSnapshot().actorCount === 1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  console.log('PASS existing-viewer reactions refresh activity; wall-clock expiry runs while rendering is hidden.');

  await emit('member', user('active-viewer'));
  assert.equal((await snapshot()).actorCount, 1, 'Rejoining alone cannot resurrect an expired avatar');
  await emit('gift', gift('active-viewer'));
  assert.equal((await snapshot()).actorCount, 2, 'A fresh gift allows reentry');
  await emit('state', state(false));
  assert.equal((await snapshot()).actorCount, 1, 'Disconnect clears viewers and keeps the host');
  await emit('state', state(true));
  assert.equal((await snapshot()).actorCount, 1, 'Reconnecting the same channel keeps only the host');
  await emit('chat', { ...user('active-viewer'), comment: 'Bắt đầu lại' });
  assert.equal((await snapshot()).actorCount, 2);
  assert.deepEqual(errors, []);
  console.log('PASS expired viewers can reenter via chat/gift; disconnect/reconnect leaves no stale actors or browser errors.');
} finally { await browser.close(); }
