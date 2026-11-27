/**
 * Entrance hall of three bays, then the remaining slots in the rooms behind.
 * Slot ids do not change. Only the world position of the origin-room look changes.
 */
import { commercialFrameZ } from "./origin-room-geometry.mjs";

export const HALL_END_Z = 16.55;

export function canDecorateSlot(slot) {
  return Boolean(slot && slot.isCommercial && !slot.piece && !slot.reservedForAds);
}
export const HALL_DOOR = Object.freeze({ x0: 1.55, x1: 3.65 });

const BAY = [6.05, 10.0, 14.05];

let commercialSlots = [];

export function bindOriginPoses(slots) {
  commercialSlots = (slots || []).filter(slot => Number.isInteger(slot.parentBayId));
  hallCache = null;
  rearCache = null;
}

function commercialByBay() {
  const byBay = new Map();
  for (const slot of commercialSlots) {
    if (!byBay.has(slot.parentBayId)) byBay.set(slot.parentBayId, []);
    byBay.get(slot.parentBayId).push(slot);
  }
  for (const list of byBay.values()) list.sort((a, b) => a.ordinal - b.ordinal);
  return byBay;
}

function pose(slot, side, z, y) {
  return {
    id: slot.id,
    side,
    z,
    y,
    widthM: slot.widthM,
    heightM: slot.heightM,
    parentBayId: slot.parentBayId
  };
}

let hallCache = null;

/** Twelve wall slots inside the entrance hall, two or three per bay per side. */
export function hallPoses() {
  if (hallCache) return hallCache;
  if (!commercialSlots.length) return [];
  const byBay = commercialByBay();
  const bay5 = byBay.get(5);
  const bay7 = byBay.get(7);
  const bay11 = byBay.get(11);
  const yLarge = 2.05;
  const ySmall = 1.72;
  hallCache = [
    { id: 0, partner: true, side: -1, z: BAY[0], y: 2.1, widthM: 2.36, heightM: 1.6 },
    { id: 1, partner: true, side: 1, z: BAY[0], y: 2.1, widthM: 1.42, heightM: 2.15 },
    pose(bay5[0], -1, BAY[1] - 0.78, yLarge),
    pose(bay5[1], -1, BAY[1] + 0.78, yLarge),
    pose(bay7[0], 1, BAY[1] - 0.78, yLarge),
    pose(bay7[1], 1, BAY[1] + 0.78, yLarge),
    pose(bay11[0], -1, BAY[2] - 0.9, ySmall),
    pose(bay11[1], -1, BAY[2], ySmall),
    pose(bay11[2], -1, BAY[2] + 0.9, ySmall),
    pose(bay11[3], 1, BAY[2] - 0.9, ySmall),
    pose(bay11[4], 1, BAY[2], ySmall),
    pose(bay11[5], 1, BAY[2] + 0.9, ySmall)
  ];
  return hallCache;
}

function hallIds() {
  return new Set(hallPoses().map(item => item.id));
}

function rearCenters() {
  const used = new Set([5, 7]);
  const bays = [];
  for (const slot of commercialSlots) {
    if (hallIds().has(slot.id) || used.has(slot.parentBayId)) continue;
    if (!bays.includes(slot.parentBayId)) bays.push(slot.parentBayId);
  }
  bays.sort((a, b) => a - b);
  const map = new Map();
  bays.forEach((bay, index) => map.set(bay, 24.6 + index * 3.5));
  return map;
}

let rearCache = null;
function rearMap() {
  if (!rearCache) rearCache = rearCenters();
  return rearCache;
}

export function originPose(slot) {
  if (slot == null) return null;
  if (Number.isInteger(slot.id) && slot.id < 4 && !slot.isCommercial) {
    const hall = hallPoses().find(item => item.partner && item.id === slot.id);
    if (hall) return { side: hall.side, z: hall.z, y: hall.y };
    const side = slot.id % 2 ? 1 : -1;
    return { side, z: slot.id === 2 ? 20.4 : 20.4, y: 2.1 };
  }
  const hall = hallPoses().find(item => !item.partner && item.id === slot.id);
  if (hall) return { side: hall.side, z: hall.z, y: hall.y };
  if (!Number.isInteger(slot.parentBayId)) return null;
  const center = rearMap().get(slot.parentBayId);
  if (center == null) return null;
  const side = slot.parentBayId % 2 ? 1 : -1;
  return {
    side,
    z: commercialFrameZ({ ...slot, side, z: center }),
    y: 0.9 + slot.yM + slot.heightM / 2
  };
}

export function rearBayCount() {
  return rearMap().size;
}
