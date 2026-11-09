import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync('empty-museum/app.js','utf8');
const commerce=readFileSync('empty-museum/commerce-admin.mjs','utf8');
const source=app.match(/function safeStoredPiece\(item\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(source,'safeStoredPiece normalization is required');
const safeStoredPiece=runInNewContext(source+'\nsafeStoredPiece');

test('untrusted local artwork IDs cannot inject HTML',()=>{
  assert.equal(safeStoredPiece({id:'19"><img src=x onerror=alert(1)>',size:'standard'}),null);
  assert.equal(safeStoredPiece({id:1}),null);
  assert.equal(safeStoredPiece({id:19.5}),null);
});

test('untrusted artwork image CSS, slot and size are rejected',()=>{
  const item=safeStoredPiece({
    id:19,slot:'<img onerror=alert(1)>',size:'x" onmouseover="alert(1)',
    category:'<script>',image:'url(https://tracker.example.net/pixel)',
    title:'<img src=x onerror=alert(1)>'
  });
  assert.equal(item.slot,null);
  assert.equal(item.size,'standard');
  assert.equal(item.category,'image');
  assert.equal(item.image,'');
  assert.equal(item.title,'<img src=x onerror=alert(1)>');
});

test('known local artwork formats still work',()=>{
  const item=safeStoredPiece({id:25,slot:'S01',size:'floor',category:'3d',image:'data:image/png;base64,AA=='});
  assert.equal(item.id,25);
  assert.equal(item.slot,'S01');
  assert.equal(item.size,'floor');
  assert.equal(item.image,'data:image/png;base64,AA==');
});

test('commerce reservations render with DOM text nodes, never untrusted HTML',()=>{
  const render=commerce.match(/function renderManagement\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(render,'reservation render method exists');
  assert.match(render,/\.textContent\s*=/);
  assert.match(render,/\.replaceChildren\(/);
  assert.doesNotMatch(render,/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/);
});

test('main exhibit image uploads are raster-only and size-bounded',()=>{
  assert.match(app,/\['image\/jpeg','image\/png','image\/webp'\]\.includes\(f\.type\)/);
  assert.match(app,/f\.size>15\*1024\*1024/);
});

test('public Supabase schema retains published-only SELECT and no public writes',()=>{
  const schema=readFileSync('empty-museum/supabase/schema.sql','utf8');
  assert.match(schema,/enable row level security/i);
  assert.match(schema,/status='published' and published_at<=now\(\)/);
  assert.doesNotMatch(schema,/grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.museum_artworks\s+to\s+(?:anon|authenticated)/i);
});
