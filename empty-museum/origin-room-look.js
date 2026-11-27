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
import {
  FRAME,
  frameAnchorX,
  frameRotationY,
  commercialFrameZ,
  wallInnerFaceX
} from "./origin-room-geometry.mjs";
import {buildStoneShell, compactWallFrames, mountArchitectureKit, mountOrnateFrames, placeWarmHalos, placeFrameReflections} from "./origin-room-build.js?v=20261127j4";

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
  shader.uniforms.uMarbleScale = {value: 0.22};
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
	float vein = smoothstep(0.80, 0.52, lum);
	alb = mix(alb, warm, 0.12);
	alb = mix(alb, alb * vec3(0.62, 0.64, 0.66), vein * 0.55);
	diffuseColor.rgb = alb * uMarbleLift;
	#ifdef USE_LIGHTMAP
		float baked = dot(texture2D(lightMap, vLightMapUv).rgb, vec3(0.333));
		diffuseColor.rgb *= mix(0.58, 1.0, clamp(baked, 0.0, 1.0));
	#endif
	if (uFloorEdge > 0.5) {
		float slot = 1.0 - smoothstep(0.2, 3.4, abs(vMarbleWp.x));
		diffuseColor.rgb *= mix(1.0, 0.70, slot * slot);
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
  material.customProgramCacheKey = () => "origin-marble-j2-" + lift + "-" + roughMix + "-" + (floorEdge ? 1 : 0);
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
    lift: 1,
    roughMix: 0.4,
    envMapIntensity: 0.16
  });
  const floor = marbleMaterial(maps, {
    roughness: mobile ? 0.55 : 0.72,
    metalness: 0,
    lift: 0.7,
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
    ? [[0, 5.7, 5.2, 3.6], [-0.35, 5.95, 8, 3.2], [0.4, 5.5, 11, 3.8], [0, 5.85, 15, 3.4], [-0.25, 5.6, 20, 3.5], [0.2, 5.9, 26, 3.2]]
    : [[-0.15, 5.85, 3.6, 4.2], [0.35, 5.5, 5.2, 3.8], [-0.45, 6.0, 6.8, 3.6], [0.1, 5.4, 8.4, 4.4],
      [0.5, 5.8, 10.2, 3.4], [-0.3, 6.05, 11.6, 3.8], [0.15, 5.45, 13.4, 4.2], [-0.5, 5.75, 15.2, 3.6],
      [0.4, 5.95, 17, 3.5], [-0.1, 5.5, 19.2, 4.3], [0.3, 6.0, 22, 3.4], [-0.4, 5.7, 25, 3.8],
      [0.05, 5.55, 28, 4.0], [0.45, 5.9, 32, 3.3], [-0.2, 5.65, 36, 3.7]];
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float size = length((instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 world = center + right * position.x * size + up * position.y * size;
        vUv = uv;
        vSeed = center.z * 0.37 + center.x * 1.7;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vSeed;
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
        float body = 1.0 - smoothstep(0.12, 0.50, length(uv) - warp);
        float alpha = body * smoothstep(0.32, 0.68, n);
        if (alpha < 0.02) discard;
        float light = clamp(uv.y * 1.6 + 0.62, 0.0, 1.0);
        vec3 col = mix(vec3(0.68, 0.71, 0.74), vec3(1.0, 0.99, 0.97), light);
        gl_FragColor = vec4(col, alpha * 0.82);
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
      float fade = smoothstep(22.0, 0.6, vDist);
      float t = smoothstep(0.2, 3.4, vAbsX);
      float mirror = mix(0.05, 0.9, t * t) * fade;
      gl_FragColor = vec4(base.rgb, clamp(mirror, 0.0, 0.9));
    }`
};

function isFlutedBay(mesh) {
  const p = mesh.geometry?.parameters;
  if (!p || p.depth === undefined || p.width === undefined) return false;
  const key = [p.width, p.height, p.depth].map(n => Math.round(n * 1000)).join(",");
  return key === "52,3280,3160" || key === "16,3270,14" || key === "45,45,3060";
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
    scene.fog.color.set(0xf3f0ea);
    scene.fog.density = 0.00048;
  }
  scene.environmentIntensity = mobile ? 0.42 : 0.55;

  scene.traverse(obj => {
    if (obj.isHemisphereLight) {
      obj.color.set(0xfff1e4);
      obj.groundColor.set(0xb7b0a6);
      obj.intensity = 0.36;
    } else if (obj.isDirectionalLight) {
      obj.color.set(0xffefdc);
      obj.intensity = 0.24;
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
        float alpha = across * across * along * along * down * 0.22;
        gl_FragColor = vec4(1.0, 0.99, 0.96, alpha);
      }
    `
  }), 11);
  const card = new THREE.Object3D();
  [4.2, 10, 18, 28, 40].forEach((z, index) => {
    card.position.set(0, 4.55, z);
    card.rotation.set(0, 0, 0);
    card.scale.set(2.9, 4.6, 1);
    card.updateMatrix();
    shaft.setMatrixAt(index, card.matrix);
  });
  [[6, 5.75], [12, 5.35], [18, 4.95], [26, 4.5], [34, 4.05], [42, 3.6]].forEach(([z, y], index) => {
    card.position.set(0, y, z);
    card.rotation.set(-Math.PI / 2, 0, 0);
    card.scale.set(2.8, 11, 1);
    card.updateMatrix();
    shaft.setMatrixAt(5 + index, card.matrix);
  });
  shaft.instanceMatrix.needsUpdate = true;
  shaft.frustumCulled = false;
  shaft.renderOrder = 1;
  shaft.name = "origin-light-shaft";
  scene.add(shaft);

  let reflector = null;
  if (!mobile && floorMesh) {
    const mirror = new Reflector(new THREE.PlaneGeometry(half * 2 + 0.3, length - 0.2), {
      clipBias: 0.003,
      textureWidth: 2048,
      textureHeight: 1024,
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
      sky.visible = false;
      shaft.visible = false;
      clouds.visible = false;
      reflect.call(this, renderer, scene, camera);
      sky.visible = skyWas;
      shaft.visible = shaftWas;
      clouds.visible = cloudsWere;
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
        light.intensity = occupied ? (mobile ? 8.5 : 12) : (mobile ? 3.4 : 4.5);
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
