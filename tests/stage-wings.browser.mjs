import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Local browser fixtures only. Does not connect TikTok or save stage settings.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8086';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } }), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.EventSource = class { constructor() { setTimeout(() => this.onopen?.(), 0); } close() {} };
  });
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().ready);
  await page.evaluate(() => { window.clubScene.setCameraMode('overview'); window.clubScene.setHostCharacter('hikari'); });
  await page.locator('#test-gift').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().activeSkill?.characterId === 'hikari');
  await page.waitForTimeout(1300);
  const gift = await page.evaluate(() => window.clubScene.getSnapshot());
  assert.deepEqual(gift.activeSkill.wings, { style: 'layered-feather-wings', feathers: 132, layers: 3 });
  assert.equal(gift.activeSkill.style, 'seraph-feathers');
  assert.equal(gift.activeSkill.phase, 'signature');
  assert(gift.camera.every(Number.isFinite));
  await page.locator('#wutai').screenshot({ path: '.run/feather-wing-gift.png' });
  await page.waitForFunction(() => !window.clubScene.getSnapshot().activeSkill);
  await page.evaluate(() => {
    window.clubScene.resetCamera();
    window.clubScene.setTopGifters({ epoch: 'wings-test', session: 1, revision: 1,
      leaders: ['hikari', 'luna', 'akira'].map((characterId, i) => ({ rank: i + 1, uniqueId: `wing-top-${i}`, nickname: `Wing Top ${i + 1}`, diamonds: 300 - i * 100, gifts: 3 - i, characterId })) });
  });
  const top = await page.evaluate(() => window.clubScene.getSnapshot().topGifters);
  assert.equal(top.count, 3);
  assert(top.leaders.every((entry) => entry.wings.feathers === 132 && entry.wings.layers === 3));
  await page.waitForTimeout(1600);
  await page.locator('#wutai').screenshot({ path: '.run/feather-wing-top.png' });
  await page.evaluate(() => window.clubScene.setCameraMode('mixed'));
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraTop?.rank === 1, {}, { timeout: 30000 });
  await page.waitForTimeout(1600);
  const closeup = await page.evaluate(() => window.clubScene.getSnapshot());
  assert.equal(closeup.activeSkill, null, 'Honor wings do not trigger a gift skill');
  assert.equal(closeup.cameraAura.kind, 'top');
  assert(closeup.camera[2] > closeup.target[2]);
  await page.locator('#wutai').screenshot({ path: '.run/feather-wing-top-close.png' });
  await page.evaluate(() => {
    window.clubScene.setCameraMode('overview');
    window.clubScene.setTopGifters({ epoch: 'wings-test', session: 1, revision: 2, leaders: [] });
  });
  assert.equal(await page.evaluate(() => window.clubScene.getSnapshot().topGifters.count), 0);
  assert.deepEqual(errors, []);
  console.log('PASS 132 layered feathers on Hikari and all Top podiums, gift entry/cleanup, portrait framing and empty podium cleanup.');
} finally { await browser.close(); }
