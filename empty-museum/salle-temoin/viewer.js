import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createMuseumV5Navigation} from '../museum-v5.js?v=20261110temoin';
import {museumCameraMotion} from '../movement3d.js';
import {buildLayout} from './room-layout.mjs';

const layout = buildLayout();
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer:coarse)').matches;
const tier = params.get('tier') || (coarse || innerWidth < 820 ? 'mobile' : 'desktop');
const mobile = tier === 'mobile';
const shot = params.get('shot') || '';
const ASSET = 'salle-temoin/assets/';

const canvas = document.getElementById('walkCanvas');
const overlay = document.getElementById('walkOverlay');
const statusEl = document.getElementById('temoinStatus');
if (shot && shot !== 'mobile') document.body.classList.add('is-shot');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: mobile ? 'low-power' : 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = layout.room.exposure;
renderer.setClearColor(0x14110e, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.75));
// Illumination comes from the Cycles lightmap. A second shadow map
// reintroduced the hard stripes the bake is meant to soften.

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(mobile ? 58 : 46, 1, 0.08, 80);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = mobile ? 0.22 : 0.38;

const gltfLoader = new GLTFLoader();
const ktx2 = new KTX2Loader().setTranscoderPath('salle-temoin/basis/');
ktx2.detectSupport(renderer);

function loadTexture(url, colorSpace) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, texture => {
      texture.colorSpace = colorSpace;
      texture.anisotropy = mobile ? 4 : 8;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      resolve(texture);
    }, undefined, reject);
  });
}

async function loadLightmap() {
  if (mobile) {
    try {
      const texture = await ktx2.loadAsync(ASSET + 'lightmap-mobile.ktx2');
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      texture.channel = 1;
      lightScale = 1;
      return texture;
    } catch (error) {
      console.warn('KTX2 lightmap unavailable, using the half-resolution HDR bake.', error);
    }
    const mobileHdr = await new RGBELoader().loadAsync(ASSET + 'lightmap-mobile.hdr');
    mobileHdr.colorSpace = THREE.LinearSRGBColorSpace;
    mobileHdr.channel = 1;
    return mobileHdr;
  }
  const texture = await new RGBELoader().loadAsync(ASSET + 'lightmap.hdr');
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.channel = 1;
  return texture;
}

function atlasCell(index, columns = 8) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const pad = 0.015 / columns;
  const step = 1 / columns;
  return {
    u0: column * step + pad,
    v0: row * step + pad,
    u1: (column + 1) * step - pad,
    v1: (row + 1) * step - pad,
  };
}

