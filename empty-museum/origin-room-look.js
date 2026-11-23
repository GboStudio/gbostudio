/**
 * Pièce d'origine — essai visuel (marbre, or, sol réfléchissant, ciel).
 * Pour retrouver l'ancien rendu calcaire : mettre `enabled` à false.
 * Le reste du musée (parcours, cadres, allée, joysticks, secours 2D) ne change pas.
 *
 * Marbre : shader procédural en coordonnées monde, sans image répétée.
 * Or : MeshStandardMaterial metalness 1, rugosité ~0.34, environnement RoomEnvironment.
 * Sol : miroir planaire basse résolution sur ordinateur (fondu avec la distance),
 *       environnement + marbre poli sur mobile (pas de second passage de rendu).
 * Ciel : dôme dégradé avec nuages procéduraux, ouverture du plafond central.
 * Aucune texture tierce n'est téléchargée. Rien au-dessus de 2K.
 */
import * as THREE from "three";
import {Reflector} from "three/addons/objects/Reflector.js";
import {
  FRAME,
  PILASTER,
  frameAnchorX,
  frameRotationY,
  commercialFrameZ,
  pilasterLayout,
  wallInnerFaceX
} from "./origin-room-geometry.mjs";

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

function marbleShader(shader, lift) {
  shader.uniforms.uMarbleLift = {value: lift};
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vMarbleWp;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
	vec4 marbleWp = vec4(transformed, 1.0);
	#ifdef USE_INSTANCING
		marbleWp = instanceMatrix * marbleWp;
	#endif
	vMarbleWp = (modelMatrix * marbleWp).xyz;`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
varying vec3 vMarbleWp;
uniform float uMarbleLift;
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
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}
vec3 marbleAlbedo(vec3 p){
  float n1 = mNoise(p * vec3(0.21, 0.52, 0.065));
  float n2 = mNoise(p * vec3(0.08, 1.05, 0.12) + n1 * 1.35);
  float warp = n1 * 2.1 + n2;
  float vein = smoothstep(0.42, 0.86, abs(sin(p.y * 0.92 + p.z * 0.055 + warp)));
  float vein2 = smoothstep(0.62, 0.94, abs(sin(p.y * 1.85 + p.x * 0.22 + n2 * 2.4)));
  float cloud = mNoise(p * vec3(0.04, 0.06, 0.03));
  vec3 base = vec3(0.84, 0.825, 0.79);
  base += (cloud - 0.5) * 0.05;
  vec3 grey = vec3(0.46, 0.455, 0.44);
  return mix(base, grey, clamp(vein * 0.95 + vein2 * 0.55, 0.0, 0.72));
}`)
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n\tdiffuseColor.rgb = marbleAlbedo(vMarbleWp) * uMarbleLift;"
    );
}

function marbleMaterial({roughness, metalness, lift, envMapIntensity}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    envMapIntensity
  });
  material.onBeforeCompile = shader => marbleShader(shader, lift);
  material.customProgramCacheKey = () => "origin-marble-v1-" + lift;
  return material;
}

