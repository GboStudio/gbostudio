/**
 * Compact geometry for the marble trial: one stone shell, instanced
 * pilasters, benches, spot heads and empty frames. Draw calls stay low
 * enough for a phone. The rollback flag lives in origin-room-look.js.
 */
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {
  FRAME,
  PILASTER,
  wallInnerFaceX,
  pilasterLayout,
  benchLayout
} from "./origin-room-geometry.mjs";

function placedBox(THREE, w, h, d, x, y, z) {
  const geom = new THREE.BoxGeometry(w, h, d);
  geom.translate(x, y, z);
  return geom;
}

function frameRing(THREE, outerW, outerH, innerW, innerH, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.closePath();
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.012, depth * 0.45),
    bevelSize: 0.007,
    bevelSegments: 2,
    curveSegments: 1,
    steps: 1
  });
  geom.computeBoundingBox();
  geom.translate(0, 0, FRAME.backLocalZ - geom.boundingBox.min.z);
  return geom;
}

const ringCache = new Map();
function ringsFor(THREE, w, h) {
  const key = w.toFixed(3) + "x" + h.toFixed(3);
  let rings = ringCache.get(key);
  if (rings) return rings;
  const lip = FRAME.lip;
  rings = [
    frameRing(THREE, w + lip * 2.2, h + lip * 2.2, w + lip * 0.55, h + lip * 0.55, 0.012),
    frameRing(THREE, w + lip * 1.35, h + lip * 1.35, w + lip * 0.15, h + lip * 0.15, 0.026),
    frameRing(THREE, w + lip * 0.7, h + lip * 0.7, w - 0.02, h - 0.02, 0.04)
  ];
  ringCache.set(key, rings);
  return rings;
}

function stampInstances(THREE, mesh, nodes, localZ) {
  const dummy = new THREE.Object3D();
  const shift = new THREE.Matrix4();
  nodes.forEach((node, index) => {
    dummy.position.copy(node.position);
    dummy.rotation.copy(node.rotation);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    if (localZ) {
      shift.makeTranslation(0, 0, localZ);
      dummy.matrix.multiply(shift);
    }
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.computeBoundingSphere();
}

export function buildStoneShell({
  THREE, architecture, wallMaterial, length, half, height
}) {
  const geos = [];
  const yMid = height * 0.5;
  for (const side of [-1, 1]) {
    const face = wallInnerFaceX(side, half);
    geos.push(placedBox(THREE, 0.22, height, length, side * (half + 0.03), yMid, length / 2));
    geos.push(placedBox(THREE, 0.08, 0.18, length, face - side * 0.04, 0.09, length / 2));
    geos.push(placedBox(THREE, 0.16, 0.22, length, face - side * 0.08, height - 0.2, length / 2));
    geos.push(placedBox(THREE, 0.06, 0.05, length, side * (half - 0.95), height - 0.42, length / 2));
    const soffitW = half - 1.55;
    geos.push(placedBox(THREE, soffitW, 0.12, length, side * (1.55 + soffitW / 2), height - 0.06, length / 2));
  }
  geos.push(placedBox(THREE, half * 2 + 0.4, height, 0.28, 0, yMid, -0.2));
  geos.push(placedBox(THREE, half * 2 + 0.4, height, 0.28, 0, yMid, length + 0.1));
  geos.push(placedBox(THREE, half * 2 - 0.2, 0.08, length - 0.2, 0, 0.04, length / 2));
  const shell = new THREE.Mesh(mergeGeometries(geos, false), wallMaterial);
  geos.forEach(geom => geom.dispose());
  shell.name = "origin-stone-shell";
  shell.castShadow = true;
  shell.receiveShadow = true;
  architecture.add(shell);

  const posts = pilasterLayout({half, length, bays: 38});
  const black = new THREE.MeshStandardMaterial({color: 0x1c1b19, roughness: 0.45, metalness: 0.65});
  if (posts.length) {
    const shaftH = height - 0.72;
    const parts = [
      [PILASTER.into * 0.72, shaftH, PILASTER.along * 0.72, 0.22 + shaftH / 2],
      [PILASTER.into * 1.05, 0.22, PILASTER.along * 1.08, 0.11],
      [PILASTER.into * 1.02, 0.16, PILASTER.along * 1.05, height - 0.28]
    ];
    for (const [sx, sy, sz, y] of parts) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(sx, sy, sz), wallMaterial, posts.length);
      const dummy = new THREE.Object3D();
      posts.forEach((post, index) => {
        dummy.position.set(post.x, y, post.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      architecture.add(mesh);
    }
  }

  const benches = benchLayout(length);
  if (benches.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.42, 1.4), wallMaterial, benches.length);
    const dummy = new THREE.Object3D();
    benches.forEach((bench, index) => {
      dummy.position.set(bench.x, 0.32, bench.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    architecture.add(mesh);
  }

  const heads = [];
  for (const side of [-1, 1]) {
    for (let z = 6; z < length - 3; z += 3.5) heads.push({side, z});
  }
  if (heads.length) {
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 8), black, heads.length);
    const dummy = new THREE.Object3D();
    heads.forEach((head, index) => {
      dummy.position.set(head.side * (half - 0.95), height - 0.55, head.z);
      dummy.rotation.z = head.side * 0.5;
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    architecture.add(mesh);
  }
  return {shell};
}

export function compactWallFrames({THREE, interactive, gold, bare}) {
  const previous = interactive.getObjectByName("origin-frame-instances");
  if (previous) {
    interactive.remove(previous);
    previous.traverse(obj => {
      if (obj.geometry && !obj.userData.keepGeometry) obj.geometry.dispose();
    });
  }
  const buckets = new Map();
  for (const child of [...interactive.children]) {
    if (child.userData?.wallFrame !== "commercial" || child.userData.hasPiece) continue;
    child.visible = false;
    const key = child.userData.w.toFixed(2) + "x" + child.userData.h.toFixed(2);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  }
  const root = new THREE.Group();
  root.name = "origin-frame-instances";
  for (const list of buckets.values()) {
    const {w, h} = list[0].userData;
    for (const geom of ringsFor(THREE, w, h)) {
      const mesh = new THREE.InstancedMesh(geom, gold, list.length);
      mesh.userData.keepGeometry = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      stampInstances(THREE, mesh, list, 0);
      root.add(mesh);
    }
    const art = new THREE.InstancedMesh(new THREE.PlaneGeometry(Math.max(0.08, w - 0.04), Math.max(0.08, h - 0.04)), bare, list.length);
    art.userData.slotAt = index => list[index]?.userData.slot || null;
    stampInstances(THREE, art, list, FRAME.artLocalZ);
    root.add(art);
  }
  interactive.add(root);
  return root;
}
