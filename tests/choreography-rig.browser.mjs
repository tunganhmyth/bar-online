import { build } from 'esbuild';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Load the actual VRM rigs in a browser: source motion tests alone cannot
// detect knee pops introduced by retargeting or the foot-plant solver.
const base = process.env.SCENE_BASE_URL || 'http://localhost:8086';
const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { loadAnimeTemplate, createAnimeActor, CHARACTERS } from './frontend/anime-characters.js';
  import * as THREE from 'three';
  const library = await loadAnimeTemplate();
  window.results = [];
  for (let i = 0; i < CHARACTERS.length; i++) {
    const actor = createAnimeActor(library, i, 0, 0);
    const clips = [];
    for (const [kind, action] of [['dance', actor.dance], ['skill', actor.special]]) {
      let maxStep = 0, maxNormError = 0, seamError = 0;
      const clip = action.getClip();
      for (const track of clip.tracks) {
        if (!Array.from(track.values).every(Number.isFinite)) throw new Error('Non-finite rig track');
        if (track.ValueTypeName !== 'quaternion') continue;
        const v = track.values;
        for (let f = 0; f < v.length; f += 4) {
          maxNormError = Math.max(maxNormError, Math.abs(Math.hypot(v[f], v[f+1], v[f+2], v[f+3]) - 1));
          if (!f) continue;
          let dot = 0; for (let j = 0; j < 4; j++) dot += v[f+j] * v[f-4+j];
          maxStep = Math.max(maxStep, 2 * Math.acos(Math.min(1, Math.abs(dot))));
        }
        let dot = 0; for (let j = 0; j < 4; j++) dot += v[j] * v[v.length-4+j];
        seamError = Math.max(seamError, 1 - Math.abs(dot));
      }
      clips.push({ kind, duration: clip.duration, maxStep, maxNormError, seamError });
    }
    actor.mixer.setTime(12); actor.update(0, 12); actor.model.updateMatrixWorld(true);
    let tailoredBody = false;
    actor.model.traverse((node) => { if (node.isSkinnedMesh) { node.skeleton.update(); if (node.name.startsWith('wardrobe:bodice:')) tailoredBody = true; } });
    const bounds = new THREE.Box3().setFromObject(actor.model, true), size = bounds.getSize(new THREE.Vector3());
    window.results.push({ id: actor.config.id, style: actor.getChoreography().style, clips, tailoredBody, size: size.toArray() });
    actor.dispose();
  }
  window.ready = true;
` }, bundle: true, format: 'esm', target: 'es2022', write: false });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/choreography-rig-test', (route) => route.fulfill({ contentType: 'text/html', body: '<script type="module" src="/rig-test.js"></script>' }));
  await page.route('**/rig-test.js', (route) => route.fulfill({ contentType: 'text/javascript', body: result.outputFiles[0].text }));
  await page.goto(`${base}/choreography-rig-test`);
  await page.waitForFunction(() => window.ready, {}, { timeout: 60000 });
  const results = await page.evaluate(() => window.results);
  assert.equal(results.length, 5);
  assert.equal(new Set(results.map((item) => item.style)).size, 5);
  for (const character of results) {
    assert(character.tailoredBody, 'Tailored upper garment follows the hip and chest bones');
    assert(character.size.every((value) => Number.isFinite(value) && value > 0 && value < 5), `${character.id}: clothing stays inside the animated body bounds`);
    for (const clip of character.clips) {
    assert(clip.maxNormError < 0.0001, `${character.id}/${clip.kind}: normalized rig rotations`);
    assert(clip.maxStep < 0.44, `${character.id}/${clip.kind}: no knee or ankle pops after IK (${clip.maxStep})`);
    if (clip.kind === 'dance') assert(clip.seamError < 0.0001, `${character.id}: baked routine closes smoothly`);
    console.log(`PASS ${character.id}/${clip.kind}: max frame rotation ${clip.maxStep.toFixed(3)} rad, normalized joints and smooth loop.`);
    }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
