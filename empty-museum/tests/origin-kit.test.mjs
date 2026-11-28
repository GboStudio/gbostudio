/* Run: node --test empty-museum/tests/origin-kit.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PILASTER, benchLayout} from '../origin-room-geometry.mjs';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

function gltf() {
  const data = readFileSync(new URL('assets/kit/origin-kit.glb', root));
  assert.equal(data.subarray(0, 4).toString(), 'glTF');
  const jsonLength = data.readUInt32LE(12);
  const kind = data.subarray(16, 20).toString();
  assert.equal(kind, 'JSON');
  return JSON.parse(data.subarray(20, 20 + jsonLength).toString());
}

function worldBox(doc, meshName) {
  const meshIndex = doc.meshes.findIndex(mesh => mesh.name === meshName);
  assert.ok(meshIndex >= 0, meshName);
  const node = doc.nodes.find(item => item.mesh === meshIndex);
  const prim = doc.meshes[meshIndex].primitives[0];
  const pos = doc.accessors[prim.attributes.POSITION];
  let min = pos.min.slice();
  let max = pos.max.slice();
  if (pos.normalized && pos.componentType === 5122) {
    min = min.map(value => value / 32767);
    max = max.map(value => value / 32767);
  }
  const translation = node.translation || [0, 0, 0];
  const scale = node.scale || [1, 1, 1];
  const low = [0, 0, 0];
  const high = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const a = min[axis] * scale[axis] + translation[axis];
    const b = max[axis] * scale[axis] + translation[axis];
    low[axis] = Math.min(a, b);
    high[axis] = Math.max(a, b);
  }
  return {low, high, attributes: prim.attributes};
}

test('the modelled kit is meshopt-compressed, with marble UV0 and lightmap UV2', () => {
  const doc = gltf();
  const required = doc.extensionsRequired || [];
  assert.ok(required.includes('EXT_meshopt_compression'));
  const names = doc.meshes.map(mesh => mesh.name).sort();
  assert.deepEqual(names, ['bench', 'cornice', 'panel-narrow', 'panel-wide', 'pilaster', 'plinth']);
  const expect = {
    pilaster: [[0, 0, -0.17], [0.44, 6.1, 0.17]],
    plinth: [[0, 0, -1], [0.1, 0.18, 1]],
    cornice: [[0, 0, -1], [0.17, 0.22, 1]],
    'panel-wide': [[0, 0, -2.04], [0.04, 5.9, 2.04]],
    'panel-narrow': [[0, 0, -0.46], [0.04, 5.9, 0.46]],
    bench: [[-0.24, 0, -0.66], [0.24, 0.45, 0.66]]
  };
  for (const [name, [low, high]] of Object.entries(expect)) {
    const box = worldBox(doc, name);
    assert.ok(box.attributes.TEXCOORD_0 !== undefined, name + ' lacks UV0');
    assert.ok(box.attributes.TEXCOORD_2 !== undefined, name + ' lacks UV2');
    assert.equal(box.attributes.TEXCOORD_3, undefined, name + ' has an extra UV slot');
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(box.low[axis] - low[axis]) < 0.03, name + ' min ' + box.low);
      assert.ok(Math.abs(box.high[axis] - high[axis]) < 0.03, name + ' max ' + box.high);
    }
  }
  const script = read('tools/build_kit.py');
  for (const word of ['pilaster', 'plinth', 'cornice', 'panel-wide', 'bench', 'UV0', 'UV2', 'meshopt']) {
    assert.match(script, new RegExp(word));
  }
});

test('the kit replaces stand-ins without moving the colliders, behind the rollback flag', () => {
  assert.equal(PILASTER.into, 0.46);
  assert.equal(PILASTER.along, 0.36);
  assert.ok(benchLayout(142).every(bench => bench.into === 0.5 && bench.along === 1.4));
  const look = read('origin-room-look.js');
  const build = read('origin-room-build.js');
  assert.match(look, /export const enabled = true/);
  assert.match(look, /marble019-/);
  assert.match(look, /mountArchitectureKit/);
  assert.match(build, /origin-kit\.glb/);
  assert.match(build, /removeStandIns/);
  assert.match(build, /EXT_meshopt_compression|MeshoptDecoder/);
  for (const file of ['color', 'normal', 'rough']) {
    for (const size of ['1k', '2k']) {
      assert.ok(existsSync(new URL(`assets/marble/marble019-${file}-${size}.jpg`, root)));
    }
  }
  assert.equal(existsSync(new URL('assets/marble/marble012-color-2k.jpg', root)), false);
  assert.ok(existsSync(new URL('assets/kit/origin-kit-light.webp', root)));
  assert.ok(existsSync(new URL('assets/kit/origin-kit-light-512.webp', root)));
  const light = JSON.parse(read('assets/kit/origin-kit-light.json'));
  assert.equal(light.uv, 'UV2');
  assert.deepEqual(light.cells.pilaster, [0.02, 0.52, 0.46, 0.46]);
  assert.match(build, /placeWarmHalos/);
  assert.match(read('tools/bake_kit_light.py'), /cycles\.samples/);
});

test('the ceiling opening uses the CC0 Kloofendal sky, kept out of the floor mirror', () => {
  const look = read('origin-room-look.js');
  assert.match(look, /assets\/sky\/kloofendal-48d-/);
  assert.match(look, /mobile \? "1k" : "2k"/);
  assert.match(look, /originHideInscription/);
  assert.match(read('engine3d.js'), /originHideInscription/);
  assert.match(look, /origin-light-shaft/);
  assert.match(look, /origin-cloud-volume/);
  assert.match(look, /sky\.visible = false/);
  assert.match(look, /shaft\.visible = false/);
  assert.match(look, /clouds\.visible = false/);
  assert.match(look, /rocks\.visible = false/);
  assert.match(look, /boulder-01\.glb/);
  assert.match(look, /mobile \? null : placeScannedRocks/);
  assert.match(look, /generateMipmaps = true/);
  assert.match(look, /-m\.jpg/);
  assert.match(read('assets/rocks/CREDITS.md'), /boulder_01/);
  assert.match(read('assets/rocks/CREDITS.md'), /CC0/);
  assert.match(read('assets/rocks/CREDITS.md'), /Rico Cilliers/);
  const credits = read('assets/sky/CREDITS.md');
  assert.match(credits, /kloofendal_48d_partly_cloudy_puresky/);
  assert.match(credits, /CC0/);
  assert.match(credits, /polyhaven\.com/);
  for (const size of ['1k', '2k']) {
    assert.ok(existsSync(new URL(`assets/sky/kloofendal-48d-${size}.jpg`, root)));
  }
});
