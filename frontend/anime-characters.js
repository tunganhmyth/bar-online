import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMHumanoid, VRMNodeConstraintManager, VRMUtils } from '@pixiv/three-vrm';
import { loadDanceMotions, createDanceClip } from './dance-motions.js';
import { dressCharacter } from './character-costumes.js';
import { createDanceHands } from './dance-hands.js';

export const CHARACTERS = Object.freeze([
  { id: 'sakura', name: 'Sakura', title: 'Nữ · Dân chơi phố đêm', body: 'female', outfit: 'club', dance: 'Sensual Club · 128 nhịp', skill: 'Vũ điệu hoa anh đào',
    accent: '#ff82bd', hair: '#e7abc8', top: '#be3c76', bottom: '#211d32', trim: '#dbbfd8', eyes: '#bd4a91', hairLength: 1, accessory: 'crystalPins' },
  { id: 'yuki', name: 'Yuki', title: 'Nữ · Công chúa băng', body: 'female', outfit: 'princess', dance: 'Silk Flow · 128 nhịp', skill: 'Vương miện băng giá',
    accent: '#75e6ff', hair: '#e4efff', top: '#edf8ff', bottom: '#91bfda', trim: '#dcefff', eyes: '#2a8bcc', hairLength: 0.8, accessory: 'crown' },
  { id: 'akira', name: 'Akira', title: 'Nam · Dân chơi cyber', body: 'male', outfit: 'street', dance: 'Cold Pop · 128 nhịp', skill: 'Bùng nổ điện quang',
    accent: '#a68bff', hair: '#323441', top: '#171b29', bottom: '#111522', trim: '#a9bad2', eyes: '#7e52dd', hairLength: 1, accessory: 'headphones' },
  { id: 'luna', name: 'Luna', title: 'Nữ · Quý tộc ánh trăng', body: 'female', outfit: 'noble', dance: 'Midnight Vogue · 128 nhịp', skill: 'Ngân hà nguyệt vũ',
    accent: '#cdb0ff', hair: '#a798bf', top: '#30213e', bottom: '#281c37', trim: '#d6b17b', eyes: '#8f5cb3', hairLength: 1.15, accessory: 'moon' },
  { id: 'hikari', name: 'Hikari', title: 'Nam · Hoàng tử bình minh', body: 'male', outfit: 'prince', dance: 'Liquid Lock · 128 nhịp', skill: 'Đôi cánh bình minh',
    accent: '#ffdb85', hair: '#ffe5ac', top: '#f3eddf', bottom: '#19263f', trim: '#d5ad67', eyes: '#c59a3d', hairLength: 1, accessory: 'royalCrown' }
]);

const sharedGeometry = new Map();
const geometry = (key, make) => {
  if (!sharedGeometry.has(key)) sharedGeometry.set(key, make());
  return sharedGeometry.get(key);
};
const TAU = Math.PI * 2;

function desaturateTexture(texture, cache) {
  if (!texture?.image) return texture;
  if (cache.has(texture)) return cache.get(texture);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(texture.image.width, 1024); canvas.height = Math.min(texture.image.height, 1024);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = Math.min(255, Math.pow((image.data[i] * 0.3 + image.data[i + 1] * 0.59 + image.data[i + 2] * 0.11) / 255, 0.55) * 285);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = gray;
  }
  ctx.putImageData(image, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace; result.flipY = texture.flipY;
  result.wrapS = texture.wrapS; result.wrapT = texture.wrapT;
  cache.set(texture, result);
  return result;
}

