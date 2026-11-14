import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createMuseumV5Navigation} from '../museum-v5.js?v=20261111ech';
import {buildLayout} from './room-layout.mjs';
import {atlasCell, atlasDrawRect, PAINTING_FLIP_Y} from '../salle-temoin/canvas-orientation.mjs';

const layout = buildLayout();
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer:coarse)').matches;
const tier = params.get('tier') || (coarse || innerWidth < 820 ? 'mobile' : 'desktop');
const mobile = tier === 'mobile';
const shot = params.get('shot') || '';
const ASSET = 'salle-echantillon/assets/';
const STONE = 'salle-temoin/assets/pbr/';
const PAINT = 'salle-temoin/assets/paintings/';

function paintingUrl(painting) {
  return painting.startsWith('cc0/') ? `salle-echantillon/assets/${painting}` : PAINT + painting;
}

const canvas = document.getElementById('walkCanvas');
const overlay = document.getElementById('walkOverlay');
const statusEl = document.getElementById('sampleStatus');
if (shot && shot !== 'switch') document.body.classList.add('is-shot');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: Boolean(shot),
  powerPreference: mobile ? 'low-power' : 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(params.get('expo')) || layout.room.exposure;
renderer.setClearColor(0xf4f2ee, 1);
renderer.setPixelRatio(shot ? 1 : Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(layout.room.fov, 1, 0.05, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = mobile ? 0.16 : 0.28;

const gltfLoader = new GLTFLoader();
const ktx2 = new KTX2Loader().setTranscoderPath('salle-temoin/basis/');
ktx2.detectSupport(renderer);

function sampleTexel(data, type, index) {
  const value = data[index];
  return type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat(value) : value;
}

function downscaleLightmap(texture, maxEdge) {
  const image = texture.image;
  const width = image?.width || 0;
  const height = image?.height || 0;
  if (!width || !height || Math.max(width, height) <= maxEdge) return texture;
  const scale = Math.max(width, height) / maxEdge;
  const w = Math.max(1, Math.round(width / scale));
  const h = Math.max(1, Math.round(height / scale));
  const src = image.data;
  const out = new Uint16Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / h));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / w));
      const base = (sy * width + sx) * 4;
      const dest = (y * w + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        out[dest + channel] = THREE.DataUtils.toHalfFloat(sampleTexel(src, texture.type, base + channel));
      }
    }
  }
  texture.image = {data: out, width: w, height: h};
  texture.type = THREE.HalfFloatType;
  texture.format = THREE.RGBAFormat;
  texture.needsUpdate = true;
  return texture;
}

function prepareLightmap(texture) {
  texture.colorSpace = THREE.NoColorSpace;
  // glTF already flips V. A second flip maps the wall halos onto the ceiling.
  texture.flipY = params.get('flip') === '1';
  downscaleLightmap(texture, 1024);
  texture.needsUpdate = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.channel = 2;
  return texture;
}

async function loadLightmap() {
  const hdr = await new RGBELoader().loadAsync(ASSET + (mobile ? 'lightmap-mobile.hdr' : 'lightmap.hdr'));
  return prepareLightmap(hdr);
}

