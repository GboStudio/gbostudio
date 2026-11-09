import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DEFAULT_COMMERCE_CONFIG,normalizeCommerceConfig} from './commerce-model.mjs';
import {planExhibitionStops} from './tour-journey.js';

const require=createRequire(import.meta.url);
const mix=require('./gallery-mix.js');
const config=normalizeCommerceConfig(DEFAULT_COMMERCE_CONFIG);
test('38 bays: 4 partners plus precisely 34 commercial modules, 116 individual frames',()=>{
  assert.equal(mix.MODULE_COUNT,38);
  assert.deepEqual(mix.PARTNER_BAYS,[0,1,2,3]);
  assert.deepEqual(mix.mix(),{very_large:8,large:12,normal:9,medium:4,small:1});
  assert.equal(mix.allWallSlots().length,116);
  assert.equal(config.wall.moduleLengthM,3);
  assert.equal(mix.WALL_LENGTH_M,3);
});
test('Every 3m wall module is subdivided into the correct non-overlapping rectangles',()=>{
  for(let bay=4;bay<38;bay++){
    const panels=mix.slotsForBay(bay),format=mix.FORMATS[mix.formatForBay(bay)];
    assert.equal(panels.length,format.count);
    assert.equal(new Set(panels.map(x=>x.id)).size,panels.length);
    for(const slot of panels){
      assert.ok(slot.widthM>0 && slot.heightM>0);
      assert.ok(slot.xM>=0 && slot.xM+slot.widthM<=3);
      assert.ok(slot.yM>=0 && slot.yM+slot.heightM<=2.4);
    }
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){
      const a=panels[i],b=panels[j];
      const overlapX=a.xM<b.xM+b.widthM-1e-6&&b.xM<a.xM+a.widthM-1e-6;
      const overlapY=a.yM<b.yM+b.heightM-1e-6&&b.yM<a.yM+a.heightM-1e-6;
      assert.ok(!overlapX||!overlapY,'Wall frame collision: '+a.id+' / '+b.id);
    }
  }
});
test('Partner bays have no commercial subslots',()=>{
  for(const bay of mix.PARTNER_BAYS)assert.deepEqual(mix.slotsForBay(bay),[]);
});
test('Exactly four 1.8 by 1.5m side stations leave a central passage',()=>{
  assert.equal(mix.AISLE_STATIONS.length,4);
  assert.deepEqual(config.aisle.stations,mix.AISLE_STATIONS.map(s=>s.id));
  assert.equal(mix.AISLE_WIDTH_M,1.5);
  assert.equal(mix.AISLE_LENGTH_M,1.8);
  assert.equal(mix.AISLE_MAX_HEIGHT_M,2.5);
  assert.ok(mix.AISLE_STATIONS.every(s=>Math.abs(s.x)-mix.AISLE_WIDTH_M/2>=1.4));
  assert.ok(mix.AISLE_STATIONS.every(s=>s.z>=10&&s.z<=135));
});
test('Modular frames are valid guided-tour stops without changing legacy numeric slots',()=>{
  const sub=mix.slotsForBay(4)[0];
  const piece={title:'A'};
  const converted={...sub,side:-1,z:5.7+sub.parentBayId*3.5,
    y:.9+sub.yM+sub.heightM/2,isCommercial:true,piece};
  const stops=planExhibitionStops([converted]);
  assert.equal(stops.length,1);
  assert.equal(stops[0].id,'wall-'+sub.id);
  assert.ok(Number.isFinite(stops[0].z));
  assert.equal(stops[0].focusY,converted.y);
  assert.equal(planExhibitionStops([{id:7,piece}]).length,1);
});
