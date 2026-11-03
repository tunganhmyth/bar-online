import * as THREE from 'three';
import { CHARACTERS, createAnimeActor } from './anime-characters.js';
import { createSongMarquee } from './song-marquee.js';
import { createFeatherWings } from './feather-wings.js';

const TIERS = [
  { rank: 1, x: 0, height: 1.8, color: '#ffd37a', scale: 1.22 },
  { rank: 2, x: -3.8, height: 1.1, color: '#8ce5ff', scale: 1.08 },
  { rank: 3, x: 3.8, height: 0.9, color: '#f9a3be', scale: 1.08 }
];
const Z = -8.3;
export const TOP_ROLES = Object.freeze(['Cơ Trưởng', 'Cơ Phó', 'Tiếp viên']);

export function createTopGifterStage(scene, labelRoot) {
  const root = new THREE.Group(); root.name = 'top-gifters-dj-stage'; scene.add(root);
  const slots = new Map();
  const geometries = [], materials = [], textures = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1); geometries.push(boxGeometry);
  const black = new THREE.MeshStandardMaterial({ color: '#12101d', roughness: 0.45, metalness: 0.5 }); materials.push(black);
  let library = null, leaders = [], demo = false;
  const projection = new THREE.Vector3();
  function box(parent, dimensions, position, material) {
    const mesh = new THREE.Mesh(boxGeometry, material); mesh.scale.set(...dimensions); mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  function neon(color) { const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) }); materials.push(material); return material; }
  const floorGlow = neon('#aa73f5');
  box(root, [12.5, 0.24, 2.7], [0, 0.12, Z + 0.15], black);
  box(root, [12.6, 0.035, 0.04], [0, 0.25, Z + 1.51], floorGlow);
  const songMarquee = createSongMarquee(root, [0, 0.69, Z + 1.63]);
  const discGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.045, 32); geometries.push(discGeometry);
  const rimGeometry = new THREE.TorusGeometry(0.29, 0.015, 6, 40); geometries.push(rimGeometry);
  const bars = [];
  for (const tier of TIERS) {
    const group = new THREE.Group(); group.position.set(tier.x, tier.height, Z); root.add(group);
    const accent = neon(tier.color);
    box(root, [3.45, tier.height - 0.24, 2.1], [tier.x, (tier.height + 0.24) / 2, Z + 0.25], black);
    box(root, [3.5, 0.035, 0.04], [tier.x, 0.3, Z + 1.32], accent);
    box(group, [3.5, 0.24, 2.15], [0, -0.12, 0.25], black);
    box(group, [3.55, 0.035, 0.05], [0, 0.015, 1.32], accent);
    box(group, [3.15, 0.78, 0.14], [0, 0.41, 1.29], black);
    box(group, [3.32, 0.08, 1.08], [0, 0.85, 0.84], black);
    box(group, [3.35, 0.025, 0.045], [0, 0.9, 1.39], accent);
    for (const direction of [-1, 1]) {
      box(group, [0.025, 0.75, 0.04], [direction * 1.57, 0.42, 1.385], accent);
      const platter = new THREE.Mesh(discGeometry, black); platter.position.set(direction * 0.91, 0.92, 0.83); group.add(platter);
      const rim = new THREE.Mesh(rimGeometry, accent); rim.rotation.x = -Math.PI / 2; rim.position.copy(platter.position); rim.position.y += 0.025; group.add(rim);
    }
    for (let i = 0; i < 6; i++) box(group, [0.075, 0.02, 0.075], [(i % 3 - 1) * 0.14, 0.91, 0.75 + Math.floor(i / 3) * 0.15], accent);
    const laptop = box(group, [0.5, 0.33, 0.035], [0.45, 1.12, 0.6], black); laptop.rotation.x = -0.12;
    box(group, [0.41, 0.23, 0.015], [0.45, 1.12, 0.625], accent);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0e101c'; ctx.fillRect(0, 0, 512, 160);
    ctx.textAlign = 'center'; ctx.fillStyle = tier.color; ctx.font = '900 62px Arial'; ctx.fillText(`TOP ${tier.rank}`, 256, 74);
    ctx.font = '18px Arial'; ctx.fillStyle = '#ad9cb7'; ctx.fillText('GIFT STARS', 256, 114);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const face = new THREE.MeshBasicMaterial({ map: texture }); materials.push(face);
    const plateGeometry = new THREE.PlaneGeometry(1.2, 0.4); geometries.push(plateGeometry);
    const plate = new THREE.Mesh(plateGeometry, face); plate.position.set(0, 0.45, 1.39); group.add(plate);
    for (let i = 0; i < 8; i++) for (const direction of [-1, 1]) {
      const bar = box(group, [0.055, 0.1, 0.02], [direction * (0.72 + i * 0.09), 0.2, 1.39], accent);
      bars.push({ mesh: bar, phase: i + tier.rank * 2 });
    }
    const figure = new THREE.Group(); figure.scale.setScalar(tier.scale); group.add(figure);
    const haloGeometry = new THREE.TorusGeometry(tier.rank === 1 ? 0.62 : 0.5, 0.012, 6, 64); geometries.push(haloGeometry);
    const halo = new THREE.Mesh(haloGeometry, accent); halo.position.set(0, 1.8, -0.24); figure.add(halo);
    const wings = createFeatherWings({ accent: tier.color }), regalia = wings.root;
    regalia.scale.setScalar(0.78); regalia.position.y = 0.28; figure.add(regalia);
    const label = document.createElement('div'); label.className = 'podium-label'; label.dataset.rank = String(tier.rank);
    label.style.setProperty('--rank-color', tier.color);
    const rank = document.createElement('small'); rank.textContent = `${tier.rank === 1 ? '♛ ' : '✧ '}TOP ${tier.rank}`;
    const name = document.createElement('strong'); name.textContent = 'Chờ ngôi sao';
    const score = document.createElement('span'); score.textContent = TOP_ROLES[tier.rank - 1];
    label.append(rank, name, score); labelRoot.append(label);
    halo.visible = false; regalia.visible = false;
    slots.set(tier.rank, { tier, group, figure, halo, regalia, wings, label, rank, name, score, avatar: null, entry: null, characterId: null });
  }

  function release(slot) {
    if (slot.avatar) { slot.avatar.dispose(); slot.avatar.model.removeFromParent(); }
    slot.avatar = null; slot.entry = null; slot.characterId = null;
  }
  function render(time = 0) {
    for (const slot of slots.values()) {
      const entry = leaders.find((item) => item.rank === slot.tier.rank);
      const changed = entry?.uniqueId !== slot.entry?.uniqueId || entry?.characterId !== slot.characterId;
      if (changed) release(slot);
      slot.entry = entry || null;
      if (entry && library && !slot.avatar) {
        const index = Math.max(0, CHARACTERS.findIndex((character) => character.id === entry.characterId));
        const seed = [...entry.uniqueId].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
        slot.avatar = createAnimeActor(library, index, seed, time);
        slot.figure.add(slot.avatar.model); slot.characterId = CHARACTERS[index].id;
      }
      slot.halo.visible = !!entry; slot.regalia.visible = !!entry;
      slot.rank.textContent = `${slot.tier.rank === 1 ? '♛ ' : '✧ '}TOP ${slot.tier.rank}${demo ? ' · XEM THỬ' : ''}`;
      slot.name.textContent = entry?.nickname || 'Chờ ngôi sao'; slot.name.title = entry?.nickname || '';
      slot.score.textContent = TOP_ROLES[slot.tier.rank - 1];
      slot.label.classList.toggle('is-empty', !entry);
    }
  }
  render();
  return {
    setNowPlaying(track) { songMarquee.setTrack(track); },
    getNowPlaying() { return songMarquee.getSnapshot(); },
    getCameraSubjects() {
      return [...slots.values()].filter((slot) => slot.entry && slot.avatar).map((slot) => ({
        rank: slot.tier.rank, uniqueId: slot.entry.uniqueId, nickname: slot.entry.nickname,
        position: slot.group.position.clone(), scale: slot.tier.scale, accent: slot.avatar.config.accent
      }));
    },
    setLibrary(value, time) { library = value; render(time); },
    setLeaders(value, isDemo = false, time = 0) { leaders = value.slice(0, 3); demo = isDemo; render(time); },
    update(delta, time, camera, width, height, hideLabels, focusedRank = null, softFocus = false) {
      songMarquee.update(delta, hideLabels ? 0.18 : focusedRank !== null || softFocus ? 0.5 : 1);
      bars.forEach(({ mesh, phase }) => { const h = 0.1 + (0.5 + 0.5 * Math.sin(time * 3.4 + phase)) * 0.24; mesh.scale.y = h; mesh.position.y = 0.14 + h / 2; });
      for (const slot of slots.values()) {
        slot.avatar?.mixer.update(delta); slot.avatar?.update(delta, time);
        slot.wings.update(time, slot.entry ? 1 : 0, focusedRank === slot.tier.rank ? 1 : 0.88);
        slot.halo.rotation.z = Math.sin(time * 0.35) * 0.1;
        slot.halo.visible = !!slot.entry && focusedRank !== slot.tier.rank;
        slot.regalia.visible = !!slot.entry;
        projection.set(slot.tier.x, slot.tier.height + (slot.avatar?.labelHeight || 2.5) * slot.tier.scale, Z).project(camera);
        slot.label.classList.toggle('is-focused', focusedRank === slot.tier.rank);
        slot.label.hidden = hideLabels || (focusedRank !== null && focusedRank !== slot.tier.rank)
          || projection.z < -1 || projection.z > 1 || Math.abs(projection.x) > 1.15 || Math.abs(projection.y) > 1.1;
        if (!slot.label.hidden) slot.label.style.transform = `translate(-50%, -100%) translate(${(projection.x * 0.5 + 0.5) * width}px, ${(-projection.y * 0.5 + 0.5) * height}px)`;
      }
    },
    getSnapshot() { return { demo, count: [...slots.values()].filter((slot) => slot.avatar).length,
      leaders: [...slots.values()].filter((slot) => slot.entry).map((slot) => ({ ...slot.entry, characterId: slot.characterId || slot.entry.characterId, position: slot.group.position.toArray(), animated: !!slot.avatar, wings: slot.wings.getSnapshot() })) }; },
    dispose() {
      songMarquee.dispose();
      slots.forEach((slot) => { release(slot); slot.wings.dispose(); slot.label.remove(); });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); textures.forEach((item) => item.dispose()); root.removeFromParent();
    }
  };
}
