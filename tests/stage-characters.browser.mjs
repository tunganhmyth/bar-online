import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Run on the isolated local preview. Keeps real settings/SSE; simulated LIVE
// events exist only in this browser and never connect/disconnect TikTok.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8081';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
let api, original;
try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 1000 } });
  api = context.request;
  original = await (await api.get(`${base}/api/stage/settings`)).json();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(...args) { super(...args); window.__emitLive = (event) => this.onmessage?.({ data: JSON.stringify(event) }); }
    };
  });
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().ready);
  await page.locator('#host-character:enabled').waitFor();
  const snapshot = () => page.evaluate(() => window.clubScene.getSnapshot());
  const emit = (type, data) => page.evaluate((event) => window.__emitLive(event), { type, data });
  const cast = await page.evaluate(() => window.clubScene.getCharacters());
  assert.deepEqual(cast.map((item) => item.id), ['sakura', 'yuki', 'akira', 'luna', 'hikari']);
  assert.deepEqual(cast.filter((item) => item.body === 'male').map((item) => item.id), ['akira', 'hikari']);
  assert.equal(cast.filter((item) => item.body === 'female').length, 3);
  assert.equal(new Set(cast.map((item) => item.outfit)).size, 5);
  assert.equal(new Set(cast.map((item) => item.dance)).size, 5);
  assert.equal(new Set(cast.map((item) => item.skill)).size, 5);
  const effectStyles = new Set();

  for (const character of cast) {
    await page.locator('#host-character').selectOption(character.id);
    await page.waitForFunction((id) => window.clubScene.getSnapshot().hostCharacter === id, character.id);
    assert.equal((await snapshot()).actorCount, 1, 'Changing character keeps a single host');
    assert.equal((await snapshot()).participants[0].body, character.body);
    assert.equal((await snapshot()).participants[0].outfit, character.outfit);
    assert.match((await snapshot()).participants[0].motionSource, /^J_/, 'Uses a real human dance capture');
    assert.equal((await snapshot()).participants[0].choreography.comboCount, 16);
    assert.equal((await snapshot()).participants[0].choreography.beats, 128);
    await page.locator('#test-gift').click();
    assert.equal((await snapshot()).activeSkill, null, 'Skill waits for camera arrival');
    await page.waitForFunction((id) => window.clubScene.getSnapshot().activeSkill?.characterId === id, character.id);
    await page.waitForTimeout(1200);
    const focused = await snapshot();
    assert.equal(focused.activeSkill.userId, focused.hostId);
    effectStyles.add(focused.activeSkill.style);
    assert.equal(focused.activeSkill.phase, 'signature');
    assert(focused.activeSkill.particles >= 28 && focused.activeSkill.intensity > 0.9);
    if (character.id === 'hikari') assert.deepEqual(focused.activeSkill.wings, { style: 'layered-feather-wings', feathers: 132, layers: 3 });
    assert.equal(focused.cameraAura, null, 'Gift skill replaces the softer portrait aura');
    assert.equal(await page.locator('#wutai').getAttribute('data-skill-character'), character.id);
    assert.equal(focused.participants[0].animation, 'skill');
    assert.match(await page.locator('#gift-skill').textContent(), new RegExp(character.name));
    const labelBounds = await page.locator('.character-label.featured').boundingBox();
    const bannerBounds = await page.locator('#gift-feature').boundingBox();
    assert(labelBounds.y >= bannerBounds.y + bannerBounds.height + 5, 'Gift banner leaves the focused username visible');
    await page.locator('#wutai').screenshot({ path: `.run/anime-${character.id}-skill.png` });
    await page.waitForFunction(() => window.clubScene.getSnapshot().activeSkill === null);
    await page.waitForTimeout(450);
    assert.equal((await snapshot()).participants[0].animation, 'dance', 'Normal dance resumes after the gift');
    assert.equal(await page.locator('#wutai').getAttribute('data-skill-character'), null);
    console.log(`PASS ${character.name}: unique dance, signature ${character.skill}, camera arrival and return to dance.`);
  }
  assert.equal(effectStyles.size, 5, 'Every character has a different visual signature');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.clubScene?.getSnapshot().ready && window.clubScene.getSnapshot().hostCharacter === 'hikari');
  assert.equal((await snapshot()).participants[0].characterId, 'hikari', 'Host character persists after reload');
  await emit('state', { connected: true, username: 'character-fixture', viewerCount: 2 });
  await emit('chat', { uniqueId: 'first', nickname: 'First', comment: '!yuki' });
  await emit('chat', { uniqueId: 'second', nickname: 'Second', comment: '!akira' });
  assert.equal((await snapshot()).participants.find((actor) => actor.id === 'first').characterId, 'yuki');
  assert.equal((await snapshot()).participants.find((actor) => actor.id === 'second').characterId, 'akira');
  await emit('gift', { uniqueId: 'first', nickname: 'First', giftName: 'Hoa hồng', count: 1 });
  await emit('gift', { uniqueId: 'second', nickname: 'Second', giftName: 'Hoa hồng', count: 1 });
  await page.waitForFunction(() => window.clubScene.getSnapshot().activeSkill?.userId === 'first');
  await page.waitForTimeout(500);
  const first = await snapshot();
  assert.equal(first.activeSkill.characterId, 'yuki');
  assert.equal(first.queueLength, 1);
  assert.deepEqual(first.participants.filter((actor) => actor.animation === 'skill').map((actor) => actor.id), ['first']);
  await page.waitForFunction(() => window.clubScene.getSnapshot().activeSkill?.userId === 'second');
  await page.waitForTimeout(500);
  const second = await snapshot();
  assert.equal(second.activeSkill.characterId, 'akira');
  assert.deepEqual(second.participants.filter((actor) => actor.animation === 'skill').map((actor) => actor.id), ['second']);
  await page.evaluate(() => window.clubScene.resetParticipants());
  assert.equal((await snapshot()).activeSkill, null, 'Reset removes the signature effect and queued gifts');
  assert.equal((await snapshot()).actorCount, 1);
  assert.equal((await snapshot()).animatedCount, 1);
  const bounds = await page.evaluate(() => window.clubScene.getSnapshot(true).participants[0].bounds);
  assert(Number.isFinite(bounds.min.y) && Number.isFinite(bounds.max.y));
  assert.deepEqual(errors, []);
  console.log('PASS chat selects characters; only the focused gifter performs their skill; queue, cleanup and persistence work.');
} finally {
  if (api && original) await api.put(`${base}/api/stage/settings`, { data: { hostCharacter: original.hostCharacter || 'sakura' } });
  await browser.close();
}
