import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  atlasCell, atlasDrawRect, orientationErrors, sourceFractionFromTop, topBandMatches, wallOf,
} from './canvas-orientation.mjs';

function readGlb(path) {
  const data = readFileSync(path);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
  const binOffset = 20 + jsonLength;
  const binLength = data.readUInt32LE(binOffset);
  const bin = data.subarray(binOffset + 8, binOffset + 8 + binLength);
  function accessor(index, components) {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const count = acc.count;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const values = [];
      for (let c = 0; c < components; c += 1) {
        values.push(bin.readFloatLE(start + (i * components + c) * 4));
      }
      out.push(values);
    }
    return out;
  }
  function quads(meshName) {
    const mesh = json.meshes.find(item => item.name === meshName);
    const primitive = mesh.primitives[0];
    const pos = accessor(primitive.attributes.POSITION, 3);
    const uv = accessor(primitive.attributes.TEXCOORD_0, 2);
    let indices;
    if (primitive.indices !== undefined) {
      const acc = json.accessors[primitive.indices];
      const view = json.bufferViews[acc.bufferView];
      const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
      indices = [];
      const stride = acc.componentType === 5123 ? 2 : 4;
      for (let i = 0; i < acc.count; i += 1) {
        indices.push(stride === 2 ? bin.readUInt16LE(start + i * 2) : bin.readUInt32LE(start + i * 4));
      }
    }
    const tris = [];
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) tris.push(indices.slice(i, i + 3));
    } else {
      for (let i = 0; i < pos.length; i += 3) tris.push([i, i + 1, i + 2]);
    }
    const faces = [];
    for (let t = 0; t < tris.length; t += 2) {
      const ids = [...new Set([...tris[t], ...(tris[t + 1] || [])])];
      faces.push(ids.map(id => ({
        x: pos[id][0],
        y: pos[id][1],
        // The viewer mirrors glTF Z so the hall runs toward +Z.
        z: -pos[id][2],
        u: uv[id][0],
        v: uv[id][1],
      })));
    }
    return faces;
  }
  const heroes = json.meshes.filter(mesh => mesh.name.startsWith('Hero_')).flatMap(mesh => quads(mesh.name));
  return [...heroes, ...quads('artwork')];
}

const faces = readGlb(new URL('./assets/salle-temoin.glb', import.meta.url));

test('every canvas is upright and not mirrored', () => {
  assert.ok(faces.length > 40, `expected the hung canvases, found ${faces.length}`);
  const failures = [];
  for (const [index, corners] of faces.entries()) {
    const wall = wallOf(corners);
    const errors = orientationErrors(corners, wall);
    if (errors.length) failures.push(`${index} ${wall}: ${errors.join(', ')}`);
    const cell = Math.abs(corners[0].v - corners[1].v) < 0.2 && corners[0].v > 0.2
      ? {
        u0: Math.min(...corners.map(c => c.u)),
        v0: 1 - Math.max(...corners.map(c => c.v)),
        u1: Math.max(...corners.map(c => c.u)),
        v1: 1 - Math.min(...corners.map(c => c.v)),
      }
      : null;
    if (!topBandMatches(corners, cell)) failures.push(`${index} ${wall}: top band is not the top of the source`);
  }
  assert.deepEqual(failures, []);
});

test('the atlas draws the source top onto the frame top', () => {
  const size = 64;
  const cell = atlasCell(3);
  const rect = atlasDrawRect(cell, size);
  const buffer = new Uint8Array(size * size);
  // White bar on the top 20% of the source, placed by the same rect the viewer uses.
  const bar = Math.max(1, Math.round(rect.h * 0.2));
  for (let y = 0; y < bar; y += 1) {
    for (let x = 0; x < Math.round(rect.w); x += 1) {
      const px = Math.floor(rect.x) + x;
      const py = Math.floor(rect.y) + y;
      if (px >= 0 && py >= 0 && px < size && py < size) buffer[py * size + px] = 255;
    }
  }
  const frameTopV = 1 - cell.v1;
  const sampledY = Math.min(size - 1, Math.max(0, Math.round(frameTopV * size)));
  const sampledX = Math.min(size - 1, Math.max(0, Math.round(((cell.u0 + cell.u1) / 2) * size)));
  assert.equal(buffer[sampledY * size + sampledX], 255, 'frame top missed the white top band');
  const frameBottomV = 1 - cell.v0;
  const bottomY = Math.min(size - 1, Math.round(frameBottomV * size) - 1);
  assert.equal(buffer[bottomY * size + sampledX], 0, 'frame bottom should be outside the top band');
  assert.ok(sourceFractionFromTop(frameTopV, cell) < 0.05);
  assert.ok(sourceFractionFromTop(frameBottomV, cell) > 0.95);
});
