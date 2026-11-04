/* Run: node --test empty-museum/tests/museum.test.mjs */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {availableWholeWalls,isSlotInsideWall,PARTNER_BAYS} from '../museum-inventory.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..');
const file=p=>readFileSync(join(root,p),'utf8');
test('38 opening bays reserve four partner spots and keep remaining inventory coherent',()=>{
  const walls=availableWholeWalls(38,[4,5,8,11,14,17]);
  assert.ok(walls.length>0);
  for(const wall of walls){
    assert.equal(wall.slots.length,3);
    assert.ok(wall.slots.every(slot=>slot>=4&&slot<38));
    assert.ok(wall.slots.every(slot=>!PARTNER_BAYS.includes(slot)));
    assert.ok(wall.slots.every(slot=>![4,5,8,11,14,17].includes(slot)));
    assert.equal(wall.slots[1]-wall.slots[0],2);
    assert.equal(wall.slots[2]-wall.slots[1],2);
    assert.ok(wall.slots.every(slot=>isSlotInsideWall(slot,wall)));
  }
});
test('a frame blocks sale of the Mur Total containing its bay',()=>{
  const initial=availableWholeWalls(24,[]);
  const selected=initial.find(x=>x.base>=6);
  assert.ok(selected);
  const after=availableWholeWalls(24,[selected.slots[1]]);
  assert.ok(!after.some(x=>x.base===selected.base&&x.side===selected.side));
});
test('partner bays prevent opening wall offers in the first module',()=>{
  assert.equal(availableWholeWalls(6).length,0);
  assert.ok(availableWholeWalls(12).length>0);
});
test('a partial module never creates a whole-wall offer',()=>{
  assert.equal(availableWholeWalls(4,[],[]).length,0);
  assert.equal(availableWholeWalls(5,[],[]).length,0);
});
test('V5, its cloud adapter and entrypoint parse and point at each other',()=>{
  for(const path of ['gallery-v5.js','museum-cloud.js','museum-inventory.mjs']){
    const src=file(path);
    const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:src,encoding:'utf8'});
    assert.equal(parsed.status,0,path+': '+parsed.stderr);
  }
  const page=file('3d.html');
  assert.match(page,/gallery-v5\.js\?v=/);
  assert.match(page,/gallery-fallback\.js/);
  assert.match(page,/type="importmap"/);
  assert.match(page,/THE UNREAL/);
});
test('cloud mode remains disabled until an approved backend is configured',()=>{
  assert.match(file('cloud-config.js'),/enabled:\s*false/);
  assert.match(file('museum-cloud.js'),/endpoint.searchParams.set\('status','eq.published'\)/);
});
