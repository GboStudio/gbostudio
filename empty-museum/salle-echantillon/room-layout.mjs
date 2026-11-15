/**
 * White open-sky sample room. Dimensions are in the viewer's space:
 * X across the nave, Y up, Z down the axis toward the cloud haze.
 * There is no ceiling and no back wall. The public gallery does not import this module.
 *
 * This length is the sample only. The future 100 m gallery (end wall, door,
 * dog-leg, repeated modules) is decided and not built. See PROJECT_STATE.md.
 */
export const ROOM = {
  width: 9.6,
  backZ: -0.45,
  hallLength: 33.2,
  endDepth: 5.0,
  length: 36.0,
  eye: 1.6,
  exposure: 1.2,
  openSky: true,
  wallColor: '#E4E0DA',
  stoneColor: '#E7E4DE',
  endColor: '#F7F5F2',
  ceilingColor: '#F4F7FB',
  corniceY: 4.52,
  soffitY: 5.02,
  skylightY: 5.58,
  skylightHalf: 1.65,
  skylightZ0: 1.15,
  skylightZ1: 12.55,
  portalHalf: 1.05,
  portalHeight: 3.42,
  daylightK: 5600,
  pictureK: 3000,
  skylightPower: 5400,
  spotPower: 2400,
  endPower: 2200,
  lightmapSize: 2048,
  floorTileM: 5.4,
  fov: 44,
  mobileFov: 58,
  cameraZ: 1.9,
};

const PAINT = 'salle-temoin/assets/paintings/';

// Four sizes, never three of the same in a row. The two walls start on different steps.
const CADENCE = [
  {artW: 0.64, artH: 0.86, mould: 0.09, hang: 1.82},
  {artW: 0.42, artH: 0.56, mould: 0.055, hang: 1.64},
  {artW: 0.82, artH: 0.6, mould: 0.08, hang: 1.74},
  {artW: 0.7, artH: 0.98, mould: 0.1, hang: 1.92},
];
const PAINTINGS = {
  left: [
    'cc0/oeuvres/kintsugi.jpg',
    'cc0/oeuvres/le-gamin-de-1987.jpg',
    'pd/painting-5.webp',
    'pd/painting-7.webp',
    'pd/painting-2.webp',
    'cc0/oeuvres/lundi-8h12.jpg',
  ],
  right: [
    'cc0/oeuvres/lundi-8h12.jpg',
    'pd/painting-2.webp',
    'pd/painting-4.webp',
    'pd/painting-6.webp',
    'pd/painting-5.webp',
    'cc0/oeuvres/kintsugi.jpg',
  ],
};

function sideFrames(wall) {
  const sign = wall === 'left' ? -1 : 1;
  const x = sign * ROOM.width / 2;
  const normal = -sign;
  const paintings = PAINTINGS[wall];
  // One frame in each bay. The hero is the nearest, and the widest.
  const posts = [];
  for (let z = 6.6; z <= 32.2; z += 3.35) posts.push(Math.round(z * 100) / 100);
  // Two large sizes only. A 0.5 m frame disappears down a 30 m nave.
  const kinds = wall === 'left'
    ? [{artW: 1.15, artH: 1.52, mould: 0.13, hang: 1.78}, {artW: 1.35, artH: 1.05, mould: 0.11, hang: 1.62}]
    : [{artW: 1.35, artH: 1.05, mould: 0.11, hang: 1.62}, {artW: 1.15, artH: 1.52, mould: 0.13, hang: 1.78}];
  const frames = [];
  let paint = 0;
  for (let i = 0; i < posts.length - 1; i += 1) {
    const z0 = posts[i] + 0.4;
    const z1 = posts[i + 1] - 0.4;
    const room = z1 - z0;
    if (room < 1.2) continue;
    const size = kinds[i % kinds.length];
    const z = Math.round(((z0 + z1) / 2) * 100) / 100;
    const hero = frames.length === 0;
    const artW = hero ? 1.28 : Math.min(size.artW, room - 0.28);
    const artH = hero ? 1.7 : size.artH;
    const mould = hero ? 0.16 : size.mould;
    frames.push({
      id: hero ? `${wall}-front` : `${wall}-${z.toFixed(2)}`,
      wall,
      x,
      y: hero ? 1.72 : size.hang,
      z,
      artWidth: Math.round(artW * 1000) / 1000,
      artHeight: Math.round(artH * 1000) / 1000,
      moulding: Math.round(mould * 1000) / 1000,
      width: Math.round((artW + mould * 2) * 1000) / 1000,
      height: Math.round((artH + mould * 2) * 1000) / 1000,
      normal,
      painting: hero
        ? (wall === 'left' ? 'cc0/oeuvres/le-dernier-bal.jpg' : 'cc0/oeuvres/le-premier-spectateur.jpg')
        : paintings[paint++ % paintings.length],
      hero,
      pictureLight: true,
    });
  }
  return frames;
}

