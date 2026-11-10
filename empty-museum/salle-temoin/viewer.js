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
if (!mobile) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

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
      lightScale = 4;
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
  const size = mobile ? 2048 : 4096;
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
    const image = await loadImage(ASSET + 'paintings/' + frame.id + '.webp');
    const x = cell.u0 * size;
    const y = (1 - cell.v1) * size;
    const w = (cell.u1 - cell.u0) * size;
    const h = (cell.v1 - cell.v0) * size;
    context.drawImage(image, x, y, w, h);
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
  const size = 2048;
  const plate = document.createElement('canvas');
  plate.width = plate.height = size;
  const context = plate.getContext('2d');
  cartels.forEach((cartel, index) => {
    const cell = atlasCell(index);
    const x = cell.u0 * size;
    const y = (1 - cell.v1) * size;
    const w = (cell.u1 - cell.u0) * size;
    const h = (cell.v1 - cell.v0) * size;
    const gradient = context.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#f4e7c8');
    gradient.addColorStop(0.45, '#d9c08a');
    gradient.addColorStop(1, '#b89a62');
    context.fillStyle = gradient;
    context.fillRect(x, y, w, h);
    context.strokeStyle = '#6d542c';
    context.lineWidth = Math.max(2, size / 400);
    context.strokeRect(x + 8, y + 8, w - 16, h - 16);
    context.fillStyle = '#3a2c18';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    const titleSize = Math.max(18, h * 0.22);
    context.font = `500 ${titleSize}px Georgia, "Liberation Serif", serif`;
    context.fillText(cartel.title, x + 18, y + h * 0.16, w - 36);
    context.font = `600 ${titleSize * 0.62}px Arial, sans-serif`;
    context.fillStyle = '#5c4728';
    context.fillText(cartel.author.toUpperCase(), x + 18, y + h * 0.48, w - 36);
    context.font = `600 ${titleSize * 0.48}px Arial, sans-serif`;
    context.fillText('DÉMO · PAS UNE VENTE', x + 18, y + h * 0.72, w - 36);
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
    if (name !== 'laylight' && name !== 'underlay' && object.geometry?.attributes) {
      material.lightMap = lightmap;
      material.lightMap.channel = object.geometry.attributes.uv2 ? 2 : 1;
      // Cycles stores the Lambert result (irradiance / π). Three divides by π again.
      material.lightMapIntensity = Math.PI * lightScale * 0.72;
    }
    object.material = material;
    object.castShadow = !mobile && (name === 'sculpture');
    object.receiveShadow = !mobile && (name === 'parquet' || name === 'marble');
  });
}

async function heroTextures(frames) {
  const textures = [];
  for (const frame of frames) {
    if (!frame.hero) continue;
    const texture = await loadTexture(ASSET + 'paintings/' + frame.id + '.webp', THREE.SRGBColorSpace);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    textures.push(texture);
  }
  return textures;
}

function addSculpture() {
  const plinth = layout.plinth;
  const points = [];
  const profile = [0.22, 0.34, 0.28, 0.16, 0.2, 0.18, 0.11, 0.08];
  profile.forEach((radius, index) => {
    points.push(new THREE.Vector2(radius, (index / (profile.length - 1)) * plinth.sculptureHeight));
  });
  const geometry = new THREE.LatheGeometry(points, mobile ? 20 : 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9d3cc,
    roughness: 0.28,
    metalness: 0.04,
    envMapIntensity: 0.6,
  });
  const urn = new THREE.Mesh(geometry, material);
  urn.name = 'sculpture';
  urn.position.set(plinth.x, plinth.height, plinth.z);
  urn.castShadow = !mobile;
  urn.receiveShadow = !mobile;
  scene.add(urn);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 24),
    new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: mobile ? 0.28 : 0.12, depthWrite: false}),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(plinth.x, 0.012, plinth.z);
  shadow.renderOrder = 2;
  scene.add(shadow);
  if (!mobile) {
    const light = new THREE.DirectionalLight(0xfff3e2, 0.55);
    light.position.set(plinth.x - 1.4, 5.2, plinth.z + 1.1);
    light.target.position.set(plinth.x, plinth.height, plinth.z);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 0.4;
    light.shadow.camera.far = 8;
    light.shadow.camera.left = -1.6;
    light.shadow.camera.right = 1.6;
    light.shadow.camera.top = 1.6;
    light.shadow.camera.bottom = -1.6;
    light.shadow.bias = -0.0008;
    scene.add(light, light.target);
  }
  return urn;
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
    x: hero.x + 1.55,
    y: hero.y,
    z: hero.z,
    yaw: Math.PI / 2,
    pitch: 0,
    fov: 32,
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

