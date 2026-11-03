import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const motions = JSON.parse(await readFile('src/main/resources/static/animations/dance-motions.json', 'utf8'));
test('five body-specific 128-count routines have contact data and smooth connected phrases', () => {
  assert.equal(motions.version, 3);
  assert.equal(motions.bpm, 140);
  assert.equal(new Set(Object.values(motions.characters).map((item) => item.sourceClip)).size, 5);
  for (const character of Object.values(motions.characters)) {
    assert.equal(character.dance.beats, 128);
    assert.equal(character.dance.sections.length, 16);
    assert(character.dance.duration > 54);
    assert(character.sources.length >= 8);
    assert(character.style && ['male', 'female'].includes(character.body));
    for (const phrase of [character.dance, character.skill]) {
      const frames = phrase.positions.length / 3;
      assert.equal(phrase.contacts.length, 2);
      for (const contacts of phrase.contacts) {
        assert.equal(contacts.length, frames);
        assert(contacts.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
        assert(contacts.some((value) => value > 0.5), 'Foot plants were identified');
      }
      for (let i = 0; i < frames; i++) {
        assert(phrase.positions.slice(i * 3, i * 3 + 3).every(Number.isFinite));
        assert(Math.hypot(phrase.positions[i * 3], phrase.positions[i * 3 + 2]) <= 0.521);
      }
      for (const [name, values] of Object.entries(phrase.rotations)) {
        assert.equal(values.length, frames * 4);
        for (let i = 0; i < frames; i++) assert(Math.abs(Math.hypot(...values.slice(i * 4, i * 4 + 4)) - 1) < 0.0001);
        const dot = values.slice(0, 4).reduce((sum, value, index) => sum + value * values[values.length - 4 + index], 0);
        if (phrase === character.dance) assert(Math.abs(dot) > 0.9999, `${name}: loop closes without a pose jump`);
        for (let i = 4; i < values.length; i += 4) {
          const localDot = Math.abs(values.slice(i, i + 4).reduce((sum, value, index) => sum + value * values[i - 4 + index], 0));
          assert(2 * Math.acos(Math.min(1, localDot)) < 0.44, `${name}: no instant joint flip at a combo boundary`);
        }
      }
      for (const name of ['leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg']) {
        const values = phrase.rotations[name];
        assert(Math.max(...values.filter((_, index) => index % 4 === 0)) - Math.min(...values.filter((_, index) => index % 4 === 0)) > 0.025,
          `${character.sourceClip}/${name}: not a static pose`);
      }
    }
  }
});
