// Human captures: G1 Moves / Jasmine Coro / Experiential Technologies, CC BY 4.0.
// Body-specific 128-count routines with continuous pre-roll transitions.
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stylePose } from './choreography-style.mjs';

const revision = '895d064b2385725e6aabf540461c219afc3e0916';
const bpm = 140, fps = 30, beat = 60 / bpm;
const names = {
  gnarly: 'J_Dance11_Gnarly', go: 'J_Dance19_LetsGO', thrill: 'J_Dance22_Thrilling',
  west: 'J_Dance8_WestCoast', party: 'J_Dance7_Party', sassy: 'J_Dance6_Sassy',
  nineties: 'J_ShortDance15_Nineties', broadway: 'J_Dance4_Broadway',
  shuffle: 'J_Dance17_Shuffle', hype: 'J_Dance5_Hype', lush: 'J_Dance12_LushLife',
  salsa: 'J_Dance2_Salsa', woah: 'J_Dance3_Woah', blunt: 'J_Dance21_Blunt',
  dwg: 'J_Dance20_DWG', midnight: 'J_Dance23_MidnightSun', single: 'J_ShortDance13_SingleLadies'
};
const plans = {
  sakura: { body: 'female', style: 'sensual-club', strength: 1.1,
    dance: ['lush', 'sassy', 'single', 'gnarly', 'salsa', 'midnight', 'sassy', 'thrill', 'single', 'party', 'lush', 'gnarly', 'midnight', 'salsa', 'single', 'sassy'],
    phases: ['HIP EIGHT', 'SHOULDER ROLL', 'CROSS STEP', 'DOUBLE STEP', 'LATIN FLOW', 'BODY WAVE', 'ARM LINE', 'KICK CHANGE', 'HEEL TOE', 'HIP DROP', 'SLOW ROLL', 'QUICK STEP', 'RIB ISOLATION', 'PIVOT', 'HAND FLOURISH', 'VOGUE FINISH'],
    skill: ['single', 'gnarly', 'sassy'] },
  yuki: { body: 'female', style: 'silk-flow', strength: 0.8,
    dance: ['midnight', 'salsa', 'lush', 'single', 'broadway', 'sassy', 'shuffle', 'midnight', 'salsa', 'lush', 'shuffle', 'thrill', 'broadway', 'gnarly', 'midnight', 'salsa'],
    phases: ['SILK FLOW', 'CROSS STEP', 'BODY WAVE', 'WRIST LINE', 'PIVOT', 'SHOULDER ROLL', 'QUICK STEP', 'RIB WAVE', 'LATIN FLOW', 'HIP EIGHT', 'HAND FLOURISH', 'KICK CHANGE', 'CROSS TURN', 'SLOW ROLL', 'BODY LINE', 'ROYAL FINISH'],
    skill: ['broadway', 'single', 'midnight'] },
  akira: { body: 'male', style: 'cold-pop', strength: 1.1,
    dance: ['woah', 'blunt', 'dwg', 'shuffle', 'go', 'west', 'hype', 'gnarly', 'blunt', 'woah', 'shuffle', 'dwg', 'west', 'go', 'hype', 'nineties'],
    phases: ['CHEST POP', 'HEEL TOE', 'ARM LOCK', 'QUICK STEP', 'LEVEL DROP', 'BODY WAVE', 'SHOULDER HIT', 'KICK CHANGE', 'TUTTING ACCENT', 'RIB ISOLATION', 'DOUBLE STEP', 'KNEE SWITCH', 'ARM WAVE', 'PIVOT', 'POP COMBO', 'COLD FREEZE'],
    skill: ['dwg', 'shuffle', 'woah'] },
  luna: { body: 'female', style: 'midnight-vogue', strength: 1,
    dance: ['sassy', 'single', 'midnight', 'lush', 'salsa', 'broadway', 'gnarly', 'sassy', 'single', 'midnight', 'shuffle', 'lush', 'salsa', 'gnarly', 'broadway', 'sassy'],
    phases: ['VOGUE LINE', 'HIP EIGHT', 'SLOW ROLL', 'CROSS STEP', 'LATIN FLOW', 'HAND FLOURISH', 'QUICK STEP', 'SHOULDER ROLL', 'HEEL TOE', 'BODY WAVE', 'HIP DROP', 'RIB ISOLATION', 'PIVOT', 'ARM LINE', 'CROSS TURN', 'MIDNIGHT FINISH'],
    skill: ['single', 'sassy', 'broadway'] },
  hikari: { body: 'male', style: 'liquid-lock', strength: 0.9,
    dance: ['west', 'woah', 'nineties', 'blunt', 'shuffle', 'dwg', 'go', 'hype', 'woah', 'west', 'blunt', 'shuffle', 'nineties', 'dwg', 'go', 'hype'],
    phases: ['LIQUID WAVE', 'CHEST LOCK', 'HEEL TOE', 'RIB ISOLATION', 'DOUBLE STEP', 'SHOULDER HIT', 'PIVOT', 'KICK CHANGE', 'TUTTING ACCENT', 'ARM WAVE', 'LEVEL DROP', 'QUICK STEP', 'GLIDE FLOW', 'ARM LOCK', 'KNEE SWITCH', 'ROYAL FREEZE'],
    skill: ['blunt', 'dwg', 'west'] }
};
const boneMap = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes'
};
const round = (v) => Math.round(v * 100000) / 100000;
const smooth = (v) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const sources = new Map();
await mkdir('.run/mocap', { recursive: true });
await mkdir('src/main/resources/static/animations', { recursive: true });

