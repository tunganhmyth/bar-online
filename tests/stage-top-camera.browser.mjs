import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Browser-only gift/ranking fixtures; no changes to the server's LIVE or settings.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8086';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } }), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.EventSource = class {
      constructor() {
        window.__emitLive = (event) => this.onmessage?.({ data: JSON.stringify(event) });
        setTimeout(() => this.onopen?.(), 0);
      }
      close() {}
    };
  });
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().ready);
  const snapshot = () => page.evaluate(() => window.clubScene.getSnapshot());
  const emit = (type, data) => page.evaluate((event) => window.__emitLive(event), { type, data });
  const leaders = ['VIP One', 'VIP Two', 'VIP Three'].map((nickname, i) => ({ rank: i + 1, nickname,
    uniqueId: `top-camera-${i + 1}`, characterId: ['hikari', 'luna', 'akira'][i], diamonds: 300 - i * 100, gifts: 3 - i }));
  let revision = 0;
  const board = (entries) => emit('top-gifters', { epoch: 'top-camera-test', session: 1, revision: revision++, leaders: entries });
  await board(leaders);
  assert.equal((await snapshot()).actorCount, 1, 'Ranked DJ copies do not create floor viewers');
  await page.evaluate(() => window.clubScene.setCameraMode('mixed'));
  assert.deepEqual((await snapshot()).mixedShots, ['overview', 'left', 'front', 'top', 'right', 'closeup', 'orbit', 'top']);
  assert.equal((await snapshot()).shotDurationSeconds, 5);
  const waitTop = async (rank) => {
    await page.waitForFunction((value) => window.clubScene.getSnapshot().cameraTop?.rank === value, rank, { timeout: 45000 });
    await page.waitForTimeout(1600);
    const shot = await snapshot();
    assert.equal(shot.cameraShot, 'top'); assert.equal(shot.cameraMode, 'mixed');
    assert.equal(shot.cameraTop.uniqueId, leaders[rank - 1].uniqueId);
    assert(shot.camera[2] > shot.target[2], 'Top shots face the front of the podium');
    assert(Math.abs(Math.atan2(shot.camera[0] - shot.target[0], shot.camera[2] - shot.target[2])) < Math.PI / 3);
    assert.equal(shot.activeSkill, null, 'Honor close-ups do not trigger gift skills');
    assert.deepEqual(shot.cameraAura, { userId: leaders[rank - 1].uniqueId, kind: 'top' }, 'Top close-up has a soft aura separate from gift skills');
    assert.equal(await page.locator('.podium-label.is-focused:visible').count(), 1);
    assert.match(await page.locator('#camera-status').textContent(), new RegExp(`TOP ${rank}`));
    await page.locator('#wutai').screenshot({ path: `.run/camera-top-${rank}.png` });
    console.log(`PASS mixed camera visits Top ${rank} on the DJ podium, facing forward with a clear nameplate.`);
  };
  await waitTop(1);
  await emit('gift', { uniqueId: 'new-gifter', nickname: 'New gift', giftName: 'Hoa hồng', count: 1 });
  assert.equal((await snapshot()).cameraMode, 'focus');
  assert.equal((await snapshot()).cameraTop, null);
  await page.waitForFunction(() => window.clubScene.getSnapshot().activeSkill?.userId === 'new-gifter');
  await page.waitForFunction(() => !window.clubScene.getSnapshot().focusedUser && window.clubScene.getSnapshot().cameraMode === 'mixed', {}, { timeout: 20000 });
  console.log('PASS new gifts interrupt the Top close-up, play the correct skill and resume mixed mode.');
  await waitTop(2);
  await waitTop(3);
  const changed = leaders.map((entry) => ({ ...entry })); changed[2].uniqueId = 'replacement'; changed[2].nickname = 'New Top Three';
  await board(changed);
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraTop?.uniqueId === 'replacement');
  assert.match(await page.locator('#camera-status').textContent(), /NEW TOP THREE/);
  await board(changed.slice(0, 2));
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraTop?.rank <= 2);
  await board([]);
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraShot !== 'top' && !window.clubScene.getSnapshot().cameraTop);
  assert.deepEqual((await snapshot()).mixedShots, ['overview', 'left', 'front', 'right', 'closeup', 'orbit']);
  assert.deepEqual(errors, []);
  console.log('PASS rank replacement updates the subject; missing/empty ranks fall back to valid shots with no empty podium focus.');
} finally { await browser.close(); }