export function buildLayout() {
  const frames = [...sideFrames('left'), ...sideFrames('right')];
  const benches = [
    {wall: 'left', x: -ROOM.width / 2 + 0.28, z0: 6.62, z1: 9.2, height: 0.46, depth: 0.44},
    {wall: 'right', x: ROOM.width / 2 - 0.28, z0: 6.62, z1: 9.2, height: 0.46, depth: 0.44},
  ];
  const pilasters = [];
  for (let z = 6.6; z <= 32.2; z += 3.35) pilasters.push({z: Math.round(z * 100) / 100, width: 0.72, depth: 0.48});
  const obstacles = benches.map(bench => ({
    minX: bench.x - bench.depth / 2,
    maxX: bench.x + bench.depth / 2,
    minZ: bench.z0,
    maxZ: bench.z1,
  }));
  return {
    room: ROOM,
    frames,
    benches,
    pilasters,
    obstacles,
    paintingsRoot: PAINT,
  };
}

export function frameRect(frame) {
  if (frame.wall === 'north') {
    return {
      minX: frame.x - frame.width / 2,
      maxX: frame.x + frame.width / 2,
      minZ: frame.z - 0.2,
      maxZ: frame.z + 0.2,
    };
  }
  if (frame.wall === 'endLeft' || frame.wall === 'endRight') {
    return {
      minX: frame.x - 0.2,
      maxX: frame.x + 0.2,
      minZ: frame.z - frame.width / 2,
      maxZ: frame.z + frame.width / 2,
    };
  }
  return {
    minX: frame.x - 0.2,
    maxX: frame.x + 0.2,
    minZ: frame.z - frame.width / 2,
    maxZ: frame.z + frame.width / 2,
  };
}

export function findArchitectureConflicts(layout = buildLayout()) {
  const hits = [];
  const frames = layout.frames.filter(frame => frame.wall === 'left' || frame.wall === 'right');
  for (const frame of frames) {
    const rect = frameRect(frame);
    for (const pilaster of layout.pilasters) {
      const minZ = pilaster.z - pilaster.width / 2;
      const maxZ = pilaster.z + pilaster.width / 2;
      if (rect.maxZ > minZ + 0.02 && rect.minZ < maxZ - 0.02) {
        hits.push(`${frame.id} crosses pilaster at ${pilaster.z}`);
      }
    }
    if (rect.maxZ > layout.room.hallLength - 0.15) hits.push(`${frame.id} crosses the portal`);
    if (rect.minZ < 0.4) hits.push(`${frame.id} crosses the entrance`);
  }
  for (let i = 0; i < frames.length; i += 1) {
    for (let j = i + 1; j < frames.length; j += 1) {
      if (frames[i].wall !== frames[j].wall) continue;
      const a = frameRect(frames[i]);
      const b = frameRect(frames[j]);
      if (a.maxZ > b.minZ + 0.02 && b.maxZ > a.minZ + 0.02) {
        hits.push(`${frames[i].id} overlaps ${frames[j].id}`);
      }
    }
  }
  return hits;
}