async function paintingAtlas(frames) {
  const columns = 8;
  const size = mobile ? 1024 : 4096;
  const canvasAtlas = document.createElement('canvas');
  canvasAtlas.width = canvasAtlas.height = size;
  const context = canvasAtlas.getContext('2d');
  context.fillStyle = '#6a5342';
  context.fillRect(0, 0, size, size);
  let index = 0;
  for (const frame of frames) {
    if (frame.hero) continue;
    const cell = atlasCell(index);
    index += 1;
    const image = await loadImage(ASSET + 'paintings/pd/painting-' + frame.painting + '.webp');
    const x = cell.u0 * size;
    // glTF stores V flipped, so the first cell lives at the top of the canvas.
    const y = cell.v0 * size;
    const w = (cell.u1 - cell.u0) * size;
    const h = (cell.v1 - cell.v0) * size;
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    const imageAspect = image.width / image.height;
    const cellAspect = w / h;
    let dw = w;
    let dh = h;
    let dx = x;
    let dy = y;
    if (imageAspect > cellAspect) {
      dw = h * imageAspect;
      dx = x - (dw - w) / 2;
    } else {
      dh = w / imageAspect;
      dy = y - (dh - h) / 2;
    }
    context.drawImage(image, dx, dy, dw, dh);
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvasAtlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = mobile ? 4 : 8;
  texture.needsUpdate = true;
  return texture;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function cartelAtlas(cartels) {
  const columns = 8;
  const size = mobile ? 1024 : 4096;
  const plate = document.createElement('canvas');
  plate.width = plate.height = size;
  const context = plate.getContext('2d');
  cartels.forEach((cartel, index) => {
    const cell = atlasCell(index);
    const x = cell.u0 * size;
    const y = cell.v0 * size;
    const w = (cell.u1 - cell.u0) * size;
    const h = (cell.v1 - cell.v0) * size;
    context.save();
    context.translate(x, y + h);
    context.scale(1, -1);
    const gradient = context.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#f4e7c8');
    gradient.addColorStop(0.45, '#d9c08a');
    gradient.addColorStop(1, '#b89a62');
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);
    context.strokeStyle = '#6d542c';
    context.lineWidth = Math.max(2, size / 400);
    context.strokeRect(8, 8, w - 16, h - 16);
    context.fillStyle = '#3a2c18';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    const padX = w * 0.08;
    const titleSize = Math.max(15, h * 0.3);
    context.font = `500 ${titleSize}px Georgia, "Liberation Serif", serif`;
    context.fillText(cartel.title, padX, h * 0.1, w - padX * 2);
    context.font = `600 ${titleSize * 0.46}px Arial, sans-serif`;
    context.fillStyle = '#5c4728';
    context.fillText(cartel.author, padX, h * 0.44, w - padX * 2);
    context.font = `600 ${titleSize * 0.36}px Arial, sans-serif`;
    context.fillText('DOMAINE PUBLIC', padX, h * 0.66, w - padX * 2);
    context.font = `600 ${titleSize * 0.28}px Arial, sans-serif`;
    context.fillText('DÉMO · PAS UNE VENTE', padX, h * 0.84, w - padX * 2);
    context.restore();
  });
  const texture = new THREE.CanvasTexture(plate);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function applyLibrary(root, library, lightmap) {
  root.traverse(object => {
    if (!object.isMesh) return;
    const source = object.material;
    const name = (source?.name || object.name || '').replace(/\.\d+$/, '');
    const base = library[name] || library.stone;
    const material = base.clone();
    material.name = name;
    material.vertexColors = true;
    const uv1 = object.geometry?.attributes?.uv1;
    if (name !== 'laylight' && name !== 'underlay' && name !== 'cartel' && uv1) {
      object.geometry.setAttribute('uv2', uv1);
      material.lightMap = lightmap;
      material.lightMap.channel = 2;
      // Cycles stores the Lambert result (irradiance / π). Three divides by π again.
      const gain = name === 'artwork' ? 1.45 : 1.0;
      material.lightMapIntensity = Math.PI * lightScale * gain;
    }
    object.material = material;
    object.castShadow = !mobile && (name === 'sculpture');
    object.receiveShadow = !mobile && (name === 'parquet' || name === 'marble');
  });
}

function coverRepeat(imageAspect, frameAspect) {
  if (imageAspect > frameAspect) {
    const rx = frameAspect / imageAspect;
    return {rx, ry: 1, ox: (1 - rx) / 2, oy: 0};
  }
  const ry = imageAspect / frameAspect;
  return {rx: 1, ry, ox: 0, oy: (1 - ry) / 2};
}

function bringCanvasesForward(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    const matName = (object.material?.name || '').replace(/\.\d+$/, '');
    if (matName !== 'artwork' && !object.name.startsWith('Hero_')) return;
    const position = object.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      if (x < -4.5) position.setX(i, x + 0.022);
      else if (x > 4.5) position.setX(i, x - 0.022);
      else if (z < -16) position.setZ(i, z + 0.022);
    }
    position.needsUpdate = true;
  });
}

function unmirror(texture, cover = {rx: 1, ry: 1, ox: 0, oy: 0}) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(-cover.rx, cover.ry);
  texture.offset.set(cover.ox + cover.rx, cover.oy);
}

async function heroTextures(frames) {
  const textures = [];
  for (const frame of frames) {
    if (!frame.hero) continue;
    const texture = await loadTexture(ASSET + 'paintings/pd/painting-' + frame.painting + '.webp', THREE.SRGBColorSpace);
    const image = texture.image;
    const cover = coverRepeat(image.width / image.height, frame.artWidth / frame.artHeight);
    if (mobile && Math.max(image.width, image.height) > 1024) {
      const scale = 1024 / Math.max(image.width, image.height);
      const plate = document.createElement('canvas');
      plate.width = Math.round(image.width * scale);
      plate.height = Math.round(image.height * scale);
      plate.getContext('2d').drawImage(image, 0, 0, plate.width, plate.height);
      texture.image = plate;
      texture.needsUpdate = true;
    }
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(cover.rx, cover.ry);
    texture.offset.set(cover.ox, cover.oy);
    textures.push(texture);
  }
  return textures;
}

