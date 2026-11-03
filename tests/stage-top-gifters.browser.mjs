import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Isolated server using fake-tiktok-worker.mjs, never the running LIVE server.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8085';
assert(!new URL(base).port || new URL(base).port !== '8080', 'Use a separate fixture server');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
let api, connected = false;
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 1050 } });
  api = context.request;
  const state = await (await api.get(`${base}/api/live/state`)).json();
  assert(!state.connected && !state.connecting, 'Fixture server must start disconnected');
  const errors = [];
  const open = async (obs = false) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/?quality=low${obs ? '&obs=1' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.clubScene?.getSnapshot().ready);
    return page;
  };
  const page = await open(), obs = await open(true);
  const snapshot = (target = page) => target.evaluate(() => window.clubScene.getSnapshot());
  const board = () => api.get(`${base}/api/live/top-gifters`).then((result) => result.json());
  const username = `leaderboard_test_${String(Date.now()).slice(-6)}`;
  assert.equal((await api.post(`${base}/api/live/connect`, { data: { username } })).status(), 202);
  connected = true;
  for (const target of [page, obs]) {
    await target.waitForFunction(() => {
      const top = window.clubScene.getSnapshot().topGifters;
      return top.count === 3 && top.leaders[0]?.uniqueId === 'rank-b' && top.leaders[0]?.diamonds === 110;
    });
  }
  const result = await board();
  assert.deepEqual(result.leaders.map(({ uniqueId, diamonds, gifts }) => [uniqueId, diamonds, gifts]),
    [['rank-b', 110, 11], ['rank-a', 100, 1], ['rank-c', 20, 2]], 'Combo deltas count once across tabs');
  const top = (await snapshot()).topGifters;
  assert.deepEqual(top, (await snapshot(obs)).topGifters, 'Control page and OBS share ranks and characters');
  assert.equal(top.leaders[0].characterId, 'hikari', 'Pre-gift comment selection reaches the DJ character');
  assert.equal(top.leaders[0].position[0], 0);
  assert(top.leaders[0].position[1] > top.leaders[1].position[1]);
  assert(top.leaders[1].position[0] < 0 && top.leaders[2].position[0] > 0);
  assert(top.leaders.every((entry) => entry.animated && entry.position[2] < -8));
  assert.equal(await page.locator('.top-gifter-row').count(), 3);
  assert.deepEqual(await page.locator('.top-gifter-row > span').allTextContents(), ['Cơ Trưởng', 'Cơ Phó', 'Tiếp viên']);
  assert.deepEqual(await page.locator('.podium-label > span').allTextContents(), ['Cơ Trưởng', 'Cơ Phó', 'Tiếp viên']);
  await page.evaluate(() => window.clubScene.resetCamera());
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.podium-label:visible').count(), 3);
  await page.locator('#wutai').screenshot({ path: '.run/top3-live-stage.png' });

  await obs.reload({ waitUntil: 'domcontentloaded' });
  await obs.waitForFunction(() => window.clubScene?.getSnapshot().topGifters.count === 3);
  const reloaded = await snapshot(obs);
  assert.deepEqual(reloaded.topGifters, top, 'New OBS source restores the board without replaying gifts');
  assert.equal(reloaded.actorCount, 1, 'Honor characters do not admit viewers onto the dance floor');
  assert.equal(reloaded.focusedUser, null);
  assert.deepEqual(await obs.locator('.podium-label > span').allTextContents(), ['Cơ Trưởng', 'Cơ Phó', 'Tiếp viên']);
  await obs.locator('#wutai').screenshot({ path: '.run/top3-obs-stage.png' });

  await page.evaluate(() => { for (const id of ['rank-a', 'rank-b', 'rank-c']) window.clubScene.removeParticipant(id); });
  assert.equal((await snapshot()).topGifters.count, 3, 'Floor departure preserves gift honors');
  assert.deepEqual(await board(), result);
  await api.post(`${base}/api/live/disconnect`); connected = false;
  await page.locator('#preview:enabled').waitFor();
  await page.locator('#preview').click();
  await page.waitForFunction(() => window.clubScene.getSnapshot().topGifters.demo);
  assert.equal(await page.locator('.podium-label small').first().textContent(), '♛ TOP 1 · XEM THỬ');
  assert.deepEqual(await board(), result, 'Local preview never changes the real board');
  await page.evaluate(() => window.clubScene.setPreview(false));
  assert.deepEqual((await snapshot()).topGifters, top);
  assert.deepEqual(errors, []);
  console.log('PASS Top 3 gift deltas, rank changes, 3D DJ podiums, character choice, OBS reload, floor departure and isolated demo.');
} finally {
  if (api && connected) await api.post(`${base}/api/live/disconnect`);
  await browser.close();
}
