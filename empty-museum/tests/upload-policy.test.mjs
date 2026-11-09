import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRasterHeader,validateRasterFile,validateRasterDimensions} from '../upload-policy.mjs';

function fakeFile(bytes,type){
 const blob=new Blob([Uint8Array.from(bytes)],{type});
 return blob;
}
test('raster signature recognition',()=>{
 assert.equal(inspectRasterHeader(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png');
 assert.equal(inspectRasterHeader(Uint8Array.from([255,216,255,1,2,3,4,5,6,7,8,9])),'image/jpeg');
 assert.equal(inspectRasterHeader(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])),'image/webp');
 assert.equal(inspectRasterHeader(Uint8Array.from([60,115,118,103,32,0,0,0,0,0,0,0])),null);
});
test('reject disguised SVG, false MIME, and unsupported formats',async()=>{
 await assert.rejects(validateRasterFile(fakeFile([60,115,118,103,32,0,0,0,0,0,0,0],'image/png')));
 await assert.rejects(validateRasterFile(fakeFile([137,80,78,71,13,10,26,10,0,0,0,0],'image/svg+xml')));
 await assert.rejects(validateRasterFile(fakeFile([255,216,255,0,0,0,0,0,0,0,0,0],'image/png')));
});
test('accept the three signed raster formats',async()=>{
 await validateRasterFile(fakeFile([137,80,78,71,13,10,26,10,0,0,0,0],'image/png'));
 await validateRasterFile(fakeFile([255,216,255,0,0,0,0,0,0,0,0,0],'image/jpeg'));
 await validateRasterFile(fakeFile([82,73,70,70,0,0,0,0,87,69,66,80],'image/webp'));
});
test('bound image dimensions before canvas allocation',()=>{
 assert.deepEqual(validateRasterDimensions(3000,3000),{width:3000,height:3000});
 assert.throws(()=>validateRasterDimensions(10000,10000));
 assert.throws(()=>validateRasterDimensions(14000,100));
 assert.throws(()=>validateRasterDimensions(NaN,900));
 assert.throws(()=>validateRasterDimensions(0,500));
});