function tag(texture, colorSpace) {
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function loadSurface(file, colorSpace, fallback) {
  if (mobile && (file.includes('-nor.') || file.includes('gilt-nor'))) {
    const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    tag(flat, colorSpace);
    flat.wrapS = flat.wrapT = THREE.RepeatWrapping;
    return flat;
  }
  const base = fallback || ASSET + 'pbr/';
  try {
    const texture = tag(await ktx2.loadAsync(base + file.replace(/\.jpg$/, '.ktx2')), colorSpace);
    texture.anisotropy = mobile ? 4 : 8;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    return texture;
  } catch (error) {
    console.warn('KTX2 surface unavailable', file, error);
  }
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(base + file, texture => {
      tag(texture, colorSpace);
      texture.anisotropy = mobile ? 4 : 8;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      resolve(texture);
    }, undefined, reject);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function paintingAtlas(frames) {
  const columns = 4;
  const size = mobile ? 1024 : 2048;
  const plate = document.createElement('canvas');
  plate.width = plate.height = size;
  const context = plate.getContext('2d');
  context.fillStyle = '#5c4636';
  context.fillRect(0, 0, size, size);
  let index = 0;
  for (const frame of frames) {
    if (frame.hero) continue;
    const cell = atlasCell(index, columns);
    index += 1;
    const image = await loadImage(paintingUrl(frame.painting));
    const placed = atlasDrawRect(cell, size);
    context.save();
    context.beginPath();
    context.rect(placed.x, placed.y, placed.w, placed.h);
    context.clip();
    const imageAspect = image.width / image.height;
    const cellAspect = placed.w / placed.h;
    let dw = placed.w;
    let dh = placed.h;
    let dx = placed.x;
    let dy = placed.y;
    if (imageAspect > cellAspect) {
      dw = placed.h * imageAspect;
      dx = placed.x - (dw - placed.w) / 2;
    } else {
      dh = placed.w / imageAspect;
      dy = placed.y - (dh - placed.h) / 2;
    }
    context.drawImage(image, dx, dy, dw, dh);
    context.restore();
  }
  const texture = new THREE.CanvasTexture(plate);
  texture.flipY = PAINTING_FLIP_Y;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = mobile ? 4 : 8;
  texture.needsUpdate = true;
  return texture;
}

function coverRepeat(imageAspect, frameAspect) {
  if (imageAspect > frameAspect) {
    const rx = frameAspect / imageAspect;
    return {rx, ry: 1, ox: (1 - rx) / 2, oy: 0};
  }
  const ry = imageAspect / frameAspect;
  return {rx: 1, ry, ox: 0, oy: (1 - ry) / 2};
}

async function heroTextures(frames) {
  const textures = [];
  const ordered = frames.filter(frame => frame.hero);
  for (const frame of ordered) {
    const texture = await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(paintingUrl(frame.painting), resolve, undefined, reject);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    const image = texture.image;
    const cover = coverRepeat(image.width / image.height, frame.artWidth / frame.artHeight);
    const maxEdge = mobile ? 768 : 1280;
    if (Math.max(image.width, image.height) > maxEdge) {
      const scale = maxEdge / Math.max(image.width, image.height);
      const plate = document.createElement('canvas');
      plate.width = Math.max(1, Math.round(image.width * scale));
      plate.height = Math.max(1, Math.round(image.height * scale));
      plate.getContext('2d').drawImage(image, 0, 0, plate.width, plate.height);
      texture.image = plate;
      texture.needsUpdate = true;
    }
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(cover.rx, cover.ry);
    texture.offset.set(cover.ox, cover.oy);
    texture.anisotropy = mobile ? 4 : 8;
    textures.push(texture);
  }
  return textures;
}

const LIGHT_GAIN = Number(params.get('gain')) || 1.08;

function artworkCompositeMaterial(painting, lightmap) {
  painting.colorSpace = THREE.NoColorSpace;
  painting.updateMatrix();
  return new THREE.ShaderMaterial({
    uniforms: {
      map: {value: painting},
      lightMap: {value: lightmap},
      mapTransform: {value: painting.matrix},
    },
    toneMapped: true,
    vertexShader: `
      attribute vec2 uv2;
      varying vec2 vUv;
      varying vec2 vUv2;
      varying vec3 vNormalW;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vUv2 = uv2;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform sampler2D lightMap;
      uniform mat3 mapTransform;
      varying vec2 vUv;
      varying vec2 vUv2;
      varying vec3 vNormalW;
      varying vec3 vView;
      vec3 srgbToLinear(vec3 color) {
        return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), color));
      }
      void main() {
        vec2 artUv = (mapTransform * vec3(vUv, 1.0)).xy;
        vec3 art = srgbToLinear(texture2D(map, artUv).rgb);
        vec3 light = max(texture2D(lightMap, vUv2).rgb * 3.14159 * 1.15, vec3(0.55));
        float facing = clamp(dot(normalize(vNormalW), normalize(vView)), 0.0, 1.0);
        vec3 gloss = vec3(0.04) * pow(1.0 - facing, 5.0);
        gl_FragColor = vec4(art * light + gloss, 1.0);
      }
    `,
  });
}

function applyLibrary(root, library, lightmap) {
  root.traverse(object => {
    if (!object.isMesh) return;
    if ((object.name || '') === 'endwall') {
      object.material = new THREE.MeshPhysicalMaterial({
        color: 0xf4f6f8,
        roughness: 0.42,
        metalness: 0,
        transmission: 0.82,
        thickness: 0.2,
        transparent: true,
        opacity: 1,
        envMapIntensity: 1.1,
        side: THREE.DoubleSide,
      });
      return;
    }
    if ((object.name || '').startsWith('giltframe')) {
      const uv = object.geometry?.attributes?.uv;
      if (uv && !object.geometry.attributes.uv2) object.geometry.setAttribute('uv2', uv);
      object.material = library.gilt.clone();
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    const name = (object.material?.name || object.name || '').replace(/\.\d+$/, '');
    const base = library[name] || library.marble;
    const material = base.clone();
    material.name = name;
    const uv = object.geometry?.attributes?.uv1 || object.geometry?.attributes?.uv2;
    // Rocks are decimated scans. Their lightmap islands are not rebaked; the sky lights them.
    const lit = uv && !['sky', 'bulb', 'iron', 'gilt', 'rock'].includes(name);
    if (lit) {
      object.geometry.setAttribute('uv2', uv);
      material.lightMap = lightmap;
      material.lightMap.channel = 2;
      const gain = name === 'floor' ? 0.7 : name === 'marble' ? 1.32 : name === 'artwork' ? 1.12 : name === 'rock' ? 1.2 : 1;
      material.lightMapIntensity = Math.PI * LIGHT_GAIN * gain;
    }
    if (name === 'sky') material.fog = false;
    object.material = material;
    object.castShadow = false;
    object.receiveShadow = false;
  });
}

const halfW = layout.room.width / 2;
const blocks = [
  ...layout.obstacles,
  {minX: -halfW, maxX: halfW, minZ: layout.room.backZ - 0.2, maxZ: 0.15},
  {minX: -halfW, maxX: halfW, minZ: layout.room.length - 0.4, maxZ: layout.room.length + 0.3},
];

function blocked(x, z) {
  const radius = 0.28;
  if (Math.abs(x) > halfW - 0.48) return true;
  if (z < 0.35 || z > layout.room.length - 0.7) return true;
  return blocks.some(box => x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
}

const state = {
  x: 0,
  y: layout.room.eye,
  z: layout.room.cameraZ,
  yaw: 0,
  pitch: 0,
  fov: mobile ? layout.room.mobileFov : layout.room.fov,
  vx: 0,
  vz: 0,
};

const shots = {
  axis: {x: 0, y: layout.room.eye, z: layout.room.cameraZ, yaw: 0, pitch: 0.05, fov: layout.room.fov},
  mobile: {x: 0, y: layout.room.eye, z: layout.room.cameraZ, yaw: 0, pitch: 0.04, fov: layout.room.mobileFov},
  frame: {x: -2.15, y: 1.7, z: 7.55, yaw: Math.PI / 2, pitch: 0.0, fov: 34},
  ceiling: {x: 0, y: 1.58, z: 2.8, yaw: 0, pitch: 0.92, fov: 48},
  floor: {x: 0.15, y: 0.62, z: 2.15, yaw: 0.04, pitch: -0.82, fov: 46},
};
if (shots[shot]) Object.assign(state, shots[shot]);

const videoKeys = [
  {t: 0, ...shots.axis},
  {t: 3.5, x: 0, y: 1.58, z: 3.4, yaw: 0, pitch: 0.02, fov: 50},
  {t: 6.5, x: -1.85, y: 1.6, z: 4.7, yaw: Math.PI / 2, pitch: 0.03, fov: 38},
  {t: 9.2, x: 0.05, y: 1.55, z: 3.1, yaw: 0, pitch: 0.78, fov: 48},
  {t: 12.2, x: 0, y: 1.58, z: 6.4, yaw: 0, pitch: 0, fov: 48},
];

function lerpShot(a, b, t) {
  const out = {};
  for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'fov']) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

let videoStart = 0;
const keys = new Set();

function applyCamera() {
  // Layout Z runs down the hall. The glTF already stores that depth as -Z.
  // Keeping the mesh unscaled leaves every texture the way it was painted.
  camera.position.set(state.x, state.y, -state.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = state.yaw;
  // Positive pitch looks up. Three.js positive X rotation looks down when facing -Z.
  camera.rotation.x = -state.pitch;
  camera.fov = state.fov;
  camera.updateProjectionMatrix();
}

const v5 = createMuseumV5Navigation({
  overlay, canvas, mobile,
  home: () => Object.assign(state, shots.axis),
  setZoom: fov => { state.fov = fov; },
  adjustZoom: delta => { state.fov = Math.min(110, Math.max(28, state.fov + delta)); },
  nextStop: () => focusNext(),
  onTourChange: () => {},
  onViewChange: () => {},
});

let focusIndex = 0;
function focusNext() {
  const frame = layout.frames[focusIndex % layout.frames.length];
  focusIndex += 1;
  if (frame.wall === 'left' || frame.wall === 'endLeft') {
    state.x = frame.x + 1.7;
    state.z = frame.z;
    state.yaw = Math.PI / 2;
  } else if (frame.wall === 'right' || frame.wall === 'endRight') {
    state.x = frame.x - 1.7;
    state.z = frame.z;
    state.yaw = -Math.PI / 2;
  } else {
    state.x = frame.x;
    state.z = frame.z - 2.2;
    state.yaw = 0;
  }
  state.y = layout.room.eye;
  state.pitch = (frame.y - layout.room.eye) * 0.12;
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

if (matchMedia('(pointer:coarse)').matches) {
  const {fitMuseumVisualViewport} = await import('../visual-viewport-v1.js?v=20261106v2');
  fitMuseumVisualViewport();
}
v5.enter();

const report = {
  tier,
  ready: false,
  drawCalls: 0,
  triangles: 0,
  textureBytes: 0,
  exposure: renderer.toneMappingExposure,
  toneMapping: 'ACESFilmic',
  lightmap: 'luminance',
};
window.__SALLE_ECHANTILLON__ = report;

const marbleFile = mobile ? 'carrara-diff-mobile.jpg' : 'carrara-diff.jpg';
const marbleRoughFile = mobile ? 'carrara-rough-mobile.jpg' : 'carrara-rough.jpg';

let panoMesh = null;
let panoTexture = null;
const panoButton = document.getElementById('panoToggle');
const savedTone = {
  mapping: renderer.toneMapping,
  exposure: renderer.toneMappingExposure,
};

async function loadPanoTexture() {
  const started = performance.now();
  const response = await fetch(ASSET + 'pano-360.jpg');
  if (!response.ok) throw new Error('photo 360 absente');
  const buffer = await response.arrayBuffer();
  report.panoBytes = buffer.byteLength;
  report.panoMegabytes = Math.round(buffer.byteLength / (1024 * 1024) * 10) / 10;
  const bitmap = await createImageBitmap(new Blob([buffer], {type: 'image/jpeg'}));
  const texture = new THREE.Texture(bitmap);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  report.panoLoadMs = Math.round(performance.now() - started);
  return texture;
}

function attachPano(texture) {
  if (panoMesh || !texture) return;
  const geo = new THREE.SphereGeometry(5, 80, 48);
  geo.scale(-1, 1, 1);
  panoMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: texture, fog: false}));
  panoMesh.rotation.order = 'YXZ';
  panoMesh.rotation.y = Number(params.get('panoSpin') ?? (Math.PI * 1.5));
  panoMesh.rotation.x = Number(params.get('panoTilt') ?? Math.PI);
  panoMesh.visible = false;
  camera.add(panoMesh);
  scene.add(camera);
}

function setPano(on) {
  if (!panoMesh) return;
  report.pano = on;
  panoMesh.visible = on;
  if (on) {
    state.x = 0;
    state.y = layout.room.eye;
    state.z = layout.room.cameraZ;
    state.yaw = Number(params.get('panoYaw') || 0);
    state.pitch = 0;
    state.fov = shot === 'pano' ? layout.room.fov : (mobile ? layout.room.mobileFov : layout.room.fov);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    if (panoButton) panoButton.textContent = 'RETOUR';
    if (matchMedia('(pointer:coarse)').matches) enableGyro();
  } else {
    renderer.toneMapping = savedTone.mapping;
    renderer.toneMappingExposure = savedTone.exposure;
    if (panoButton) panoButton.textContent = 'PHOTO 360';
  }
}

let gyroOn = false;
function enableGyro() {
  if (gyroOn) return;
  gyroOn = true;
  const orientation = window.DeviceOrientationEvent;
  if (orientation?.requestPermission) {
    orientation.requestPermission().catch(() => {});
  }
  window.addEventListener('deviceorientation', event => {
    if (!report.pano || event.beta == null) return;
    state.pitch = Math.max(-1.15, Math.min(1.15, (event.beta - 78) * Math.PI / 180));
    if (event.alpha != null) state.yaw = event.alpha * Math.PI / 180;
  });
}

panoButton?.addEventListener('click', async () => {
  if (report.pano) {
    setPano(false);
    return;
  }
  if (await ensurePano()) setPano(true);
});

async function ensurePano() {
  if (panoMesh) return true;
  try {
    attachPano(await loadPanoTexture());
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

try {
  const loadPng = (file, colorSpace) => new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(ASSET + 'pbr/' + file, texture => {
      texture.colorSpace = colorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    }, undefined, reject);
  });
  const [marbleA, marbleR, marbleN, giltN, giltAo, sky, lightmap, gltf, atlas, heroes] = await Promise.all([
    loadSurface(marbleFile, THREE.SRGBColorSpace),
    loadSurface(marbleRoughFile, THREE.NoColorSpace),
    loadSurface('carrara-nor.jpg', THREE.NoColorSpace),
    loadPng('gilt-frame-nor.png', THREE.NoColorSpace).catch(() => loadSurface('gilt-nor.jpg', THREE.NoColorSpace)),
    loadPng('gilt-frame-ao.png', THREE.NoColorSpace).catch(() => null),
    loadSurface('sky-dome.jpg', THREE.SRGBColorSpace),
    loadLightmap(),
    gltfLoader.loadAsync(ASSET + 'salle-echantillon.glb'),
    paintingAtlas(layout.frames),
    heroTextures(layout.frames),
  ]);
  if ((giltN.image?.width || 0) > 256) {
    giltN.wrapS = giltN.wrapT = THREE.ClampToEdgeWrapping;
    if (giltAo) giltAo.wrapS = giltAo.wrapT = THREE.ClampToEdgeWrapping;
  } else {
    giltN.repeat.set(8, 2);
  }
  sky.wrapS = sky.wrapT = THREE.ClampToEdgeWrapping;
  const floorMap = marbleA.clone();
  const floorRough = marbleR.clone();
  floorMap.repeat.set(1.65, 1.65);
  floorRough.repeat.set(1.65, 1.65);
  floorMap.needsUpdate = true;
  floorRough.needsUpdate = true;
  const envSrc = sky.clone();
  envSrc.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(envSrc).texture;
  scene.environment = env;
  scene.environmentIntensity = mobile ? 0.42 : 0.62;
  const library = {
    floor: new THREE.MeshPhysicalMaterial({
      map: floorMap,
      roughnessMap: floorRough,
      normalMap: mobile ? null : marbleN,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.1,
      metalness: 0.02,
      clearcoat: mobile ? 0.25 : 0.55,
      clearcoatRoughness: 0.14,
      envMapIntensity: mobile ? 0.45 : 0.7,
    }),
    marble: new THREE.MeshPhysicalMaterial({
      map: marbleA,
      roughnessMap: marbleR,
      normalMap: mobile ? null : marbleN,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.38,
      metalness: 0,
      envMapIntensity: mobile ? 0.18 : 0.28,
    }),
    rock: new THREE.MeshStandardMaterial({
      map: marbleA,
      roughnessMap: marbleR,
      normalMap: mobile ? null : marbleN,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: mobile ? 0.55 : 0.72,
    }),
    gilt: new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(0.83, 0.62, 0.31, THREE.LinearSRGBColorSpace),
      roughness: 0.36,
      metalness: 1,
      normalMap: giltN,
      normalScale: new THREE.Vector2(0.65, 0.65),
      aoMap: giltAo || null,
      aoMapIntensity: giltAo ? 1.1 : 0,
      envMapIntensity: mobile ? 0.8 : 1.3,
    }),
    artwork: new THREE.MeshStandardMaterial({
      map: atlas,
      emissiveMap: atlas,
      emissive: 0xfff1df,
      emissiveIntensity: 0.14,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.12,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x141210,
      roughness: 0.32,
      metalness: 0.9,
      envMapIntensity: mobile ? 0.25 : 0.45,
    }),
    bulb: new THREE.MeshStandardMaterial({
      color: 0xffc38a,
      emissive: 0xffb27a,
      emissiveIntensity: mobile ? 1.4 : 2.0,
      roughness: 0.35,
      metalness: 0,
    }),
    sky: new THREE.MeshBasicMaterial({
      map: sky,
      color: 0xffffff,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    }),
  };
  applyLibrary(gltf.scene, library, lightmap);
  const heroObjects = [];
  gltf.scene.traverse(object => {
    if (object.isMesh && object.name.startsWith('Hero_')) heroObjects.push(object);
  });
  heroObjects.sort((a, b) => a.name.localeCompare(b.name));
  heroObjects.forEach((object, index) => {
    const painting = heroes[index] || atlas;
    object.material = object.material.clone();
    object.material.map = painting;
    object.material.emissiveMap = painting;
    object.material.emissive = new THREE.Color(0xfff1df);
    object.material.emissiveIntensity = 0.18;
    object.material.color.set(0xffffff);
    object.material.roughness = 0.72;
    const uv = object.geometry.attributes.uv1 || object.geometry.attributes.uv2;
    if (uv) {
      object.geometry.setAttribute('uv2', uv);
      object.material.lightMap = lightmap;
      object.material.lightMap.channel = 2;
      object.material.lightMapIntensity = Math.PI * LIGHT_GAIN * 1.15;
    }
  });
  const framed = [];
  const plain = [];
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    if (object.name.startsWith('framed-canvas-')) framed.push(object);
    else if (object.name.startsWith('Canvas_')) plain.push(object);
  });
  const canvases = framed.length ? framed : plain.sort((a, b) => a.name.localeCompare(b.name));
  if (framed.length) {
    for (const object of plain) object.visible = false;
  }
  if (canvases.length) {
    const frames = layout.frames.filter(frame => frame.wall === 'left' || frame.wall === 'right');
    const textures = await Promise.all(frames.map(frame => new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(paintingUrl(frame.painting), resolve, undefined, reject);
    })));
    const byId = new Map(frames.map((frame, index) => [frame.id, {frame, painting: textures[index]}]));
    canvases.forEach((object, index) => {
      const id = object.name.replace('framed-canvas-', '');
      const match = byId.get(id) || {frame: frames[index], painting: textures[index]};
      const frame = match.frame;
      const painting = match.painting;
      if (!frame || !painting) return;
      painting.colorSpace = THREE.SRGBColorSpace;
      painting.flipY = false;
      const cover = coverRepeat(painting.image.width / painting.image.height, frame.artWidth / frame.artHeight);
      painting.wrapS = painting.wrapT = THREE.ClampToEdgeWrapping;
      painting.repeat.set(cover.rx, cover.ry);
      painting.offset.set(cover.ox, cover.oy);
      // The lightmap islands do not cover this canvas, so sampling them drew black bands.
      // Daylight plus a small lift keeps the picture near the Cycles brightness.
      object.material = new THREE.MeshStandardMaterial({
        map: painting,
        color: 0xffffff,
        roughness: 0.52,
        metalness: 0,
        emissive: 0xfff7ef,
        emissiveMap: painting,
        emissiveIntensity: 0.28,
        envMapIntensity: 0.55,
      });
    });
  }
  // The mesh stays right-handed. A negative Z scale mirrored the paintings
  // and put the left wall on the right of the picture. Depth already points down -Z.
  scene.add(gltf.scene);
  const floorSpan = layout.room.length - layout.room.backZ;
  const reflector = new Reflector(new THREE.PlaneGeometry(layout.room.width, floorSpan), {
    textureWidth: mobile ? 256 : 768,
    textureHeight: mobile ? 256 : 432,
    clipBias: 0.003,
    color: 0xf4f1ea,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0.018, -(layout.room.backZ + floorSpan / 2));
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.material.uniforms.uResolution = {value: new THREE.Vector2(1920, 1080)};
  reflector.material.fragmentShader = reflector.material.fragmentShader
    .replace('uniform vec3 color;', 'uniform vec3 color;\nuniform vec2 uResolution;')
    .replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      `float y = gl_FragCoord.y / max(uResolution.y, 1.0);
       float fres = smoothstep(0.02, 0.62, y);
       gl_FragColor = vec4(base.rgb * color, mix(0.08, 0.46, fres));`,
    );
  const fitReflector = () => {
    reflector.material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  fitReflector();
  window.addEventListener('resize', fitReflector);
  scene.add(reflector);
  for (const frame of layout.frames) {
    const spot = new THREE.SpotLight(0xffc992, mobile ? 30 : 78, 6.4, 0.78, 0.88, 1.35);
    const side = frame.wall === 'left' ? 1 : -1;
    spot.position.set(frame.x + side * 0.85, 4.55, -frame.z);
    spot.target.position.set(frame.x + side * 0.05, frame.y + frame.height * 0.15, -frame.z);
    scene.add(spot, spot.target);
  }
  scene.fog = new THREE.Fog(0xf7f8fb, 16, 40);
  const shaftTex = shaftTexture();
  for (const [x, y, z, w, h, spin] of [[0.05, 6.4, 9.2, 1.8, 8.2, 0.08], [-0.45, 5.6, 12.2, 1.15, 6.4, -0.2], [0.5, 6.8, 14.6, 1.35, 7.2, 0.25]]) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: shaftTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: mobile ? 0.16 : 0.22,
      fog: false,
      side: THREE.DoubleSide,
    }));
    shaft.position.set(x, y, -z);
    shaft.rotation.y = spin;
    scene.add(shaft);
  }
  // The far end is the sky dome, not a beige card.
  if (shot === 'pano' || params.get('view') === 'pano' || shot === 'switch') {
    await ensurePano();
  }
  if (shot === 'pano' || params.get('view') === 'pano') setPano(true);
  statusEl.remove();
  report.ready = true;
} catch (error) {
  console.error(error);
  statusEl.textContent = 'La salle échantillon n’a pas pu s’ouvrir. ' + error.message;
}