async function addSculpture() {
  const plinth = layout.plinth;
  const bustFile = await gltfLoader.loadAsync(ASSET + 'pbr/bust/marble_bust_01.gltf');
  const bust = bustFile.scene;
  bust.name = 'sculpture';
  const measured = new THREE.Box3().setFromObject(bust);
  const height = Math.max(0.2, measured.max.y - measured.min.y);
  const scale = 1.05 / height;
  bust.scale.setScalar(scale);
  const fitted = new THREE.Box3().setFromObject(bust);
  bust.position.set(
    plinth.x - (fitted.min.x + fitted.max.x) / 2,
    plinth.height - fitted.min.y,
    plinth.z - (fitted.min.z + fitted.max.z) / 2,
  );
  bust.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    if (object.material) {
      object.material.envMapIntensity = mobile ? 0.45 : 0.9;
      object.material.roughness = Math.min(object.material.roughness ?? 0.35, 0.42);
    }
  });
  scene.add(bust);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false}),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(plinth.x, plinth.height + 0.004, plinth.z);
  shadow.renderOrder = 2;
  scene.add(shadow);
  return bust;
}

const halfW = layout.room.width / 2;
const blocks = [
  ...layout.obstacles,
  {minX: -halfW, maxX: halfW, minZ: -0.2, maxZ: 0.35},
  {minX: -halfW, maxX: halfW, minZ: layout.room.length - 0.35, maxZ: layout.room.length + 0.2},
];

function blocked(x, z) {
  const radius = 0.28;
  if (Math.abs(x) > halfW - 0.55) return true;
  if (z < 0.55 || z > layout.room.length - 0.55) return true;
  return blocks.some(box => x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
}

const state = {x: 0, y: 1.62, z: 1.45, yaw: 0, pitch: 0, fov: mobile ? 58 : 46, vx: 0, vz: 0};
const keys = new Set();

function applyCamera() {
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = Math.PI + state.yaw;
  camera.rotation.x = state.pitch;
  camera.fov = state.fov;
  camera.updateProjectionMatrix();
}

function frameShot() {
  const hero = layout.frames.find(frame => frame.wall === 'left' && frame.format === 'very_large');
  return {
    // yaw 0 looks down the nave (+Z). Negative yaw turns toward the left wall (-X).
    x: hero.x + 4.05,
    y: 1.5,
    z: hero.z - 0.15,
    yaw: -Math.PI / 2 + 0.02,
    pitch: 0.02,
    fov: 42,
  };
}

const shots = {
  entrance: {x: 0, y: 1.62, z: 1.35, yaw: 0, pitch: -0.01, fov: 42},
  perspective: {x: 0.15, y: 1.62, z: 5.1, yaw: 0, pitch: 0.01, fov: 36},
  floor: {x: -0.25, y: 0.4, z: 3.15, yaw: 0.35, pitch: -0.92, fov: 48},
  frame: frameShot(),
  ceiling: {x: 0, y: 1.62, z: 6.4, yaw: 0, pitch: 1.02, fov: 46},
  plinth: {x: 0.35, y: 1.48, z: layout.plinth.z - 2.15, yaw: 0.15, pitch: -0.04, fov: 40},
  mobile: {x: 0, y: 1.62, z: 1.55, yaw: 0, pitch: 0, fov: 60},
};

if (shots[shot]) Object.assign(state, shots[shot]);

const videoKeys = [
  {t: 0, ...shots.entrance},
  {t: 5, x: 0.05, y: 1.62, z: 6.2, yaw: 0.15, pitch: 0.02, fov: 42},
  {t: 8.5, x: -1.4, y: 1.55, z: 7.4, yaw: Math.PI / 2, pitch: 0.02, fov: 38},
  {t: 11.5, x: 0, y: 1.62, z: 8.2, yaw: 0, pitch: 0.95, fov: 46},
  {t: 14, x: 0.4, y: 0.85, z: 4.2, yaw: 0.2, pitch: -0.7, fov: 46},
  {t: 16, x: 0.2, y: 1.62, z: 7.6, yaw: 0.35, pitch: 0, fov: 40},
];

function lerpShot(a, b, t) {
  const keys = ['x', 'y', 'z', 'yaw', 'pitch', 'fov'];
  const out = {};
  for (const key of keys) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

let videoStart = 0;

const v5 = createMuseumV5Navigation({
  overlay, canvas, mobile,
  home: () => Object.assign(state, shots.entrance),
  setZoom: fov => { state.fov = fov; },
  adjustZoom: delta => { state.fov = Math.min(70, Math.max(28, state.fov + delta)); },
  nextStop: () => focusNext(),
  onTourChange: () => {},
  onViewChange: () => {},
});

let focusIndex = 0;
function focusNext() {
  const frame = layout.frames[focusIndex % layout.frames.length];
  focusIndex += 1;
  const side = frame.wall === 'left' ? 1.6 : frame.wall === 'right' ? -1.6 : 0;
  state.x = frame.wall === 'north' ? frame.x : frame.x + side;
  state.z = frame.wall === 'north' ? frame.z - 1.7 : frame.z;
  state.y = 1.62;
  state.yaw = frame.wall === 'left' ? Math.PI / 2 : frame.wall === 'right' ? -Math.PI / 2 : 0;
  state.pitch = (frame.y - 1.62) * 0.15;
}

function resize() {
  const width = overlay.clientWidth || innerWidth;
  const height = overlay.clientHeight || innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

window.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyZ', 'KeyA', 'KeyQ', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));

let drag = null;
canvas.addEventListener('pointerdown', event => {
  if (event.target !== canvas) return;
  drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
});
canvas.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id || mobile) return;
  state.yaw -= (event.clientX - drag.x) * 0.0045;
  state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch - (event.clientY - drag.y) * 0.0032));
  drag.x = event.clientX;
  drag.y = event.clientY;
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  state.fov = Math.min(70, Math.max(28, state.fov + Math.sign(event.deltaY) * 1.8));
}, {passive: false});

