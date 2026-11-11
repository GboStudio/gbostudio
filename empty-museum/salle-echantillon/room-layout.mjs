/**
 * White open-sky sample room. Dimensions are in the viewer's space:
 * X across the nave, Y up, Z down the axis toward the cloud haze.
 * There is no ceiling and no back wall. The public gallery does not import this module.
 */
export const ROOM = {
  width: 7.2,
  backZ: -0.45,
  hallLength: 13.4,
  endDepth: 5.0,
  length: 18.4,
  eye: 1.6,
  exposure: 0.78,
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

function sideFrames(wall) {
  const sign = wall === 'left' ? -1 : 1;
  const x = sign * ROOM.width / 2;
  const normal = -sign;
  const hang = 1.78;
  const large = wall === 'left'
    ? {artW: 1.02, artH: 1.36, mould: 0.14, painting: 'cc0/oeuvres/le-dernier-bal.jpg', hero: true}
    : {artW: 1.02, artH: 1.36, mould: 0.14, painting: 'cc0/oeuvres/le-premier-spectateur.jpg', hero: true};
  const medium = wall === 'left'
    ? [
      ['cc0/oeuvres/kintsugi.jpg', 9.15],
      ['cc0/oeuvres/le-gamin-de-1987.jpg', 10.05],
      ['pd/painting-5.webp', 10.95],
    ]
    : [
      ['cc0/oeuvres/lundi-8h12.jpg', 9.15],
      ['pd/painting-2.webp', 10.05],
      ['pd/painting-4.webp', 10.95],
    ];
  const frames = [{
    id: `${wall}-front`,
    wall,
    x,
    y: hang,
    z: 7.55,
    artWidth: large.artW,
    artHeight: large.artH,
    moulding: large.mould,
    width: large.artW + large.mould * 2,
    height: large.artH + large.mould * 2,
    normal,
    painting: large.painting,
    hero: true,
    pictureLight: true,
  }];
  for (const [painting, z] of medium) {
    const artW = 0.5;
    const artH = 0.67;
    const mould = 0.08;
    frames.push({
      id: `${wall}-${z}`,
      wall,
      x,
      y: hang,
      z,
      artWidth: artW,
      artHeight: artH,
      moulding: mould,
      width: artW + mould * 2,
      height: artH + mould * 2,
      normal,
      painting,
      hero: false,
      pictureLight: true,
    });
  }
  const smallW = 0.42;
  const smallH = 0.56;
  const smallM = 0.055;
  frames.push({
    id: `${wall}-far`,
    wall,
    x,
    y: hang,
    z: 12.45,
    artWidth: smallW,
    artHeight: smallH,
    moulding: smallM,
    width: smallW + smallM * 2,
    height: smallH + smallM * 2,
    normal,
    painting: wall === 'left' ? 'pd/painting-7.webp' : 'pd/painting-6.webp',
    hero: false,
    pictureLight: true,
  });
  return frames;
}

export function buildLayout() {
  const frames = [...sideFrames('left'), ...sideFrames('right')];
  const benches = [
    {wall: 'left', x: -ROOM.width / 2 + 0.28, z0: 6.62, z1: 9.2, height: 0.46, depth: 0.44},
    {wall: 'right', x: ROOM.width / 2 - 0.28, z0: 6.62, z1: 9.2, height: 0.46, depth: 0.44},
  ];
  const pilasters = [5.85, 11.7].map(z => ({z, width: 0.62, depth: 0.2}));
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