function decorate(head, config, materials, legacy, sourceHeight) {
  const group = new THREE.Group();
  const inverseRest = head.getWorldQuaternion(new THREE.Quaternion()).invert();
  group.quaternion.copy(inverseRest);
  if (legacy) group.rotateY(Math.PI);
  const crown = config.accessory === 'crown' || config.accessory === 'royalCrown';
  group.position.set(0, crown ? 0.05 : 0.12, 0).applyQuaternion(inverseRest);
  group.scale.setScalar(sourceHeight / 1.615);
  head.add(group);
  const color = new THREE.MeshToonMaterial({ color: config.accent });
  const white = new THREE.MeshToonMaterial({ color: '#fff2ff' });
  const glow = new THREE.MeshBasicMaterial({ color: config.accent, toneMapped: false });
  materials.push(color, white, glow);
  const mesh = (shape, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const item = new THREE.Mesh(shape, material); item.position.set(x, y, z); item.scale.set(sx, sy, sz); group.add(item); return item;
  };
  const sphere = geometry('sphere', () => new THREE.SphereGeometry(1, 16, 12));
  const crystal = geometry('crystal', () => new THREE.OctahedronGeometry(1));
  if (config.accessory === 'crystalPins') {
    for (let i = 0; i < 3; i++) {
      const pin = mesh(crystal, glow, -0.105 - i * 0.015, 0.12 - i * 0.025, 0.058, 0.01, 0.026, 0.007); pin.rotation.z = -0.5;
    }
    for (const side of [-1, 1]) mesh(crystal, color, side * 0.105, -0.035, 0.045, 0.009, 0.023, 0.007);
  } else if (config.accessory === 'ribbon') {
    for (const side of [-1, 1]) {
      const bow = mesh(sphere, color, -0.105 + side * 0.045, 0.17, 0.025, 0.056, 0.032, 0.018);
      bow.rotation.z = side * 0.4;
      const tail = mesh(geometry('ribbon', () => new THREE.ConeGeometry(0.026, 0.1, 3)), color,
        -0.105 + side * 0.022, 0.115, 0.01); tail.rotation.z = side * 0.3 + Math.PI;
    }
    mesh(sphere, white, -0.105, 0.17, 0.041, 0.02, 0.02, 0.015);
  } else if (config.accessory === 'crown' || config.accessory === 'royalCrown') {
    const band = mesh(geometry('crown-ring', () => new THREE.TorusGeometry(0.1, 0.009, 6, 32)), glow, 0, 0.18, -0.01);
    band.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) mesh(crystal, config.accessory === 'royalCrown' ? color : white, (i - 2) * 0.042, 0.2 + (2 - Math.abs(i - 2)) * 0.012, 0.04, 0.014, 0.04, 0.012);
  } else if (config.accessory === 'headphones') {
    mesh(geometry('headphone-band', () => new THREE.TorusGeometry(0.135, 0.014, 8, 24, Math.PI)), color, 0, 0.04, -0.015);
    for (const side of [-1, 1]) {
      mesh(sphere, color, side * 0.132, 0.03, 0, 0.03, 0.052, 0.038);
      mesh(sphere, glow, side * 0.157, 0.03, 0.008, 0.008, 0.032, 0.025);
    }
  } else if (config.accessory === 'moon') {
    const crescent = mesh(geometry('crescent-accessory', () => crescentGeometry(0.05, 0.016)), glow, -0.11, 0.13, 0.035);
    crescent.rotation.z = -0.3;
    for (const side of [-1, 1]) mesh(crystal, glow, side * 0.112, -0.025, 0.027, 0.011, 0.025, 0.008);
  } else {
    const halo = mesh(geometry('halo', () => new THREE.TorusGeometry(0.13, 0.008, 8, 48)), glow, 0, 0.28, 0);
    halo.rotation.x = Math.PI / 2 - 0.16;
    for (const side of [-1, 1]) {
      const pin = mesh(sphere, white, side * 0.115, 0.12, 0.02, 0.055, 0.018, 0.012); pin.rotation.z = side * 0.45;
    }
  }
  return group;
}

function crescentGeometry(radius, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(0, radius);
  shape.bezierCurveTo(-radius * 1.3, radius, -radius * 1.3, -radius, 0, -radius);
  shape.bezierCurveTo(-radius * 0.55, -radius * 0.45, -radius * 0.55, radius * 0.45, 0, radius);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
}

