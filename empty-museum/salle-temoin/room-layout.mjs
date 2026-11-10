/**
 * Salle témoin — trame architecturale.
 * Une baie de 3,50 m = un pilastre de 0,50 m + un champ d'accrochage de 3,00 m
 * (exactement un module commercial). Le parquet de Versailles mesure 3,50/3 m
 * afin que trois panneaux tombent dans chaque baie.
 * Ce module ne charge aucune géométrie : il sert aux tests, au bake Blender
 * et au contrôle de collision du visiteur.
 */
import {makeWallSlots, DEFAULT_COMMERCE_CONFIG} from '../commerce-model.mjs';

export const ROOM = Object.freeze({
  width: 10.5,
  length: 17.5,
  bayPitch: 3.5,
  pilaster: 0.5,
  field: 3.0,
  panel: 3.5 / 3,
  panelsPerBay: 3,
  wallColor: '#7A2E2E',
  stoneColor: '#D9D0C2',
  corniceY: 7.35,
  vaultSpringY: 7.55,
  laylightY: 9.48,
  vaultCrownY: 10.85,
  laylightHalfWidth: (3.5 / 3) * 2,
  bandBottom: 0.62,
  exhibitHeight: 2.4,
  margin: 0.12,
  gap: 0.045,
  baseboardH: 0.2,
  baseboardD: 0.045,
  redBottom: 0.28,
  redTop: 5.15,
  pilasterDepth: 0.16,
  endPilasterDepth: 0.09,
  frameDepth: 0.068,
  eye: 1.62,
  exposure: 1.08,
  daylightK: 5000,
  pictureK: 3000,
  lightmapSize: 4096,
  floorPxPerM: 160,
  wallPxPerM: 100
});

const LEFT_FORMATS = ['large', 'very_large', 'normal', 'medium', 'small'];
const RIGHT_FORMATS = ['large', 'normal', 'very_large', 'normal', 'large'];

// Public-domain works, files in assets/paintings/pd/. Heroes are chosen so a
// landscape canvas is not a stretched portrait. See credits.json.
const WORKS = [
  {title: 'La laitière', author: 'Johannes Vermeer', painting: 0},
  {title: 'La jeune fille à la perle', author: 'Johannes Vermeer', painting: 1},
  {title: 'Autoportrait', author: 'Rembrandt van Rijn', painting: 2},
  {title: 'L’allée de Middelharnis', author: 'Meindert Hobbema', painting: 3},
  {title: 'Paysage de dunes', author: 'Jacob van Ruisdael', painting: 4},
  {title: 'Portrait de Claes Duyst van Voorhout', author: 'Frans Hals', painting: 5},
  {title: 'Nature morte à la corne', author: 'Willem Kalf', painting: 6},
  {title: 'Détail, La laitière', author: 'Johannes Vermeer', painting: 7}
];

const HERO_PAINTING = {
  'M001-large-1': 1,
  'M002-very_large-1': 6,
  'M008-very_large-1': 2,
  'M011-very_large-1': 3
};

function aabb(box) {
  return {
    minX: box.minX, maxX: box.maxX,
    minY: box.minY, maxY: box.maxY,
    minZ: box.minZ, maxZ: box.maxZ
  };
}

export function sideBays() {
  const n = Math.round(ROOM.length / ROOM.bayPitch);
  const bays = [];
  for (let i = 0; i < n; i++) {
    const z0 = i * ROOM.bayPitch;
    bays.push({
      index: i,
      pilaster: {minZ: z0, maxZ: z0 + ROOM.pilaster},
      field: {minZ: z0 + ROOM.pilaster, maxZ: z0 + ROOM.bayPitch}
    });
  }
  return bays;
}

export function widthBays() {
  const n = Math.round(ROOM.width / ROOM.bayPitch);
  const x0 = -ROOM.width / 2;
  const bays = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * ROOM.bayPitch;
    bays.push({
      index: i,
      pilaster: {minX: x, maxX: x + ROOM.pilaster},
      field: {minX: x + ROOM.pilaster, maxX: x + ROOM.bayPitch}
    });
  }
  return bays;
}

function mouldingFor(width, height) {
  const slender = Math.min(width, height) * 0.085;
  // The outer moulding stays inside the rented cell, so neighbours
  // and pilasters cannot be crossed.
  return Math.max(0.014, Math.min(slender, 0.09, width * 0.14, height * 0.14));
}

function pictureLightFor(width, height) {
  return width >= 1 && height >= 1;
}

let titleCursor = 0;
function nextWork(frameId) {
  if (Object.prototype.hasOwnProperty.call(HERO_PAINTING, frameId)) {
    return WORKS[HERO_PAINTING[frameId]];
  }
  const work = WORKS[titleCursor % WORKS.length];
  titleCursor += 1;
  return work;
}

