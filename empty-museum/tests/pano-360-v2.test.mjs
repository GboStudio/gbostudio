/* Run: node --test empty-museum/tests/pano-360-v2.test.mjs */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PANO_360_V2,pano360V2Sources} from '../pano-360-v2.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const file=name=>readFileSync(join(root,name),'utf8');

function jpegSize(bytes){
  let i=2;
  while(i<bytes.length-8){
    if(bytes[i]!==0xFF){i++;continue;}
    const marker=bytes[i+1];
    if(marker===0xC0||marker===0xC1||marker===0xC2){
      return {height:bytes.readUInt16BE(i+5),width:bytes.readUInt16BE(i+7)};
    }
    if(marker===0xD8||marker===0xD9){i+=2;continue;}
    i+=2+bytes.readUInt16BE(i+2);
  }
  throw new Error('JPEG size marker missing');
}

test('one boolean chooses the panorama and phones never receive the 6144 master',()=>{
  assert.equal(typeof PANO_360_V2.enabled,'boolean');
  assert.equal(PANO_360_V2.fullEdge,6144);
  assert.equal(PANO_360_V2.safeEdge,4096);
  assert.deepEqual(pano360V2Sources(8192,true),[PANO_360_V2.safeWebp,PANO_360_V2.safeJpeg]);
  assert.deepEqual(pano360V2Sources(16384,false),[PANO_360_V2.full]);
  assert.deepEqual(pano360V2Sources(6144,false),[PANO_360_V2.full]);
  assert.deepEqual(pano360V2Sources(4096,false),[PANO_360_V2.safeWebp,PANO_360_V2.safeJpeg]);
  assert.deepEqual(pano360V2Sources(0,false),[PANO_360_V2.safeWebp,PANO_360_V2.safeJpeg]);
});

test('served panorama files exist at the safe GPU size, with the 6144 master kept as-is',()=>{
  const full=readFileSync(join(root,'assets/pano/pano-360-ia-v2.jpg'));
  const safe=readFileSync(join(root,'assets/pano/pano-360-ia-v2-4096.jpg'));
  const webp=readFileSync(join(root,'assets/pano/pano-360-ia-v2-4096.webp'));
  assert.deepEqual(jpegSize(full),{width:6144,height:3072});
  assert.deepEqual(jpegSize(safe),{width:4096,height:2048});
  assert.equal(webp.subarray(0,4).toString(),'RIFF');
  assert.equal(webp.subarray(8,12).toString(),'WEBP');
  assert.ok(webp.byteLength>100000);
  assert.ok(existsSync(join(root,'pano-360-v2.js')));
});

test('the WebGL tour mounts the panorama and the progress bar no longer states a length in metres',()=>{
  const engine=file('engine3d.js');
  const walk=file('walk.js');
  const loader=file('engine-loader.js');
  assert.match(engine,/mountPano360V2/);
  assert.match(engine,/pano-360-v2\.js\?v=/);
  assert.match(loader,/engine3d\.js\?v=/);
  assert.match(loader,/walk\.js\?v=/);
  assert.doesNotMatch(engine,/Math\.floor\(LENGTH\)\+" M/);
  assert.match(engine,/CRÉATIONS · "\+frees\+" PLACES LIBRES/);
  assert.doesNotMatch(walk,/Math\.floor\(length\) \+ " M/);
  assert.match(walk,/PLACES LIBRES/);
  assert.match(engine,/addPhysicalGalleryV3/);
  assert.match(engine,/createMuseumV5Navigation/);
});