await Promise.all(Object.entries(names).map(async ([key, name]) => {
  const url = `https://huggingface.co/datasets/exptech/g1-moves/resolve/${revision}/dance/${name}/capture/${name}.bvh`;
  let text;
  try { text = await readFile(`.run/mocap/${name}.bvh`, 'utf8'); }
  catch {
    const response = await fetch(url); if (!response.ok) throw new Error(`${name}: ${response.status}`);
    text = await response.text(); await writeFile(`.run/mocap/${name}.bvh`, text);
  }
  const { clip, skeleton } = new BVHLoader().parse(text);
  const tracks = new Map(clip.tracks.map((track) => [track.name, track.createInterpolant()]));
  const height = tracks.get('Hips.position').evaluate(0)[1];
  const rootBone = skeleton.bones[0];
  const mapped = Object.entries(boneMap).map(([source, target]) => ({ target, bone: skeleton.bones.find((b) => b.name === source), track: tracks.get(`${source}.quaternion`) }));
  const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((name) => skeleton.bones.find((bone) => bone.name === name));
  function pose(time) {
    time = THREE.MathUtils.clamp(time, 0, clip.duration);
    rootBone.position.fromArray(tracks.get('Hips.position').evaluate(time));
    const rotations = {};
    for (const { target, bone, track } of mapped) {
      bone.quaternion.fromArray(track.evaluate(time)); rotations[target] = bone.quaternion.clone();
    }
    rootBone.updateMatrixWorld(true);
    const points = feet.map((bone) => bone.getWorldPosition(new THREE.Vector3()));
    return { rotations, position: rootBone.position.clone(), feet: points,
      sole: Math.min(...points.map((point) => point.y)) };
  }
  const floors = []; for (let t = 0; t < clip.duration; t += 0.2) floors.push(pose(t).sole);
  floors.sort((a, b) => a - b); const ground = floors[Math.floor(floors.length * 0.08)];
  const scored = { female: [], male: [] };
  const a = new THREE.Quaternion(), b = new THREE.Quaternion();
  for (let start = 0.6; start + 4 < clip.duration - 0.3; start += 0.4) {
    let legs = 0, arms = 0, torso = 0;
    for (let t = start; t < start + 3.6; t += 0.16) {
      for (const item of mapped) {
        a.fromArray(item.track.evaluate(t)); b.fromArray(item.track.evaluate(t + 0.16));
        const energy = a.angleTo(b);
        if (/Leg|Foot/.test(item.target)) legs += energy;
        else if (/Arm|Hand/.test(item.target)) arms += energy;
        else if (/hips|spine|chest/.test(item.target)) torso += energy;
      }
    }
    scored.female.push({ start, score: torso * 2.6 + arms * 0.55 + legs * 0.7 });
    scored.male.push({ start, score: legs * 1.5 + arms * 0.85 + torso * 1.2 });
  }
  const windows = {};
  for (const body of ['female', 'male']) {
    scored[body].sort((a, b) => b.score - a.score); windows[body] = [];
    for (const candidate of scored[body]) if (windows[body].every((item) => Math.abs(candidate.start - item.start) > 2)) windows[body].push(candidate);
    if (!windows[body].length) windows[body].push({ start: 0.6, score: 0 });
    windows[body] = windows[body].filter((item) => item.score >= windows[body][0].score * 0.72).slice(0, 4);
  }
  sources.set(key, { name, url, hash: createHash('sha256').update(text).digest('hex'), height, ground, pose, windows });
}));