if (matchMedia('(pointer:coarse)').matches) {
  const {fitMuseumVisualViewport} = await import('../visual-viewport-v1.js?v=20261106v2');
  fitMuseumVisualViewport();
}
v5.enter();

let lightScale = 1;
const report = {
  tier,
  ready: false,
  drawCalls: 0,
  triangles: 0,
  textureBytes: 0,
  exposure: renderer.toneMappingExposure,
  lightmap: layout.room.floorPxPerM,
};
window.__SALLE_TEMOIN__ = report;

async function loadSurface(file, colorSpace) {
  if (mobile && (file.includes('-nor.') || file.includes('-rough.'))) {
    const flat = file.includes('-nor.') ? [128, 128, 255, 255] : [210, 210, 210, 255];
    const texture = new THREE.DataTexture(new Uint8Array(flat), 1, 1);
    texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  if (mobile) {
    try {
      const texture = await ktx2.loadAsync(ASSET + 'pbr/' + file.replace(/\.jpg$/, '.ktx2'));
      texture.colorSpace = colorSpace;
      texture.anisotropy = 4;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      return texture;
    } catch (error) {
      console.warn('KTX2 surface unavailable', file, error);
    }
  }
  const texture = await loadTexture(ASSET + 'pbr/' + file, colorSpace);
  const image = texture.image;
  if (mobile && image && Math.max(image.width, image.height) > 1024) {
    const scale = 1024 / Math.max(image.width, image.height);
    const plate = document.createElement('canvas');
    plate.width = Math.round(image.width * scale);
    plate.height = Math.round(image.height * scale);
    plate.getContext('2d').drawImage(image, 0, 0, plate.width, plate.height);
    texture.image = plate;
    texture.needsUpdate = true;
  }
  return texture;
}

try {
  const [oakA, oakR, oakN, plasterA, plasterR, plasterN, pompeianA, marbleA, marbleR, marbleN, leatherA, leatherR, leatherN, lightmap, gltf, atlas, heroes] = await Promise.all([
    loadSurface('oak-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('oak-rough.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('oak-nor.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('plaster-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('plaster-rough.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('plaster-nor.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('pompeian-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('marble-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('marble-rough.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('marble-nor.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('leather-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('leather-rough.jpg', THREE.LinearSRGBColorSpace),
    loadSurface('leather-nor.jpg', THREE.LinearSRGBColorSpace),
    loadLightmap(),
    gltfLoader.loadAsync(ASSET + 'salle-temoin.glb'),
    paintingAtlas(layout.frames),
    heroTextures(layout.frames),
  ]);
  const wallNormal = new THREE.Vector2(0.55, 0.55);
  const library = {
    parquet: new THREE.MeshPhysicalMaterial({
      map: oakA, roughnessMap: oakR, normalMap: oakN, normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 1, metalness: 0, clearcoat: mobile ? 0.08 : 0.32, clearcoatRoughness: 0.34,
      envMapIntensity: mobile ? 0.28 : 0.72,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: plasterA, roughnessMap: plasterR, normalMap: plasterN, normalScale: wallNormal,
      roughness: 1, metalness: 0, envMapIntensity: 0.16,
    }),
    pompeian: new THREE.MeshStandardMaterial({
      map: pompeianA, roughnessMap: plasterR, normalMap: plasterN, normalScale: wallNormal,
      roughness: 1, metalness: 0, envMapIntensity: 0.12,
    }),
    gilt: new THREE.MeshStandardMaterial({color: 0xe8c56b, roughness: 0.22, metalness: 1, envMapIntensity: mobile ? 0.55 : 1.15}),
    liner: new THREE.MeshStandardMaterial({color: 0xe7d5ba, roughness: 0.74, metalness: 0}),
    artwork: new THREE.MeshStandardMaterial({map: atlas, roughness: 0.72, metalness: 0, envMapIntensity: 0.08, side: THREE.DoubleSide}),
    cartel: (() => {
      const plate = cartelAtlas(layout.cartels);
      return new THREE.MeshStandardMaterial({
        map: plate, emissiveMap: plate, emissive: 0xffffff, emissiveIntensity: 0.65,
        roughness: 0.55, metalness: 0.12, envMapIntensity: 0.2,
      });
    })(),
    mullion: new THREE.MeshStandardMaterial({map: plasterA, roughnessMap: plasterR, normalMap: plasterN, roughness: 1, metalness: 0}),
    benchWood: new THREE.MeshStandardMaterial({map: oakA, roughnessMap: oakR, normalMap: oakN, roughness: 0.72, metalness: 0}),
    benchSeat: new THREE.MeshStandardMaterial({
      map: leatherA, roughnessMap: leatherR, normalMap: leatherN, normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.92, metalness: 0, envMapIntensity: 0.2,
    }),
    marble: new THREE.MeshStandardMaterial({
      map: marbleA, roughnessMap: marbleR, normalMap: marbleN,
      roughness: 0.85, metalness: 0.02, envMapIntensity: mobile ? 0.35 : 0.7,
    }),
    door: new THREE.MeshStandardMaterial({map: oakA, roughnessMap: oakR, normalMap: oakN, roughness: 0.7, metalness: 0, color: 0x8a6238}),
    brass: new THREE.MeshStandardMaterial({color: 0xc4a36a, roughness: 0.3, metalness: 1, envMapIntensity: 0.8}),
    laylight: new THREE.MeshStandardMaterial({color: 0xf4efe4, emissive: 0xf7f1e6, emissiveIntensity: mobile ? 0.75 : 1.05, roughness: 1, side: THREE.DoubleSide}),
    underlay: new THREE.MeshStandardMaterial({color: 0x3a2c22, roughness: 0.95}),
  };
  applyLibrary(gltf.scene, library, lightmap);
  let heroIndex = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh || !object.name.startsWith('Hero_')) return;
    object.material = object.material.clone();
    object.material.map = heroes[heroIndex] || atlas;
    object.material.color.set(0xffffff);
    object.material.roughness = 0.78;
    heroIndex += 1;
  });
  // Blender's Y-up glTF conversion stores the hall depth on -Z.
  // Flip it back so yaw 0 walks toward the far wall, and un-mirror images.
  // Hero canvases already carry their own cover-crop flip.
  gltf.scene.scale.z = -1;
  // The linen liner is a plate 6 mm in front of the canvas. Bring the
  // paintings forward so they sit in the rebate instead of behind that plate.
  bringCanvasesForward(gltf.scene);
  for (const texture of [oakA, oakR, oakN, plasterA, plasterR, plasterN, pompeianA, marbleA, marbleR, marbleN, leatherA, leatherR, leatherN]) {
    unmirror(texture);
  }
  scene.add(gltf.scene);
  await addSculpture();
  if (!mobile) {
    try {
      const cubeTarget = new THREE.WebGLCubeRenderTarget(128);
      const probe = new THREE.CubeCamera(0.3, 26, cubeTarget);
      probe.position.set(0, 2.15, layout.room.length * 0.42);
      probe.update(renderer, scene);
      scene.environment = pmrem.fromCubemap(cubeTarget.texture).texture;
      scene.environmentIntensity = 0.7;
      cubeTarget.dispose();
    } catch (error) {
      console.warn('reflection probe skipped', error);
    }
  }
  statusEl.remove();
  report.ready = true;
} catch (error) {
  console.error(error);
  statusEl.textContent = 'La salle témoin n’a pas pu s’ouvrir. ' + error.message;
}

function pressed(...names) {
  return names.some(name => keys.has(name));
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const input = v5.update(dt);
  if (shot === 'video') {
    if (!videoStart) videoStart = now;
    const elapsed = Math.min(16, (now - videoStart) / 1000);
    let span = videoKeys[0];
    for (let index = 0; index < videoKeys.length - 1; index += 1) {
      if (elapsed >= videoKeys[index].t && elapsed <= videoKeys[index + 1].t) {
        const local = (elapsed - videoKeys[index].t) / (videoKeys[index + 1].t - videoKeys[index].t);
        const smooth = local * local * (3 - 2 * local);
        span = lerpShot(videoKeys[index], videoKeys[index + 1], smooth);
        break;
      }
      span = videoKeys[videoKeys.length - 1];
    }
    Object.assign(state, span);
    report.videoTime = elapsed;
  } else if (!shot) {
    let forward = (pressed('ArrowUp', 'KeyW', 'KeyZ') ? 1 : 0) - (pressed('ArrowDown', 'KeyS') ? 1 : 0) + input.forward;
    let strafe = (pressed('KeyD') ? 1 : 0) - (pressed('KeyQ', 'KeyA') ? 1 : 0) + input.strafe;
    overlay.dataset.museumInputForward = forward.toFixed(3);
    overlay.dataset.museumInputStrafe = strafe.toFixed(3);
    overlay.dataset.museumInputLookX = input.lookX.toFixed(3);
    overlay.dataset.museumInputLookY = input.lookY.toFixed(3);
    state.yaw += input.lookX * 1.9 * dt;
    state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch - input.lookY * 1.32 * dt));
    const motion = museumCameraMotion(state.yaw, forward, strafe);
    const speed = 1.55;
    const mag = Math.max(1, Math.hypot(forward, strafe));
    state.vx += (motion.x * speed / mag - state.vx) * Math.min(1, dt * 8);
    state.vz += (motion.z * speed / mag - state.vz) * Math.min(1, dt * 8);
    const nx = state.x + state.vx * dt;
    const nz = state.z + state.vz * dt;
    if (!blocked(nx, state.z)) state.x = nx;
    if (!blocked(state.x, nz)) state.z = nz;
    state.y = 1.62;
  }
  applyCamera();
  renderer.render(scene, camera);
  if (report.ready && !report.drawCalls) {
    report.drawCalls = renderer.info.render.calls;
    report.triangles = renderer.info.render.triangles;
    const seen = new Set();
    let bytes = 0;
    scene.traverse(object => {
      const material = object.material;
      if (!material) return;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'lightMap', 'emissiveMap']) {
        const texture = material[key];
        if (!texture || seen.has(texture)) continue;
        seen.add(texture);
        const image = texture.image;
        if (!image) continue;
        if (image.data?.byteLength) bytes += image.data.byteLength;
        else if (image.width && image.height) bytes += image.width * image.height * 4;
      }
    });
    report.textureBytes = bytes;
    report.textureMegabytes = Math.round(bytes / (1024 * 1024) * 10) / 10;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
