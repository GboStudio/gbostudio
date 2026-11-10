/**
 * Painting orientation contract.
 * glTF flips V. With Texture.flipY === false, v = 0 is the top of the source
 * image. Every canvas is upright when its highest vertex has the smaller v,
 * and it is not mirrored when u increases toward the visitor's right.
 */

export const PAINTING_FLIP_Y = false;

export function atlasCell(index, columns = 8) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const pad = 0.015 / columns;
  const step = 1 / columns;
  return {
    u0: column * step + pad,
    v0: row * step + pad,
    u1: (column + 1) * step - pad,
    v1: (row + 1) * step - pad,
  };
}

/** Where to draw the source image in an atlas whose V matches the glTF mesh. */
export function atlasDrawRect(cell, size) {
  const w = (cell.u1 - cell.u0) * size;
  const h = (cell.v1 - cell.v0) * size;
  return {
    x: cell.u0 * size,
    y: (1 - cell.v1) * size,
    w,
    h,
  };
}

/** 0 = top of the source image, 1 = bottom, for a mesh v inside this cell. */
export function sourceFractionFromTop(meshV, cell) {
  const vTop = 1 - cell.v1;
  const vBottom = 1 - cell.v0;
  return (meshV - vTop) / (vBottom - vTop);
}

export function wallOf(corners) {
  const xs = corners.map(corner => corner.x);
  const zs = corners.map(corner => corner.z);
  if (Math.max(...xs) - Math.min(...xs) < 0.08) return xs[0] < 0 ? 'left' : 'right';
  if (Math.max(...zs) - Math.min(...zs) < 0.08) return zs[0] > 8 ? 'north' : 'south';
  return 'unknown';
}

/** World axis that increases toward the visitor's right while facing the wall. */
export function visitorRight(wall) {
  if (wall === 'left') return {axis: 'z', sign: -1};
  if (wall === 'right') return {axis: 'z', sign: 1};
  if (wall === 'north') return {axis: 'x', sign: -1};
  return {axis: 'x', sign: 1};
}

export function orientationErrors(corners, wall = wallOf(corners)) {
  const errors = [];
  const top = corners.reduce((best, corner) => corner.y > best.y ? corner : best);
  const bottom = corners.reduce((best, corner) => corner.y < best.y ? corner : best);
  if (!(top.v < bottom.v - 1e-4)) errors.push('upside-down');
  const right = visitorRight(wall);
  const tops = [...corners].sort((a, b) => b.y - a.y).slice(0, 2);
  tops.sort((a, b) => (a[right.axis] - b[right.axis]) * right.sign);
  if (!(tops[1].u > tops[0].u + 1e-4)) errors.push('mirrored');
  return errors;
}

/**
 * Patch check: a source image that is white on its top band and black below
 * must show the white band on the top edge of the frame.
 */
export function topBandMatches(corners, cell) {
  const top = corners.reduce((best, corner) => corner.y > best.y ? corner : best);
  const fraction = cell
    ? sourceFractionFromTop(top.v, cell)
    : (PAINTING_FLIP_Y ? 1 - top.v : top.v);
  return fraction < 0.2;
}
