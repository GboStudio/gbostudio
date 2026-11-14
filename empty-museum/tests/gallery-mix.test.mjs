import test from 'node:test';
import assert from 'node:assert/strict';
import mix from '../gallery-mix.js';
import {readFileSync} from 'node:fs';
import {DEFAULT_COMMERCE_CONFIG} from '../commerce-model.mjs';

test('34 modules sur 38, avec quatre partenaires réservés',()=>{
  assert.equal(mix.MODULE_COUNT,38);
  assert.deepEqual(mix.PARTNER_BAYS,[0,1,2,3]);
  assert.equal(mix.SEQUENCE.length,34);
  assert.deepEqual(mix.mix(),{very_large:8,large:12,normal:9,medium:4,small:1});
  for(let i=0;i<4;i++)assert.equal(mix.slotsForBay(i).length,0);
});
test('116 cadres uniques, contenus dans chacun des modules de 3 mètres',()=>{
  const slots=mix.allWallSlots();
  assert.equal(slots.length,116);
  assert.equal(new Set(slots.map(s=>s.id)).size,116);
  for(const slot of slots){
    assert.ok(slot.xM>=0 && slot.xM+slot.widthM<=3.00001);
    assert.ok(slot.yM>=0 && slot.yM+slot.heightM<=mix.EXHIBIT_HEIGHT_M+.00001);
    assert.ok(slot.widthM>0 && slot.heightM>0);
    assert.ok(slot.parentBayId>=4 && slot.parentBayId<38);
    assert.equal(slot.moduleNumber,slot.parentBayId+1);
  }
});
test('Aucune subdivision ne se superpose dans un module',()=>{
  for(let bay=4;bay<mix.MODULE_COUNT;bay++){
    const slots=mix.slotsForBay(bay);
    assert.equal(slots.length,mix.FORMATS[mix.formatForBay(bay)].count);
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
      const a=slots[i],b=slots[j];
      const overlapX=Math.min(a.xM+a.widthM,b.xM+b.widthM)-Math.max(a.xM,b.xM);
      const overlapY=Math.min(a.yM+a.heightM,b.yM+b.heightM)-Math.max(a.yM,b.yM);
      assert.ok(overlapX<=0 || overlapY<=0,'Deux cadres se chevauchent : '+a.id+', '+b.id);
    }
  }
});
test('Quatre socles premium, de 1,80 × 1,50 m et hauteur maximale 2,50 m',()=>{
  assert.equal(mix.AISLE_STATIONS.length,4);
  assert.equal(new Set(mix.AISLE_STATIONS.map(s=>s.id)).size,4);
  assert.equal(mix.AISLE_LENGTH_M,1.8);
  assert.equal(mix.AISLE_WIDTH_M,1.5);
  assert.equal(mix.AISLE_MAX_HEIGHT_M,2.5);
  assert.ok(mix.AISLE_STATIONS.every(s=>Math.abs(s.x)>=2 && s.z>0));
});
test('Tarifs muraux divisés par deux pour les cinq formats',()=>{
  assert.deepEqual(mix.PRICES,{
    very_large:{monthly:59.5,annual:595},large:{monthly:34.5,annual:345},
    normal:{monthly:19.5,annual:195},medium:{monthly:9.5,annual:95},small:{monthly:4.5,annual:45}
  });
});

test('Source unique des tarifs : le miroir mural de gallery-mix.js est identique à commerce-model.mjs',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(mix.PRICES)),JSON.parse(JSON.stringify(DEFAULT_COMMERCE_CONFIG.wall.pricing)));
});
test('Aucun ancien prix écrit en dur dans l’accueil et les moteurs 3D',()=>{
  for(const name of ['app.js','walk.js','engine3d.js']){
    const code=readFileSync(new URL('../'+name,import.meta.url),'utf8');
    assert.doesNotMatch(code,/\bprice\s*:\s*\d/,name+' : tarif numérique en dur');
    assert.doesNotMatch(code,/openExhibit\([^)]*,\s*\d/,name+' : tarif passé en dur à openExhibit');
    assert.doesNotMatch(code,/\d\s*€/,name+' : montant en euros écrit en dur');
  }
});