try {
  const [oakA, oakR, oakN, stoneA, stoneN, marbleA, marbleR, lightmap, gltf, atlas, heroes] = await Promise.all([
    loadTexture(ASSET + 'oak-albedo.png', THREE.SRGBColorSpace),
    loadTexture(ASSET + 'oak-roughness.png', THREE.LinearSRGBColorSpace),
    loadTexture(ASSET + 'oak-normal.png', THREE.LinearSRGBColorSpace),
    loadTexture(ASSET + 'stone-albedo.png', THREE.SRGBColorSpace),
    loadTexture(ASSET + 'stone-normal.png', THREE.LinearSRGBColorSpace),
    loadTexture(ASSET + 'marble-albedo.png', THREE.SRGBColorSpace),
    loadTexture(ASSET + 'marble-roughness.png', THREE.LinearSRGBColorSpace),
    loadLightmap(),
    gltfLoader.loadAsync(ASSET + 'salle-temoin.glb'),
    paintingAtlas(layout.frames),
    heroTextures(layout.frames),
  ]);
  oakA.wrapS = oakA.wrapT = THREE.RepeatWrapping;
  const library = {
    parquet: new THREE.MeshPhysicalMaterial({
      map: oakA, roughnessMap: oakR, normalMap: oakN,
      roughness: 0.42, metalness: 0, clearcoat: mobile ? 0.04 : 0.18, clearcoatRoughness: 0.38,
      envMapIntensity: mobile ? 0.25 : 0.45,
    }),
    stone: new THREE.MeshStandardMaterial({map: stoneA, normalMap: stoneN, roughness: 0.68, metalness: 0, envMapIntensity: 0.12}),
    pompeian: new THREE.MeshStandardMaterial({color: layout.room.wallColor, roughness: 0.8, metalness: 0, envMapIntensity: 0.08}),
    gilt: new THREE.MeshStandardMaterial({color: 0xe0c27a, roughness: 0.34, metalness: 1, envMapIntensity: mobile ? 0.45 : 0.85}),
    liner: new THREE.MeshStandardMaterial({color: 0xe7d5ba, roughness: 0.74, metalness: 0}),
    artwork: new THREE.MeshStandardMaterial({map: atlas, roughness: 0.62, metalness: 0, envMapIntensity: 0.12}),
    cartel: new THREE.MeshStandardMaterial({map: cartelAtlas(layout.cartels), roughness: 0.48, metalness: 0.22}),
    mullion: new THREE.MeshStandardMaterial({color: 0xe7e1d6, roughness: 0.38, metalness: 0.55}),
    benchWood: new THREE.MeshStandardMaterial({map: oakA, roughnessMap: oakR, roughness: 0.5, metalness: 0}),
    benchSeat: new THREE.MeshStandardMaterial({color: 0x3e3028, roughness: 0.72, metalness: 0}),
    marble: new THREE.MeshStandardMaterial({map: marbleA, roughnessMap: marbleR, roughness: 0.2, metalness: 0.04, envMapIntensity: 0.55}),
    door: new THREE.MeshStandardMaterial({map: oakA, roughnessMap: oakR, roughness: 0.46, metalness: 0, color: 0x8a6238}),
    brass: new THREE.MeshStandardMaterial({color: 0xc4a36a, roughness: 0.32, metalness: 1, emissive: 0x3a2a12, emissiveIntensity: 0.15}),
    laylight: new THREE.MeshStandardMaterial({color: 0xfff6ea, emissive: 0xfff4e6, emissiveIntensity: mobile ? 2.2 : 3.4, roughness: 1, side: THREE.DoubleSide}),
    underlay: new THREE.MeshStandardMaterial({color: 0x120e0b, roughness: 0.95}),
  };
  applyLibrary(gltf.scene, library, lightmap);
  let heroIndex = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh || !object.name.startsWith('Hero_')) return;
    object.material = object.material.clone();
    object.material.map = heroes[heroIndex] || atlas;
    object.material.color.set(0xffffff);
    heroIndex += 1;
  });
  // Blender's Y-up glTF conversion stores the hall depth on -Z.
  // Flip it back so yaw 0 walks toward the far wall, and un-mirror images.
  gltf.scene.scale.z = -1;
  for (const texture of [atlas, ...heroes, library.cartel.map, oakA, stoneA, marbleA]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
  }
  scene.add(gltf.scene);
  addSculpture();
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