export async function loadAnimeTemplate() {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const [female, male, motions] = await Promise.all([
    loader.loadAsync('/models/anime-dancer.vrm'), loader.loadAsync('/models/anime-male.vrm'), loadDanceMotions()
  ]);
  const models = {};
  for (const [body, gltf] of [['female', female], ['male', male]]) {
    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('Không đọc được model anime.');
    for (const collider of vrm.springBoneManager?.colliders || []) collider.removeFromParent();
    VRMUtils.combineSkeletons(vrm.scene);
    vrm.scene.updateMatrixWorld(true);
    const sourceHeight = new THREE.Box3().setFromObject(vrm.scene).getSize(new THREE.Vector3()).y;
    const scale = (body === 'male' ? 2.25 : 2.1) / sourceHeight;
    models[body] = { vrm, scale, sourceHeight, legacy: vrm.meta.metaVersion === '0', motions, clips: new Map(), neutralTextures: new Map(), hairGeometries: new Map(), costumeGeometries: new Map() };
  }
  return { models };
}

export function createAnimeActor(library, index, seed = 0, stageTime = 0) {
  const config = CHARACTERS[index];
  const template = library.models[config.body];
  const model = cloneSkeleton(template.vrm.scene);
  // The template's normalized rig is replaced with a rig bound to this clone.
  const oldNormalized = model.getObjectByName(template.vrm.humanoid.normalizedHumanBonesRoot.name);
  oldNormalized?.removeFromParent();
  const humanBones = Object.fromEntries(Object.entries(template.vrm.humanoid.rawHumanBones)
    .map(([name, { node }]) => [name, { node: model.getObjectByName(node.name) }]));
  const humanoid = new VRMHumanoid(humanBones);
  model.add(humanoid.normalizedHumanBonesRoot);
  const constraints = new VRMNodeConstraintManager();
  for (const original of template.vrm.nodeConstraintManager?.constraints || []) {
    const constraint = new original.constructor(model.getObjectByName(original.destination.name), model.getObjectByName(original.source.name));
    constraint.weight = original.weight;
    if ('aimAxis' in original) constraint.aimAxis = original.aimAxis;
    if ('rollAxis' in original) constraint.rollAxis = original.rollAxis;
    constraints.addConstraint(constraint);
  }
  constraints.setInitState();
  const materials = [];
  const materialClones = new Map();
  model.traverse((node) => {
    if (!node.isMesh) return;
    const cloneMaterial = (original) => {
      if (materialClones.has(original)) return materialClones.get(original);
      const material = original.clone();
      const name = original.name;
      let tint;
      if (/HAIR/.test(name)) tint = config.hair;
      else if (/Tops/.test(name)) tint = config.top;
      else if (/Bottoms|Shoes/.test(name)) tint = config.bottom;
      else if (/EyeIris/.test(name)) tint = config.eyes;
      if (tint) {
        material.map = desaturateTexture(original.map, template.neutralTextures);
        if (material.shadeMultiplyTexture) material.shadeMultiplyTexture = desaturateTexture(original.shadeMultiplyTexture, template.neutralTextures);
        material.color.set(tint);
        material.shadeColorFactor?.set(tint).multiplyScalar(0.78);
      }
      if (material.isMToonMaterial) {
        material.giEqualizationFactor = 1;
        material.outlineWidthFactor = /SKIN|HAIR/.test(name) ? 0.00045 : 0.0006;
      }
      materialClones.set(original, material); materials.push(material);
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    node.frustumCulled = false;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    if (['princess', 'noble'].includes(config.outfit) && list.every((material) => /Body.*SKIN/.test(material.name))) {
      // Skin hidden beneath a full skirt must not poke through it on knee lifts.
      const key = `${config.outfit}:lining:${node.geometry.uuid}`;
      if (!template.costumeGeometries.has(key)) {
        const lining = node.geometry.clone();
        const positions = lining.attributes.position;
        const kept = [];
        const indices = lining.index;
        const floor = config.outfit === 'princess' ? 0.12 : 0.36;
        for (let i = 0; i < indices.count; i += 3) {
          const tri = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
          const heights = tri.map((vertex) => positions.getY(vertex));
          if (!(Math.min(...heights) > floor && Math.max(...heights) < 1.02)) kept.push(...tri);
        }
        lining.setIndex(kept); template.costumeGeometries.set(key, lining);
      }
      node.geometry = template.costumeGeometries.get(key);
    }
    if (config.body === 'female' && list.every((material) => /Bottoms/.test(material.name))) node.visible = false;
    if (list.every((material) => /Tops/.test(material.name))) node.visible = false;
    if (config.body === 'female' && list.some((material) => /HAIR/.test(material.name))) {
      const key = `${index}:${node.geometry.uuid}`;
      if (!template.hairGeometries.has(key)) {
        const modified = node.geometry.clone();
        const positions = modified.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          if (positions.getY(i) < 1.42) positions.setY(i, 1.42 - (1.42 - positions.getY(i)) * config.hairLength);
        }
        positions.needsUpdate = true; modified.computeVertexNormals();
        template.hairGeometries.set(key, modified);
      }
      node.geometry = template.hairGeometries.get(key);
    }
  });
  decorate(humanoid.getRawBoneNode('head'), config, materials, template.legacy, template.sourceHeight);
  const wardrobe = dressCharacter(humanoid, config, materials, template.legacy, template.sourceHeight);
  const mixer = new THREE.AnimationMixer(model);
  const motion = template.motions.characters[config.id];
  if (!template.clips.has(index)) template.clips.set(index, {
    dance: createDanceClip(humanoid, motion, false, template.legacy),
    special: createDanceClip(humanoid, motion, true, template.legacy)
  });
  const clips = template.clips.get(index);
  const dance = mixer.clipAction(clips.dance);
  const special = mixer.clipAction(clips.special);
  special.setLoop(THREE.LoopOnce, 1); special.clampWhenFinished = true;
  const beatSeconds = 60 / template.motions.bpm;
  const phaseOffset = (seed % 8) * 8 * beatSeconds;
  let timeline = stageTime;
  dance.play(); dance.time = (phaseOffset + timeline) % dance.getClip().duration;
  model.scale.setScalar(template.scale);
  if (template.legacy) model.rotation.y = Math.PI;
  let skillActive = false;
  let skillBlend = 0;
  const updateHands = createDanceHands(humanoid, config.body, template.legacy);
  const faceMeshes = [];
  model.traverse((node) => { if (node.morphTargetDictionary) faceMeshes.push(node); });
  return {
    model, materials, mixer, config, dance, special, motionSource: motion.sourceClip, labelHeight: config.body === 'male' ? 2.85 : 2.58,
    setSkill(enabled) {
      if (skillActive === enabled) return;
      skillActive = enabled;
      if (enabled) { special.reset().setEffectiveWeight(1).play(); dance.crossFadeTo(special, 0.5, false); }
      else {
        dance.enabled = true; dance.setEffectiveWeight(1).play();
        dance.time = (phaseOffset + timeline) % dance.getClip().duration;
        special.crossFadeTo(dance, 0.55, false);
      }
    },
    getChoreography() {
      const routine = skillActive ? motion.skill : motion.dance;
      const time = skillActive ? special.time : dance.time;
      const section = routine.sections.findIndex((item, index, list) => time >= item.start && (index === list.length - 1 || time < list[index + 1].start));
      return { style: motion.style, bpm: template.motions.bpm, beats: routine.beats, duration: routine.duration,
        combo: section + 1, comboCount: routine.sections.length, phase: routine.sections[section]?.phase, time };
    },
    update(delta, time) {
      timeline = time;
      updateHands((skillActive ? special.time : dance.time) / beatSeconds, skillActive);
      wardrobe.update(time);
      humanoid.update();
      constraints.update();
      skillBlend = THREE.MathUtils.damp(skillBlend, skillActive ? 1 : 0, 8, delta);
      const blink = Math.pow(Math.max(0, Math.cos((time + seed % 7) * 1.3)), 38);
      for (const face of faceMeshes) {
        for (const [name, target] of Object.entries(face.morphTargetDictionary)) {
          if (/blink|eye_close$/i.test(name)) face.morphTargetInfluences[target] = blink;
          else if (/happy|joy/i.test(name)) face.morphTargetInfluences[target] = config.body === 'female' ? 0.08 + skillBlend * 0.22 : 0;
        }
      }
    },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      const skeletons = new Set(); model.traverse((node) => { if (node.isSkinnedMesh) skeletons.add(node.skeleton); });
      skeletons.forEach((skeleton) => skeleton.dispose()); materials.forEach((material) => material.dispose());
    }
  };
}

export { createSignatureEffect } from './character-effects.js';
