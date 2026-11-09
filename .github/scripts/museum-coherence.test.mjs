import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditStaticReferences,findStaticReferences,resolveLocalReference} from './museum-coherence-lib.mjs';

test('HTML references capture required files, not ordinary links',()=>{
  const html='<link rel="stylesheet" href="./visual.css?v=2"><img src="assets/room.png"><a href="/legal">Terms</a><script src="./main.js"></script>';
  assert.deepEqual(findStaticReferences(html,'html'),['./visual.css?v=2','assets/room.png','./main.js']);
});

test('ES modules, dynamic imports and runtime styles are audited',()=>{
  const code="import {foo} from './foo.js?v=1';\nawait import('./bar.js?x=2');\nstyle.href='./ui.css?v=3';\nscript.src='fallback.js?rev=4';\nimport {External} from 'three';";
  assert.deepEqual(findStaticReferences(code,'js'),['./foo.js?v=1','./bar.js?x=2','./ui.css?v=3','fallback.js?rev=4']);
});

test('local references resolve within repo while external URLs are ignored',()=>{
  assert.equal(resolveLocalReference('empty-museum/engine3d.js','./floor.js?x=1'),'empty-museum/floor.js');
  assert.equal(resolveLocalReference('empty-museum/index.html','/privacy.html'),null);
  assert.equal(resolveLocalReference('empty-museum/index.html','https://cdn.example/test.js'),null);
  assert.throws(()=>resolveLocalReference('empty-museum/index.html','../../outside.js'),/escapes repository/);
});

test('known-valid fixture passes',()=>{
  const known=new Set(['empty-museum/app.js','empty-museum/styles.css']);
  const html='<script src="./app.js?v=1"></script><link rel="stylesheet" href="styles.css">';
  assert.deepEqual(auditStaticReferences('empty-museum/index.html',html,p=>known.has(p)),[]);
});

test('a missing primary engine fails rather than silently passing',()=>{
  const html='<script src="./missing-engine.js?v=2026"></script>';
  assert.match(auditStaticReferences('empty-museum/index.html',html,()=>false)[0],/missing-engine\.js/);
});

test('path traversal fails closed',()=>{
  assert.match(auditStaticReferences('empty-museum/engine-loader.js','import "../../leak.js";',()=>true)[0],/escapes repository/);
});
