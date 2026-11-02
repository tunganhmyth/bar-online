import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const PALETTES = [
  { name: 'Neon Rose', hair: '#e7baca', top: '#ff379a', bottom: '#131321', shoes: '#f3f4ff' },
  { name: 'Midnight', hair: '#121522', top: '#ecf6ff', bottom: '#223249', shoes: '#e1ebf9' },
  { name: 'Electric Blue', hair: '#74c8e8', top: '#57deee', bottom: '#141b29', shoes: '#eefcff' },
  { name: 'Violet', hair: '#a98ee4', top: '#9970ed', bottom: '#21172d', shoes: '#eee4ff' },
  { name: 'Blonde', hair: '#e3c17a', top: '#f4f0e7', bottom: '#3d4b72', shoes: '#f9fafc' },
  { name: 'Cherry', hair: '#5c142f', top: '#c51e52', bottom: '#161421', shoes: '#222035' },
  { name: 'Silver', hair: '#d8e2ec', top: '#202334', bottom: '#e0e4ec', shoes: '#252438' },
  { name: 'Mint', hair: '#293f36', top: '#78e3b4', bottom: '#222b3b', shoes: '#e8f9f0' }
];
const SLOT_POSITIONS = [
  [-2.5, 2.5], [2.5, 2.5], [0, 0], [-5, 0], [5, 0],
  [-2.5, -2.5], [2.5, -2.5], [-5, -5], [0, -5], [5, -5],
  [0, 5], [-5, 5], [5, 5], [-7.5, 2.5], [7.5, 2.5],
  [-7.5, -2.5], [7.5, -2.5], [-2.5, -7.5], [2.5, -7.5],
  [-7.5, 5], [7.5, 5], [-5, -7.5], [5, -7.5], [0, 7.5],
  [-7.5, -5], [7.5, -5], [-5, 7.5], [5, 7.5], [-2.5, 7.5], [2.5, 7.5]
];
const DEMO_USERS = ['Mina', 'Luna', 'Kira', 'Yuna', 'Sora', 'Ruby', 'Hana', 'Yuki'];
const hash = (text) => [...text].reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) >>> 0), 0);
const ease = (t) => t * t * (3 - 2 * t);

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
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.4;
  controls.target.set(0, 1, -0.5);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 768), 0.36, 0.45, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const actors = new Map();
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
  let danceClip = null;
  let modelScale = 1;
  let modelOffset = 0;
  let elapsed = 0;
  let activeGift = null;
  let width = 1, height = 1;
  let preview = false;
  let lightsOn = true;
  let orbit = false;
  let disposed = false;
  let renderTime = 0;
  let frameCount = 0;
  let frameRate = 0;
  let fpsStart = 0;
  const onEvent = (type, detail) => container.dispatchEvent(new CustomEvent(type, { detail }));

  scene.add(new THREE.HemisphereLight('#cfd7ff', '#332447', 1.9));
  const key = new THREE.DirectionalLight('#ffecd9', 2.8);
  key.position.set(3, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8cdfff', 2.5);
  rim.position.set(-5, 4, -5);
  scene.add(rim);
  const fill = new THREE.PointLight('#ff5bce', 32, 18, 2);
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
  box(8, 2.7, 0.2, '#100b1c', 0, 3.8, -9.65);
  const logoTexture = textureCanvas(1024, 320, (ctx, w, h) => {
    ctx.fillStyle = '#0f0b19'; ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#80ffff'); gradient.addColorStop(0.5, '#ffffff'); gradient.addColorStop(1, '#ff68d4');
    ctx.textAlign = 'center'; ctx.fillStyle = gradient;
    ctx.font = '900 104px Arial'; ctx.fillText('MYTHMAKER', w / 2, 160);
    ctx.fillStyle = '#b4a1cf'; ctx.font = '26px Arial'; ctx.fillText('THE NIGHT IS YOURS', w / 2, 225);
    ctx.fillStyle = '#493252'; ctx.fillRect(180, 268, 664, 2);
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.35), new THREE.MeshBasicMaterial({ map: logoTexture }));
  logo.position.set(0, 3.85, -9.5);
  scene.add(logo);
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
  const focusLight = new THREE.PointLight('#ffce72', 0, 7, 2);
  scene.add(focusLight);
  const giftRing = new THREE.Mesh(new THREE.RingGeometry(0.83, 0.86, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(2.5), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  giftRing.rotation.x = -Math.PI / 2;
  giftRing.visible = false;
  scene.add(giftRing);

  function home() {
    const portrait = width / height < 0.9;
    camera.fov = portrait ? 55 : 43;
    camera.updateProjectionMatrix();
    homePosition.set(portrait ? 0.3 : 1.2, portrait ? 3.6 : 4.5, portrait ? 16.3 : 16.0);
    if (!activeGift) { camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update(); }
  }
  const resize = new ResizeObserver(() => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    home();
  });
  resize.observe(container);

  function actorLabel(user, isDemo) {
    const label = document.createElement('div');
    label.className = 'character-label';
    label.dataset.user = String(user.uniqueId);
    const badge = document.createElement('span'); badge.className = 'character-initial';
    badge.textContent = String(user.nickname || '?').slice(0, 1).toUpperCase();
    const text = document.createElement('div'); text.className = 'character-label-text';
    const tag = document.createElement('small'); tag.textContent = isDemo ? 'DANCER · XEM THỬ' : 'TIKTOK LIVE';
    const name = document.createElement('strong'); name.textContent = String(user.nickname || user.uniqueId).slice(0, 40);
    text.append(tag, name); label.append(badge, text);
    const message = document.createElement('div'); message.className = 'character-message'; message.hidden = true;
    label.append(message); labels.append(label);
    return { label, message };
  }

  function applyPalette(actor) {
    const colors = PALETTES[actor.variant % PALETTES.length];
    for (const material of actor.materials) {
      const name = material.name.toLowerCase();
      if (name === 'hair') material.color.set(colors.hair);
      else if (name === 't-shirt') material.color.set(colors.top);
      else if (name === 'short') material.color.set(colors.bottom);
      else if (name === 'white') material.color.set(colors.shoes);
      else if (name === 'black') material.color.set('#131623');
      else if (name === 'skin') material.color.set(['#eac1a8', '#e6b79d', '#c28d6f'][actor.variant % 3]);
      material.roughness = name === 'hair' ? 0.65 : 0.8;
      material.metalness = 0;
    }
    actor.label.style.setProperty('--avatar-accent', colors.top);
    actor.palette = colors.name;
  }

  function attachModel(actor) {
    if (!model || actor.model) return;
    actor.model = cloneSkeleton(model);
    actor.materials = [];
    actor.model.traverse((child) => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
        actor.materials.push(...child.material);
      } else { child.material = child.material.clone(); actor.materials.push(child.material); }
      child.frustumCulled = false;
    });
    actor.model.scale.setScalar(modelScale);
    actor.model.position.y = modelOffset;
    actor.group.add(actor.model);
    actor.head = actor.model.getObjectByName('mixamorigHead');
    actor.mixer = new THREE.AnimationMixer(actor.model);
    const action = actor.mixer.clipAction(danceClip);
    action.play(); action.time = actor.seed % Math.max(1, danceClip.duration);
    action.timeScale = 0.88 + actor.variant * 0.035;
    actor.action = action;
    mixers.add(actor.mixer);
    applyPalette(actor);
  }

  function addParticipant(user, isDemo = false) {
    const id = String(user.uniqueId || user.nickname || 'viewer');
    if (actors.has(id)) return actors.get(id);
    if (actors.size >= SLOT_POSITIONS.length) {
      const removable = [...actors.values()].find((actor) => activeGift?.id !== actor.id && !focusQueue.some((job) => job.id === actor.id));
      if (removable) removeParticipant(removable.id);
    }
    let slot = 0;
    while (positions.has(slot)) slot++;
    positions.add(slot);
    const group = new THREE.Group();
    group.position.set(SLOT_POSITIONS[slot][0], 0.025, SLOT_POSITIONS[slot][1]);
    group.rotation.y = -0.12 + (hash(id) % 5) * 0.055;
    scene.add(group);
    const label = actorLabel({ ...user, uniqueId: id }, isDemo);
    const actor = { id, user, isDemo, slot, group, ...label, variant: hash(id) % PALETTES.length, seed: hash(id), materials: [], reactUntil: 0, messageUntil: 0 };
    actors.set(id, actor);
    attachModel(actor);
    container.dataset.actorCount = actors.size;
    onEvent('club:participants', { count: actors.size, preview });
    return actor;
  }

  function removeParticipant(id) {
    const actor = actors.get(id);
    if (!actor) return;
    actor.mixer?.stopAllAction();
    if (actor.mixer) { actor.mixer.uncacheRoot(actor.model); mixers.delete(actor.mixer); }
    actor.materials.forEach((material) => material.dispose());
    actor.label.remove();
    scene.remove(actor.group);
    positions.delete(actor.slot);
    actors.delete(id);
  }

  function resetParticipants() {
    resetCamera();
    [...actors.keys()].forEach(removeParticipant);
    container.dataset.actorCount = 0;
    onEvent('club:participants', { count: 0, preview });
  }

  function setPreview(enabled) {
    preview = enabled;
    resetParticipants();
    container.dataset.preview = String(enabled);
    if (enabled) DEMO_USERS.forEach((nickname, i) => {
      const actor = addParticipant({ uniqueId: 'demo:' + i, nickname }, true);
      actor.variant = i;
      if (actor.model) applyPalette(actor);
    });
  }

  function showMessage(user, text) {
    const actor = addParticipant(user);
    actor.message.textContent = String(text).slice(0, 160);
    actor.message.hidden = false;
    actor.messageUntil = elapsed + 4.5;
    return actor;
  }

  function react(user, text) {
    const actor = showMessage(user, text);
    actor.reactUntil = elapsed + 1.8;
    return actor;
  }

  function startGift(job) {
    const actor = actors.get(job.id);
    if (!actor) return;
    activeGift = { ...job, started: elapsed, until: elapsed + 6.4,
      fromPosition: camera.position.clone(), fromTarget: controls.target.clone() };
    controls.enabled = false;
    giftRing.position.set(actor.group.position.x, 0.025, actor.group.position.z);
    giftRing.visible = true;
    actor.label.classList.add('featured');
    container.dataset.cameraMode = 'focus';
    container.dataset.focusedUser = actor.id;
    onEvent('club:gift', { user: actor.user, gift: job.data, preview: actor.isDemo || job.data.preview === true });
  }

  function focusGift(user, data) {
    const actor = react(user, `🎁 ${data.count || 1} × ${data.giftName || 'Quà tặng'}`);
    if (activeGift?.id === actor.id && elapsed < activeGift.until - 1) {
      activeGift.until = Math.min(activeGift.started + 11, elapsed + 4);
      activeGift.data = { ...data, count: (Number(activeGift.data.count) || 1) + (Number(data.count) || 1) };
      onEvent('club:gift', { user: actor.user, gift: activeGift.data, preview: actor.isDemo || activeGift.data.preview === true });
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

  function resetCamera() {
    if (activeGift) actors.get(activeGift.id)?.label.classList.remove('featured');
    activeGift = null;
    focusQueue.length = 0;
    controls.enabled = true;
    controls.autoRotate = orbit;
    giftRing.visible = false;
    focusLight.intensity = 0;
    container.dataset.cameraMode = 'overview';
    delete container.dataset.focusedUser;
    camera.position.copy(homePosition); controls.target.copy(homeTarget); controls.update();
    onEvent('club:gift-end', {});
  }

  const modelReady = new GLTFLoader().loadAsync('/models/club-dancer.glb').then((gltf) => {
    if (disposed) return;
    model = gltf.scene;
    // Skin bounds require every bone's world matrix to be current before measuring.
    model.updateMatrixWorld(true);
    model.traverse((child) => { if (child.isSkinnedMesh) child.computeBoundingBox(); });
    const bounds = new THREE.Box3().setFromObject(model, true);
    modelScale = 2.1 / bounds.getSize(new THREE.Vector3()).y;
    modelOffset = -bounds.min.y * modelScale;
    danceClip = gltf.animations.find((clip) => /samba|dance/i.test(clip.name)) || gltf.animations[0];
    if (!danceClip) throw new Error('Model chưa có animation nhảy.');
    actors.forEach(attachModel);
    container.dataset.ready = 'true';
    onEvent('club:ready', { animations: gltf.animations.map((clip) => clip.name) });
  }).catch((error) => {
    container.dataset.ready = 'error';
    onEvent('club:error', { message: 'Không tải được nhân vật 3D. Hãy tải lại trang.', detail: error.message });
  });

  function updateCamera() {
    if (!activeGift) { controls.autoRotate = orbit; controls.autoRotateSpeed = 0.45; return; }
    const actor = actors.get(activeGift.id);
    if (!actor) { resetCamera(); return; }
    const age = elapsed - activeGift.started;
    const remaining = activeGift.until - elapsed;
    const target = actor.group.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    const angle = 0.25 + Math.sin(age * 0.28) * 0.18;
    const close = actor.group.position.clone().add(new THREE.Vector3(Math.sin(angle) * 4.8, 2.0, Math.cos(angle) * 4.8));
    if (age < 1.1) {
      const t = ease(age / 1.1);
      camera.position.lerpVectors(activeGift.fromPosition, close, t);
      controls.target.lerpVectors(activeGift.fromTarget, target, t);
    } else if (remaining < 1.1) {
      const t = ease(1 - Math.max(0, remaining) / 1.1);
      camera.position.lerpVectors(close, homePosition, t);
      controls.target.lerpVectors(target, homeTarget, t);
    } else { camera.position.copy(close); controls.target.copy(target); }
    camera.lookAt(controls.target);
    focusLight.position.copy(target).add(new THREE.Vector3(0, 1.7, 1.4));
    focusLight.intensity = Math.min(16, age * 16) * Math.min(1, Math.max(0, remaining));
    giftRing.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.07);
    giftRing.material.opacity = 0.7 + Math.sin(elapsed * 8) * 0.22;
    if (remaining <= 0) {
      actor.label.classList.remove('featured');
      activeGift = null;
      giftRing.visible = false; focusLight.intensity = 0;
      controls.enabled = true;
      container.dataset.cameraMode = 'overview';
      delete container.dataset.focusedUser;
      onEvent('club:gift-end', {});
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
    actors.forEach((actor) => {
      if (actor.head) actor.head.scale.setScalar(0.8);
      if (actor.messageUntil && elapsed > actor.messageUntil) { actor.message.hidden = true; actor.messageUntil = 0; }
      if (actor.action) actor.action.timeScale = (0.88 + actor.variant * 0.035) * (actor.reactUntil > elapsed ? 1.3 : 1);
      projection.copy(actor.group.position).y += 2.34;
      projection.project(camera);
      const visible = projection.z < 1 && projection.z > -1 && Math.abs(projection.x) < 1.18 && Math.abs(projection.y) < 1.15;
      actor.label.hidden = !visible;
      if (visible) {
        actor.label.style.transform = `translate(-50%, -100%) translate(${(projection.x * 0.5 + 0.5) * width}px, ${(-projection.y * 0.5 + 0.5) * height}px)`;
        const distance = camera.position.distanceTo(actor.group.position);
        actor.label.style.setProperty('--label-scale', Math.min(1, Math.max(0.64, 11 / distance)));
        actor.label.style.zIndex = String(1000 - Math.round(distance * 10));
      }
    });
    updateCamera();
    if (!activeGift) controls.update();
    renderer.info.reset();
    if (lightweight) renderer.render(scene, camera);
    else composer.render();
  }
  document.addEventListener('visibilitychange', () => clock.getDelta());
  container.dataset.cameraMode = 'overview';
  setPreview(true);
  requestAnimationFrame(animate);

  return {
    ready: modelReady,
    addParticipant,
    resetParticipants,
    setPreview,
    showMessage,
    react,
    focusGift,
    resetCamera,
    testGift() {
      const list = [...actors.values()];
      if (!list.length) setPreview(true);
      const actor = [...actors.values()][Math.floor(Math.random() * actors.size)];
      focusGift(actor.user, { giftName: 'Hoa hồng', count: 5, diamonds: 5, preview: true });
    },
    changeAvatar(id) {
      const actor = actors.get(id) || actors.get(activeGift?.id) || actors.values().next().value;
      if (!actor) return;
      actor.variant = (actor.variant + 1) % PALETTES.length;
      if (actor.model) applyPalette(actor);
      return actor.palette;
    },
    toggleLights() { lightsOn = !lightsOn; return lightsOn; },
    toggleOrbit() { orbit = !orbit; controls.autoRotate = orbit; return orbit; },
    getSnapshot(includeBounds = false) {
      return { ready: !!model, preview, actorCount: actors.size, animatedCount: mixers.size, fps: frameRate,
        cameraMode: activeGift ? 'focus' : 'overview', focusedUser: activeGift?.id || null, queueLength: focusQueue.length,
        camera: camera.position.toArray(), target: controls.target.toArray(), lightsOn,
        participants: [...actors.values()].map((actor) => ({ id: actor.id, nickname: actor.user.nickname, palette: actor.palette, position: actor.group.position.toArray(), ...(includeBounds ? { bounds: new THREE.Box3().setFromObject(actor.group, true) } : {}) })),
        triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    },
    dispose() {
      disposed = true; resetParticipants(); resize.disconnect(); controls.dispose();
      composer.dispose(); renderer.dispose();
    }
  };
};
