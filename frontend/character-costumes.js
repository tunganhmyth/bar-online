import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const shapes = new Map(), fabrics = new Map();
const shared = (name, make) => { if (!shapes.has(name)) shapes.set(name, make()); return shapes.get(name); };
function fabric(kind) {
  if (fabrics.has(kind)) return fabrics.get(kind);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = kind === 'leather' ? '#d2d2d2' : '#dfe0e4'; ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 8); ctx.stroke(); }
  if (kind === 'brocade') {
    ctx.strokeStyle = '#c6c9d0'; ctx.lineWidth = 1.4;
    for (let y = -32; y < 288; y += 64) for (let x = -32; x < 288; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, y - 23); ctx.bezierCurveTo(x + 22, y - 8, x + 22, y + 8, x, y + 23);
      ctx.bezierCurveTo(x - 22, y + 8, x - 22, y - 8, x, y - 23); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 2);
  fabrics.set(kind, texture); return texture;
}

function mount(bone, legacy, size) {
  const group = new THREE.Group(); group.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (legacy) group.rotateY(Math.PI);
  group.scale.setScalar(size); bone.add(group); return group;
}

export function dressCharacter(humanoid, config, materials, legacy, sourceHeight) {
  const size = sourceHeight / 1.615, frames = [], moving = [];
  const frame = (name) => {
    const group = mount(humanoid.getRawBoneNode(name), legacy, size); group.name = `wardrobe:${name}`; frames.push(group); return group;
  };
  const hip = frame('hips'), chest = frame('chest'), head = frame('head');
  const satin = (name, color, kind = 'satin') => {
    const material = new THREE.MeshStandardMaterial({ name, color, map: fabric(kind), roughness: kind === 'leather' ? 0.45 : 0.58,
      metalness: kind === 'leather' ? 0.12 : 0.06, emissive: color, emissiveIntensity: 0.035, side: THREE.DoubleSide });
    materials.push(material); return material;
  };
  const cloth = satin('skirt', config.bottom, ['princess', 'noble'].includes(config.outfit) ? 'brocade' : 'leather');
  const upper = satin('jacket', config.top, config.outfit === 'street' ? 'leather' : 'satin');
  const dark = satin('lining', '#131724');
  const velvet = satin('velvet', config.outfit === 'prince' ? '#172b4d' : '#24192f', 'brocade');
  const metal = new THREE.MeshStandardMaterial({ name: 'binding', color: config.trim, metalness: 0.65, roughness: 0.28,
    emissive: config.trim, emissiveIntensity: 0.08 });
  const jewel = new THREE.MeshPhysicalMaterial({ name: 'gem', color: config.accent, metalness: 0.18, roughness: 0.16,
    clearcoat: 0.9, emissive: config.accent, emissiveIntensity: 0.15 });
  materials.push(metal, jewel);
  const sphere = shared('sphere', () => new THREE.SphereGeometry(1, 12, 8));
  const box = shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const crystal = shared('crystal', () => new THREE.OctahedronGeometry(1));
  function add(parent, geometry, material, position, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  const ring = (radius, tube = 0.004) => shared(`ring:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 5, 48));
  function line(parent, points, material, radius = 0.003) {
    for (let i = 1; i < points.length; i++) {
      const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i]), distance = a.distanceTo(b);
      const mesh = add(parent, shared('tube', () => new THREE.CylinderGeometry(1, 1, 1, 6)), material,
        a.clone().add(b).multiplyScalar(0.5).toArray(), [radius, distance, radius]);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    }
  }
  function panel(parent, key, points, material, position, thickness = 0.005) {
    const geometry = shared(key, () => {
      const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
      return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    });
    return add(parent, geometry, material, position);
  }
  function bodice(material, fitted = true) {
    const waistY = (humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).y
      - humanoid.getRawBoneNode('chest').getWorldPosition(new THREE.Vector3()).y) / size + 0.065;
    const geometry = shared(`bodice:${config.outfit}`, () => {
      const profile = config.body === 'male'
        ? [[0.13, waistY], [0.145, -0.08], [0.17, 0.04], [0.17, 0.145], [0.09, 0.19], [0.064, 0.21]]
        : config.outfit === 'club'
          ? [[0.12, waistY + 0.025], [0.132, -0.025], [0.15, 0.055], [0.158, 0.14], [0.075, 0.19]]
          : [[0.12, waistY], [0.132, -0.025], [0.15, 0.055], [0.146, 0.12], [0.13, 0.15]];
      return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * (fitted ? 1 : 1.05), y)), 48);
    });
    // Blend waist vertices to the hip and upper vertices to the chest. A rigid
    // tube opens a gap at the belt whenever the dancer bends or rolls the torso.
    const skinned = shared(`skinned-bodice:${config.outfit}`, () => {
      const g = geometry.clone(), indices = [], weights = [];
      for (let i = 0; i < g.attributes.position.count; i++) {
        const chestWeight = THREE.MathUtils.smoothstep(g.attributes.position.getY(i), waistY + 0.015, waistY + 0.2);
        indices.push(0, 1, 0, 0); weights.push(1 - chestWeight, chestWeight, 0, 0);
      }
      g.scale(1, 1, 0.76); chest.updateWorldMatrix(true, false); g.applyMatrix4(chest.matrixWorld);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4)); return g;
    });
    const hipBone = humanoid.getRawBoneNode('hips'), chestBone = humanoid.getRawBoneNode('chest');
    let root = hipBone; while (root.parent) root = root.parent;
    const mesh = new THREE.SkinnedMesh(skinned, material); mesh.name = `wardrobe:bodice:${config.outfit}`; root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([hipBone, chestBone])); mesh.frustumCulled = false;
  }
  function waist(parent = hip, radius = 0.139, y = 0.065) {
    const band = add(parent, ring(radius, 0.012), dark, [0, y, 0], [1, 0.82, 1]); band.rotation.x = Math.PI / 2;
    add(parent, crystal, metal, [0, y, 0.125], [0.025, 0.021, 0.009]);
  }
  function pendant() {
    const points = []; for (let i = 0; i <= 12; i++) { const t = i / 12; points.push([(t - 0.5) * 0.16, 0.105 - Math.sin(t * Math.PI) * 0.075, 0.122]); }
    line(chest, points, metal, 0.0025); add(chest, crystal, jewel, [0, 0.018, 0.134], [0.012, 0.022, 0.006]);
  }
  function sleeves(material, long, trimCuffs = true) {
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const upperBone = humanoid.getRawBoneNode(`${side}UpperArm`), elbow = humanoid.getRawBoneNode(`${side}LowerArm`), hand = humanoid.getRawBoneNode(`${side}Hand`);
      const length = upperBone.getWorldPosition(new THREE.Vector3()).distanceTo(elbow.getWorldPosition(new THREE.Vector3())) / size;
      const arm = frame(`${side}UpperArm`), sleeveLength = long ? length : length * 0.47;
      const sleeve = add(arm, shared(`sleeve:${sleeveLength.toFixed(4)}`, () => new THREE.CylinderGeometry(0.053, 0.066, sleeveLength, 20, 1, true)), material,
        [sign * sleeveLength * 0.48, 0, 0]); sleeve.rotation.z = -sign * Math.PI / 2;
      line(arm, [[sign * 0.025, 0.03, 0.061], [sign * (sleeveLength - 0.01), 0.03, 0.048]], metal, 0.002);
      if (long) {
        const fore = frame(`${side}LowerArm`), lowerLength = elbow.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3())) / size;
        const lower = add(fore, shared(`forearm:${lowerLength.toFixed(4)}`, () => new THREE.CylinderGeometry(0.034, 0.053, lowerLength * 0.94, 20, 1, true)), material,
          [sign * lowerLength * 0.48, 0, 0]); lower.rotation.z = -sign * Math.PI / 2;
        if (trimCuffs) { const cuff = add(fore, ring(0.036, 0.006), metal, [sign * lowerLength * 0.92, 0, 0]); cuff.rotation.y = Math.PI / 2; }
      }
    }
  }
  function skirt(kind) {
    const profile = kind === 'princess'
      ? [[0.128, 0.075], [0.142, -0.025], [0.19, -0.17], [0.285, -0.39], [0.375, -0.65], [0.405, -0.715]]
      : kind === 'noble' ? [[0.128, 0.075], [0.153, -0.04], [0.205, -0.20], [0.29, -0.43], [0.34, -0.565]]
        : [[0.132, 0.075], [0.148, 0], [0.205, -0.165], [0.216, -0.215]];
    const group = new THREE.Group(); group.name = `wardrobe:${kind}-skirt`; hip.add(group); frames.push(group);
    const geometry = shared(`couture-skirt:${kind}`, () => {
      const shape = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 96);
      const p = shape.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const angle = Math.atan2(p.getZ(i), p.getX(i));
        const flare = THREE.MathUtils.clamp((0.075 - p.getY(i)) / 0.5, 0, 1);
        const fold = 1 + Math.cos(angle * (kind === 'mini' ? 16 : 12)) * flare * 0.055;
        p.setX(i, p.getX(i) * fold); p.setZ(i, p.getZ(i) * fold * (kind === 'mini' ? 0.86 : 0.94));
      }
      shape.computeVertexNormals(); return shape;
    });
    add(group, geometry, cloth, [0, 0, 0]);
    const [bottomRadius, bottomY] = profile[profile.length - 1];
    const hem = add(group, ring(bottomRadius, kind === 'mini' ? 0.004 : 0.006), metal, [0, bottomY, 0], [1, 0.94, 1]); hem.rotation.x = Math.PI / 2;
    if (kind !== 'mini') {
      for (let column = 0; column < 12; column++) {
        const a = column / 12 * Math.PI * 2;
        const points = profile.map(([r, y]) => [Math.cos(a) * (r + 0.003), y, Math.sin(a) * (r + 0.003) * 0.94]);
        line(group, points, metal, 0.0015);
        const r = bottomRadius * 0.85;
        add(group, crystal, jewel, [Math.cos(a) * r, bottomY + 0.105, Math.sin(a) * r * 0.94], [0.007, 0.019, 0.005]);
      }
      // Curved scalloped overskirt panels, rather than a single plain cone.
      for (let side = -1; side <= 1; side += 2) {
        const points = [[0, 0.03, 0.14], [side * 0.09, -0.08, 0.16], [side * 0.17, -0.22, 0.20], [side * 0.24, -0.35, 0.19]];
        line(group, points, metal, 0.004);
        for (let i = 1; i < points.length - 1; i++) add(group, sphere, metal, points[i], [0.008, 0.008, 0.006]);
      }
      moving.push({ group, z: 0.035, x: 0.012, phase: kind === 'princess' ? 0.8 : 1.9 });
    } else {
      for (let i = -1; i <= 1; i++) add(group, box, metal, [i * 0.038, -0.015, 0.133], [0.009, 0.025, 0.006]);
      line(group, [[0.09, 0.04, 0.12], [0.16, -0.04, 0.12], [0.19, -0.095, 0.08]], metal, 0.004);
    }
  }

  if (config.outfit === 'club') {
    bodice(upper); skirt('mini'); waist(); pendant(); sleeves(upper, false);
    for (const sign of [-1, 1]) {
      panel(chest, `club-lapel:${sign}`, [[sign * 0.025, 0.105], [sign * 0.105, 0.075], [sign * 0.075, -0.07]], dark, [0, 0, 0.128]);
      line(chest, [[sign * 0.025, 0.105, 0.136], [sign * 0.075, -0.07, 0.136]], metal, 0.003);
      add(chest, crystal, jewel, [sign * 0.105, -0.08, 0.115], [0.008, 0.012, 0.006]);
    }
    for (const side of ['left', 'right']) {
      const leg = frame(`${side}LowerLeg`);
      add(leg, shared('tall-boot', () => new THREE.CylinderGeometry(0.052, 0.038, 0.27, 24, 1, true)), dark, [0, -0.17, 0], [1, 1, 1.08]);
      const cuff = add(leg, ring(0.052, 0.004), metal, [0, -0.035, 0]); cuff.rotation.x = Math.PI / 2;
      line(leg, [[0.022, -0.04, 0.048], [0.018, -0.29, 0.038]], metal, 0.002);
    }
  } else if (config.outfit === 'princess' || config.outfit === 'noble') {
    const princess = config.outfit === 'princess';
    skirt(config.outfit); bodice(upper); waist(); pendant();
    // Sweetheart neckline, fitted corset seams and a crystal centre brooch.
    line(chest, [[-0.13, 0.15, 0.078], [-0.09, 0.16, 0.10], [-0.045, 0.145, 0.12], [0, 0.13, 0.125], [0.045, 0.145, 0.12], [0.09, 0.16, 0.10], [0.13, 0.15, 0.078]], metal, 0.004);
    for (const sign of [-1, 1]) {
      line(chest, [[sign * 0.08, 0.07, 0.12], [sign * 0.065, -0.08, 0.113], [sign * 0.05, -0.20, 0.086]], metal, 0.002);
      const arm = frame(`${sign > 0 ? 'left' : 'right'}UpperArm`);
      const lace = add(arm, ring(0.06, 0.009), upper, [sign * 0.065, -0.005, 0]); lace.rotation.y = Math.PI / 2;
      for (let i = 0; i < 5; i++) add(arm, sphere, metal, [sign * 0.07, -0.03 - i * 0.004, (i - 2) * 0.019], [0.005, 0.005, 0.005]);
      const wrist = frame(`${sign > 0 ? 'left' : 'right'}Hand`);
      const bracelet = add(wrist, ring(0.026, 0.004), metal, [0, 0, 0]); bracelet.rotation.y = Math.PI / 2;
    }
    add(chest, crystal, jewel, [0, 0.045, 0.144], [0.019, 0.032, 0.009]);
    if (!princess) {
      const collar = add(chest, ring(0.075, 0.014), velvet, [0, 0.16, -0.015], [1, 0.8, 1]); collar.rotation.x = Math.PI / 2;
      const back = panel(chest, 'noble-mantle', [[-0.19, 0.1], [0.19, 0.1], [0.15, -0.24], [0, -0.34], [-0.15, -0.24]], velvet, [0, 0, -0.13]);
      back.rotation.y = Math.PI;
    }
  } else {
    const prince = config.outfit === 'prince';
    bodice(upper, false); sleeves(upper, true); waist();
    panel(chest, `shirt:${config.outfit}`, [[-0.055, 0.18], [0.055, 0.18], [0.045, -0.12], [-0.045, -0.12]], dark, [0, 0, 0.135]);
    for (const sign of [-1, 1]) {
      panel(chest, `lapel:${config.outfit}:${sign}`, [[sign * 0.04, 0.13], [sign * 0.125, 0.07], [sign * 0.048, -0.14], [sign * 0.068, 0.02]], upper, [0, 0, 0.145]);
      line(chest, [[sign * 0.04, 0.13, 0.153], [sign * 0.125, 0.07, 0.153], [sign * 0.048, -0.14, 0.153]], metal, prince ? 0.003 : 0.002);
      const arm = frames.find((item) => item.name === `wardrobe:${sign > 0 ? 'left' : 'right'}UpperArm`);
      if (prince) {
        add(arm, box, metal, [sign * 0.025, 0.025, 0], [0.085, 0.012, 0.075]);
        for (let i = 0; i < 4; i++) add(arm, sphere, metal, [sign * (0.005 + i * 0.02), 0.01, 0.039], [0.003, 0.012, 0.003]);
        for (let i = 0; i < 3; i++) add(chest, sphere, metal, [sign * 0.07, -0.035 - i * 0.05, 0.146], [0.006, 0.006, 0.004]);
      } else {
        add(arm, box, jewel, [sign * 0.075, 0.04, 0.05], [0.075, 0.011, 0.005]);
        const leg = frame(`${sign > 0 ? 'left' : 'right'}LowerLeg`);
        add(leg, sphere, dark, [0, -0.02, 0.045], [0.045, 0.07, 0.016]);
      }
    }
    if (prince) {
      line(chest, [[-0.09, 0.10, 0.16], [0.075, -0.16, 0.16]], metal, 0.013);
      add(chest, crystal, jewel, [-0.095, 0.07, 0.17], [0.017, 0.022, 0.007]);
      for (const sign of [-1, 1]) {
        const tail = new THREE.Group(); tail.position.set(sign * 0.07, 0.05, -0.115); hip.add(tail); frames.push(tail); tail.name = `wardrobe:tail:${sign}`;
        panel(tail, `tailcoat:${sign}`, [[-0.09, 0.03], [0.09, 0.03], [0.10, -0.36], [sign * 0.03, -0.47], [-0.10, -0.38]], upper, [0, 0, 0]);
        line(tail, [[-sign * 0.085, -0.03, 0.008], [-sign * 0.09, -0.36, 0.008], [sign * 0.03, -0.47, 0.008]], metal, 0.003);
        moving.push({ group: tail, z: 0.025, x: 0.05, phase: sign });
      }
      const cape = new THREE.Group(); cape.position.set(0, 0.07, -0.16); chest.add(cape); frames.push(cape); cape.name = 'wardrobe:royal-cape';
      panel(cape, 'royal-cape', [[-0.14, 0.03], [0.14, 0.03], [0.25, -0.52], [0.16, -0.59], [0, -0.56], [-0.16, -0.59], [-0.25, -0.52]], velvet, [0, 0, 0]);
      line(cape, [[-0.14, 0.03, -0.008], [-0.25, -0.52, -0.008], [-0.16, -0.59, -0.008], [0, -0.56, -0.008], [0.16, -0.59, -0.008], [0.25, -0.52, -0.008], [0.14, 0.03, -0.008]], metal, 0.003);
      moving.push({ group: cape, z: 0.015, x: 0.04, phase: 0.3 });
    } else {
      line(chest, [[-0.11, 0.10, 0.16], [0.09, -0.18, 0.14]], dark, 0.014);
      add(chest, box, metal, [0.04, -0.11, 0.16], [0.026, 0.031, 0.007]);
      line(hip, [[0.10, 0.055, 0.12], [0.17, -0.045, 0.11], [0.18, -0.13, 0.055], [0.14, -0.15, 0]], metal, 0.004);
      for (const sign of [-1, 1]) add(head, box, dark, [sign * 0.044, 0.145, 0.079], [0.072, 0.025, 0.01]);
    }
  }
  // Merge fixed details by material/bone and share the merged geometry. Richer
  // outfits keep a small draw-call count even with thirty live dancers.
  frames.forEach((group, index) => {
    const buckets = new Map();
    for (const mesh of [...group.children]) {
      if (!mesh.isMesh) continue;
      const key = mesh.material.name; if (!buckets.has(key)) buckets.set(key, { material: mesh.material, meshes: [] });
      buckets.get(key).meshes.push(mesh);
    }
    for (const [key, bucket] of buckets) {
      const cacheKey = `batch:${config.outfit}:${index}:${key}`;
      const merged = shared(cacheKey, () => {
        const parts = bucket.meshes.map((mesh) => { mesh.updateMatrix(); const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); return g.applyMatrix4(mesh.matrix); });
        const result = mergeGeometries(parts); parts.forEach((part) => part.dispose()); return result;
      });
      bucket.meshes.forEach((mesh) => mesh.removeFromParent()); add(group, merged, bucket.material, [0, 0, 0]);
    }
  });
  return { update(time) { moving.forEach(({ group, x, z, phase }) => { group.rotation.x = Math.sin(time * 2.3 + phase) * x; group.rotation.z = Math.sin(time * 1.8 + phase) * z; }); } };
}