export function createOriginMaterials({mobile}) {
  const gold = new THREE.MeshStandardMaterial({
    color: 0xb8893c,
    metalness: 1,
    roughness: 0.32,
    envMapIntensity: mobile ? 1.15 : 1.55
  });
  const wall = marbleMaterial({
    roughness: 0.78,
    metalness: 0,
    lift: 1,
    envMapIntensity: 0.18
  });
  const floor = marbleMaterial({
    roughness: mobile ? 0.42 : 0.55,
    metalness: 0.02,
    lift: 0.96,
    envMapIntensity: mobile ? 0.28 : 0.1
  });
  floor.polygonOffset = true;
  floor.polygonOffsetFactor = 1;
  floor.polygonOffsetUnits = 1;
  return {gold, wall, floor};
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: true,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      float hsh(vec2 p){return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);}
      float n2(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hsh(i), b = hsh(i + vec2(1.0, 0.0));
        float c = hsh(i + vec2(0.0, 1.0)), d = hsh(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 zenith = vec3(0.74, 0.81, 0.88);
        vec3 horizon = vec3(0.97, 0.95, 0.91);
        vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.55, d.y));
        float up = max(d.y, 0.08);
        vec2 uv = d.xz / up;
        float clouds = n2(uv * 2.4) + 0.55 * n2(uv * 5.1);
        float puff = smoothstep(0.55, 0.92, clouds) * smoothstep(0.02, 0.28, d.y);
        col = mix(col, vec3(0.99, 0.985, 0.975), puff * 0.82);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
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
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
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
      float fade = smoothstep(7.5, 0.8, vDist);
      vec3 refl = mix(base.rgb, blendOverlay(base.rgb, color), 0.25);
      gl_FragColor = vec4(refl, 0.34 * fade);
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
  half, height, length, museumArtDirection, wallMaterial, floorMaterial
}) {
  if (physicalGallery?.tiles) physicalGallery.tiles.visible = false;
  if (physicalGallery?.mortar) physicalGallery.mortar.visible = false;
  if (physicalGallery?.bayShade) physicalGallery.bayShade.visible = false;

  architecture.traverse(obj => {
    if (obj.userData?.temRole === "ceiling-cap" || obj.userData?.temRole === "ceiling-oculus") obj.visible = false;
    if (!obj.isMesh) return;
    if (isFlutedBay(obj)) obj.visible = false;
  });

  architecture.traverse(obj => {
    if (!obj.isMesh || obj.userData?.temRole === "structural-floor") return;
    const material = obj.material;
    if (!material || Array.isArray(material) || !material.isMeshStandardMaterial) return;
    if (material.metalness > 0.2 || material.transparent) return;
    if (material.roughness < 0.55) return;
    obj.material = wallMaterial;
  });

  if (floorMesh) {
    floorMesh.material = floorMaterial;
    floorMesh.position.y = -0.135;
    floorMesh.receiveShadow = true;
  }

  scene.background = new THREE.Color(0xe4edf2);
  if (scene.fog) {
    scene.fog.color.set(0xf3f0ea);
    scene.fog.density = 0.00048;
  }
  scene.environmentIntensity = mobile ? 0.62 : 0.88;

  scene.traverse(obj => {
    if (obj.isHemisphereLight) {
      obj.color.set(0xfff4e6);
      obj.groundColor.set(0xc4bdb2);
      obj.intensity = 0.48;
    } else if (obj.isDirectionalLight) {
      obj.color.set(0xfff1e2);
      obj.intensity = 0.36;
      if (mobile) obj.castShadow = false;
    } else if (obj.isAmbientLight) {
      obj.intensity = 0.06;
    }
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(86, mobile ? 20 : 28, mobile ? 12 : 16), skyMaterial());
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.position.y = 2.2;
  scene.add(sky);

  let reflector = null;
  if (floorMesh) {
    const mirror = new Reflector(new THREE.PlaneGeometry(half * 2 - 0.36, length - 0.4), {
      clipBias: 0.003,
      textureWidth: mobile ? 256 : 512,
      textureHeight: mobile ? 256 : 512,
      color: 0xf6f1ea,
      multisample: 0,
      shader: reflectorShader
    });
    mirror.rotateX(-Math.PI / 2);
    mirror.position.set(0, 0.012, length / 2);
    mirror.renderOrder = 2;
    mirror.material.transparent = true;
    mirror.material.depthWrite = false;
    mirror.name = "origin-floor-mirror";
    if (mobile) {
      const renderReflection = mirror.onBeforeRender;
      let frame = 0;
      mirror.onBeforeRender = function(renderer, scene, camera) {
        frame += 1;
        if (frame % 2 === 0 && mirror.userData.warm) return;
        renderReflection.call(this, renderer, scene, camera);
        mirror.userData.warm = true;
      };
    }
    scene.add(mirror);
    reflector = mirror;
  }

  const posts = pilasterLayout({half, length, bays: 38});
  if (posts.length) {
    const postHeight = height - 0.42;
    const geom = new THREE.BoxGeometry(PILASTER.into, postHeight, PILASTER.along);
    const mesh = new THREE.InstancedMesh(geom, wallMaterial, posts.length);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    posts.forEach((post, i) => {
      dummy.position.set(post.x, 0.16 + postHeight / 2, post.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    architecture.add(mesh);
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
        light.intensity = occupied ? (mobile ? 6.2 : 8.2) : (mobile ? 3.1 : 4.0);
        light.angle = 0.6;
        light.penumbra = 0.94;
        light.decay = 1.35;
        light.distance = 11;
      }
    };
  }

  return {
    reflector,
    sync(x, z) { sky.position.x = x; sky.position.z = z; }
  };
}

export function frameFacesRoom(side, anchorX) {
  const front = anchorX + Math.sin(frameRotationY(side)) * FRAME.artLocalZ;
  const back = anchorX + Math.sin(frameRotationY(side)) * FRAME.backLocalZ;
  return Math.abs(front) < Math.abs(back);
}

export {wallInnerFaceX};
