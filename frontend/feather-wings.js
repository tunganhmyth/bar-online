import * as THREE from 'three';

let sharedGeometry = null, sharedTexture = null;
function featherTexture() {
  if (sharedTexture) return sharedTexture;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const satin = ctx.createLinearGradient(0, 0, 256, 0);
  satin.addColorStop(0, '#f5f9fc'); satin.addColorStop(0.35, '#d6e2ed'); satin.addColorStop(0.49, '#fafcff');
  satin.addColorStop(0.53, '#d9e3ec'); satin.addColorStop(0.85, '#edf4fa'); satin.addColorStop(1, '#ffffff');
  ctx.fillStyle = satin; ctx.fillRect(0, 0, 256, 1024);
  // Fine diagonal vanes and the central shaft remain visible in close-ups.
  for (let y = 16; y < 1024; y += 6) {
    ctx.strokeStyle = y % 12 ? '#ffffff70' : '#8fa7ba45'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(128, y); ctx.bezierCurveTo(90, y - 12, 36, y - 26, 0, y - 44);
    ctx.moveTo(128, y); ctx.bezierCurveTo(166, y - 10, 220, y - 23, 256, y - 40); ctx.stroke();
  }
  ctx.strokeStyle = '#aec0ce'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(128, 1024); ctx.quadraticCurveTo(126, 460, 128, 8); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(130, 1024); ctx.lineTo(130, 14); ctx.stroke();
  sharedTexture = new THREE.CanvasTexture(canvas); sharedTexture.colorSpace = THREE.SRGBColorSpace;
  sharedTexture.anisotropy = 4; return sharedTexture;
}

function featherGeometry() {
  if (sharedGeometry) return sharedGeometry;
  const positions = [], colors = [], uv = [], indices = [], rows = 26, columns = 6;
  const blue = new THREE.Color('#a9bed2'), pearl = new THREE.Color('#fafcff'), color = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = Math.pow(Math.sin(t * Math.PI), 0.56) * (1 - t * 0.23) + 0.018 * (1 - t);
    for (let column = 0; column <= columns; column++) {
      const across = column / columns * 2 - 1;
      const asymmetry = across > 0 ? 0.94 : 1.06;
      const edge = Math.abs(across);
      positions.push(across * width * asymmetry + t * t * 0.10,
        t - Math.pow(edge, 1.3) * Math.sin(t * Math.PI) * 0.025,
        Math.sin(t * Math.PI) * (0.04 + (1 - edge * edge) * 0.07) + t * t * 0.045);
      color.copy(blue).lerp(pearl, 0.35 + t * 0.45 + edge * 0.15);
      colors.push(color.r, color.g, color.b); uv.push(column / columns, t);
      if (row < rows && column < columns) {
        const n = row * (columns + 1) + column;
        indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  sharedGeometry = geometry; return geometry;
}

function featherLayout() {
  const feathers = [];
  const primary = (t) => ({ base: [0.35 + 0.45 * Math.sin((1 - t) * Math.PI * 0.6), 1.4 + 0.45 * (1 - t)],
    tip: [1.62 - 0.75 * Math.pow(t, 1.7), 2.85 - 2.7 * t] });
  for (let i = 0; i < 16; i++) {
    const t = i / 15, { base, tip } = primary(t);
    feathers.push({ base, tip, width: 0.24 + Math.sin(t * Math.PI) * 0.04, z: -0.10 - i * 0.001, layer: 0 });
  }
  for (let i = 0; i < 18; i++) {
    const t = i / 17, { base, tip } = primary(t);
    feathers.push({ base: [0.21 + 0.28 * Math.sin((1 - t) * 1.7), 1.3 + 0.30 * (1 - t)],
      tip: [THREE.MathUtils.lerp(base[0], tip[0], 0.58), THREE.MathUtils.lerp(base[1], tip[1], 0.58)], width: 0.175, z: -0.035 + i * 0.001, layer: 1 });
  }
  for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
    const t = i / 15, x = 0.18 + row * 0.11 + Math.sin((1 - t) * 1.7) * 0.26, y = 1.29 + (1 - t) * 0.40;
    feathers.push({ base: [x, y], tip: [x + 0.16 + Math.sin(t * Math.PI) * 0.10, y + 0.17 - t * 0.34],
      width: 0.12, z: 0.045 + row * 0.035 + i * 0.001, layer: 2 });
  }
  return feathers;
}

// Original 3D feathers, layered like an angel wing. Two instanced draws per
// pair, shared feather geometry/texture, independent folding hinges.
export function createFeatherWings({ accent = '#ffdfb0' } = {}) {
  const root = new THREE.Group(); root.name = 'layered-feather-wings';
  const geometry = featherGeometry(), layout = featherLayout(), hinges = [], meshes = [];
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, map: featherTexture(),
    roughness: 0.62, metalness: 0.06, emissive: '#e9dfcc', emissiveIntensity: 0.10,
    side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: true });
  const dummy = new THREE.Object3D(), color = new THREE.Color(), white = new THREE.Color('#ffffff'), tint = new THREE.Color(accent);
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(side * 0.18, 1.25, -0.48); root.add(hinge); hinges.push({ side, hinge });
    const mesh = new THREE.InstancedMesh(geometry, material, layout.length); mesh.frustumCulled = false;
    layout.forEach((feather, i) => {
      const dx = side * (feather.tip[0] - feather.base[0]), dy = feather.tip[1] - feather.base[1];
      dummy.position.set(side * (feather.base[0] - 0.18), feather.base[1] - 1.25, feather.z);
      dummy.rotation.set(0, 0, Math.atan2(-dx, dy)); dummy.scale.set(feather.width / 2, Math.hypot(dx, dy), 0.7);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      color.copy(white).lerp(tint, feather.layer === 2 ? 0.12 : 0.035); mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true; hinge.add(mesh); meshes.push(mesh);
  }
  return {
    root,
    update(time, opacity = 1, opening = 1) {
      root.visible = opacity > 0.001; material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
      const unfolded = THREE.MathUtils.smoothstep(opening, 0, 1);
      hinges.forEach(({ side, hinge }) => {
        hinge.rotation.y = side * (0.10 + (1 - unfolded) * 0.95 + Math.sin(time * 1.2) * 0.045);
        hinge.rotation.z = side * ((1 - unfolded) * 0.10 + Math.sin(time * 1.4) * 0.025);
      });
    },
    getSnapshot() { return { style: 'layered-feather-wings', feathers: layout.length * 2, layers: 3 }; },
    dispose() { meshes.forEach((mesh) => mesh.dispose()); material.dispose(); root.removeFromParent(); }
  };
}
