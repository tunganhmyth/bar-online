import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Use an isolated server with its own stage.settings-file; no LIVE connection.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8086';
assert.notEqual(new URL(base).port, '8080', 'Use an isolated preview server');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
let api, original;
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 1000 } });
  api = context.request;
  original = await (await api.get(`${base}/api/stage/settings`)).json();
  assert(Object.hasOwn(original, 'musicTrack'), 'Restart preview with updated backend');
  const errors = [];
  const open = async (obs = false) => {
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/?quality=low${obs ? '&obs=1' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#music-track:enabled').waitFor({ state: 'attached' });
    return page;
  };
  const page = await open(), obs = await open(true);
  const options = await page.locator('#music-track option').evaluateAll((items) => items.map((item) => ({ id: item.value, title: item.textContent })));
  assert.equal(options.length, 5);
  for (const { id, title } of options) {
    await page.locator('#music-track').selectOption(id);
    for (const target of [page, obs]) {
      await target.waitForFunction((value) => {
        const audio = document.getElementById('music');
        return document.getElementById('music-track').value === value && audio.readyState >= 2 && !audio.paused && audio.currentTime > 0;
      }, id);
      const playing = await target.locator('#music').evaluate((audio) => ({ duration: audio.duration, error: audio.error?.code, loop: audio.loop, label: audio.getAttribute('aria-label'), source: audio.currentSrc }));
      assert(playing.duration > 30 && Number.isFinite(playing.duration), `${title} decodes as real audio`);
      assert(!playing.error && playing.loop);
      assert.equal(playing.label, title);
      assert(!new URL(playing.source).hash, 'Filename # is encoded');
      await target.waitForFunction((value) => {
        const current = window.clubScene?.getSnapshot().nowPlaying;
        return current && `${current.title} · ${current.artist}` === value;
      }, title);
    }
    assert.equal((await (await api.get(`${base}/api/stage/settings`)).json()).musicTrack, id);
  }
  await page.locator('#music-track').selectOption('ket-thuc-va-chia-tay');
  await page.waitForFunction(() => document.getElementById('music').readyState >= 2 && document.getElementById('music-track').value === 'ket-thuc-va-chia-tay');
  await obs.reload({ waitUntil: 'domcontentloaded' });
  await obs.waitForFunction(() => document.getElementById('music-track').value === 'ket-thuc-va-chia-tay' && !document.getElementById('music').paused);
  await page.locator('#music').evaluate((audio) => { audio.pause(); audio.currentTime = 17; });
  await page.bringToFront();
  const marquee = await page.evaluate(() => window.clubScene.getSnapshot().nowPlaying);
  await page.waitForFunction((previous) => window.clubScene.getSnapshot().nowPlaying.scrollOffset !== previous, marquee.scrollOffset);
  assert(marquee.position[1] < 1 && marquee.position[2] < -6, 'LED strip is mounted below the DJ desks');
  await api.put(`${base}/api/stage/settings`, { data: { laserEnabled: !original.laserEnabled } });
  await page.waitForFunction((value) => document.getElementById('laser-toggle').getAttribute('aria-pressed') === String(value), !original.laserEnabled);
  assert(await page.locator('#music').evaluate((audio) => audio.paused && Math.abs(audio.currentTime - 17) < 0.1), 'Other settings preserve pause and playback position');
  assert.equal(await page.evaluate(() => window.clubScene.getSnapshot().nowPlaying.textureVersion), marquee.textureVersion, 'Other settings do not repaint or reset the marquee');
  await page.route('**/api/stage/settings', (route) => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { error: 'Không lưu được bài nhạc thử.' } }) : route.continue());
  await page.locator('#music-track').selectOption('hon-bat-cu-ai');
  await page.waitForFunction(() => document.getElementById('music-status').textContent === 'Không lưu được bài nhạc thử.');
  assert.equal(await page.locator('#music-track').inputValue(), 'ket-thuc-va-chia-tay');
  await page.unroute('**/api/stage/settings');
  await page.locator('.music-picker').scrollIntoViewIfNeeded();
  await page.locator('.music-section').last().screenshot({ path: '.run/music-picker.png' });
  assert.deepEqual(errors, []);
  console.log('PASS all 5 tracks play, update the scrolling 3D LED and OBS, survive reload, preserve playback on unrelated settings and roll back failed saves.');
} finally {
  if (api && original) await api.put(`${base}/api/stage/settings`, { data: { musicTrack: original.musicTrack, laserEnabled: original.laserEnabled } });
  await browser.close();
}
