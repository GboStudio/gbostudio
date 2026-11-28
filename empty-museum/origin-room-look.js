/**
 * Pièce d'origine — essai visuel (marbre, or, sol réfléchissant, ciel).
 * Pour retrouver l'ancien rendu calcaire : mettre `enabled` à false.
 * Le reste du musée (parcours, cadres, allée, joysticks, secours 2D) ne change pas.
 *
 * Marbre : Marble019 d'ambientCG (CC0), albédo + normale + rugosité, 2K bureau / 1K mobile.
 * Kit : pilastre, plinthe, corniche, panneau et banquette (glTF meshopt), mêmes positions.
 * Or : MeshStandardMaterial metalness 1, environnement RoomEnvironment.
 * Sol : miroir planaire 1024 sur ordinateur, environnement seul sur mobile.
 * Ciel : photo CC0 Poly Haven (Kloofendal 48d) sur le dôme, 2K bureau / 1K mobile.
 */
import * as THREE from "three";
import {Reflector} from "three/addons/objects/Reflector.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {
  FRAME,
  ENFILADE,
  enfiladeFrameLayout,
  frameAnchorX,
  frameRotationY,
  commercialFrameZ,
  wallInnerFaceX
} from "./origin-room-geometry.mjs";
import { HALL_END_Z, canDecorateSlot } from "./origin-hall-layout.mjs";
import {buildStoneShell, compactWallFrames, mountArchitectureKit, mountOrnateFrames, placeWarmHalos, placeFrameReflections} from "./origin-room-build.js?v=20261127j12";

export const enabled = true;

export {
  FRAME,
  frameAnchorX,
  frameRotationY,
  commercialFrameZ,
  LEGACY_FRAME_SIZE_M
} from "./origin-room-geometry.mjs";

const geometryCache = new Map();

export function mouldedFrameGeometry(w, h) {
  const key = w.toFixed(4) + "x" + h.toFixed(4);
  let template = geometryCache.get(key);
  if (!template) {
    const lip = FRAME.lip;
    const hw = w / 2 + lip, hh = h / 2 + lip;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-w / 2, -h / 2);
    hole.lineTo(-w / 2, h / 2);
    hole.lineTo(w / 2, h / 2);
    hole.lineTo(w / 2, -h / 2);
    hole.closePath();
    shape.holes.push(hole);
    template = new THREE.ExtrudeGeometry(shape, {
      depth: FRAME.depth,
      bevelEnabled: true,
      bevelThickness: FRAME.bevelThickness,
      bevelSize: FRAME.bevelSize,
      bevelSegments: 2,
      curveSegments: 1,
      steps: 1
    });
    template.computeBoundingBox();
    template.translate(0, 0, FRAME.backLocalZ - template.boundingBox.min.z);
    geometryCache.set(key, template);
  }
  // Inventory redraw disposes mesh geometries. Hand out a clone.
  return template.clone();
}

