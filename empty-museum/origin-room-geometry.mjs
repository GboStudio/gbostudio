/**
 * Placement math for the marble test look.
 * Frames stay on the same bays, heights and along-wall positions.
 * Only the distance to the wall changes: the back of each frame sits
 * FRAME.clearanceM in front of the structural wall face.
 * No Three.js dependency, so the flush test can run in plain Node.
 */

export const FRAME = Object.freeze({
  clearanceM: 0.015,
  backLocalZ: -0.010,
  artLocalZ: 0.008,
  lip: 0.058,
  bevelSize: 0.014,
  bevelThickness: 0.012,
  depth: 0.034
});

export const ROOM = Object.freeze({
  half: 4.6,
  wallCenterExtra: 0.03,
  wallThickness: 0.22,
  step: 3.5,
  bayStart: 5.7,
  legacyFrameY: 2.10
});

/** Side plaque on the four partner frames (engine3d addFrame). */
export const LEGACY_PLAQUE = Object.freeze({
  gap: 0.14,
  width: 0.33
});

export const LEGACY_FRAME_SIZE_M = Object.freeze({
  mini: [1.35, 1.83],
  portrait: [1.42, 2.15],
  landscape: [2.36, 1.6],
  tall: [1.48, 2.67],
  wide: [2.78, 1.95],
  panorama: [2.8, 1.18],
  standard: [2.36, 1.6],
  large: [2.78, 1.95],
  xl: [2.8, 1.18]
});

export const PILASTER = Object.freeze({
  /** Distance from a bay centre to the pilaster centre, along the wall. */
  offset: 2.22,
  along: 0.36,
  into: 0.46
});

export const VISITOR = Object.freeze({
  radius: 0.36,
  zMin: 0.85,
  zEndPad: 2.6
});

export function wallInnerFaceX(side, half = ROOM.half) {
  const center = side * (half + ROOM.wallCenterExtra);
  return center - side * (ROOM.wallThickness / 2);
}

/** Negative local Z points at the wall for both side rotations. */
export function frameRotationY(side) {
  return side < 0 ? Math.PI / 2 : -Math.PI / 2;
}

export function frameLocalToWorldX(side, anchorX, localZ) {
  return anchorX + Math.sin(frameRotationY(side)) * localZ;
}

export function frameAnchorX(side, {
  half = ROOM.half,
  clearance = FRAME.clearanceM,
  backLocalZ = FRAME.backLocalZ
} = {}) {
  const face = wallInnerFaceX(side, half);
  const backWorld = face - side * clearance;
  return backWorld - Math.sin(frameRotationY(side)) * backLocalZ;
}

/** Positive when the frame back is inside the room, short of the wall face. */
export function frameWallGap(side, anchorX, backLocalZ = FRAME.backLocalZ, half = ROOM.half) {
  const face = wallInnerFaceX(side, half);
  const back = frameLocalToWorldX(side, anchorX, backLocalZ);
  return side > 0 ? face - back : back - face;
}

export function commercialFrameZ(slot) {
  return slot.z + slot.side * (slot.xM + slot.widthM / 2 - 1.5);
}

export function frameOuterHalfWidth(width, {plaque = false} = {}) {
  const moulding = width / 2 + FRAME.lip + FRAME.bevelSize;
  if (!plaque) return moulding;
  const plaqueOuter = width / 2 + LEGACY_PLAQUE.gap + LEGACY_PLAQUE.width;
  return Math.max(moulding, plaqueOuter);
}

/**
 * Square pilasters on the wall that owns each bay, clear of the frames
 * and of the partner plaques. One shared midpoint keeps a rhythm
 * on the empty stretch between bays of the same wall.
 */
export function pilasterLayout({
  bays = 38,
  step = ROOM.step,
  start = ROOM.bayStart,
  half = ROOM.half,
  length = 142
} = {}) {
  const posts = [];
  const seen = new Set();
  function add(side, z) {
    if (z < 3.2 || z > length - 1.2) return;
    const key = side + ":" + z.toFixed(3);
    if (seen.has(key)) return;
    seen.add(key);
    const face = wallInnerFaceX(side, half);
    posts.push({
      side,
      x: face - side * (PILASTER.into / 2),
      z,
      along: PILASTER.along,
      into: PILASTER.into
    });
  }
  for (let i = 0; i < bays; i++) {
    const side = i % 2 ? 1 : -1;
    const z = start + i * step;
    add(side, z - PILASTER.offset);
    add(side, z + PILASTER.offset);
  }
  for (let i = 0; i < bays - 1; i++) {
    const side = i % 2 ? 1 : -1;
    add(side, start + (i + 1) * step);
  }
  return posts;
}

/** Pilasters for the origin look: deep piers in the entrance hall, then the rear bays. */
export function originPilasters({half = ROOM.half, length = 142} = {}) {
  const posts = [];
  const add = (side, z, along, into) => {
    if (z < 3 || z > length - 1) return;
    const face = wallInnerFaceX(side, half);
    posts.push({side, z, x: face - side * (into / 2), along, into});
  };
  for (const side of [-1, 1]) {
    for (const z of [3.55, 8.15, 12.2, 15.9]) add(side, z, 0.42, 0.55);
    for (let i = 0; i < 32; i++) add(side, 26.35 + i * 3.5, 0.3, 0.46);
  }
  return posts;
}

export function benchLayout(length = 142) {
  const benches = [];
  const aisleZ = [15, 47, 85, 112];
  for (const side of [-1, 1]) {
    const face = wallInnerFaceX(side);
    for (let z = 12; z < length - 5; z += 14) {
      if (aisleZ.some(at => Math.abs(at - z) < 2.4)) continue;
      const into = 0.5;
      benches.push({
        side,
        x: face - side * (0.2 + into / 2),
        z,
        along: 1.4,
        into
      });
    }
  }
  return benches;
}

