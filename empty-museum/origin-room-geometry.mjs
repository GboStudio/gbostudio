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
  offset: 2.05,
  along: 0.28,
  into: 0.32
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

export function sameWallOverlap(frame, post) {
  if (frame.side !== post.side) return 0;
  const frame0 = frame.z - frame.outerHalf;
  const frame1 = frame.z + frame.outerHalf;
  const post0 = post.z - post.along / 2;
  const post1 = post.z + post.along / 2;
  return Math.min(frame1, post1) - Math.max(frame0, post0);
}