function pushFrames(frames, cartels, wall, fieldMin, fieldMax, axis, moduleNumber, format) {
  const slots = makeWallSlots(DEFAULT_COMMERCE_CONFIG, moduleNumber, format);
  for (const slot of slots) {
    const along = fieldMin + slot.xM + slot.widthM / 2;
    const y = ROOM.bandBottom + slot.yM + slot.heightM / 2;
    const mould = mouldingFor(slot.widthM, slot.heightM);
    const meta = nextWork(slot.id);
    const hero = format === 'very_large' || (format === 'large' && slot.ordinal === 1 && wall === 'left');
    const frame = {
      id: slot.id,
      wall, format,
      moduleNumber,
      ordinal: slot.ordinal,
      width: slot.widthM,
      height: slot.heightM,
      along, y,
      moulding: mould,
      artWidth: slot.widthM - 2 * mould,
      artHeight: slot.heightM - 2 * mould,
      pictureLight: pictureLightFor(slot.widthM, slot.heightM),
      hero,
      painting: meta.painting,
      title: meta.title,
      author: meta.author,
      demo: true
    };
    if (axis === 'z') {
      const x = wall === 'left' ? -ROOM.width / 2 : ROOM.width / 2;
      const sign = wall === 'left' ? 1 : -1;
      frame.x = x;
      frame.z = along;
      frame.normal = sign;
      frame.box = aabb({
        minX: Math.min(x, x + sign * ROOM.frameDepth),
        maxX: Math.max(x, x + sign * ROOM.frameDepth),
        minY: y - slot.heightM / 2,
        maxY: y + slot.heightM / 2,
        minZ: along - slot.widthM / 2,
        maxZ: along + slot.widthM / 2
      });
    } else {
      const z = wall === 'north' ? ROOM.length : 0;
      const sign = wall === 'north' ? -1 : 1;
      frame.x = along;
      frame.z = z;
      frame.normal = sign;
      frame.box = aabb({
        minX: along - slot.widthM / 2,
        maxX: along + slot.widthM / 2,
        minY: y - slot.heightM / 2,
        maxY: y + slot.heightM / 2,
        minZ: Math.min(z, z + sign * ROOM.frameDepth),
        maxZ: Math.max(z, z + sign * ROOM.frameDepth)
      });
    }
    // Single-row canvases have room for a readable brass plate. Stacked
    // cells only have the 4.5 cm gap, so their plates stay inside it.
    const cartelH = slot.heightM > 1.4 ? 0.105 : (slot.heightM > 0.8 ? 0.028 : 0.018);
    const cartelW = slot.heightM > 1.4
      ? Math.min(0.46, slot.widthM * 0.34)
      : Math.min(slot.widthM * 0.72, slot.heightM > 0.8 ? 0.18 : 0.1);
    const below = frame.box.minY - 0.01 - cartelH;
    const cartel = {
      id: slot.id + '-cartel',
      frameId: slot.id,
      wall,
      w: cartelW,
      h: cartelH,
      title: meta.title,
      author: meta.author,
      format
    };
    if (axis === 'z') {
      cartel.x = frame.x;
      cartel.z = frame.z;
      cartel.y = below + cartelH / 2;
      const sign = frame.normal;
      cartel.box = aabb({
        minX: Math.min(frame.x, frame.x + sign * 0.02),
        maxX: Math.max(frame.x, frame.x + sign * 0.02),
        minY: below,
        maxY: below + cartelH,
        minZ: frame.z - cartelW / 2,
        maxZ: frame.z + cartelW / 2
      });
    } else {
      cartel.x = frame.x;
      cartel.z = frame.z;
      cartel.y = below + cartelH / 2;
      const sign = frame.normal;
      cartel.box = aabb({
        minX: frame.x - cartelW / 2,
        maxX: frame.x + cartelW / 2,
        minY: below,
        maxY: below + cartelH,
        minZ: Math.min(frame.z, frame.z + sign * 0.02),
        maxZ: Math.max(frame.z, frame.z + sign * 0.02)
      });
    }
    frames.push(frame);
    cartels.push(cartel);
  }
}

