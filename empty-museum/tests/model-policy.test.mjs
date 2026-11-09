import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectGLTF,validateSTLFile} from '../model-policy.mjs';
const basic={asset:{version:'2.0'},nodes:[{}],buffers:[{byteLength:1024}]};

test('valid basic local model structure',()=>assert.equal(inspectGLTF(basic),true));
test('reject network fetches, SVG/data abuse and oversized accessors',()=>{
 assert.throws(()=>inspectGLTF({...basic,images:[{uri:'https://evil.example/art.png'}]}));
 assert.throws(()=>inspectGLTF({...basic,images:[{uri:'data:image/svg+xml;base64,PHN2Zz4='}]}));
 assert.throws(()=>inspectGLTF({...basic,buffers:[{byteLength:999999999}]}));
 assert.throws(()=>inspectGLTF({...basic,accessors:[{count:2000000}]}));
 assert.throws(()=>inspectGLTF({...basic,bufferViews:[{buffer:0,byteLength:4096}]}));
});
test('reject cyclic node hierarchies and invalid references',()=>{
 assert.throws(()=>inspectGLTF({...basic,nodes:[{children:[0]}]}));
 assert.throws(()=>inspectGLTF({...basic,nodes:[{children:[1]}]}));
});
test('binary STL triangle count must match file and budget',async()=>{
 const bytes=new Uint8Array(84+50);
 const view=new DataView(bytes.buffer);view.setUint32(80,1,true);
 assert.equal(await validateSTLFile(new Blob([bytes])),'binary');
 view.setUint32(80,9999999,true);
 await assert.rejects(validateSTLFile(new Blob([bytes])));
});