function canvasPixel(r, g, b) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 2, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function loadMarbleMap(url, color) {
  const loader = new THREE.TextureLoader();
  return new Promise(resolve => {
    loader.load(url, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

const MARBLE_GLSL = `
float mHash(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float mNoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = mHash(i);
  float n100 = mHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = mHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = mHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = mHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = mHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = mHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = mHash(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
vec2 marbleRot(vec2 uv, float a){
  float c = cos(a), s = sin(a);
  return vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
}
vec3 marbleTri(sampler2D tex, vec3 p, vec3 n){
  vec3 b = pow(abs(normalize(n)), vec3(4.0));
  b /= max(b.x + b.y + b.z, 0.0001);
  float ang = (mNoise(p * 0.028) - 0.5) * 0.7;
  vec2 bend = vec2(mNoise(p * 0.05), mNoise(p.zxy * 0.046)) * 0.32;
  vec2 uX = marbleRot(p.zy * uMarbleScale + bend, ang);
  vec2 uY = marbleRot(p.xz * uMarbleScale + bend.yx, ang * 0.6);
  vec2 uZ = marbleRot(p.xy * uMarbleScale - bend, -ang * 0.45);
  return texture2D(tex, uX).rgb * b.x + texture2D(tex, uY).rgb * b.y + texture2D(tex, uZ).rgb * b.z;
}
`;

function marbleShader(shader, maps, lift, roughMix, floorEdge) {
  shader.uniforms.uMarbleLift = {value: lift};
  shader.uniforms.uMarbleScale = {value: 0.16};
  shader.uniforms.uMarbleMap = {value: maps.color};
  shader.uniforms.uMarbleNor = {value: maps.normal};
  shader.uniforms.uMarbleRough = {value: maps.rough};
  shader.uniforms.uRoughMix = {value: roughMix};
  shader.uniforms.uFloorEdge = {value: floorEdge};
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vMarbleWp;\nvarying vec3 vMarbleN;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
	vec4 marbleWp = vec4(transformed, 1.0);
	mat3 marbleN = mat3(1.0);
	#ifdef USE_INSTANCING
		marbleWp = instanceMatrix * marbleWp;
		marbleN = mat3(instanceMatrix);
	#endif
	vMarbleWp = (modelMatrix * marbleWp).xyz;
	vMarbleN = normalize(mat3(modelMatrix) * marbleN * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
varying vec3 vMarbleWp;
varying vec3 vMarbleN;
uniform float uMarbleLift;
uniform float uMarbleScale;
uniform float uRoughMix;
uniform float uFloorEdge;
uniform sampler2D uMarbleMap;
uniform sampler2D uMarbleNor;
uniform sampler2D uMarbleRough;
${MARBLE_GLSL}`)
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
	vec3 alb = marbleTri(uMarbleMap, vMarbleWp, vMarbleN);
	float lum = dot(alb, vec3(0.2126, 0.7152, 0.0722));
	vec3 warm = vec3(0.965, 0.945, 0.915);
	float vein = smoothstep(0.86, 0.62, lum);
	alb = mix(alb, warm, 0.06);
	alb = mix(alb, alb * vec3(0.72, 0.74, 0.76), vein * 0.36);
	float along = abs(vMarbleN.x) > abs(vMarbleN.z) ? vMarbleWp.z : vMarbleWp.x;
	float dy = abs(fract(vMarbleWp.y / 1.5) - 0.5) * 1.5;
	float da = abs(fract(along / 3.0) - 0.5) * 3.0;
	float seam = 1.0 - smoothstep(0.003, 0.016, min(dy, da));
	alb = mix(alb, alb * vec3(0.80, 0.80, 0.78), seam * (1.0 - uFloorEdge));
	diffuseColor.rgb = alb * uMarbleLift;
	#ifdef USE_LIGHTMAP
		float baked = dot(texture2D(lightMap, vLightMapUv).rgb, vec3(0.333));
		diffuseColor.rgb *= mix(0.78, 1.0, clamp(baked, 0.0, 1.0));
	#endif
	if (vMarbleN.y < -0.4) {
		diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.98, 0.96), 0.84);
	}`
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
	if (vMarbleN.y < -0.45 && vMarbleWp.y > 5.4) {
		float opening = 1.0 - smoothstep(2.05, 4.5, abs(vMarbleWp.x));
		totalEmissiveRadiance += vec3(0.94, 0.97, 1.0) * (0.55 + 1.25 * opening);
	}`
    )
    .replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
	float scannedRough = dot(marbleTri(uMarbleRough, vMarbleWp, vMarbleN), vec3(0.333));
	roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor * (0.55 + scannedRough * 1.4), 0.045, 0.92), uRoughMix);`
    )
    .replace(
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>
	vec3 scannedN = marbleTri(uMarbleNor, vMarbleWp, vMarbleN) * 2.0 - 1.0;
	normal = normalize(normal + vec3(scannedN.x, scannedN.y, 0.0) * 0.42);`
    );
  return shader;
}

function marbleMaterial(maps, {roughness, metalness, lift, roughMix, envMapIntensity, floorEdge}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    envMapIntensity
  });
  material.onBeforeCompile = shader => {
    material.userData.shader = marbleShader(shader, maps, lift, roughMix, floorEdge ? 1 : 0);
  };
  material.customProgramCacheKey = () => "origin-marble-j8-" + lift + "-" + roughMix + "-" + (floorEdge ? 1 : 0);
  return material;
}

function pushMarble(materials, maps) {
  const names = {color: "uMarbleMap", normal: "uMarbleNor", rough: "uMarbleRough"};
  for (const mat of materials) {
    const shader = mat.userData.shader;
    if (!shader) continue;
    for (const key of Object.keys(names)) {
      if (maps[key]) shader.uniforms[names[key]].value = maps[key];
    }
  }
}

export function createOriginMaterials({mobile}) {
  const maps = {
    color: canvasPixel(214, 210, 204),
    normal: canvasPixel(128, 128, 255),
    rough: canvasPixel(40, 40, 40)
  };
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe2b34a,
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: mobile ? 1.45 : 2.35
  });
  const wall = marbleMaterial(maps, {
    roughness: 0.46,
    metalness: 0,
    lift: 1.08,
    roughMix: 0.4,
    envMapIntensity: 0.16
  });
  const floor = marbleMaterial(maps, {
    roughness: mobile ? 0.55 : 0.72,
    metalness: 0,
    lift: 0.84,
    roughMix: 0.04,
    envMapIntensity: mobile ? 0.12 : 0.03,
    floorEdge: true
  });
  floor.polygonOffset = true;
  floor.polygonOffsetFactor = 1;
  floor.polygonOffsetUnits = 1;
  const tracked = [wall, floor];
  const size = mobile ? "1k" : "2k";
  const stem = "./assets/marble/marble019-";
  Promise.all([
    loadMarbleMap(stem + "color-" + size + ".jpg", true),
    loadMarbleMap(stem + "normal-" + size + ".jpg", false),
    loadMarbleMap(stem + "rough-" + size + ".jpg", false)
  ]).then(([color, normal, rough]) => {
    if (color) maps.color = color;
    if (normal) maps.normal = normal;
    if (rough) maps.rough = rough;
    pushMarble(tracked, maps);
    const overlay = document.getElementById("walkOverlay");
    if (overlay) overlay.dataset.originMarble = color && normal && rough ? "ready" : "fallback";
  });
  return {
    gold,
    wall,
    floor,
    track(material) {
      tracked.push(material);
      if (material.userData.shader) pushMarble([material], maps);
    }
  };
}

function cloudVolume({THREE, mobile}) {
  // Camera-facing puffs at several depths. Parallax comes from the spacing.
  // Four noise octaves on one instanced draw; mobile uses fewer puffs.
  const puffs = mobile
    ? [[0, 5.9, 4.4, 4.6], [-0.4, 5.55, 6.6, 4.0], [0.45, 5.8, 8.6, 4.2],
      [-0.2, 5.5, 10.8, 4.4], [0.3, 6.0, 13.2, 3.8], [-0.35, 5.65, 15.6, 4.0]]
    : [[-0.2, 5.9, 3.4, 4.8], [0.45, 5.45, 4.8, 4.2], [-0.55, 6.05, 6.2, 4.4],
      [0.15, 5.4, 7.6, 5.0], [0.6, 5.85, 9.2, 3.8], [-0.4, 6.1, 10.6, 4.6],
      [0.25, 5.5, 12.2, 4.8], [-0.65, 5.8, 13.8, 4.0], [0.5, 6.0, 15.4, 4.2],
      [-0.15, 5.45, 17.2, 5.0], [0.35, 5.95, 19.4, 3.8], [-0.5, 5.6, 21.6, 4.4],
      [0.1, 6.05, 24, 4.6], [0.55, 5.5, 27, 4.0], [-0.3, 5.75, 30, 4.4],
      [0.2, 5.9, 33.5, 3.8], [-0.45, 5.55, 37, 4.2]];
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vSeed;
      varying vec3 vWorld;
      void main() {
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float size = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 world = center + right * position.x * size + up * position.y * size;
        vUv = uv;
        vWorld = world;
        vSeed = center.z * 0.37 + center.x * 1.7;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vSeed;
      varying vec3 vWorld;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
        vec2 uv = vUv - 0.5;
        float n = 0.0;
        float amp = 0.5;
        vec2 p = uv * 3.1 + vSeed;
        for (int i = 0; i < 4; i++) {
          n += amp * noise(p);
          p *= 2.05;
          amp *= 0.5;
        }
        float warp = noise(uv * 2.2 + vSeed) * 0.16;
        float body = 1.0 - smoothstep(0.0, 0.52, length(uv) - warp);
        float alpha = body * smoothstep(0.10, 0.42, n);
        float slot = smoothstep(2.18, 1.45, abs(vWorld.x));
        alpha *= slot * slot;
        if (alpha < 0.02) discard;
        float light = clamp(uv.y * 1.6 + 0.42, 0.0, 1.0);
        vec3 col = mix(vec3(0.80, 0.84, 0.88), vec3(1.0, 0.995, 0.985), light);
        gl_FragColor = vec4(col, min(alpha * 1.4, 0.95));
      }
    `
  }), puffs.length);
  const dummy = new THREE.Object3D();
  puffs.forEach(([x, y, z, size], index) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(size, size, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  mesh.name = "origin-cloud-volume";
  return mesh;
}

function adoptMarble(mat, source, trackMarble) {
  mat.onBeforeCompile = shader => {
    const previous = source.userData.shader;
    source.onBeforeCompile(shader);
    mat.userData.shader = source.userData.shader;
    source.userData.shader = previous;
    if (trackMarble) trackMarble(mat);
  };
}

function placeEnfilade({THREE, scene, half, height, wallMaterial, mobile, trackMarble}) {
  const face = wallInnerFaceX(1, half);
  const open = ENFILADE.opening / 2;
  const zs = mobile ? ENFILADE.zs.slice(0, 1) : ENFILADE.zs;
  const joint = wallMaterial.clone();
  joint.customProgramCacheKey = () => wallMaterial.customProgramCacheKey() + "-joint";
  adoptMarble(joint, wallMaterial, trackMarble);
  const backing = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), joint, zs.length * 3);
  const slabs = [];
  const dummy = new THREE.Object3D();
  let index = 0;
  const pushSlab = (x, y, z, w, h) => {
    const gap = 0.008;
    slabs.push({x, y, z: z - ENFILADE.thickness / 2 - 0.018, w: Math.max(0.2, w - gap), h: Math.max(0.2, h - gap)});
  };
  const fill = (x0, x1, y0, y1, z) => {
    const cols = Math.max(1, Math.round((x1 - x0) / 1.6));
    const rows = Math.max(1, Math.round((y1 - y0) / 1.5));
    const cw = (x1 - x0) / cols;
    const ch = (y1 - y0) / rows;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        pushSlab(x0 + cw * (col + 0.5), y0 + ch * (row + 0.5), z, cw, ch);
      }
    }
  };
  for (const z of zs) {
    const door = z === ENFILADE.zs[0] ? ENFILADE.firstDoor : {x0: -open, x1: open};
    const leftW = door.x0 + face;
    const rightW = face - door.x1;
    dummy.position.set((-face + door.x0) / 2, height / 2, z);
    dummy.scale.set(leftW, height, ENFILADE.thickness);
    dummy.updateMatrix();
    backing.setMatrixAt(index++, dummy.matrix);
    fill(-face, door.x0, 0.02, height, z);
    dummy.position.set((door.x1 + face) / 2, height / 2, z);
    dummy.scale.set(rightW, height, ENFILADE.thickness);
    dummy.updateMatrix();
    backing.setMatrixAt(index++, dummy.matrix);
    fill(door.x1, face, 0.02, height, z);
    const lintelH = Math.max(0.4, height - ENFILADE.lintelY);
    dummy.position.set((door.x0 + door.x1) / 2, ENFILADE.lintelY + lintelH / 2, z);
    dummy.scale.set(door.x1 - door.x0, lintelH, ENFILADE.thickness);
    dummy.updateMatrix();
    backing.setMatrixAt(index++, dummy.matrix);
    fill(door.x0, door.x1, ENFILADE.lintelY, height, z);
  }
  backing.instanceMatrix.needsUpdate = true;
  backing.name = "origin-enfilade";
  scene.add(backing);
  const slabMat = wallMaterial.clone();
  slabMat.emissive = new THREE.Color(0xffffff);
  slabMat.emissiveIntensity = mobile ? 0.34 : 0.03;
  slabMat.customProgramCacheKey = () => wallMaterial.customProgramCacheKey() + "-slab";
  adoptMarble(slabMat, wallMaterial, trackMarble);
  const faces = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), slabMat, slabs.length);
  slabs.forEach((slab, slabIndex) => {
    dummy.position.set(slab.x, slab.y, slab.z);
    dummy.scale.set(slab.w, slab.h, 0.045);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    faces.setMatrixAt(slabIndex, dummy.matrix);
  });
  faces.instanceMatrix.needsUpdate = true;
  faces.name = "origin-enfilade-slabs";
  scene.add(faces);
  const frames = (mobile ? enfiladeFrameLayout().slice(0, 1) : enfiladeFrameLayout());
  const gold = new THREE.MeshStandardMaterial({color: 0xe2b34a, metalness: 1, roughness: 0.28});
  const lips = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), gold, frames.length);
  const paintings = [
    "pd-01.jpg", "pd-02.jpg", "pd-03.jpg", "pd-04.jpg", "pd-05.jpg", "pd-06.jpg",
    "pd-07.jpg", "pd-08.jpg", "pd-09.jpg", "pd-10.jpg", "pd-11.jpg", "pd-12.jpg"
  ];
  const paintingLoader = new THREE.TextureLoader();
  frames.forEach((frame, frameIndex) => {
    dummy.position.set(frame.x, frame.y, frame.z + 0.004);
    dummy.scale.set(frame.w + 0.12, frame.h + 0.12, 1);
    dummy.rotation.set(0, Math.PI, 0);
    dummy.updateMatrix();
    lips.setMatrixAt(frameIndex, dummy.matrix);
    const mat = new THREE.MeshBasicMaterial({color: 0xf4f0ea, toneMapped: true});
    const art = new THREE.Mesh(new THREE.PlaneGeometry(frame.w, frame.h), mat);
    art.position.set(frame.x, frame.y, frame.z);
    art.rotation.y = Math.PI;
    art.name = "origin-enfilade-art";
    scene.add(art);
    paintingLoader.load(paintingUrl(paintings[frameIndex], mobile), tex => {
      preparePainting(tex, mobile);
      mat.map = tex;
      mat.needsUpdate = true;
    });
  });
  lips.instanceMatrix.needsUpdate = true;
  lips.name = "origin-enfilade-frame";
  scene.add(lips);
}