export function aabbAt(x, z, sizeX, sizeZ) {
  return {
    minX: x - sizeX / 2,
    maxX: x + sizeX / 2,
    minZ: z - sizeZ / 2,
    maxZ: z + sizeZ / 2
  };
}

export function frameObstacle(frame) {
  const face = wallInnerFaceX(frame.side);
  const inner = face - frame.side * 0.11;
  return {
    minX: Math.min(face, inner),
    maxX: Math.max(face, inner),
    minZ: frame.z - frame.outerHalf,
    maxZ: frame.z + frame.outerHalf
  };
}

export function visitorBounds(length = 142, radius = VISITOR.radius) {
  return {
    minX: wallInnerFaceX(-1) + radius,
    maxX: wallInnerFaceX(1) - radius,
    minZ: VISITOR.zMin,
    maxZ: Math.max(VISITOR.zMin + 1, length - VISITOR.zEndPad)
  };
}

/** Rooms of about three bays, closed by a wall with a walkable doorway. */
export const ENFILADE = Object.freeze({
  thickness: 0.5,
  opening: 2.2,
  lintelY: 3.05,
  zs: Object.freeze([16.55, 24.95, 35.45, 45.85, 56.45, 66.95, 77.45, 87.95, 98.45, 108.95, 119.45, 129.95]),
  /** First doorway sits on the right so the end-wall painting can stay centered. */
  firstDoor: Object.freeze({ x0: 1.55, x1: 3.65 })
});

export function enfiladeFrameLayout() {
  const faceZ = z => z - ENFILADE.thickness / 2;
  return ENFILADE.zs.map((z, index) => {
    const structuralZ = faceZ(z);
    const wallFaceZ = structuralZ - 0.04;
    const side = index % 2 ? 1 : -1;
    return {
      id: "enfilade-" + index,
      x: index === 0 ? 0 : side * 2.4,
      y: 1.78,
      z: wallFaceZ - 0.016,
      w: 1.12,
      h: 1.28,
      wallFaceZ
    };
  });
}

function doorwayBoxes(z, x0, x1, half) {
  const face = wallInnerFaceX(1, half);
  const leftW = x0 + face;
  const rightW = face - x1;
  return [
    aabbAt((-face + x0) / 2, z, leftW, ENFILADE.thickness + 0.36),
    aabbAt((x1 + face) / 2, z, rightW, ENFILADE.thickness + 0.36)
  ];
}

export function enfiladeObstacles(half = ROOM.half) {
  const open = ENFILADE.opening / 2;
  const boxes = [];
  ENFILADE.zs.forEach((z, index) => {
    if (index === 0) boxes.push(...doorwayBoxes(z, ENFILADE.firstDoor.x0, ENFILADE.firstDoor.x1, half));
    else boxes.push(...doorwayBoxes(z, -open, open, half));
  });
  for (const frame of enfiladeFrameLayout()) {
    boxes.push(aabbAt(frame.x, frame.z, frame.w, 0.08));
  }
  return boxes;
}

export function staticObstacles(length = 142) {
  const boxes = [];
  for (const post of originPilasters({length})) {
    boxes.push(aabbAt(post.x, post.z, post.into, post.along));
  }
  if (length > 20) boxes.push(...enfiladeObstacles());
  for (const bench of benchLayout(length)) {
    boxes.push(aabbAt(bench.x, bench.z, bench.into, bench.along));
  }
  for (const spot of [
    {x: -2.25, z: 8}, {x: -2.25, z: 47}, {x: 2.25, z: 85}, {x: -2.25, z: 112}
  ]) {
    boxes.push(aabbAt(spot.x, spot.z, 1.5, 1.8));
  }
  return boxes;
}

export function circleHitsBox(x, z, radius, box) {
  const cx = Math.min(box.maxX, Math.max(box.minX, x));
  const cz = Math.min(box.maxZ, Math.max(box.minZ, z));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < radius * radius;
}

export function hitsObstacle(x, z, radius, obstacles) {
  for (const box of obstacles) {
    if (circleHitsBox(x, z, radius, box)) return true;
  }
  return false;
}

function clampVisitor(x, z, bounds) {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, z))
  };
}

/** Slide on X then Z. A blocked axis keeps the previous free coordinate. */
export function slideVisitor(px, pz, nx, nz, radius, obstacles, bounds) {
  const hit = (x, z) => hitsObstacle(x, z, radius, obstacles);
  let x = clampVisitor(nx, pz, bounds).x;
  if (hit(x, pz)) x = px;
  let z = clampVisitor(x, nz, bounds).z;
  if (hit(x, z)) z = pz;
  return clampVisitor(x, z, bounds);
}

/** One small step toward the aisle. Never teleports down the gallery. */
export function separateVisitor(x, z, radius, obstacles, bounds) {
  const cur = clampVisitor(x, z, bounds);
  if (!hitsObstacle(cur.x, cur.z, radius, obstacles)) return cur;
  const toward = clampVisitor(cur.x * 0.8, cur.z, bounds);
  if (!hitsObstacle(toward.x, toward.z, radius, obstacles)) return toward;
  return clampVisitor(cur.x * 0.8, cur.z, bounds);
}

export function sameWallOverlap(frame, post) {
  if (frame.side !== post.side) return 0;
  const frame0 = frame.z - frame.outerHalf;
  const frame1 = frame.z + frame.outerHalf;
  const post0 = post.z - post.along / 2;
  const post1 = post.z + post.along / 2;
  return Math.min(frame1, post1) - Math.max(frame0, post0);
}
