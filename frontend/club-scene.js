import * as THREE from 'three';
import { CHARACTERS, loadAnimeTemplate, createAnimeActor, createSignatureEffect } from './anime-characters.js';
import { createTopGifterStage, TOP_ROLES } from './top-gifter-stage.js';
import { createFocusAura } from './character-effects.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SLOT_POSITIONS = [
  [-2.5, 2.5], [2.5, 2.5], [0, 0], [-5, 0], [5, 0],
  [-2.5, -2.5], [2.5, -2.5], [-5, -5], [0, -5], [5, -5],
  [0, 5], [-5, 5], [5, 5], [-7.5, 2.5], [7.5, 2.5],
  [-7.5, -2.5], [7.5, -2.5], [-7.5, 7.5], [7.5, 7.5],
  [-7.5, 5], [7.5, 5], [-7.5, 10], [7.5, 10], [0, 7.5],
  [-7.5, -5], [7.5, -5], [-5, 7.5], [5, 7.5], [-2.5, 7.5], [2.5, 7.5]
];
const DEMO_USERS = ['Mina', 'Luna', 'Kira', 'Yuna', 'Sora', 'Ruby', 'Hana', 'Yuki'];
const hash = (text) => [...text].reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) >>> 0), 0);
const ease = (t) => t * t * (3 - 2 * t);
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const HOST_ID = 'stage:host';
const CAMERA_LABELS = {
  overview: 'Toàn sàn', front: 'Chính diện', left: 'Chéo trái', right: 'Chéo phải',
  overhead: 'Từ trên cao', orbit: 'Xoay chậm', closeup: 'Cận cảnh nhân vật', mixed: 'Hỗn hợp tự động'
};
const MIXED_SHOTS = ['overview', 'left', 'front', 'right', 'closeup', 'orbit'];
const MIXED_TOP_SHOTS = ['overview', 'left', 'front', 'top', 'right', 'closeup', 'orbit', 'top'];
const SHOT_SECONDS = 5;

