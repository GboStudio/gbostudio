import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {orientationErrors, topBandMatches, wallOf} from '../salle-temoin/canvas-orientation.mjs';

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
    const out = [];
    for (let i = 0; i < acc.count; i += 1) {
      const values = [];
      for (let c = 0; c < components; c += 1) values.push(bin.readFloatLE(start + (i * components + c) * 4));
      out.push(values);
    }
    return out;
  }
  function quads(meshName) {
    const mesh = json.meshes.find(item => item.name === meshName);
    if (!mesh) return [];
    const primitive = mesh.primitives[0];
    const pos = accessor(primitive.attributes.POSITION, 3);
    const uv = accessor(primitive.attributes.TEXCOORD_0, 2);
    const acc = json.accessors[primitive.indices];
    const view = json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = acc.componentType === 5123 ? 2 : 4;
    const indices = [];
    for (let i = 0; i < acc.count; i += 1) {
      indices.push(stride === 2 ? bin.readUInt16LE(start + i * 2) : bin.readUInt32LE(start + i * 4));
    }
    const faces = [];
    for (let t = 0; t < indices.length; t += 6) {
      const ids = [...new Set(indices.slice(t, t + 6))];
      if (ids.length < 4) continue;
      faces.push(ids.slice(0, 4).map(id => ({
        x: pos[id][0],
        y: pos[id][1],
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

const faces = readGlb(new URL('./assets/salle-echantillon.glb', import.meta.url));

test('every sample-room canvas is upright and not mirrored', () => {
  assert.ok(faces.length >= 10, `expected the hung canvases, found ${faces.length}`);
  const failures = [];
  for (const [index, corners] of faces.entries()) {
    const wall = wallOf(corners);
    const errors = orientationErrors(corners, wall);
    if (errors.length) failures.push(`${index} ${wall}: ${errors.join(', ')}`);
    const cell = Math.abs(corners[0].v - corners[1].v) < 0.2 && corners[0].v > 0.2
      ? {
        u0: Math.min(...corners.map(corner => corner.u)),
        v0: 1 - Math.max(...corners.map(corner => corner.v)),
        u1: Math.max(...corners.map(corner => corner.u)),
        v1: 1 - Math.min(...corners.map(corner => corner.v)),
      }
      : null;
    if (!topBandMatches(corners, cell)) failures.push(`${index} ${wall}: top band is not the top of the source`);
  }
  assert.deepEqual(failures, []);
});