function shaftTexture() {
  const plate = document.createElement('canvas');
  plate.width = 128;
  plate.height = 512;
  const context = plate.getContext('2d');
  const horizontal = context.createLinearGradient(0, 0, 128, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.5, 'rgba(255,250,242,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = horizontal;
  context.fillRect(0, 0, 128, 512);
  const vertical = context.createLinearGradient(0, 0, 0, 512);
  vertical.addColorStop(0, 'rgba(255,255,255,0.15)');
  vertical.addColorStop(0.35, 'rgba(255,255,255,1)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = vertical;
  context.fillRect(0, 0, 128, 512);
  const texture = new THREE.CanvasTexture(plate);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function round1(value) {
  return Math.round(value * 1000) / 1000;
}

function pressed(...names) {
  return names.some(name => keys.has(name));
}

let last = performance.now();
const gaze = new THREE.Vector3();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const input = v5.update(dt);
  if (shot === 'video') {
    if (!videoStart) videoStart = now;
    const frozen = params.get('t');
    const elapsed = window.__SAMPLE_T != null
      ? Math.min(12.2, Number(window.__SAMPLE_T))
      : frozen
        ? Math.min(12.2, Number(frozen))
        : Math.min(12.2, (now - videoStart) / 1000);
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
  } else if (shot === 'switch') {
    if (!videoStart) videoStart = now;
    const elapsed = window.__SAMPLE_T != null
      ? Math.min(8, Number(window.__SAMPLE_T))
      : Math.min(8, (now - videoStart) / 1000);
    report.videoTime = elapsed;
    if (elapsed < 2.8) {
      Object.assign(state, shots.axis);
    } else if (!report.pano && panoMesh) {
      setPano(true);
    } else if (report.pano) {
      state.yaw = Math.sin((elapsed - 2.8) * 0.7) * 0.65;
      state.pitch = -0.04 + Math.sin((elapsed - 2.8) * 0.45) * 0.16;
    }
  } else if (!shot && !report.pano) {
    let forward = (pressed('ArrowUp', 'KeyW', 'KeyZ') ? 1 : 0) - (pressed('ArrowDown', 'KeyS') ? 1 : 0) + input.forward;
    let strafe = (pressed('KeyD') ? 1 : 0) - (pressed('KeyQ', 'KeyA') ? 1 : 0) + input.strafe;
    overlay.dataset.museumInputForward = forward.toFixed(3);
    overlay.dataset.museumInputStrafe = strafe.toFixed(3);
    state.yaw += input.lookX * 1.9 * dt;
    state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch - input.lookY * 1.32 * dt));
    const speed = 1.45;
    const mag = Math.max(1, Math.hypot(forward, strafe));
    // yaw 0 looks down the hall (-Z). Strafe right is +X, forward increases layout Z.
    const s = Math.sin(state.yaw);
    const c = Math.cos(state.yaw);
    const dx = s * forward + c * strafe;
    const dz = c * forward - s * strafe;
    state.vx += (dx * speed / mag - state.vx) * Math.min(1, dt * 8);
    state.vz += (dz * speed / mag - state.vz) * Math.min(1, dt * 8);
    const nx = state.x + state.vx * dt;
    const nz = state.z + state.vz * dt;
    if (!blocked(nx, state.z)) state.x = nx;
    if (!blocked(state.x, nz)) state.z = nz;
    state.y = layout.room.eye;
  }
  applyCamera();
  camera.getWorldDirection(gaze);
  report.eye = [round1(camera.position.x), round1(camera.position.y), round1(camera.position.z), round1(gaze.x), round1(gaze.y), round1(gaze.z)];
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
        const image = texture?.image;
        if (!texture || seen.has(texture) || (image && seen.has(image))) continue;
        seen.add(texture);
        if (!image) continue;
        seen.add(image);
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
