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
  eye: 1.5,
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
  // 41.6° vertical is about 68° horizontal on a 16:9 frame.
  fov: 41.6,
  mobileFov: 58,
  cameraZ: 1.15,
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
  // Four bays. Two large frames in the first, then two or three smaller
  // ones, with space around them. The scan is portrait, so the hung width
  // is about 0.86 × the height.
  const posts = [4.6, 11.8, 19.0, 26.2, 33.0];
  const bays = [
    [
      {artW: 1.05, artH: 1.28, mould: 0.11},
      {artW: 0.76, artH: 0.9, mould: 0.09},
    ],
    [
      {artW: 0.7, artH: 0.84, mould: 0.08},
      {artW: 0.58, artH: 0.7, mould: 0.07},
    ],
    [
      {artW: 0.74, artH: 0.88, mould: 0.08},
      {artW: 0.56, artH: 0.68, mould: 0.07},
      {artW: 0.64, artH: 0.76, mould: 0.07},
    ],
    [
      {artW: 0.68, artH: 0.8, mould: 0.08},
      {artW: 0.58, artH: 0.7, mould: 0.07},
    ],
  ];
  const frames = [];
  let paint = 0;
  for (let bay = 0; bay < posts.length - 1; bay += 1) {
    const sizes = bays[bay];
    const z0 = posts[bay] + 0.7;
    const z1 = posts[bay + 1] - 0.7;
    const step = (z1 - z0) / sizes.length;
    for (let slot = 0; slot < sizes.length; slot += 1) {
      const shift = wall === 'right' && bay > 0 ? 1 : 0;
      const size = sizes[(slot + shift) % sizes.length];
      const z = Math.round((z0 + step * (slot + 0.5)) * 100) / 100;
      const hero = frames.length === 0;
      const artW = hero ? 1.08 : size.artW;
      const artH = hero ? 1.28 : size.artH;
      const mould = hero ? 0.12 : size.mould;
      frames.push({
        id: hero ? `${wall}-front` : `${wall}-${z.toFixed(2)}`,
        wall,
        x,
        y: 1.6,
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
  }
  return frames;
}

export function buildLayout() {
  const frames = [...sideFrames('left'), ...sideFrames('right')];
  const benches = [
    {wall: 'left', x: -ROOM.width / 2 + 0.32, z0: 5.4, z1: 10.9, height: 0.48, depth: 0.42},
    {wall: 'right', x: ROOM.width / 2 - 0.32, z0: 5.4, z1: 10.9, height: 0.48, depth: 0.42},
  ];
  const pilasters = [];
  for (const z of [4.6, 11.8, 19.0, 26.2, 33.0]) {
    pilasters.push({z, width: 0.55, depth: 0.5});
  }
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
