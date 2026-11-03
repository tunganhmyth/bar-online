import * as THREE from 'three';
import { createFeatherWings } from './feather-wings.js';

const TAU = Math.PI * 2, textures = new Map();
const ease = (value) => THREE.MathUtils.smoothstep(value, 0, 1);
function spriteTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.translate(64, 64);
  if (kind === 'trail') {
    const gradient = ctx.createLinearGradient(-64, 0, 64, 0);
    gradient.addColorStop(0, '#ffffff00'); gradient.addColorStop(0.3, '#ffffff99'); gradient.addColorStop(0.75, '#ffffffcc'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(-64, -64, 128, 128);
    const feather = ctx.createLinearGradient(0, -64, 0, 64);
    feather.addColorStop(0, '#ffffff00'); feather.addColorStop(0.45, '#ffffffff'); feather.addColorStop(0.55, '#ffffffff'); feather.addColorStop(1, '#ffffff00');
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = feather; ctx.fillRect(-64, -64, 128, 128);
    ctx.globalCompositeOperation = 'source-over';
  } else if (kind === 'aura') {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
    glow.addColorStop(0, '#ffffff11'); glow.addColorStop(0.45, '#ffffff66'); glow.addColorStop(0.72, '#ffffff28'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(-64, -64, 128, 128);
  } else {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 62);
    glow.addColorStop(0, '#ffffffbb'); glow.addColorStop(0.18, '#ffffff77'); glow.addColorStop(0.5, '#ffffff18'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(-64, -64, 128, 128);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    if (kind === 'petal') {
      ctx.beginPath(); ctx.moveTo(0, -37); ctx.bezierCurveTo(43, -24, 34, 19, 0, 39); ctx.bezierCurveTo(-34, 19, -43, -24, 0, -37); ctx.fill();
    } else if (kind === 'snow') {
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -37); ctx.moveTo(-9, -19); ctx.lineTo(0, -28); ctx.lineTo(9, -19); ctx.stroke(); ctx.restore(); }
    } else if (kind === 'spark') {
      ctx.beginPath(); ctx.moveTo(-5, -40); ctx.lineTo(10, -40); ctx.lineTo(5, 40); ctx.lineTo(-10, 40); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r = i % 2 ? 7 : 39; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(kind, texture); return texture;
}

const THEMES = {
  sakura: { style: 'rose-ribbons', secondary: '#ffe0ee', particle: 'petal', count: 40 },
  yuki: { style: 'crystal-bloom', secondary: '#eaf9ff', particle: 'snow', count: 28 },
  akira: { style: 'voltage-trails', secondary: '#70eaff', particle: 'spark', count: 32 },
  luna: { style: 'lunar-constellation', secondary: '#ead4a4', particle: 'star', count: 30 },
  hikari: { style: 'seraph-feathers', secondary: '#ffe8b0', particle: 'star', count: 28 }
};

export function createSignatureEffect(config) {
  const theme = THEMES[config.id], root = new THREE.Group(); root.name = `skill:${config.id}`;
  const featherWings = config.id === 'hikari' ? createFeatherWings({ accent: theme.secondary }) : null;
  if (featherWings) root.add(featherWings.root);
  const geometries = new Set(), materials = [], animated = [], ribbons = [];
  function material(color, opacity, map) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, map: map || null, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false });
    materials.push({ mat, opacity }); return mat;
  }
  const accent = material(config.accent, 0.55), pale = material(theme.secondary, 0.65), soft = material(config.accent, 0.22);
  function mesh(geometry, mat, position = [0, 0, 0]) {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, mat); object.position.set(...position); root.add(object); return object;
  }
  function arc(radius, span, mat, position, rotation = [0, 0, 0], thickness = 0.005) {
    const object = mesh(new THREE.TorusGeometry(radius, thickness, 5, 80, span), mat, position); object.rotation.set(...rotation); return object;
  }
  mesh(new THREE.PlaneGeometry(2.4, 2.8), material(config.accent, 0.22, spriteTexture('aura')), [0, 1.35, -0.7]);
  const groundGlow = mesh(new THREE.PlaneGeometry(2.5, 2.5), material(config.accent, 0.32, spriteTexture('aura')), [0, 0.025, 0]);
  groundGlow.rotation.x = -Math.PI / 2;
  const inner = arc(0.82, TAU, accent, [0, 0.035, 0], [-Math.PI / 2, 0, 0]);
  const outer = arc(1.06, Math.PI * 1.65, pale, [0, 0.04, 0], [-Math.PI / 2, 0, 0], 0.003);
  const sweepMat = material(config.accent, 0.55);
  const sweep = arc(1, TAU, sweepMat, [0, 0.03, 0], [-Math.PI / 2, 0, 0]);
  const backArc = arc(0.88, Math.PI * 1.35, soft, [0, 1.5, -0.58], [0, 0, 0.35]);
  const backArc2 = arc(1.04, Math.PI * 1.15, accent, [0, 1.5, -0.6], [0, 0, Math.PI + 0.2], 0.003);
  function line(points, mat, radius = 0.004) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), 40, radius, 4, false), mat);
  }
  function ribbon(sample, width = 0.025, color = config.accent) {
    const segments = 40, geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 6), uv = [], indices = [];
    for (let i = 0; i <= segments; i++) { uv.push(i / segments, 0, i / segments, 1); if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); } }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
    const object = mesh(geometry, material(color, 0.62, spriteTexture('trail'))); object.frustumCulled = false;
    ribbons.push({ geometry, positions, sample, width, segments });
  }
  for (const side of [-1, 1]) {
    if (config.id === 'sakura') {
      for (let layer = 0; layer < 2; layer++) ribbon((u, time) => {
        const a = u * Math.PI * 1.35 + layer * 0.6 + time * 0.16;
        return [side * (0.48 + Math.sin(u * Math.PI) * 0.62 + Math.sin(a) * 0.08), 0.18 + u * 2.25, -0.48 + Math.cos(a) * 0.08];
      }, layer ? 0.028 : 0.065, layer ? theme.secondary : config.accent);
    } else if (config.id === 'yuki') {
      for (let branch = 0; branch < 3; branch++) {
        const a = branch * 0.42 - 0.5;
        const object = line([[side * 0.42, 0.75, -0.55], [side * (0.7 + a * 0.08), 1.3, -0.65], [side * (0.92 + branch * 0.08), 1.75 + branch * 0.22, -0.6]], branch % 2 ? pale : accent, 0.006);
        animated.push({ object, phase: branch + side, kind: 'ice' });
        line([[side * 0.72, 1.3, -0.65], [side * 0.98, 1.45 + branch * 0.12, -0.62]], pale, 0.003);
        const prism = mesh(new THREE.OctahedronGeometry(1), pale, [side * (0.66 + branch * 0.17), 0.9 + branch * 0.43, -0.58]);
        prism.scale.set(0.025, 0.16 + branch * 0.02, 0.025); prism.rotation.z = side * -0.3;
      }
    } else if (config.id === 'akira') {
      for (let circuit = 0; circuit < 2; circuit++) {
        const x = side * (0.68 + circuit * 0.21);
        line([[x, 0.15, -0.45], [x, 0.8, -0.5], [x + side * 0.12, 0.92, -0.5], [x + side * 0.12, 1.7, -0.5], [x - side * 0.07, 1.9, -0.5], [x - side * 0.07, 2.3, -0.5]], circuit ? pale : accent, 0.004);
      }
      ribbon((u, time) => [side * (0.55 + Math.sin(u * Math.PI + time * 0.4) * 0.2), 0.2 + u * 2.1, -0.5], 0.013, theme.secondary);
    } else if (config.id === 'luna') {
      ribbon((u, time) => { const a = u * TAU + time * 0.15; return [Math.cos(a) * 1.06, 1.15 + Math.sin(a) * 0.58, -0.65 - Math.sin(a) * 0.08]; }, 0.012, theme.secondary);
      break;
    }
  }
  if (config.id === 'luna') {
    const shape = new THREE.Shape(); shape.moveTo(0, 0.39); shape.bezierCurveTo(-0.47, 0.39, -0.47, -0.39, 0, -0.39); shape.bezierCurveTo(-0.22, -0.19, -0.22, 0.19, 0, 0.39);
    const moon = mesh(new THREE.ShapeGeometry(shape, 32), pale, [0.78, 1.98, -0.6]); moon.rotation.z = -0.2;
  }
  if (config.id === 'hikari') arc(0.25, TAU, pale, [0, 2.57, -0.02], [-Math.PI / 2, 0, 0], 0.008);
  const particleMat = material(config.accent, config.id === 'sakura' ? 0.8 : 0.65, spriteTexture(theme.particle));
  const particleGeometry = new THREE.PlaneGeometry(1, 1); geometries.add(particleGeometry);
  const particles = new THREE.InstancedMesh(particleGeometry, particleMat, theme.count); particles.frustumCulled = false; root.add(particles);
  const dummy = new THREE.Object3D(); let phase = 'arrival', currentIntensity = 0;
  return {
    root, characterId: config.id, name: config.skill,
    update(time, intensity = 1, camera) {
      if (camera) root.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z);
      const opening = ease(time / 0.8), fade = Math.min(1, Math.max(0, intensity));
      currentIntensity = fade; phase = time < 0.85 ? 'arrival' : fade < 0.7 ? 'outro' : 'signature';
      materials.forEach(({ mat, opacity }) => { mat.opacity = opacity * fade; });
      featherWings?.update(time, fade, opening);
      inner.scale.setScalar(0.86 + opening * 0.14 + Math.sin(time * 1.9) * 0.015);
      outer.rotation.z = time * 0.19; outer.scale.setScalar(0.92 + opening * 0.08);
      sweep.scale.setScalar(0.2 + ease(time / 0.9) * 1.3); sweepMat.opacity = Math.max(0, 1 - time / 0.9) * fade * 0.55;
      backArc.rotation.z = 0.35 + Math.sin(time * 0.3) * 0.08; backArc2.rotation.z = Math.PI + 0.2 - time * 0.035;
      animated.forEach(({ object, phase }) => { object.scale.setScalar(0.9 + opening * 0.1 + Math.sin(time * 1.5 + phase) * 0.015); });
      for (const item of ribbons) {
        for (let i = 0; i <= item.segments; i++) {
          const u = i / item.segments, at = u * (0.3 + opening * 0.7), point = item.sample(at, time);
          const tangent = item.sample(Math.min(1, at + 0.006), time), previous = item.sample(Math.max(0, at - 0.006), time);
          const dx = tangent[0] - previous[0], dy = tangent[1] - previous[1], length = Math.max(0.0001, Math.hypot(dx, dy));
          const w = Math.pow(Math.sin(u * Math.PI), 0.6) * item.width;
          const nx = -dy / length * w, ny = dx / length * w;
          item.positions.set([point[0] + nx, point[1] + ny, point[2], point[0] - nx, point[1] - ny, point[2]], i * 6);
        }
        item.geometry.attributes.position.needsUpdate = true;
      }
      for (let i = 0; i < theme.count; i++) {
        const side = i % 2 ? 1 : -1, seed = i * 2.39996;
        const progress = ((i * 0.173 + time * (config.id === 'sakura' ? -0.18 : 0.13)) % 1 + 1) % 1;
        dummy.position.set(side * (0.48 + (i % 5) * 0.11 + Math.sin(time * 0.65 + seed) * 0.1), 0.2 + progress * 2.25, -0.35 - (i % 4) * 0.13);
        dummy.rotation.set(config.id === 'sakura' ? Math.sin(time + seed) * 0.7 : 0, Math.sin(time * 0.6 + seed) * 0.35, seed + time * 0.2);
        const s = (config.id === 'sakura' ? 0.12 + i % 3 * 0.025 : 0.085 + i % 3 * 0.02) * opening * fade;
        dummy.scale.set(s, s * (config.id === 'sakura' ? 1.5 : config.id === 'akira' ? 2 : 1), s); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
    },
    getSnapshot() { return { style: theme.style, phase, intensity: currentIntensity, particles: theme.count, ribbons: ribbons.length, wings: featherWings?.getSnapshot() || null }; },
    dispose() { featherWings?.dispose(); particles.dispose(); geometries.forEach((g) => g.dispose()); materials.forEach(({ mat }) => mat.dispose()); root.removeFromParent(); }
  };
}

export function createFocusAura(accentColor) {
  const root = new THREE.Group(); root.name = 'portrait-focus-aura';
  const material = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const geometry = new THREE.TorusGeometry(0.8, 0.004, 5, 64, Math.PI * 1.45);
  const halo = new THREE.Mesh(geometry, material); halo.position.set(0, 1.55, -0.5); root.add(halo);
  const floorGeometry = new THREE.TorusGeometry(0.78, 0.005, 5, 64);
  const floor = new THREE.Mesh(floorGeometry, material); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.035; root.add(floor);
  return {
    root,
    update(time, camera, fade = 1) {
      root.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z);
      material.opacity = ease(time / 0.7) * fade * 0.35;
      halo.rotation.z = 0.3 + time * 0.045; halo.scale.setScalar(0.92 + ease(time / 0.8) * 0.08);
      floor.scale.setScalar(1 + Math.sin(time * 1.7) * 0.025);
    },
    dispose() { geometry.dispose(); floorGeometry.dispose(); material.dispose(); root.removeFromParent(); }
  };
}
