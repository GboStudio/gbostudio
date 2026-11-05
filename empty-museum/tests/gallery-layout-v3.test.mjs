import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planLimestoneSlabs,wallIrradianceProfile,stoneSlabStats}
  from '../gallery-layout-v3.js';

test('museum-sized physical slabs cover the hall in a bounded instance budget',()=>{
  const slabs=planLimestoneSlabs({half:4.6,length:142});
  const stats=stoneSlabStats(slabs);
  assert.equal(stats.columns,4);
  assert.ok(stats.rows>=50&&stats.rows<=70);
  assert.equal(stats.count,stats.rows*stats.columns);
  assert.ok(slabs.every(s=>s.width>2&&s.depth>2));
  assert.ok(slabs.every(s=>s.x>-4.6&&s.x<4.6&&s.z>0&&s.z<142));
});
test('slab layout is deterministic and subtly non-uniform',()=>{
  const one=planLimestoneSlabs({half:4.6,length:142});
  const two=planLimestoneSlabs({half:4.6,length:142});
  assert.deepEqual(one,two);
  assert.ok(new Set(one.map(s=>s.tint)).size>10);
  assert.ok(one.every(s=>s.tint>=.96&&s.tint<=1.02));
});
test('stone joint widths remain feasible in narrow rooms',()=>{
  const stones=planLimestoneSlabs({half:2.4,length:8,columns:4,gap:.012});
  assert.ok(stones.length>0);
  assert.ok(stones.every(s=>s.width>0 && s.depth>0));
  assert.deepEqual(stoneSlabStats([]),{count:0,rows:0,columns:0});
});
test('precomputed wall occlusion has bounded shadow and natural light falloff',()=>{
  const centre=wallIrradianceProfile(.5,.55);
  const edge=wallIrradianceProfile(0,.55);
  const base=wallIrradianceProfile(.5,0);
  const crown=wallIrradianceProfile(.5,1);
  assert.ok(edge>centre && base>centre && crown>centre);
  for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){
    const v=wallIrradianceProfile(i/20,j/20);
    assert.ok(v>=0&&v<=.31);
  }
});
