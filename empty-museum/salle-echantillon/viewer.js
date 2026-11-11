import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createMuseumV5Navigation} from '../museum-v5.js?v=20261111ech';
import {museumCameraMotion} from '../movement3d.js';
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

const canvas = document.getElementById('walkCanvas');
const overlay = document.getElementById('walkOverlay');
const statusEl = document.getElementById('sampleStatus');
if (shot) document.body.classList.add('is-shot');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: mobile ? 'low-power' : 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(params.get('expo')) || layout.room.exposure;
renderer.setClearColor(0x100e0c, 1);
renderer.setPixelRatio(shot ? 1 : Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(layout.room.fov, 1, 0.05, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = mobile ? 0.16 : 0.28;

const gltfLoader = new GLTFLoader();
const ktx2 = new KTX2Loader().setTranscoderPath('salle-temoin/basis/');
ktx2.detectSupport(renderer);

function prepareLightmap(texture) {
  texture.colorSpace = THREE.NoColorSpace;
  // glTF already flips V. A second flip maps the wall halos onto the ceiling.
  texture.flipY = params.get('flip') === '1';
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

function unmirror(texture) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x *= -1;
  texture.offset.x += 1;
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
    const image = await loadImage(PAINT + frame.painting);
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
      new THREE.TextureLoader().load(PAINT + frame.painting, resolve, undefined, reject);
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

function applyLibrary(root, library, lightmap) {
  root.traverse(object => {
    if (!object.isMesh) return;
    const name = (object.material?.name || object.name || '').replace(/\.\d+$/, '');
    const base = library[name] || library.stone;
    const material = base.clone();
    material.name = name;
    const uv = object.geometry?.attributes?.uv1 || object.geometry?.attributes?.uv2;
    const lit = uv && !['laylight', 'bulb', 'iron', 'gilt', 'skirting'].includes(name);
    if (lit) {
      object.geometry.setAttribute('uv2', uv);
      material.lightMap = lightmap;
      material.lightMap.channel = 2;
      const gain = name === 'parquet' ? 0.92 : name === 'bordeaux' ? 2.15 : name === 'artwork' ? 1.2 : name === 'ceiling' ? 5.5 : name === 'stone' ? 2.1 : 1;
      material.lightMapIntensity = Math.PI * LIGHT_GAIN * gain;
    }
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
  axis: {x: 0, y: layout.room.eye, z: layout.room.cameraZ, yaw: 0, pitch: -0.02, fov: layout.room.fov},
  mobile: {x: 0, y: layout.room.eye, z: layout.room.cameraZ, yaw: 0, pitch: -0.02, fov: layout.room.mobileFov},
  frame: {x: -2.05, y: 1.64, z: 4.65, yaw: Math.PI / 2, pitch: 0.02, fov: 36},
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
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = Math.PI + state.yaw;
  camera.rotation.x = state.pitch;
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

const floorFile = mobile ? 'herringbone-diff-mobile.jpg' : 'herringbone-diff.jpg';
const floorRough = mobile ? 'herringbone-rough-mobile.jpg' : 'herringbone-rough.jpg';
const floorNor = mobile ? 'herringbone-nor-mobile.jpg' : 'herringbone-nor.jpg';

try {
  const [floorA, floorR, floorN, wallA, wallR, wallN, stoneA, stoneR, stoneN, giltN, sky, lightmap, gltf, atlas, heroes] = await Promise.all([
    loadSurface(floorFile, THREE.SRGBColorSpace),
    loadSurface(floorRough, THREE.NoColorSpace),
    loadSurface(floorNor, THREE.NoColorSpace),
    loadSurface('bordeaux-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('bordeaux-rough.jpg', THREE.NoColorSpace),
    loadSurface('bordeaux-nor.jpg', THREE.NoColorSpace),
    loadSurface('limestone-diff.jpg', THREE.SRGBColorSpace),
    loadSurface('limestone-rough.jpg', THREE.NoColorSpace),
    loadSurface('limestone-nor.jpg', THREE.NoColorSpace),
    loadSurface('gilt-nor.jpg', THREE.NoColorSpace),
    loadSurface('skylight.jpg', THREE.SRGBColorSpace),
    loadLightmap(),
    gltfLoader.loadAsync(ASSET + 'salle-echantillon.glb'),
    paintingAtlas(layout.frames),
    heroTextures(layout.frames),
  ]);
  for (const texture of [floorA, floorR, floorN, wallA, wallR, wallN, stoneA, stoneR, stoneN, giltN]) unmirror(texture);
  giltN.repeat.set(giltN.repeat.x * 8, giltN.repeat.y * 2);
  const library = {
    parquet: new THREE.MeshPhysicalMaterial({
      map: floorA,
      roughnessMap: floorR,
      normalMap: mobile ? null : floorN,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.55,
      metalness: 0,
      clearcoat: mobile ? 0.08 : 0.16,
      clearcoatRoughness: 0.22,
      envMapIntensity: mobile ? 0.35 : 0.55,
    }),
    bordeaux: new THREE.MeshPhysicalMaterial({
      map: wallA,
      roughnessMap: wallR,
      normalMap: mobile ? null : wallN,
      normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 1,
      metalness: 0,
      sheen: 0.05,
      sheenColor: new THREE.Color(layout.room.wallColor),
      sheenRoughness: 0.82,
      envMapIntensity: 0.035,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: stoneA,
      roughnessMap: stoneR,
      normalMap: mobile ? null : stoneN,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.12,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      map: stoneA,
      color: new THREE.Color('#F3E6D2'),
      emissive: new THREE.Color('#E8D4B4'),
      emissiveIntensity: 0.2,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.06,
    }),
    skirting: new THREE.MeshStandardMaterial({
      color: 0x3c3832,
      roughness: 0.78,
      metalness: 0.04,
    }),
    plaster: new THREE.MeshStandardMaterial({
      color: new THREE.Color(layout.room.endColor),
      emissive: new THREE.Color(0xf3eadc),
      emissiveIntensity: 0.22,
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0.08,
    }),
    gilt: new THREE.MeshStandardMaterial({
      color: 0xf0d48a,
      emissive: 0xd4b36a,
      emissiveIntensity: 0.22,
      roughness: 0.3,
      metalness: 1,
      normalMap: giltN,
      normalScale: new THREE.Vector2(1.1, 1.1),
      envMapIntensity: mobile ? 1.1 : 2.1,
    }),
    liner: new THREE.MeshStandardMaterial({color: 0xe7d5ba, roughness: 0.74, metalness: 0}),
    artwork: new THREE.MeshStandardMaterial({
      map: atlas,
      emissiveMap: atlas,
      emissive: 0xfff1df,
      emissiveIntensity: 0.18,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.12,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x1a1714,
      roughness: 0.32,
      metalness: 0.9,
      envMapIntensity: mobile ? 0.25 : 0.45,
    }),
    bulb: new THREE.MeshStandardMaterial({
      color: 0xffc38a,
      emissive: 0xffb27a,
      emissiveIntensity: mobile ? 1.6 : 2.4,
      roughness: 0.35,
      metalness: 0,
    }),
    };
  library.bordeaux.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWallH;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWallH = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWallH;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.42, smoothstep(0.8, 4.4, vWallH));`);
  };
  library.laylight = new THREE.MeshStandardMaterial({
    map: sky,
    emissiveMap: sky,
    emissive: 0xffffff,
    emissiveIntensity: mobile ? 1.8 : 2.4,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
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
  gltf.scene.scale.z = -1;
  scene.add(gltf.scene);
  const floorSpan = layout.room.length - layout.room.backZ;
  const reflector = new Reflector(new THREE.PlaneGeometry(layout.room.width, floorSpan), {
    textureWidth: mobile ? 160 : 320,
    textureHeight: mobile ? 160 : 320,
    clipBias: 0.003,
    color: 0xfff1e2,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, 0.018, layout.room.backZ + floorSpan / 2);
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.material.uniforms.uResolution = {value: new THREE.Vector2(1920, 1080)};
  reflector.material.fragmentShader = reflector.material.fragmentShader
    .replace('uniform vec3 color;', 'uniform vec3 color;\nuniform vec2 uResolution;')
    .replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      `float y = gl_FragCoord.y / max(uResolution.y, 1.0);
       float fres = smoothstep(0.02, 0.62, y);
       gl_FragColor = vec4(base.rgb * color, mix(0.05, 0.36, fres));`,
    );
  const fitReflector = () => {
    reflector.material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  fitReflector();
  window.addEventListener('resize', fitReflector);
  scene.add(reflector);
  for (const frame of layout.frames) {
    const spot = new THREE.SpotLight(0xffd7a4, mobile ? 22 : 48, 5.5, 0.58, 0.95, 1.6);
    const side = frame.wall === 'left' || frame.wall === 'endLeft' ? 1 : frame.wall === 'right' || frame.wall === 'endRight' ? -1 : 0;
    spot.position.set(frame.x + side * 0.9, 4.25, frame.wall === 'north' ? frame.z - 0.75 : frame.z);
    spot.target.position.set(frame.x, frame.y, frame.z);
    scene.add(spot, spot.target);
  }
  if (!mobile) {
    try {
      const cubeTarget = new THREE.WebGLCubeRenderTarget(256);
      const probe = new THREE.CubeCamera(0.25, 40, cubeTarget);
      probe.position.set(0, 1.15, layout.room.hallLength * 0.42);
      probe.update(renderer, scene);
      const env = pmrem.fromCubemap(cubeTarget.texture).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.34;
      gltf.scene.traverse(object => {
        if (object.isMesh && object.material?.name === 'parquet') {
          object.material.envMap = env;
          object.material.envMapIntensity = 0.7;
        }
      });
      cubeTarget.dispose();
    } catch (error) {
      console.warn('reflection probe skipped', error);
    }
  }
  statusEl.remove();
  report.ready = true;
} catch (error) {
  console.error(error);
  statusEl.textContent = 'La salle échantillon n’a pas pu s’ouvrir. ' + error.message;
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
  } else if (!shot) {
    let forward = (pressed('ArrowUp', 'KeyW', 'KeyZ') ? 1 : 0) - (pressed('ArrowDown', 'KeyS') ? 1 : 0) + input.forward;
    let strafe = (pressed('KeyD') ? 1 : 0) - (pressed('KeyQ', 'KeyA') ? 1 : 0) + input.strafe;
    overlay.dataset.museumInputForward = forward.toFixed(3);
    overlay.dataset.museumInputStrafe = strafe.toFixed(3);
    state.yaw += input.lookX * 1.9 * dt;
    state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch - input.lookY * 1.32 * dt));
    const motion = museumCameraMotion(state.yaw, forward, strafe);
    const speed = 1.45;
    const mag = Math.max(1, Math.hypot(forward, strafe));
    state.vx += (motion.x * speed / mag - state.vx) * Math.min(1, dt * 8);
    state.vz += (motion.z * speed / mag - state.vz) * Math.min(1, dt * 8);
    const nx = state.x + state.vx * dt;
    const nz = state.z + state.vz * dt;
    if (!blocked(nx, state.z)) state.x = nx;
    if (!blocked(state.x, nz)) state.z = nz;
    state.y = layout.room.eye;
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