function prepareSection(key, ordinal, beats, phase, plan) {
  const source = sources.get(key);
  const windows = source.windows[plan.body], window = windows[ordinal % windows.length];
  const nativeDuration = beats === 8 ? 3.6 : 1.95;
  const start = source.pose(window.start), finish = source.pose(window.start + nativeDuration);
  const yaw = new THREE.Euler().setFromQuaternion(start.rotations.hips, 'YXZ').y;
  const heading = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const travel = finish.position.clone().sub(start.position); travel.y = 0;
  return {
    info: { source: source.name, sourceStart: round(window.start), beats, phase, score: round(window.score) },
    sample(u) {
      const p = source.pose(window.start + u * nativeDuration);
      const before = source.pose(window.start + u * nativeDuration - 0.025);
      const after = source.pose(window.start + u * nativeDuration + 0.025);
      p.rotations.hips.premultiply(heading);
      p.position.sub(start.position).addScaledVector(travel, -smooth(u)).applyQuaternion(heading).divideScalar(source.height);
      p.position.y += 1;
      p.flight = Math.max(0, Math.min(0.35, (p.sole - source.ground - 0.012) / source.height));
      p.contacts = [0, 1].map((side) => {
        const sole = Math.min(p.feet[side].y, p.feet[side + 2].y);
        const speed = after.feet[side].distanceTo(before.feet[side]) / (0.05 * source.height);
        return THREE.MathUtils.clamp(1 - (sole - source.ground) / (0.07 * source.height), 0, 1)
          * (1 - smooth((speed - 0.2) / 0.65));
      });
      return p;
    }
  };
}

