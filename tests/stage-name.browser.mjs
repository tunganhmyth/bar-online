import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Use an isolated preview with its own stage.settings-file. Real API and SSE.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8084';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
let api, original;
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 1000 } });
  api = context.request;
  const live = await (await api.get(`${base}/api/live/state`)).json();
  assert(!live.connected && !live.connecting, 'Use a disconnected preview server for this test');
  original = await (await api.get(`${base}/api/stage/settings`)).json();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.locator('#stage-name:enabled').waitFor();
  await page.waitForFunction(() => window.clubScene?.getSnapshot().ready);
  const before = await page.evaluate(() => window.clubScene.getSnapshot());
  const obs = await context.newPage();
  obs.on('pageerror', (error) => errors.push(error.message));
  await obs.goto(`${base}/?obs=1&quality=low`, { waitUntil: 'domcontentloaded' });
  await obs.waitForFunction(() => window.clubScene?.getSnapshot().ready);
  await page.bringToFront();
  await page.locator('#stage-name').fill('BAR ÁNH TRĂNG');
  await page.locator('#save-stage-name').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().stageName === 'BAR ÁNH TRĂNG');
  await obs.waitForFunction(() => window.clubScene.getSnapshot().stageName === 'BAR ÁNH TRĂNG');
  assert.equal(await page.locator('#stage-name-label').textContent(), 'BAR ÁNH TRĂNG');
  assert.equal(await obs.locator('#stage-name-label').textContent(), 'BAR ÁNH TRĂNG');
  const changed = await page.evaluate(() => window.clubScene.getSnapshot());
  assert(changed.stageLogoVersion > before.stageLogoVersion, '3D LED texture was repainted');
  assert.equal(changed.actorCount, before.actorCount);
  assert.equal(changed.hostName, before.hostName);
  await page.waitForTimeout(600);
  await page.locator('#wutai').screenshot({ path: '.run/custom-stage-name.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().stageName === 'BAR ÁNH TRĂNG');
  assert.equal(await page.locator('#stage-name').inputValue(), 'BAR ÁNH TRĂNG');
  assert.equal((await (await api.get(`${base}/api/stage/settings`)).json()).stageName, 'BAR ÁNH TRĂNG');

  const longName = 'W'.repeat(32);
  await page.locator('#stage-name').fill(longName); await page.locator('#save-stage-name').click();
  await page.waitForFunction((value) => window.clubScene.getSnapshot().stageName === value, longName);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.waitForTimeout(500);
  assert(await page.locator('#stage-name-label').evaluate((label) => label.scrollWidth <= label.clientWidth + 1), 'Long name fits on mobile');
  const literal = '<img src=x onerror=alert(1)>';
  await page.locator('#stage-name').fill(literal); await page.locator('#save-stage-name').click();
  await page.waitForFunction((value) => window.clubScene.getSnapshot().stageName === value, literal);
  assert.equal(await page.locator('#stage-name-label img').count(), 0, 'Name is rendered as literal text');
  assert.equal((await api.put(`${base}/api/stage/settings`, { data: { stageName: '' } })).status(), 400);
  assert.deepEqual(errors, []);
  console.log('PASS custom name updates HUD and 3D LED, synchronizes to OBS, survives reload, fits mobile and renders safely.');
} finally {
  if (api && original) await api.put(`${base}/api/stage/settings`, { data: { stageName: original.stageName || 'MYTHMAKER' } });
  await browser.close();
}
