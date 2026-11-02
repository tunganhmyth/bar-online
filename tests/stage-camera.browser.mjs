import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Uses the local preview server, including real settings API and SSE. Never
// connects to TikTok. Use a separate stage.settings-file for this server.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8081';
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
});
let original;
let api;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  api = context.request;
  const initial = await api.get(`${base}/api/stage/settings`);
  assert.equal(initial.status(), 200);
  original = await initial.json();
  const set = async (patch) => {
    const response = await api.put(`${base}/api/stage/settings`, { data: patch });
    assert.equal(response.status(), 200);
    return response.json();
  };
  await set({ hostName: 'Chủ sàn', cameraMode: 'overview', laserEnabled: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Keep the genuine SSE connection while allowing local gift fixtures.
  await page.addInitScript(() => {
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(...args) {
        super(...args);
        window.__emitLive = (event) => this.onmessage?.({ data: JSON.stringify(event) });
      }
    };
  });
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().animatedCount === 1);
  await page.locator('#host-name:enabled').waitFor();
  const snapshot = () => page.evaluate(() => window.clubScene.getSnapshot());
  assert.equal((await snapshot()).preview, false);
  assert.equal((await snapshot()).participants[0].isHost, true);
  await page.locator('#host-name').fill('DJ Linh');
  await page.locator('#save-host').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().hostName === 'DJ Linh');
  assert.equal(await page.locator('.host-label strong').textContent(), 'DJ Linh');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().hostName === 'DJ Linh' && window.clubScene.getSnapshot().ready);
  assert.equal((await snapshot()).actorCount, 1);

  const obs = await context.newPage();
  obs.on('pageerror', (error) => errors.push(error.message));
  await obs.goto(`${base}/?obs=1&quality=low`, { waitUntil: 'domcontentloaded' });
  await obs.waitForFunction(() => window.clubScene?.getSnapshot().hostName === 'DJ Linh' && window.clubScene.getSnapshot().ready);
  await page.bringToFront();
  await page.locator('#host-name').fill('DJ Chủ Sàn');
  await page.locator('#save-host').click();
  await obs.waitForFunction(() => window.clubScene.getSnapshot().hostName === 'DJ Chủ Sàn');
  console.log('PASS one permanent host; name is saved across reload and synchronized to OBS via SSE.');
  await page.locator('#laser-toggle').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().laserBeamCount === 36);
  await obs.waitForFunction(() => window.clubScene.getSnapshot().laserEnabled === true);
  assert.equal(await page.locator('#laser-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#lights-toggle').click();
  assert.equal((await snapshot()).laserBeamCount, 36, 'Laser switch is independent of stage lights');
  await page.locator('#lights-toggle').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().laserBeamCount === 36 && window.clubScene.getSnapshot().ready);
  console.log('PASS laser fans render, remain independent of stage lights, persist and synchronize to OBS.');

  // Repeated long drags must stop at the front arc instead of passing behind the backdrop.
  const canvas = await page.locator('#club-canvas').boundingBox();
  await page.waitForTimeout(1600);
  for (const direction of [-1, 1]) {
    for (let drag = 0; drag < 3; drag++) {
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      await page.mouse.down();
      await page.mouse.move(canvas.x + canvas.width / 2 + direction * 700, canvas.y + canvas.height / 2, { steps: 12 });
      await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const pose = await snapshot();
    const angle = Math.atan2(pose.camera[0] - pose.target[0], pose.camera[2] - pose.target[2]);
    assert(Math.abs(angle) <= Math.PI / 3 + 0.001, 'Manual drags cannot rotate behind the stage');
  }

  const positions = new Set();
  for (const mode of ['overview', 'front', 'left', 'right', 'overhead', 'orbit', 'closeup']) {
    await page.locator('#camera-mode').selectOption(mode);
    await page.waitForFunction((value) => window.clubScene.getSnapshot().selectedCameraMode === value, mode);
    await page.waitForTimeout(1900);
    const shot = await snapshot();
    assert.equal(shot.cameraShot, mode);
    assert(shot.camera.every(Number.isFinite));
    assert(shot.camera[2] > -1, 'Shots stay on the open side of the stage');
    positions.add(shot.camera.map((value) => value.toFixed(1)).join(','));
    assert.equal(await obs.evaluate(() => window.clubScene.getSnapshot().selectedCameraMode), mode);
  }
  assert.equal(positions.size, 7, 'Every camera preset has a distinct pose');
  await page.screenshot({ path: '.run/camera-host-controls.png' });
  await page.locator('#camera-mixed').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().selectedCameraMode === 'mixed');
  assert.equal((await snapshot()).shotDurationSeconds, 5);
  assert.deepEqual((await snapshot()).mixedShots, ['overview', 'left', 'front', 'right', 'closeup', 'orbit']);
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraShot === 'left', null, { timeout: 30000 });
  assert.match(await page.locator('#camera-status').textContent(), /HỖN HỢP/);
  await page.waitForTimeout(1800);
  await page.locator('#wutai').screenshot({ path: '.run/camera-mixed-stage.png' });
  console.log('PASS camera stays in the front arc; mixed mode uses five-second shots with no overhead angle.');

  await page.evaluate(() => window.__emitLive({ type: 'gift', data: {
    uniqueId: 'camera-gift-fixture', nickname: 'Người tặng quà', giftName: 'Hoa hồng', count: 1
  } }));
  assert.equal((await snapshot()).cameraMode, 'focus');
  await page.locator('#camera-mode').selectOption('right');
  await page.waitForFunction(() => window.clubScene.getSnapshot().selectedCameraMode === 'right');
  assert.equal((await snapshot()).cameraMode, 'focus', 'Changing mode does not interrupt a gift');
  await page.waitForFunction(() => window.clubScene.getSnapshot().cameraMode === 'right', null, { timeout: 30000 });
  await page.waitForTimeout(1800);
  assert((await snapshot()).camera[0] > 9.5, 'Gift returns to the selected camera pose');
  assert.equal(await page.locator('#gift-feature').isVisible(), false);
  await page.locator('#camera-reset').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().selectedCameraMode === 'overview');
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('#music').evaluate((audio) => !audio.paused && audio.currentTime > 0), true);
  await page.locator('#wutai').screenshot({ path: '.run/camera-host-overview.png' });
  assert.deepEqual(errors, []);
  console.log('PASS gifts take priority then resume the selected camera; reset and music autoplay work without browser errors.');
} finally {
  if (api && original) await api.put(`${base}/api/stage/settings`, { data: { hostName: original.hostName, cameraMode: original.cameraMode, laserEnabled: original.laserEnabled === true } });
  await browser.close();
}