function buildPhrase(keys, plan, special) {
  const beatsPerSection = special ? 4 : 8;
  const sectionDuration = beatsPerSection * beat, duration = sectionDuration * keys.length;
  const phases = special ? ['SIGNATURE ACCENT', 'TECHNICAL COMBO', 'FINISH POSE'] : plan.phases;
  const sections = keys.map((key, index) => prepareSection(key, index + (special ? 3 : 0), beatsPerSection, phases[index], plan));
  const samples = Math.round(duration * fps);
  const rotations = Object.fromEntries(Object.values(boneMap).map((name) => [name, []]));
  const positions = [], flight = [], contacts = [[], []];
  for (let i = 0; i <= samples; i++) {
    const time = i * duration / samples;
    const index = Math.min(keys.length - 1, Math.floor(time / sectionDuration));
    let u = (time - index * sectionDuration) / sectionDuration;
    if (special && index === keys.length - 1) u = u > 0.68 ? 0.68 + 0.18 * smooth((u - 0.68) / 0.32) : u;
    let p = sections[index].sample(u);
    const overlap = 0.5;
    const blend = smooth((u * sectionDuration - sectionDuration + overlap) / overlap);
    if (blend > 0 && (!special || index < sections.length - 1)) {
      const next = sections[(index + 1) % sections.length].sample(u - 1);
      for (const name of Object.keys(rotations)) p.rotations[name].slerp(next.rotations[name], blend);
      p.position.lerp(next.position, blend); p.flight = THREE.MathUtils.lerp(p.flight, next.flight, blend);
      p.contacts = p.contacts.map((value, side) => THREE.MathUtils.lerp(value, next.contacts[side], blend));
    }
    p = stylePose(p, plan, time / beat, index, special);
    const radius = Math.hypot(p.position.x, p.position.z);
    if (radius > 0.48) { p.position.x *= 0.48 / radius; p.position.z *= 0.48 / radius; }
    for (const [name, q] of Object.entries(p.rotations)) rotations[name].push(...q.normalize().toArray().map(round));
    positions.push(...p.position.toArray().map(round)); flight.push(round(p.flight));
    p.contacts.forEach((value, side) => contacts[side].push(round(value)));
  }
  // Remove capture jitter and cap isolated quaternion spikes, preserving the
  // deliberate fast steps. Two directions avoid accumulating a time lag.
  const previous = new THREE.Quaternion(), current = new THREE.Quaternion(), next = new THREE.Quaternion();
  for (const [name, values] of Object.entries(rotations)) {
    const original = values.slice();
    for (let i = 1; i < samples; i++) {
      previous.fromArray(original, (i - 1) * 4); current.fromArray(original, i * 4); next.fromArray(original, (i + 1) * 4);
      current.slerp(previous, 0.15).slerp(next, 0.15).normalize().toArray(values, i * 4);
    }
    const limit = /hips|spine|chest|neck|head/.test(name) ? 0.3 : 0.42;
    for (const direction of [1, -1]) {
      for (let k = 1; k <= samples; k++) {
        const i = direction === 1 ? k : samples - k;
        previous.fromArray(values, (i - direction) * 4); current.fromArray(values, i * 4);
        previous.rotateTowards(current, limit).toArray(values, i * 4);
      }
    }
    for (let i = 0; i < values.length; i++) values[i] = round(values[i]);
  }
  if (!special) {
    for (const values of Object.values(rotations)) values.splice(values.length - 4, 4, ...values.slice(0, 4));
    positions.splice(positions.length - 3, 3, ...positions.slice(0, 3)); flight[flight.length - 1] = flight[0];
    for (const values of contacts) values[values.length - 1] = values[0];
  }
  return { duration: round(duration), beats: keys.length * beatsPerSection, rotations, positions, flight, contacts,
    sections: sections.map((section, index) => ({ ...section.info, start: round(index * sectionDuration), duration: round(sectionDuration) })) };
}

const output = { version: 3, bpm, fps, source: 'G1 Moves', revision, license: 'CC-BY-4.0', characters: {} };
for (const [id, plan] of Object.entries(plans)) {
  const source = sources.get(plan.dance[0]);
  const used = [...new Set([...plan.dance, ...plan.skill])].map((key) => sources.get(key));
  output.characters[id] = { sourceClip: source.name, sourceUrl: source.url, hipsHeight: 1, body: plan.body, style: plan.style,
    sources: used.map((item) => ({ name: item.name, url: item.url, sha256: item.hash })),
    dance: buildPhrase(plan.dance, plan, false), skill: buildPhrase(plan.skill, plan, true) };
  console.log(`${id}: ${plan.style} / 128 counts / 16 phrases / ${used.length} captures / ${output.characters[id].dance.duration}s`);
}
await writeFile('src/main/resources/static/animations/dance-motions.json', JSON.stringify(output));