function skyMaterial(mobile) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xb7cbe4,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const size = mobile ? "1k" : "2k";
  const loader = new THREE.TextureLoader();
  loader.load("./assets/sky/kloofendal-48d-" + size + ".jpg?v=20261127j6", tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // Face the cloudiest longitude (+Z is texture u 0.25 before this offset).
    tex.offset.x = 0.27;
    tex.needsUpdate = true;
    material.map = tex;
    material.needsUpdate = true;
    const overlay = document.getElementById("walkOverlay");
    if (overlay) overlay.dataset.originSky = "ready";
  }, undefined, () => {
    const overlay = document.getElementById("walkOverlay");
    if (overlay) overlay.dataset.originSky = "fallback";
  });
  return material;
}

const reflectorShader = {
  name: "OriginMarbleReflector",
  uniforms: {
    color: {value: null},
    tDiffuse: {value: null},
    textureMatrix: {value: null}
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying float vDist;
    varying float vAbsX;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vAbsX = abs(position.x);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDist = length(mv.xyz);
      gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying float vDist;
    varying float vAbsX;
    #include <logdepthbuf_pars_fragment>
    float blendOverlay(float base, float blend) {
      return (base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)));
    }
    vec3 blendOverlay(vec3 base, vec3 blend) {
      return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g), blendOverlay(base.b, blend.b));
    }
    void main() {
      #include <logdepthbuf_fragment>
      vec4 base = texture2DProj(tDiffuse, vUv);
      float fade = smoothstep(26.0, 1.4, vDist);
      float mirror = 0.36 * fade;
      gl_FragColor = vec4(base.rgb, mirror);
    }`
};

function isFlutedBay(mesh) {
  const p = mesh.geometry?.parameters;
  if (!p || p.depth === undefined || p.width === undefined) return false;
  const key = [p.width, p.height, p.depth].map(n => Math.round(n * 1000)).join(",");
  return key === "52,3280,3160" || key === "16,3270,14" || key === "45,45,3060";
}

const HALL_DISPLAYS = [
  "pd-02.jpg", "pd-04.jpg", "pd-05.jpg", "pd-06.jpg", "pd-07.jpg",
  "pd-08.jpg", "pd-09.jpg", "pd-10.jpg", "pd-02.jpg", "pd-05.jpg"
];

function paintingUrl(name, mobile) {
  const file = mobile ? name.replace(/\.jpg$/, "-m.jpg") : name;
  return "./assets/paintings/" + file + "?v=20261128j14";
}

function preparePainting(tex, mobile) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = mobile ? 4 : 8;
  tex.needsUpdate = true;
}

function placeHallDisplays({THREE, interactive, mobile}) {
  const hosts = [];
  interactive.traverse(obj => {
    if (obj.userData?.wallFrame !== "commercial") return;
    const slot = obj.userData.slot;
    if (!canDecorateSlot(slot) || obj.position.z > HALL_END_Z) return;
    hosts.push(obj);
  });
  if (!hosts.length) return;
  const cols = 4;
  const rows = 3;
  const atlas = document.createElement("canvas");
  const atlasSize = mobile ? 1024 : 2048;
  atlas.width = atlasSize;
  atlas.height = atlasSize;
  const ctx = atlas.getContext("2d");
  ctx.fillStyle = "#1c1916";
  ctx.fillRect(0, 0, atlas.width, atlas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const map = new THREE.CanvasTexture(atlas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = mobile ? 4 : 8;
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const geo = new THREE.PlaneGeometry(1, 1);
  const offsets = new Float32Array(hosts.length * 2);
  hosts.forEach((_, index) => {
    offsets[index * 2] = (index % cols) * cellW;
    offsets[index * 2 + 1] = (rows - 1 - Math.floor(index / cols)) * cellH;
  });
  geo.setAttribute("uvOffset", new THREE.InstancedBufferAttribute(offsets, 2));
  const material = new THREE.MeshBasicMaterial({map, color: 0xffffff, toneMapped: false});
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nattribute vec2 uvOffset;\nvarying vec2 vOilUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvOilUv = uv * vec2(" + cellW + ", " + cellH + ") + uvOffset;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <uv_pars_fragment>", "#include <uv_pars_fragment>\nvarying vec2 vOilUv;")
      .replace(
        "#include <map_fragment>",
        "vec4 sampledDiffuseColor = texture2D(map, vOilUv);\ndiffuseColor *= sampledDiffuseColor;"
      );
  };
  const art = new THREE.InstancedMesh(geo, material, hosts.length);
  art.name = "origin-hall-display";
  art.raycast = () => {};
  art.frustumCulled = false;
  const local = new THREE.Object3D();
  const scratch = new THREE.Matrix4();
  hosts.forEach((host, index) => {
    host.updateWorldMatrix(true, false);
    local.position.set(0, 0, 0.034);
    local.scale.set(Math.max(0.08, host.userData.w - 0.06), Math.max(0.08, host.userData.h - 0.06), 1);
    local.rotation.set(0, 0, 0);
    local.updateMatrix();
    scratch.multiplyMatrices(host.matrixWorld, local.matrix);
    art.setMatrixAt(index, scratch);
  });
  art.instanceMatrix.needsUpdate = true;
  interactive.add(art);
  const loader = new THREE.TextureLoader();
  HALL_DISPLAYS.slice(0, hosts.length).forEach((file, index) => {
    loader.load(paintingUrl(file, mobile), image => {
      const pic = document.createElement("canvas");
      pic.width = image.image.width;
      pic.height = image.image.height;
      // TextureLoader gives a texture; draw its image.
      const source = image.image;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const dx = col * (atlas.width / cols);
      const dy = row * (atlas.height / rows);
      const dw = atlas.width / cols;
      const dh = atlas.height / rows;
      const scale = Math.min(dw / source.width, dh / source.height);
      const w = source.width * scale;
      const h = source.height * scale;
      ctx.drawImage(source, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
      map.needsUpdate = true;
    });
  });
}

function placeScannedRocks({THREE, scene}) {
  const holder = new THREE.Group();
  holder.name = "origin-scanned-rocks";
  scene.add(holder);
  const loader = new GLTFLoader();
  loader.load("./assets/rocks/boulder-01.glb?v=20261128j14", gltf => {
    let source = null;
    gltf.scene.traverse(obj => {
      if (!source && obj.isMesh) source = obj;
    });
    if (!source) return;
    const material = source.material;
    for (const tex of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
      if (!tex) continue;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
    }
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    material.roughness = 0.72;
    material.metalness = 0.02;
    material.emissive = new THREE.Color(0xfff6ee);
    material.emissiveIntensity = 0.28;
    const poses = [
      [-0.7, 4.15, 5.4, 0.42, 0.4],
      [0.85, 3.55, 7.2, 0.34, 1.2],
      [-0.35, 4.75, 9.1, 0.5, 2.1],
      [0.55, 3.85, 11.4, 0.38, 0.7],
      [-0.9, 4.35, 13.2, 0.46, 2.8],
      [0.2, 5.05, 15.0, 0.36, 1.6],
      [1.05, 3.7, 6.0, 0.3, 3.4]
    ];
    const mesh = new THREE.InstancedMesh(source.geometry, material, poses.length);
    const dummy = new THREE.Object3D();
    poses.forEach(([x, y, z, scale, rot], index) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rot * 0.35, rot, rot * 0.2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = "origin-scanned-rocks";
    holder.add(mesh);
    const overlay = document.getElementById("walkOverlay");
    if (overlay) overlay.dataset.originRocks = "ready";
  }, undefined, () => {
    const overlay = document.getElementById("walkOverlay");
    if (overlay) overlay.dataset.originRocks = "fallback";
  });
  return holder;
}

export function installOriginRoomLook({
  scene, architecture, floorMesh, physicalGallery, mobile,
  half, height, length, museumArtDirection, wallMaterial, floorMaterial,
  interactive, gold, bare, trackMarble
}) {
  if (physicalGallery?.tiles) physicalGallery.tiles.visible = false;
  if (physicalGallery?.mortar) physicalGallery.mortar.visible = false;
  if (physicalGallery?.bayShade) physicalGallery.bayShade.visible = false;

  const kept = [];
  architecture.traverse(obj => {
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const sign = material?.isMeshBasicMaterial && material.map;
    // Portal and welcome titles are double-sided. From above, or in the floor
    // mirror, they read backwards. The HTML title stays.
    if (obj.userData?.originHideInscription || (mobile && obj.userData?.originHideOnMobile)) {
      obj.visible = false;
      return;
    }
    if (sign) kept.push(obj);
    else obj.visible = false;
  });
  for (const sign of kept) sign.visible = true;

  buildStoneShell({THREE, architecture, wallMaterial, length, half, height});
  placeWarmHalos({THREE, interactive});
  if (mobile) placeFrameReflections({THREE, interactive});
  const overlay = document.getElementById("walkOverlay");
  if (overlay) overlay.dataset.originKit = "loading";
  mountArchitectureKit({
    THREE, architecture, wallMaterial, length, half, height, mobile,
    trackMarble
  }).then(info => {
    if (overlay) overlay.dataset.originKit = info.ready ? "ready" : "fallback";
  }).catch(error => {
    console.warn("[TEM] Architecture kit failed; box stand-ins remain", error);
    if (overlay) overlay.dataset.originKit = "fallback";
  });
  if (floorMesh) {
    floorMesh.visible = true;
    floorMesh.material = floorMaterial;
    floorMesh.position.y = -0.02;
    floorMesh.receiveShadow = true;
  }

  scene.background = new THREE.Color(0xe4edf2);
  if (scene.fog) {
    scene.fog.color.set(mobile ? 0xf6f6f4 : 0xf3f0ea);
    scene.fog.density = mobile ? 0.0011 : 0.00042;
  }
  scene.environmentIntensity = mobile ? 0.2 : 0.55;

  scene.traverse(obj => {
    if (obj.isHemisphereLight) {
      obj.color.set(mobile ? 0xf7f7f5 : 0xfff1e4);
      obj.groundColor.set(mobile ? 0xd5d3ce : 0xb7b0a6);
      obj.intensity = mobile ? 0.22 : 0.36;
    } else if (obj.isDirectionalLight) {
      obj.color.set(0xffefdc);
      obj.intensity = mobile ? 0.1 : 0.24;
      if (mobile) obj.castShadow = false;
    } else if (obj.isAmbientLight) {
      obj.intensity = 0.06;
    }
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(86, mobile ? 32 : 48, mobile ? 16 : 24), skyMaterial(mobile));
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.position.y = 2.2;
  sky.name = "origin-cumulus";
  scene.add(sky);
  placeEnfilade({THREE, scene, half, height, wallMaterial, mobile, trackMarble});
  const clouds = cloudVolume({THREE, mobile});
  scene.add(clouds);
  // Wide overlapping cards. Alpha falls off to the edge, so the shaft has no hard rim.
  const shaft = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vHeight = world.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
        float along = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
        float down = smoothstep(3.0, 5.6, vHeight);
        float alpha = across * across * along * along * down * 0.4;
        gl_FragColor = vec4(1.0, 0.99, 0.96, alpha);
      }
    `
  }), 11);
  const card = new THREE.Object3D();
  [4.2, 10, 18, 28, 40].forEach((z, index) => {
    card.position.set(0, 4.55, z);
    card.rotation.set(0, 0, 0);
    card.scale.set(4.6, 5.4, 1);
    card.updateMatrix();
    shaft.setMatrixAt(index, card.matrix);
  });
  [[6, 5.75], [12, 5.35], [18, 4.95], [26, 4.5], [34, 4.05], [42, 3.6]].forEach(([z, y], index) => {
    card.position.set(0, y, z);
    card.rotation.set(-Math.PI / 2, 0, 0);
    card.scale.set(4.4, 12, 1);
    card.updateMatrix();
    shaft.setMatrixAt(5 + index, card.matrix);
  });
  shaft.instanceMatrix.needsUpdate = true;
  shaft.frustumCulled = false;
  shaft.renderOrder = 1;
  shaft.name = "origin-light-shaft";
  scene.add(shaft);
  const rocks = mobile ? null : placeScannedRocks({THREE, scene});
  placeHallDisplays({THREE, interactive, mobile});

  let reflector = null;
  if (!mobile && floorMesh) {
    const mirror = new Reflector(new THREE.PlaneGeometry(half * 2 + 0.3, length - 0.2), {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 256,
      color: 0xf3eee6,
      multisample: 0,
      shader: reflectorShader
    });
    mirror.rotateX(-Math.PI / 2);
    // The visible floor slab tops out near y=0.12. The mirror has to sit on that surface.
    mirror.position.set(0, 0.135, length / 2);
    mirror.renderOrder = 2;
    mirror.material.transparent = true;
    mirror.material.depthWrite = false;
    mirror.name = "origin-floor-mirror";
    const reflect = mirror.onBeforeRender;
    mirror.onBeforeRender = function(renderer, scene, camera) {
      const skyWas = sky.visible;
      const shaftWas = shaft.visible;
      const cloudsWere = clouds.visible;
      const rocksWere = rocks ? rocks.visible : false;
      sky.visible = false;
      shaft.visible = false;
      clouds.visible = false;
      if (rocks) rocks.visible = false;
      reflect.call(this, renderer, scene, camera);
      sky.visible = skyWas;
      shaft.visible = shaftWas;
      clouds.visible = cloudsWere;
      if (rocks) rocks.visible = rocksWere;
    };
    scene.add(mirror);
    reflector = mirror;
  }

  const spots = [];
  scene.traverse(obj => { if (obj.isSpotLight) spots.push(obj); });
  if (museumArtDirection?.updateSpotlights && spots.length) {
    const base = museumArtDirection.updateSpotlights.bind(museumArtDirection);
    museumArtDirection.updateSpotlights = (z, slots) => {
      const before = spots.map(s => s.visible + ":" + s.intensity.toFixed(2) + ":" + s.position.z.toFixed(2)).join("|");
      base(z, slots);
      const after = spots.map(s => s.visible + ":" + s.intensity.toFixed(2) + ":" + s.position.z.toFixed(2)).join("|");
      if (before === after) return;
      for (const light of spots) {
        if (!light.visible) continue;
        const occupied = light.intensity >= 14;
        light.color.set(0xffe2c0);
        light.intensity = occupied ? (mobile ? 5.5 : 7.2) : (mobile ? 2.2 : 2.8);
        light.angle = 0.6;
        light.penumbra = 0.94;
        light.decay = 1.35;
        light.distance = 11;
      }
    };
  }

  function compactFrames() {
    if (!interactive || !gold || !bare) return null;
    return compactWallFrames({THREE, interactive, gold, bare});
  }

  return {
    reflector,
    compactFrames,
    sync(x, z) { sky.position.x = x; sky.position.z = z; }
  };
}

export function frameFacesRoom(side, anchorX) {
  const front = anchorX + Math.sin(frameRotationY(side)) * FRAME.artLocalZ;
  const back = anchorX + Math.sin(frameRotationY(side)) * FRAME.backLocalZ;
  return Math.abs(front) < Math.abs(back);
}

export {wallInnerFaceX};
