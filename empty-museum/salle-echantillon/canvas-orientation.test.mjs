import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the real-time viewer does not mirror the room', () => {
  const source = readFileSync(new URL('./viewer.js', import.meta.url), 'utf8');
  assert.equal(source.includes('scale.z = -1'), false);
  assert.equal(source.includes('scale.set(-1'), false);
});

test('Le Dernier Bal is the left-hand frame', () => {
  const data = readFileSync(new URL('./assets/salle-echantillon.glb', import.meta.url));
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
  const left = json.nodes.find(node => node.name === 'giltframe-left-front');
  const right = json.nodes.find(node => node.name === 'giltframe-right-front');
  assert.ok(left && right, 'both front frames are in the glTF');
  assert.ok(left.translation[0] < -1, 'left frame is on the negative X wall');
  assert.ok(right.translation[0] > 1, 'right frame is on the positive X wall');
  const layout = JSON.parse(readFileSync(new URL('./layout.json', import.meta.url), 'utf8'));
  const hung = layout.frames.find(frame => frame.id === 'left-front');
  assert.equal(hung.painting, 'cc0/oeuvres/le-dernier-bal.jpg');
  assert.equal(hung.wall, 'left');
});
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
        // The viewer no longer mirrors Z. glTF Z is the world Z.
        z: pos[id][2],
        u: uv[id][0],
        v: uv[id][1],
      })));
    }
    return faces;
  }
  const canvases = json.meshes.filter(mesh => mesh.name.startsWith('Canvas_')).flatMap(mesh => quads(mesh.name));
  if (canvases.length >= 10) return canvases;
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