export function buildLayout() {
  titleCursor = 0;
  const bays = sideBays();
  const ends = widthBays();
  const frames = [];
  const cartels = [];
  bays.forEach((bay, i) => {
    pushFrames(frames, cartels, 'left', bay.field.minZ, bay.field.maxZ, 'z', i + 1, LEFT_FORMATS[i]);
    pushFrames(frames, cartels, 'right', bay.field.minZ, bay.field.maxZ, 'z', i + 6, RIGHT_FORMATS[i]);
  });
  const center = ends[1];
  pushFrames(frames, cartels, 'north', center.field.minX, center.field.maxX, 'x', 11, 'very_large');

  const halfW = ROOM.width / 2;
  const pilasters = [];
  for (const bay of bays) {
    for (const wall of ['left', 'right']) {
      const x = wall === 'left' ? -halfW : halfW;
      const sign = wall === 'left' ? 1 : -1;
      pilasters.push({
        id: `${wall}-p${bay.index}`,
        wall,
        box: aabb({
          minX: Math.min(x, x + sign * ROOM.pilasterDepth),
          maxX: Math.max(x, x + sign * ROOM.pilasterDepth),
          minY: 0,
          maxY: ROOM.corniceY,
          minZ: bay.pilaster.minZ,
          maxZ: bay.pilaster.maxZ
        })
      });
    }
  }
  for (const bay of ends) {
    for (const wall of ['north', 'south']) {
      const z = wall === 'north' ? ROOM.length : 0;
      const sign = wall === 'north' ? -1 : 1;
      const depth = ROOM.endPilasterDepth;
      pilasters.push({
        id: `${wall}-p${bay.index}`,
        wall,
        box: aabb({
          minX: bay.pilaster.minX,
          maxX: bay.pilaster.maxX,
          minY: 0,
          maxY: ROOM.corniceY,
          minZ: Math.min(z, z + sign * depth),
          maxZ: Math.max(z, z + sign * depth)
        })
      });
    }
  }

  const door = {
    id: 'door-south',
    box: aabb({
      minX: -0.99,
      maxX: 0.99,
      minY: 0,
      maxY: 3.2,
      minZ: 0,
      maxZ: 0.08
    })
  };
  const plinth = {
    id: 'S01',
    x: 2.42,
    z: 9.15,
    length: 1.8,
    width: 1.5,
    height: 0.62,
    maxObjectHeight: 2.5,
    sculptureHeight: 1.48
  };
  plinth.box = aabb({
    minX: plinth.x - plinth.width / 2,
    maxX: plinth.x + plinth.width / 2,
    minY: 0,
    maxY: plinth.height,
    minZ: plinth.z - plinth.length / 2,
    maxZ: plinth.z + plinth.length / 2
  });
  const benches = [
    {id: 'bench-a', x: -1.15, z: 5.1, w: 0.46, l: 1.85, h: 0.45},
    {id: 'bench-b', x: -1.15, z: 12.55, w: 0.46, l: 1.85, h: 0.45}
  ].map(bench => ({
    ...bench,
    box: aabb({
      minX: bench.x - bench.w / 2,
      maxX: bench.x + bench.w / 2,
      minY: 0,
      maxY: bench.h,
      minZ: bench.z - bench.l / 2,
      maxZ: bench.z + bench.l / 2
    })
  }));

  const lm = ROOM.lightmapSize;
  const lightmap = {
    size: lm,
    floorPxPerM: ROOM.floorPxPerM,
    wallPxPerM: ROOM.wallPxPerM,
    floor: {x: 0, y: 0, w: Math.round(ROOM.length * ROOM.floorPxPerM), h: Math.round(ROOM.width * ROOM.floorPxPerM)},
    left: {x: 0, y: 1704, w: Math.round(ROOM.length * ROOM.wallPxPerM), h: Math.round(ROOM.corniceY * ROOM.wallPxPerM)},
    right: {x: 1840, y: 1704, w: Math.round(ROOM.length * ROOM.wallPxPerM), h: Math.round(ROOM.corniceY * ROOM.wallPxPerM)},
    north: {x: 0, y: 2520, w: Math.round(ROOM.width * ROOM.wallPxPerM), h: Math.round(ROOM.corniceY * ROOM.wallPxPerM)},
    south: {x: 1120, y: 2520, w: Math.round(ROOM.width * ROOM.wallPxPerM), h: Math.round(ROOM.corniceY * ROOM.wallPxPerM)},
    vault: {x: 0, y: 3320, w: 2200, h: 700}
  };

  return {
    room: ROOM,
    bays, ends,
    leftFormats: LEFT_FORMATS,
    rightFormats: RIGHT_FORMATS,
    frames, cartels, pilasters, door, plinth, benches, lightmap,
    obstacles: [plinth.box, ...benches.map(b => b.box)]
  };
}

export function overlap(a, b, pad = 0) {
  return a.minX < b.maxX + pad && a.maxX > b.minX - pad
    && a.minY < b.maxY + pad && a.maxY > b.minY - pad
    && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;
}

export function findArchitectureConflicts(layout, pad = 0.012) {
  const hits = [];
  const architecture = [
    ...layout.pilasters.map(p => ({kind: 'pilaster', id: p.id, box: p.box})),
    {kind: 'door', id: layout.door.id, box: layout.door.box}
  ];
  const pieces = [
    ...layout.frames.map(f => ({kind: 'frame', id: f.id, box: f.box})),
    ...layout.cartels.map(c => ({kind: 'cartel', id: c.id, box: c.box}))
  ];
  for (const piece of pieces) {
    if (piece.box.minY < ROOM.baseboardH - 0.001) {
      hits.push(`${piece.id} crosses the baseboard`);
    }
    if (piece.box.maxY > ROOM.redTop + 0.001 && piece.kind === 'frame') {
      hits.push(`${piece.id} leaves the hanging field vertically`);
    }
    for (const arch of architecture) {
      if (overlap(piece.box, arch.box, pad)) hits.push(`${piece.id} crosses ${arch.id}`);
    }
  }
  for (let i = 0; i < layout.frames.length; i++) {
    for (let j = i + 1; j < layout.frames.length; j++) {
      if (overlap(layout.frames[i].box, layout.frames[j].box, 0.004)) {
        hits.push(`${layout.frames[i].id} crosses ${layout.frames[j].id}`);
      }
    }
  }
  return hits;
}

