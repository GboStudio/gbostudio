/* Run: node --test empty-museum/tests/museum.test.mjs */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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
test('active WebGL engine, navigation and cloud adapter parse and route to the single immersive museum',()=>{
  for(const path of ['engine-loader.js','visual-viewport-v1.js','engine3d.js','luxury-v8.js','pbr-scanned.js','baked-architecture-v4.js','physical-gallery-v3.js','gallery-layout-v3.js','museum-v5.js','movement3d.js','museum-cloud.js','museum-inventory.mjs']){
    const src=file(path);
    const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:src,encoding:'utf8'});
    assert.equal(parsed.status,0,path+': '+parsed.stderr);
  }
  const index=file('index.html');
  const entry=file('3d.html');
  const loader=file('engine-loader.js');
  const engine=file('engine3d.js');
  assert.match(index,/type="importmap"/);
  assert.match(index,/engine-loader\.js\?v=/);
  assert.match(index,/THE UNREAL MUSEUM/);
  assert.match(index,/\?visit=immersive/);
  assert.match(entry,/visit=immersive/);
  assert.match(entry,/location\.replace\(target\.href\)/);
  assert.match(loader,/import\("\.\/engine3d\.js\?v=/);
  assert.match(loader,/visual-viewport-v1\.js\?v=/);
  assert.match(loader,/walk\.js\?v=/);
  assert.match(engine,/createMuseumV5Navigation/);
  const navigation=file('museum-v5.js');
  assert.match(navigation,/lookstick-ring/);
  assert.match(navigation,/museumZoomIn/);
  assert.match(navigation,/lookTouchId/);
  assert.match(navigation,/lookX:mobile&&free\?lookStick\.x:0/);
  assert.match(engine,/input\.lookX\*1\.9/);
  assert.match(engine,/input\.lookY\*dt\*1\.32/);
  assert.match(engine,/dual-joystick-v1\.css/);
  const dualCSS=file('dual-joystick-v1.css');
  assert.match(dualCSS,/\.museum-v5-lookstick/);
  assert.match(dualCSS,/Requested controls: LEFT look, RIGHT movement/);
  assert.match(engine,/museumCameraMotion/);
  assert.match(engine,/addPhysicalGalleryV3/);
  assert.match(engine,/addBakedEntranceV4/);
  assert.match(file('baked-architecture-v4.js'),/cycles-baked-v4/);
  assert.match(file('baked-architecture-v4.js'),/v3-fallback/);
  assert.match(engine,/physical-v3/);
});
test('cloud mode remains disabled until an approved backend is configured',()=>{
  assert.match(file('cloud-config.js'),/enabled:\s*false/);
  assert.match(file('museum-cloud.js'),/endpoint.searchParams.set\('status','eq.published'\)/);
});

test('verified V4 Cycles GLB is embedded, size-bounded and identical to its Blender manifest',()=>{
  const manifest=JSON.parse(file('assets/entrance-v4-manifest.json'));
  const binary=readFileSync(join(root,'assets/entrance-v4-baked.glb'));
  assert.equal(binary.toString('ascii',0,4),'glTF');
  assert.equal(binary.readUInt32LE(4),2);
  assert.equal(binary.readUInt32LE(8),binary.byteLength);
  assert.ok(binary.byteLength>=10000&&binary.byteLength<=25000000);
  assert.equal(createHash('sha256').update(binary).digest('hex'),manifest.sha256);
  const jsonLen=binary.readUInt32LE(12);
  assert.equal(binary.toString('ascii',16,20),'JSON');
  const gltf=JSON.parse(binary.toString('utf8',20,20+jsonLen));
  assert.equal(gltf.asset.version,'2.0');
  assert.ok(gltf.meshes.length>=1);
  assert.ok(gltf.images.some(img=>img.bufferView!==undefined),'Baked UV light texture must be embedded');
  assert.ok(gltf.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),'Baked texture must be bound to the scene');
  assert.ok(manifest.primitives>=1&&manifest.primitives<=12);
  // Acceptance: the entrance must include the forward visible second threshold,
  // not just the hidden high lintel from the first V4 bake.
  assert.ok(manifest.vertices>=17000&&manifest.vertices<250000);
  assert.deepEqual(manifest.texture_size,[1024,1024]);
  assert.ok(readFileSync(join(root,'assets/entrance-v4-lightbake.png')).byteLength>20000);
});


test('V11 lighting preserves real limestone geometry and avoids painted fake grout',()=>{
  const materials=file('luxury-v8.js');
  const slabs=file('physical-gallery-v3.js');
  const scanned=file('pbr-scanned.js');
  const engine=file('engine3d.js');
  const loader=file('engine-loader.js');
  assert.match(materials,/roughnessMap:stone\.roughness/);
  assert.match(materials,/const value=235\+grain\*\.85/);
  assert.doesNotMatch(materials,/joint\?216|yy<1\.1|xx%slab<1\.1/,
    'Tile joints must be modeled physically, never painted inside the albedo');
  assert.match(slabs,/new THREE\.InstancedMesh\(geometry,stone,slabs\.length\)/);
  assert.match(slabs,/stone\.roughness=\.83/);
  assert.match(scanned,/const floorUpgraded=Boolean\(floorNormal\|\|floorRough\)/);
  assert.doesNotMatch(scanned,/marble_01","diff"/,
    'Avoid swapping honed limestone albedo for dark scanned marble');
  assert.match(engine,/renderer\.toneMappingExposure = \.91/);
  assert.match(loader,/engine3d\.js\?v=20261109dualstick3baketimeout/);
  assert.match(file('index.html'),/engine-loader\.js\?v=20261109dualstick3baketimeout/);
});
