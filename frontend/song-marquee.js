import * as THREE from 'three';

// A physical LED strip on the front of the DJ podium. Only the texture UV moves
// during rendering; the canvas is repainted when the selected song changes.
export function createSongMarquee(parent, position) {
  const width = 12.1, height = 0.66;
  const root = new THREE.Group(); root.name = 'now-playing-marquee'; root.position.set(...position); parent.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const black = new THREE.MeshBasicMaterial({ color: '#080c17' });
  const cyan = new THREE.MeshBasicMaterial({ color: '#69e6f2', toneMapped: false });
  const pink = new THREE.MeshBasicMaterial({ color: '#e678bd', toneMapped: false });
  const panel = new THREE.Mesh(box, black); panel.scale.set(width + 0.16, height + 0.12, 0.1); root.add(panel);
  for (const [y, material] of [[height / 2 + 0.035, cyan], [-height / 2 - 0.035, pink]]) {
    const edge = new THREE.Mesh(box, material); edge.scale.set(width + 0.12, 0.018, 0.02); edge.position.set(0, y, 0.065); root.add(edge);
  }
  const canvas = document.createElement('canvas'); canvas.height = 128;
  const ctx = canvas.getContext('2d');
  function makeTexture() {
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace;
    next.wrapS = THREE.RepeatWrapping; next.generateMipmaps = false;
    next.minFilter = THREE.LinearFilter; next.magFilter = THREE.LinearFilter;
    return next;
  }
  let texture = makeTexture();
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const face = new THREE.Mesh(geometry, material); face.position.z = 0.06; root.add(face);
  let title = '', artist = '', text = '', scrollPixels = 0, textureVersion = 0, brightness = 1;
  function setTrack(track = {}) {
    const nextTitle = String(track.title || '').trim().slice(0, 160);
    const nextArtist = String(track.artist || '').trim().slice(0, 160);
    const nextText = nextTitle ? `♫  ${nextTitle}${nextArtist ? '  •  ' + nextArtist : ''}  ✦` : '♫  CHỜ CHỌN NHẠC  ✦';
    if (text === nextText) return;
    title = nextTitle; artist = nextArtist; text = nextText;
    ctx.font = '700 78px Arial';
    const measured = ctx.measureText(text).width;
    canvas.width = Math.min(8192, Math.max(1024, Math.ceil(measured + 220)));
    ctx.fillStyle = '#081320'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const font = Math.min(78, 78 * (canvas.width - 220) / Math.max(1, measured));
    ctx.font = `700 ${font}px Arial`; ctx.textBaseline = 'middle';
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#7debf1'); gradient.addColorStop(0.5, '#fff4fc'); gradient.addColorStop(1, '#f4a5da');
    ctx.fillStyle = gradient; ctx.fillText(text, 12, 66);
    // WebGL texture storage has a fixed size after its first upload. A song
    // with a different text width needs a fresh texture, not just needsUpdate.
    const previous = texture; texture = makeTexture(); material.map = texture; previous.dispose();
    texture.repeat.x = width * canvas.height / (height * canvas.width);
    scrollPixels = 0; texture.offset.x = 0; textureVersion++;
  }
  setTrack();
  return {
    setTrack,
    update(delta, focusBrightness = 1) {
      scrollPixels = (scrollPixels + delta * 110) % canvas.width; texture.offset.x = scrollPixels / canvas.width;
      brightness = THREE.MathUtils.damp(brightness, focusBrightness, 5, delta);
      material.color.setScalar(brightness); cyan.color.set('#69e6f2').multiplyScalar(brightness); pink.color.set('#e678bd').multiplyScalar(brightness);
    },
    getSnapshot() { return { title, artist, text, scrollOffset: texture.offset.x, textureVersion, position: root.position.toArray() }; },
    dispose() { root.removeFromParent(); box.dispose(); geometry.dispose(); black.dispose(); cyan.dispose(); pink.dispose(); material.dispose(); texture.dispose(); }
  };
}