function textureCanvas(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

window.createClubScene = function createClubScene(container) {
  const canvas = container.querySelector('#club-canvas');
  const labels = container.querySelector('#character-labels');
  const scene = new THREE.Scene();
  const lightweight = new URLSearchParams(location.search).get('quality') === 'low';
  scene.background = new THREE.Color('#080810');
  scene.fog = new THREE.FogExp2('#0a0813', 0.025);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.info.autoReset = false;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 85);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 27;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = 1.4;
  // Keep manual drags in the same front-facing arc as automatic shots.
  controls.minAzimuthAngle = -Math.PI / 3;
  controls.maxAzimuthAngle = Math.PI / 3;
  controls.target.set(0, 1, -0.5);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 768), 0.36, 0.45, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const actors = new Map();
  const characterSelections = new Map();
  const spotBeams = [];
  const ledBars = [];
  const floorSegments = [];
  const mixers = new Set();
  const homePosition = new THREE.Vector3();
  const homeTarget = new THREE.Vector3(0, 1.05, -0.7);
  const focusQueue = [];
  const projection = new THREE.Vector3();
  const positions = new Set();
  const clock = new THREE.Clock();
  let model = null;
  let elapsed = 0;
  let activeGift = null;
  let width = 1, height = 1;
  let preview = false;
  let lightsOn = true;
  let laserEnabled = false;
  let hostName = 'Chủ sàn';
  let stageName = 'MYTHMAKER';
  let hostCharacter = 'sakura';
  let signatureEffect = null;
  let portraitFocus = null;
  let rankingEpoch = '', rankingSession = null, rankingRevision = -1, lastRankings = null;
  let cameraMode = 'overview';
  let cameraShot = 'overview';
  let directorEpoch = 0;
  let shotEpoch = 0;
  let shotKey = '';
  let closeupTarget = HOST_ID;
  let topCameraRank = null, topCameraCursor = 0, topCameraUser = '';
  let cameraTransition = null;
  let disposed = false;
  let renderTime = 0;
  let frameCount = 0;
  let frameRate = 0;
  let fpsStart = 0;
  const onEvent = (type, detail) => container.dispatchEvent(new CustomEvent(type, { detail }));

  scene.add(new THREE.HemisphereLight('#e4e9ff', '#4a365a', 0.85));
  const key = new THREE.DirectionalLight('#fff1e8', 1.15);
  key.position.set(3, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8cdfff', 0.8);
  rim.position.set(-5, 4, -5);
  scene.add(rim);
  const fill = new THREE.PointLight('#ff5bce', 12, 18, 2);
  fill.position.set(0, 4, -3);
  scene.add(fill);

  function box(w, h, d, color, x, y, z, emissive = false) {
    const material = emissive
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.47, metalness: 0.45 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }
  function neon(w, h, d, color, x, y, z, intensity = 2) {
    const mesh = box(w, h, d, color, x, y, z, true);
    mesh.material.color.multiplyScalar(intensity);
    return mesh;
  }

  // Open black dance floor with layered squares, diamonds and luminous centers.
  const tileTexture = textureCanvas(512, 512, (ctx) => {
    ctx.fillStyle = '#0c0d13'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#282431'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 510, 510);
    ctx.strokeStyle = '#171922'; ctx.lineWidth = 1; ctx.strokeRect(5, 5, 502, 502);
  });
  tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping;
  tileTexture.repeat.set(25, 25);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({
    map: tileTexture, color: '#151522', metalness: 0.5, roughness: 0.38
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.015;
  scene.add(floor);

  for (let row = -3; row <= 5; row++) {
    for (let col = -3; col <= 3; col++) {
      const accent = ((row + col) % 4 === 0) ? '#b658ef' : '#27d8ff';
      const layers = [
        { size: 2.12, angle: 0, thickness: 0.012, color: '#277b60', intensity: 1.1 },
        { size: 1.99, angle: 0, thickness: 0.018, color: accent, intensity: 1.65 },
        { size: 1.68, angle: Math.PI / 4, thickness: 0.019, color: '#28ceff', intensity: 1.7 },
        { size: 1.80, angle: -0.14, thickness: 0.012, color: accent, intensity: 1.65 },
        { size: 0.28, angle: Math.PI / 4, thickness: 0.018, color: '#8fefff', intensity: 1.85 }
      ];
      layers.forEach((layer, index) => floorSegments.push({
        x: col * 2.5, z: row * 2.5, y: 0.006 + index * 0.002, ...layer
      }));
    }
  }
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), floorSegments.length * 4);
  const dummy = new THREE.Object3D();
  floorSegments.forEach((part, i) => {
    const points = [
      [0, -part.size / 2, part.size, part.thickness],
      [0, part.size / 2, part.size, part.thickness],
      [-part.size / 2, 0, part.thickness, part.size],
      [part.size / 2, 0, part.thickness, part.size]
    ];
    points.forEach(([x, z, sx, sz], j) => {
      const cos = Math.cos(part.angle), sin = Math.sin(part.angle);
      dummy.position.set(part.x + x * cos + z * sin, part.y, part.z - x * sin + z * cos);
      dummy.rotation.set(0, part.angle, 0);
      dummy.scale.set(sx, 0.012, sz);
      dummy.updateMatrix();
      strips.setMatrixAt(i * 4 + j, dummy.matrix);
      const color = new THREE.Color(part.color).multiplyScalar(part.intensity);
      strips.setColorAt(i * 4 + j, color);
    });
  });
  scene.add(strips);

  const centers = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#d4ffff').multiplyScalar(1.8) }), 63);
  let centerIndex = 0;
  for (let row = -3; row <= 5; row++) {
    for (let col = -3; col <= 3; col++) {
      dummy.position.set(col * 2.5, 0.026, row * 2.5);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      centers.setMatrixAt(centerIndex++, dummy.matrix);
    }
  }
  scene.add(centers);

  // Backdrop and speakers; both sides stay open, without walls or side rails.
  box(23.5, 0.4, 1.2, '#12121b', 0, -0.12, -9.7);
  box(24, 8, 0.4, '#0b0a13', 0, 4, -10.1);
  for (let i = 0; i < 31; i++) {
    const h = 0.65 + 0.85 * (0.5 + 0.5 * Math.sin(i * 1.7));
    ledBars.push(neon(0.31, h, 0.1, i % 2 ? '#ff249c' : '#28b9ce', (i - 15) * 0.69, h / 2 + 0.32, -9.3));
  }
  neon(22, 0.025, 0.04, '#4bcfd8', 0, 2.4, -9.6, 1.6);
  neon(22, 0.023, 0.04, '#d42caa', 0, 2.55, -9.6, 1.6);
  box(8, 2.7, 0.2, '#100b1c', 0, 7.4, -9.65);
  function drawStageLogo(ctx, w, h) {
    ctx.fillStyle = '#0f0b19'; ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#80ffff'); gradient.addColorStop(0.5, '#ffffff'); gradient.addColorStop(1, '#ff68d4');
    ctx.textAlign = 'center'; ctx.fillStyle = gradient;
    ctx.font = '900 104px Arial';
    const textWidth = ctx.measureText(stageName).width;
    ctx.font = `900 ${Math.min(104, 104 * (w - 96) / Math.max(1, textWidth))}px Arial`;
    ctx.fillText(stageName, w / 2, 160);
    ctx.fillStyle = '#b4a1cf'; ctx.font = '26px Arial'; ctx.fillText('THE NIGHT IS YOURS', w / 2, 225);
    ctx.fillStyle = '#493252'; ctx.fillRect(180, 268, 664, 2);
  }
  const logoTexture = textureCanvas(1024, 320, drawStageLogo);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.35), new THREE.MeshBasicMaterial({ map: logoTexture }));
  logo.position.set(0, 7.45, -9.5);
  scene.add(logo);
  function fitStageName() {
    const label = container.querySelector('#stage-name-label');
    if (!label) return;
    const style = getComputedStyle(label.parentElement);
    const base = parseFloat(style.fontSize);
    const available = Math.max(60, label.parentElement.clientWidth - 4);
    const tracking = stageName.length > 20 ? 0.5 : 1.5;
    const ctx = logoTexture.image.getContext('2d');
    ctx.save(); ctx.font = `700 ${base}px ${style.fontFamily}`;
    const measured = ctx.measureText(stageName).width;
    label.style.letterSpacing = `${tracking}px`;
    label.style.fontSize = `${Math.min(base, Math.max(5, base * (available - (stageName.length - 1) * tracking) / Math.max(1, measured)))}px`;
    ctx.restore();
  }
  function setStageName(value) {
    const name = String(value || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 32) || 'MYTHMAKER';
    if (stageName !== name) {
      stageName = name;
      const canvas = logoTexture.image;
      drawStageLogo(canvas.getContext('2d'), canvas.width, canvas.height);
      logoTexture.needsUpdate = true;
    }
    const label = container.querySelector('#stage-name-label');
    if (label) label.textContent = stageName;
    fitStageName();
  }
  document.fonts.ready.then(() => { if (!disposed) fitStageName(); });
  for (const x of [-8.8, 8.8]) {
    for (let level = 0; level < 2; level++) {
      box(1.4, 1.65, 0.9, '#11131c', x, 0.85 + level * 1.7, -8.3);
      const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.065, 24), new THREE.MeshStandardMaterial({ color: '#080a10', metalness: 0.6, roughness: 0.65 }));
      speaker.rotation.x = Math.PI / 2;
      speaker.position.set(x, 0.85 + level * 1.7, -7.82);
      scene.add(speaker);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 6, 32), new THREE.MeshBasicMaterial({ color: '#693d87' }));
      edge.position.copy(speaker.position); edge.position.z += 0.05; scene.add(edge);
    }
  }

  // Visible volumetric-style moving beams, with soft alpha at the edges.
  const beamGeometry = new THREE.CylinderGeometry(0.06, 2.3, 1, 24, 1, true);
  beamGeometry.translate(0, -0.5, 0);
  const beamVertex = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
    void main(){vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
  const beamFragment = `uniform vec3 tint; uniform float strength; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
    void main(){float edge=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),1.8);float fade=pow(vUv.y,0.45);gl_FragColor=vec4(tint,edge*fade*strength);}`;
  for (let i = 0; i < 8; i++) {
    const color = i % 3 === 0 ? '#ffdd82' : i % 2 === 0 ? '#ff45d7' : '#87dbe4';
    const material = new THREE.ShaderMaterial({ uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: 0.105 } },
      vertexShader: beamVertex, fragmentShader: beamFragment, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeometry, material);
    const origin = new THREE.Vector3((i % 4 - 1.5) * 5, 7.0, i < 4 ? -6.5 : 5.5);
    beam.position.copy(origin);
    scene.add(beam);
    spotBeams.push({ mesh: beam, origin, phase: i * 1.6 });
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.35, 12), new THREE.MeshStandardMaterial({ color: '#191a29', metalness: 0.8 }));
    fixture.position.copy(origin); scene.add(fixture);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2) }));
    lamp.position.copy(origin); lamp.position.y -= 0.17; scene.add(lamp);
  }
  // Two laser fans; instancing keeps all 36 thin beams in one draw call.
  const laserCount = 36;
  const laserUp = new THREE.Vector3(0, 1, 0);
  const laserDirection = new THREE.Vector3();
  const laserEnd = new THREE.Vector3();
  const lasers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014 / 3, 0.014 / 3, 1, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), laserCount);
  const laserOrigins = [new THREE.Vector3(-7.5, 5.4, -8.8), new THREE.Vector3(7.5, 5.4, -8.8)];
  for (let i = 0; i < laserCount; i++) {
    lasers.setColorAt(i, new THREE.Color(i % 3 === 0 ? '#57ff99' : i % 3 === 1 ? '#28e5ff' : '#ff3be6').multiplyScalar(1.5));
  }
  lasers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lasers.frustumCulled = false;
  lasers.visible = false;
  scene.add(lasers);
  const focusLight = new THREE.PointLight('#ffce72', 0, 7, 2);
  scene.add(focusLight);
  const giftRing = new THREE.Mesh(new THREE.RingGeometry(0.79, 0.8, 64), new THREE.MeshBasicMaterial({ color: '#ffc861', side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.35 }));
  giftRing.rotation.x = -Math.PI / 2;
  giftRing.visible = false;
  scene.add(giftRing);
  const podiumLabels = container.querySelector('#top-gifter-labels') || container.appendChild(Object.assign(document.createElement('div'), { id: 'top-gifter-labels' }));
  const topStage = createTopGifterStage(scene, podiumLabels);

  function home() {
    const portrait = width / height < 0.9;
    camera.fov = portrait ? 55 : 43;
    camera.updateProjectionMatrix();
    homePosition.set(portrait ? 0.3 : 1.2, portrait ? 3.6 : 4.5, portrait ? 16.3 : 16.0);
    if (!activeGift) {
      shotKey = ''; cameraTransition = null;
      if (cameraMode === 'overview') {
        camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update();
      }
    }
  }
  const resize = new ResizeObserver(() => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    home();
    fitStageName();
  });
  resize.observe(container);

  function actorLabel(user, isDemo, isHost) {
    const label = document.createElement('div');
    label.className = 'character-label';
    label.dataset.user = String(user.uniqueId);
    if (isHost) label.classList.add('host-label');
    const badge = document.createElement('span'); badge.className = 'character-initial';
    badge.textContent = isHost ? '♛' : String(user.nickname || '?').slice(0, 1).toUpperCase();
    const text = document.createElement('div'); text.className = 'character-label-text';
    const tag = document.createElement('small'); tag.textContent = isHost ? 'Chủ sàn' : isDemo ? 'Dân chơi · XEM THỬ' : 'Dân chơi';
    const name = document.createElement('strong'); name.textContent = String(user.nickname || user.uniqueId).slice(0, 40);
    text.append(tag, name); label.append(badge, text);
    const message = document.createElement('div'); message.className = 'character-message'; message.hidden = true;
    label.append(message); labels.append(label);
    return { label, message };
  }

  function applyCharacterLabel(actor) {
    const config = CHARACTERS[actor.variant];
    actor.label.style.setProperty('--avatar-accent', config.accent);
    actor.label.dataset.character = config.id;
    actor.palette = config.name;
  }

  function attachModel(actor) {
    if (!model || actor.model) return;
    actor.avatar = createAnimeActor(model, actor.variant, actor.seed, elapsed);
    actor.model = actor.avatar.model;
    actor.materials = actor.avatar.materials;
    actor.group.add(actor.model);
    actor.mixer = actor.avatar.mixer;
    mixers.add(actor.mixer);
    applyCharacterLabel(actor);
  }

  function selectCharacter(id, characterId, preserveGift = false) {
    const actor = actors.get(id);
    const index = CHARACTERS.findIndex((config) => config.id === characterId);
    if (!actor || index < 0) return null;
    if (!actor.isHost) characterSelections.set(id, index);
    if (actor.variant === index) return CHARACTERS[index];
    if (activeGift?.id === actor.id) {
      if (!preserveGift) resetCamera();
      else { signatureEffect?.dispose(); signatureEffect = null; }
    }
    if (actor.avatar) { mixers.delete(actor.mixer); actor.avatar.dispose(); actor.model.removeFromParent(); }
    actor.avatar = null; actor.model = null; actor.variant = index;
    attachModel(actor); applyCharacterLabel(actor);
    return CHARACTERS[index];
  }

  function addParticipant(user, isDemo = false) {
    const id = String(user.uniqueId || user.nickname || 'viewer');
    const isHost = id === HOST_ID;
    if (actors.has(id)) {
      const actor = actors.get(id);
      actor.lastActiveAt = Date.now();
      return actor;
    }
    if (actors.size >= SLOT_POSITIONS.length) {
      const removable = [...actors.values()].find((actor) => !actor.isHost && activeGift?.id !== actor.id && !focusQueue.some((job) => job.id === actor.id));
      if (removable) removeParticipant(removable.id);
    }
    let slot = isHost ? 2 : 0;
    while (positions.has(slot)) slot++;
    positions.add(slot);
    const group = new THREE.Group();
    group.position.set(SLOT_POSITIONS[slot][0], 0.025, SLOT_POSITIONS[slot][1]);
    group.rotation.y = -0.12 + (hash(id) % 5) * 0.055;
    scene.add(group);
    const label = actorLabel({ ...user, uniqueId: id }, isDemo, isHost);
    const actor = { id, user, isDemo, isHost, slot, group, ...label, variant: isHost ? CHARACTERS.findIndex((config) => config.id === hostCharacter) : characterSelections.get(id) ?? hash(id) % CHARACTERS.length, seed: hash(id), materials: [], reactUntil: 0, messageUntil: 0, lastActiveAt: Date.now() };
    actors.set(id, actor);
    attachModel(actor);
    container.dataset.actorCount = actors.size;
    onEvent('club:participants', { count: actors.size, preview });
    return actor;
  }

  function removeParticipant(id, force = false) {
    const actor = actors.get(id);
    if (!actor || (actor.isHost && !force)) return;
    // Remove queued shots as well, so an expired viewer cannot block the queue.
    for (let i = focusQueue.length - 1; i >= 0; i--) {
      if (focusQueue[i].id === id) focusQueue.splice(i, 1);
    }
    if (activeGift?.id === id) clearActiveGift();
    if (actor.mixer) mixers.delete(actor.mixer);
    actor.avatar?.dispose();
    actor.label.remove();
    scene.remove(actor.group);
    positions.delete(actor.slot);
    actors.delete(id);
    container.dataset.actorCount = actors.size;
    onEvent('club:participants', { count: actors.size, preview });
  }

  function removeInactiveParticipants() {
    const now = Date.now();
    const expired = [...actors.values()].filter((actor) => !actor.isDemo && !actor.isHost && now - actor.lastActiveAt >= INACTIVITY_TIMEOUT_MS);
    // Drop every expired queued viewer before starting another close-up.
    expired.forEach((actor) => removeParticipant(actor.id));
    if (!activeGift && focusQueue.length) startGift(focusQueue.shift());
  }

  function resetParticipants() {
    resetCamera();
    [...actors.values()].filter((actor) => !actor.isHost).forEach((actor) => removeParticipant(actor.id));
    ensureHost();
  }

  function setPreview(enabled) {
    preview = enabled;
    resetParticipants();
    container.dataset.preview = String(enabled);
    if (enabled) DEMO_USERS.forEach((nickname, i) => {
      const actor = addParticipant({ uniqueId: 'demo:' + i, nickname }, true);
      selectCharacter(actor.id, CHARACTERS[i % CHARACTERS.length].id);
    });
    if (enabled) topStage.setLeaders([0, 1, 2].map((i) => ({ rank: i + 1, uniqueId: `demo:top:${i}`, nickname: ['Ngôi Sao Đêm', 'Luna VIP', 'Akira Club'][i], diamonds: [1800, 950, 500][i], gifts: [18, 19, 10][i], characterId: ['hikari', 'luna', 'akira'][i] })), true, elapsed);
    else topStage.setLeaders(lastRankings?.leaders || [], false, elapsed);
  }

  function setTopGifters(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.leaders)) return false;
    if (snapshot.epoch === rankingEpoch && snapshot.revision < rankingRevision) return false;
    if (snapshot.epoch !== rankingEpoch || snapshot.session !== rankingSession) {
      characterSelections.clear(); topCameraCursor = 0; topCameraRank = null;
    }
    rankingEpoch = snapshot.epoch; rankingSession = snapshot.session; rankingRevision = snapshot.revision;
    const seen = new Set();
    const leaders = snapshot.leaders.filter((entry) => entry.uniqueId && !seen.has(entry.uniqueId) && seen.add(entry.uniqueId)).slice(0, 3)
      .map((entry, index) => ({ ...entry, uniqueId: String(entry.uniqueId), rank: index + 1,
        characterId: CHARACTERS.some((character) => character.id === entry.characterId) ? entry.characterId : CHARACTERS[hash(String(entry.uniqueId)) % CHARACTERS.length].id }));
    for (const entry of leaders) {
      characterSelections.set(entry.uniqueId, CHARACTERS.findIndex((character) => character.id === entry.characterId));
      if (actors.has(entry.uniqueId)) selectCharacter(entry.uniqueId, entry.characterId, true);
    }
    lastRankings = { ...snapshot, leaders };
    topStage.setLeaders(leaders, false, elapsed);
    return true;
  }

  function ensureHost() {
    return actors.get(HOST_ID) || addParticipant({ uniqueId: HOST_ID, nickname: hostName });
  }

  function setHostName(value) {
    hostName = String(value || '').trim().slice(0, 40) || 'Chủ sàn';
    const host = ensureHost();
    host.user = { ...host.user, nickname: hostName };
    host.label.querySelector('strong').textContent = hostName;
    return hostName;
  }

  function setHostCharacter(value) {
    if (!CHARACTERS.some((config) => config.id === value)) return false;
    hostCharacter = value;
    selectCharacter(ensureHost().id, value);
    return true;
  }

  function showMessage(user, text, admit = true) {
    const id = String(user.uniqueId || user.nickname || 'viewer');
    const actor = admit ? addParticipant(user) : actors.get(id);
    if (!actor) return null;
    actor.lastActiveAt = Date.now();
    actor.message.textContent = String(text).slice(0, 160);
    actor.message.hidden = false;
    actor.messageUntil = elapsed + 4.5;
    return actor;
  }

  function react(user, text, admit = false) {
    const actor = showMessage(user, text, admit);
    if (!actor) return null;
    actor.reactUntil = elapsed + 1.8;
    return actor;
  }

  function startGift(job) {
    const actor = actors.get(job.id);
    if (!actor) return;
    clearPortraitFocus();
    const accent = CHARACTERS[actor.variant].accent;
    container.style.setProperty('--focus-accent', accent);
    focusLight.color.set(accent).lerp(new THREE.Color('#fff8f2'), 0.82);
    giftRing.material.color.set(accent);
    topCameraRank = null; topCameraUser = '';
    activeGift = { ...job, started: elapsed, until: elapsed + 6.4,
      fromPosition: camera.position.clone(), fromTarget: controls.target.clone() };
    controls.enabled = false;
    giftRing.position.set(actor.group.position.x, 0.025, actor.group.position.z);
    giftRing.visible = true;
    actor.label.classList.add('featured');
    actor.message.hidden = true; actor.messageUntil = 0;
    container.dataset.cameraMode = 'focus';
    container.dataset.focusedUser = actor.id;
    onEvent('club:gift', { user: actor.user, gift: job.data, character: CHARACTERS[actor.variant], preview: actor.isDemo || job.data.preview === true });
  }

  function focusGift(user, data) {
    const actor = react(user, `🎁 ${data.count || 1} × ${data.giftName || 'Quà tặng'}`, true);
    if (activeGift?.id === actor.id && elapsed < activeGift.until - 1) {
      activeGift.until = Math.min(activeGift.started + 11, elapsed + 4);
      activeGift.data = { ...data, count: (Number(activeGift.data.count) || 1) + (Number(data.count) || 1) };
      onEvent('club:gift', { user: actor.user, gift: activeGift.data, character: CHARACTERS[actor.variant], preview: actor.isDemo || activeGift.data.preview === true });
      return;
    }
    const job = { id: actor.id, data };
    if (!activeGift) startGift(job);
    else {
      const queued = focusQueue.find((entry) => entry.id === actor.id);
      if (queued) queued.data = { ...data, count: (Number(queued.data.count) || 1) + (Number(data.count) || 1) };
      else if (focusQueue.length < 8) focusQueue.push(job);
    }
  }

  function resumeDirector() {
    directorEpoch = elapsed;
    clearPortraitFocus();
    shotKey = ''; cameraTransition = null;
    topCameraRank = null; topCameraUser = '';
    cameraShot = cameraMode === 'mixed' ? 'overview' : cameraMode;
    controls.autoRotate = false;
    container.dataset.cameraMode = cameraMode;
    onEvent('club:camera-mode', { mode: cameraMode, shot: cameraMode === 'mixed' ? 'overview' : cameraMode, label: CAMERA_LABELS[cameraMode] });
  }

  function clearActiveGift() {
    if (activeGift) {
      const actor = actors.get(activeGift.id);
      actor?.label.classList.remove('featured'); actor?.avatar?.setSkill(false);
    }
    signatureEffect?.dispose(); signatureEffect = null;
    delete container.dataset.skillCharacter;
    activeGift = null;
    giftRing.visible = false;
    focusLight.intensity = 0;
    delete container.dataset.focusedUser;
    resumeDirector();
    onEvent('club:gift-end', {});
  }

  function resetCamera() {
    focusQueue.length = 0;
    clearActiveGift();
  }

  function setCameraMode(value, cancelGift = false) {
    if (!Object.hasOwn(CAMERA_LABELS, value)) return false;
    if (cancelGift) resetCamera();
    if (cameraMode === value && shotKey && !cancelGift) return true;
    cameraMode = value;
    if (!activeGift) resumeDirector();
    else onEvent('club:camera-mode', { mode: cameraMode, shot: 'gift', label: CAMERA_LABELS[cameraMode] });
    return true;
  }

  function chooseCloseup(index) {
    const candidates = [...actors.values()];
    closeupTarget = candidates[index % Math.max(1, candidates.length)]?.id || HOST_ID;
  }

  function topCameraSubject() {
    return topCameraRank === null ? null : topStage.getCameraSubjects().find((subject) => subject.rank === topCameraRank) || null;
  }

  function clearPortraitFocus() {
    portraitFocus?.effect.dispose(); portraitFocus = null;
    delete container.dataset.portraitFocus;
  }

  function updatePortraitFocus(shot) {
    let subject = null;
    if (shot === 'top') {
      const top = topCameraSubject();
      if (top) subject = { id: top.uniqueId, position: top.position, scale: top.scale, accent: top.accent };
    } else if (shot === 'closeup') {
      const actor = actors.get(closeupTarget);
      if (actor) subject = { id: actor.id, position: actor.group.position, scale: 1, accent: CHARACTERS[actor.variant].accent };
    }
    if (!subject) { clearPortraitFocus(); return; }
    const key = `${shot}:${subject.id}:${subject.accent}`;
    if (portraitFocus?.key !== key) clearPortraitFocus();
    if (!portraitFocus) {
      if (elapsed - shotEpoch < 1.05) return;
      const effect = createFocusAura(subject.accent); scene.add(effect.root);
      portraitFocus = { key, userId: subject.id, kind: shot, started: elapsed, effect };
    }
    container.dataset.portraitFocus = shot;
    container.style.setProperty('--focus-accent', subject.accent);
    portraitFocus.effect.root.position.copy(subject.position); portraitFocus.effect.root.scale.setScalar(subject.scale);
    const shotRemaining = SHOT_SECONDS - Math.max(0, elapsed - directorEpoch) % SHOT_SECONDS;
    portraitFocus.effect.update(elapsed - portraitFocus.started, camera, ease(Math.min(1, shotRemaining / 0.6)));
  }

  function directorPose(shot) {
    const portrait = width / height < 0.9;
    const target = homeTarget.clone();
    let position = homePosition.clone();
    if (shot === 'front') position.set(0, 2.6, portrait ? 15.6 : 13.5);
    if (shot === 'left') position.set(-10, 4.4, 13.5);
    if (shot === 'right') position.set(10, 4.4, 13.5);
    if (shot === 'overhead') { position.set(0.05, portrait ? 21 : 23, 2.8); target.set(0, 0.2, -0.7); }
    if (shot === 'orbit') {
      const angle = Math.sin((elapsed - shotEpoch) * 0.19) * 0.95;
      const radius = portrait ? 16.3 : 16;
      position.set(Math.sin(angle) * radius, 4.1 + Math.sin(elapsed * 0.25) * 0.35, target.z + Math.cos(angle) * radius);
    }
    if (shot === 'closeup') {
      const actor = actors.get(closeupTarget) || actors.get(HOST_ID);
      if (actor) {
        target.copy(actor.group.position).add(new THREE.Vector3(0, 1.05, 0));
        position.copy(actor.group.position).add(new THREE.Vector3(1.3, 2.1, 5.1));
      }
    }
    if (shot === 'top') {
      const subject = topCameraSubject();
      if (subject) {
        target.copy(subject.position).add(new THREE.Vector3(0, 1.45 * subject.scale, 0.45));
        const drift = Math.sin((elapsed - shotEpoch) * 0.24) * 0.45;
        position.copy(subject.position).add(new THREE.Vector3(drift, 2.3 * subject.scale, portrait ? 7.1 : 6.8));
      }
    }
    return { position, target };
  }

  function updateDirector() {
    const cycle = Math.floor(Math.max(0, elapsed - directorEpoch) / SHOT_SECONDS);
    const subjects = cameraMode === 'mixed' ? topStage.getCameraSubjects() : [];
    const mixedShots = subjects.length ? MIXED_TOP_SHOTS : MIXED_SHOTS;
    const shot = cameraMode === 'mixed' ? mixedShots[cycle % mixedShots.length] : cameraMode;
    const nextKey = shot + (cameraMode === 'mixed' || shot === 'closeup' ? ':' + cycle : '');
    const selectedTop = subjects.find((subject) => subject.rank === topCameraRank);
    const chooseTop = shot === 'top' && (nextKey !== shotKey || !selectedTop);
    const changedTop = shot === 'top' && selectedTop?.uniqueId !== topCameraUser;
    if (nextKey !== shotKey || (shot === 'closeup' && !actors.has(closeupTarget)) || chooseTop || changedTop) {
      shotKey = nextKey; cameraShot = shot; shotEpoch = elapsed;
      if (shot === 'closeup') chooseCloseup(cycle);
      if (shot === 'top') {
        if (chooseTop) topCameraRank = subjects[topCameraCursor++ % subjects.length].rank;
        topCameraUser = topCameraSubject()?.uniqueId || '';
      } else { topCameraRank = null; topCameraUser = ''; }
      controls.autoRotate = false;
      // Clear leftover orbit damping before the director takes ownership.
      controls.enableDamping = false; controls.update(); controls.enableDamping = true;
      cameraTransition = { started: elapsed, position: camera.position.clone(), target: controls.target.clone() };
      container.dataset.cameraShot = shot;
      onEvent('club:camera-mode', { mode: cameraMode, shot, label: CAMERA_LABELS[cameraMode] });
    }
    const automatic = ['mixed', 'orbit', 'closeup'].includes(cameraMode);
    const pose = directorPose(shot);
    if (cameraTransition) {
      const t = ease(Math.min(1, (elapsed - cameraTransition.started) / 1.35));
      camera.position.lerpVectors(cameraTransition.position, pose.position, t);
      controls.target.lerpVectors(cameraTransition.target, pose.target, t);
      controls.enabled = false;
      camera.lookAt(controls.target);
      if (t >= 1) cameraTransition = null;
    } else if (automatic) {
      camera.position.copy(pose.position); controls.target.copy(pose.target);
      controls.enabled = false; camera.lookAt(controls.target);
    } else controls.enabled = true;
    if (controls.enabled) controls.update();
    updatePortraitFocus(shot);
  }

  const modelReady = loadAnimeTemplate().then((template) => {
    if (disposed) return;
    model = template;
    actors.forEach(attachModel);
    topStage.setLibrary(template, elapsed);
    container.dataset.ready = 'true';
    onEvent('club:ready', { characters: CHARACTERS.map((config) => config.id) });
  }).catch((error) => {
    container.dataset.ready = 'error';
    onEvent('club:error', { message: 'Không tải được nhân vật 3D. Hãy tải lại trang.', detail: error.message });
  });

  function updateCamera() {
    if (!activeGift) { updateDirector(); return; }
    const actor = actors.get(activeGift.id);
    if (!actor) { resetCamera(); return; }
    const age = elapsed - activeGift.started;
    const remaining = activeGift.until - elapsed;
    // Start the signature only once the camera has arrived. Queued dancers
    // continue their regular dance until their own shot starts.
    if (age >= 1.1 && remaining > 0.5 && !signatureEffect && actor.avatar) {
      actor.avatar.setSkill(true);
      signatureEffect = createSignatureEffect(CHARACTERS[actor.variant]);
      signatureEffect.root.position.copy(actor.group.position);
      scene.add(signatureEffect.root);
      container.dataset.skillCharacter = CHARACTERS[actor.variant].id;
      onEvent('club:skill', { userId: actor.id, character: CHARACTERS[actor.variant] });
    }
    const target = actor.group.position.clone().add(new THREE.Vector3(0, 1.18, 0));
    const angle = 0.25 + Math.sin(age * 0.28) * 0.18;
    const distance = CHARACTERS[actor.variant].id === 'hikari' ? 6.7 : 5.7;
    const close = actor.group.position.clone().add(new THREE.Vector3(Math.sin(angle) * distance, 2.2, Math.cos(angle) * distance));
    if (age < 1.1) {
      const t = ease(age / 1.1);
      camera.position.lerpVectors(activeGift.fromPosition, close, t);
      controls.target.lerpVectors(activeGift.fromTarget, target, t);
    } else if (remaining < 1.1) {
      const t = ease(1 - Math.max(0, remaining) / 1.1);
      const resumeShot = cameraMode === 'mixed' ? 'overview' : cameraMode;
      const pose = directorPose(resumeShot);
      camera.position.lerpVectors(close, pose.position, t);
      controls.target.lerpVectors(target, pose.target, t);
    } else { camera.position.copy(close); controls.target.copy(target); }
    camera.lookAt(controls.target);
    if (signatureEffect) signatureEffect.update(age - 1.1, Math.min(1, Math.max(0, (age - 1.1) * 3), Math.max(0, remaining * 2)), camera);
    focusLight.position.copy(target).add(new THREE.Vector3(0, 1.7, 1.4));
    focusLight.intensity = Math.min(2.1, age * 2.1) * Math.min(1, Math.max(0, remaining));
    giftRing.visible = !signatureEffect;
    giftRing.scale.setScalar(0.8 + ease(Math.min(age / 1.1, 1)) * 0.2);
    giftRing.material.opacity = Math.min(1, age * 2) * 0.35;
    if (remaining <= 0) {
      clearActiveGift();
      const next = focusQueue.shift();
      if (next) startGift(next);
    }
  }

  function animate(now) {
    if (disposed) return;
    requestAnimationFrame(animate);
    // Render at 30 fps; bound the device-pixel ratio and reflection resolution.
    if (document.hidden || now - renderTime < 31) return;
    renderTime = now;
    const delta = Math.min(clock.getDelta(), 0.08);
    elapsed += delta;
    frameCount++;
    if (now - fpsStart > 1500) { frameRate = Math.round(frameCount * 1000 / (now - fpsStart)); fpsStart = now; frameCount = 0; }
    mixers.forEach((mixer) => mixer.update(delta));
    const beat = 0.8 + Math.pow(Math.max(0, Math.sin(elapsed * Math.PI * 128 / 60)), 5) * 0.2;
    strips.material.color.setScalar(lightsOn ? beat : 0.3);
    ledBars.forEach((bar, i) => { bar.scale.y = lightsOn ? 0.68 + Math.sin(elapsed * 2.2 + i * 0.4) * 0.25 : 0.45; });
    spotBeams.forEach(({ mesh, origin, phase }) => {
      mesh.visible = lightsOn;
      const end = new THREE.Vector3(Math.sin(elapsed * 0.3 + phase) * 7, 0, Math.cos(elapsed * 0.26 + phase) * 6);
      const direction = end.sub(origin);
      mesh.scale.y = direction.length();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction.normalize());
    });
    lasers.visible = laserEnabled;
    if (laserEnabled) {
      for (let i = 0; i < laserCount; i++) {
        const bank = Math.floor(i / 18);
        const fan = (i % 18) / 17 - 0.5;
        const origin = laserOrigins[bank];
        laserEnd.set(fan * 17 + Math.sin(elapsed * 0.45 + bank * Math.PI) * 3, 0.08,
          6 + Math.sin(elapsed * 0.6 + fan * 2 + bank) * 4);
        laserDirection.subVectors(laserEnd, origin);
        dummy.position.copy(origin).add(laserEnd).multiplyScalar(0.5);
        dummy.quaternion.setFromUnitVectors(laserUp, laserDirection.clone().normalize());
        dummy.scale.set(1, laserDirection.length(), 1);
        dummy.updateMatrix();
        lasers.setMatrixAt(i, dummy.matrix);
      }
      lasers.instanceMatrix.needsUpdate = true;
    }
    const giftBanner = activeGift ? container.querySelector('#gift-feature') : null;
    const labelCeiling = giftBanner && !giftBanner.hidden ? giftBanner.offsetTop + giftBanner.offsetHeight + 10 : 0;
    actors.forEach((actor) => {
      actor.avatar?.update(delta, elapsed);
      if (actor.messageUntil && elapsed > actor.messageUntil) { actor.message.hidden = true; actor.messageUntil = 0; }
      if (actor.mixer) actor.mixer.timeScale = 1;
      projection.copy(actor.group.position).y += actor.avatar?.labelHeight || 2.58;
      projection.project(camera);
      const visible = projection.z < 1 && projection.z > -1 && Math.abs(projection.x) < 1.18 && Math.abs(projection.y) < 1.15;
      actor.label.hidden = !visible;
      if (visible) {
        const projectedY = (-projection.y * 0.5 + 0.5) * height;
        const labelY = activeGift?.id === actor.id ? Math.max(projectedY, labelCeiling + actor.label.offsetHeight) : projectedY;
        actor.label.style.transform = `translate(-50%, -100%) translate(${(projection.x * 0.5 + 0.5) * width}px, ${labelY}px)`;
        const distance = camera.position.distanceTo(actor.group.position);
        actor.label.style.setProperty('--label-scale', Math.min(1, Math.max(0.64, 11 / distance)));
        actor.label.style.zIndex = String(1000 - Math.round(distance * 10));
      }
    });
    updateCamera();
    topStage.update(delta, elapsed, camera, width, height, !!activeGift, activeGift ? null : topCameraRank, !!portraitFocus);
    renderer.info.reset();
    if (lightweight) renderer.render(scene, camera);
    else composer.render();
  }
  // Use wall-clock time rather than animation time, including hidden OBS tabs.
  const inactivityTimer = setInterval(removeInactiveParticipants, 1000);
  const onVisibilityChange = () => { clock.getDelta(); removeInactiveParticipants(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  container.dataset.cameraMode = 'overview';
  setPreview(false);
  requestAnimationFrame(animate);

  return {
    ready: modelReady,
    addParticipant,
    removeParticipant,
    resetParticipants,
    setPreview,
    setTopGifters,
    setHostName,
    setStageName,
    setNowPlaying(track) { topStage.setNowPlaying(track); },
    setHostCharacter,
    selectCharacter,
    getCharacters() { return CHARACTERS.map((config) => ({ ...config })); },
    getTopRoles() { return [...TOP_ROLES]; },
    setCameraMode,
    setLaserEnabled(value) { laserEnabled = value === true; lasers.visible = laserEnabled; },
    showMessage,
    react,
    focusGift,
    resetCamera,
    testGift() {
      const list = [...actors.values()];
      if (!list.length) return false;
      const actor = [...actors.values()][Math.floor(Math.random() * actors.size)];
      focusGift(actor.user, { giftName: 'Hoa hồng', count: 5, diamonds: 5, preview: true });
      return true;
    },
    changeAvatar(id) {
      const actor = actors.get(id) || actors.get(activeGift?.id) || actors.values().next().value;
      if (!actor) return;
      return selectCharacter(actor.id, CHARACTERS[(actor.variant + 1) % CHARACTERS.length].id)?.name;
    },
    toggleLights() { lightsOn = !lightsOn; return lightsOn; },
    toggleOrbit() { const enabled = cameraMode !== 'orbit'; setCameraMode(enabled ? 'orbit' : 'overview'); return enabled; },
    getSnapshot(includeBounds = false) {
      const topSubject = !activeGift && topCameraSubject();
      return { ready: !!model, preview, actorCount: actors.size, animatedCount: mixers.size, fps: frameRate,
        cameraMode: activeGift ? 'focus' : cameraMode, selectedCameraMode: cameraMode, cameraShot,
        cameraTop: topSubject ? { rank: topSubject.rank, uniqueId: topSubject.uniqueId, nickname: topSubject.nickname } : null,
        shotDurationSeconds: SHOT_SECONDS, directorElapsed: elapsed - directorEpoch,
        stageName, stageLogoVersion: logoTexture.version, hostName, hostCharacter, hostId: HOST_ID, viewerCount: [...actors.values()].filter((actor) => !actor.isHost && !actor.isDemo).length,
        activeSkill: signatureEffect ? { userId: activeGift?.id, characterId: signatureEffect.characterId, name: signatureEffect.name, ...signatureEffect.getSnapshot() } : null,
        cameraAura: portraitFocus ? { userId: portraitFocus.userId, kind: portraitFocus.kind } : null,
        focusedUser: activeGift?.id || null, queueLength: focusQueue.length,
        camera: camera.position.toArray(), target: controls.target.toArray(), lightsOn, laserEnabled,
        laserBeamCount: lasers.visible ? laserCount : 0, mixedShots: [...(topStage.getCameraSubjects().length ? MIXED_TOP_SHOTS : MIXED_SHOTS)],
        inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
        topGifters: topStage.getSnapshot(),
        nowPlaying: topStage.getNowPlaying(),
        participants: [...actors.values()].map((actor) => ({ id: actor.id, nickname: actor.user.nickname, isHost: actor.isHost, isDemo: actor.isDemo, palette: actor.palette,
          characterId: CHARACTERS[actor.variant].id, dance: CHARACTERS[actor.variant].dance, skill: CHARACTERS[actor.variant].skill,
          body: CHARACTERS[actor.variant].body, outfit: CHARACTERS[actor.variant].outfit,
          motionSource: actor.avatar?.motionSource,
          choreography: actor.avatar?.getChoreography(),
          animation: actor.avatar?.special.isRunning() && actor.avatar.special.getEffectiveWeight() > 0.5 ? 'skill' : 'dance', animationTime: actor.mixer?.time || 0,
          position: actor.group.position.toArray(), lastActiveAt: actor.lastActiveAt, ...(includeBounds ? { bounds: new THREE.Box3().setFromObject(actor.group, true) } : {}) })),
        triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    },
    dispose() {
      disposed = true; clearInterval(inactivityTimer); document.removeEventListener('visibilitychange', onVisibilityChange);
      resetCamera(); [...actors.keys()].forEach((id) => removeParticipant(id, true));
      topStage.dispose();
      resize.disconnect(); controls.dispose();
      composer.dispose(); renderer.dispose();
    }
  };
};
