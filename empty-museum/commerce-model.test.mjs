import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMMERCE_CONFIG,WALL_FORMATS,AISLE_DURATIONS,DISTANCE_LEVELS,
  normalizeCommerceConfig,makeWallSlots,wallPrice,aislePrice,
  createPreviewReservation,canReserveWall,canReserveAisle,isActive,aisleVisibility
} from './commerce-model.mjs';

const config=normalizeCommerceConfig(DEFAULT_COMMERCE_CONFIG);
const start=Date.UTC(2026,10,9,12,0,0);
test('Chaque découpage couvre 16 cellules exactement et sans chevauchement',()=>{
  for(const format of WALL_FORMATS){
    const slots=makeWallSlots(config,1,format.id);
    assert.equal(slots.length,format.count);
    const occupied=slots.flatMap(slot=>slot.leaves);
    assert.equal(occupied.length,16);
    assert.equal(new Set(occupied).size,16);
    assert.ok(slots.every(s=>s.xM>=0&&s.yM>=0&&s.xM+s.widthM<=3&&s.yM+s.heightM<=config.wall.exhibitHeightM));
  }
});
test('Les modules conservent exactement 3 m',()=>{
  assert.equal(config.wall.moduleLengthM,3);
  assert.throws(()=>normalizeCommerceConfig({...config,wall:{...config.wall,moduleLengthM:4}}));
});
test('Tarifs muraux mensuels et annuels distincts',()=>{
  assert.equal(wallPrice(config,'very_large','monthly').amount,59.5);
  assert.equal(wallPrice(config,'small','annual').amount,45);
  assert.throws(()=>wallPrice(config,'small','daily'));
});
test('Interdit la double réservation et la conversion de format d’un module occupé',()=>{
  const r=createPreviewReservation({config,reservations:[],type:'wall',moduleNumber:1,formatId:'normal',slotId:'M001-normal-1',term:'monthly'},start);
  assert.equal(canReserveWall([r],1,r.slotId,start).ok,false);
  assert.equal(canReserveWall([r],1,'M001-large-1',start).ok,false);
  assert.equal(canReserveWall([r],1,'M001-normal-2',start).ok,true);
  assert.throws(()=>createPreviewReservation({config,reservations:[r],type:'wall',moduleNumber:1,formatId:'normal',slotId:r.slotId,term:'monthly'},start));
  assert.equal(canReserveWall([r],1,r.slotId,Date.parse(r.endsAt)).ok,true);
});
test('L’abonnement mensuel au 31 janvier finit le dernier jour de février',()=>{
  const jan31=Date.UTC(2027,0,31,12,0,0);
  const r=createPreviewReservation({config,reservations:[],type:'wall',moduleNumber:1,formatId:'small',slotId:'M001-small-1',term:'monthly'},jan31);
  assert.equal(r.endsAt,'2027-02-28T12:00:00.000Z');
});
test('Offres 3D premium : distances et durées autorisées',()=>{
  for(const level of DISTANCE_LEVELS)for(const duration of AISLE_DURATIONS){
    const p=aislePrice(config,level.id,duration.days);
    assert.equal(p.days,duration.days);
    assert.equal(p.maxVisibleDistanceM,level.meters);
    assert.ok(p.amount>=0);
  }
  assert.throws(()=>aislePrice(config,'landmark',365));
});
test('Installation 3D : station exclusive et date d’expiration',()=>{
  const r=createPreviewReservation({config,reservations:[],type:'aisle',stationId:'S01',objectType:'sculpture',distanceId:'landmark',days:7},start);
  assert.equal(r.amount,2495);
  assert.equal(canReserveAisle([r],'S01',start).ok,false);
  assert.equal(canReserveAisle([r],'S02',start).ok,true);
  assert.equal(isActive(r,start),true);
  assert.equal(isActive(r,Date.parse(r.endsAt)),false);
  assert.equal(canReserveAisle([r],'S01',Date.parse(r.endsAt)).ok,true);
});
test('Import invalide rejeté et limites géométriques protégées',()=>{
  assert.throws(()=>normalizeCommerceConfig({schemaVersion:9,wall:config.wall,aisle:config.aisle}));
  assert.throws(()=>normalizeCommerceConfig({...config,wall:{...config.wall,marginM:0.5,gapM:0.12,exhibitHeightM:1.2}}));
  assert.throws(()=>makeWallSlots(config,0,'small'));
});

test('La distance de visibilité est configurable et figée à la réservation',()=>{
  const r=createPreviewReservation({config,reservations:[],type:'aisle',stationId:'S02',objectType:'sculpture',distanceId:'landmark',days:7},start);
  assert.equal(r.maxVisibleDistanceM,75);
  assert.equal(aisleVisibility(config,r,15,start).alpha,1);
  assert.equal(aisleVisibility(config,r,74,start).visible,true);
  assert.equal(aisleVisibility(config,r,75,start).visible,false);
  const changed=normalizeCommerceConfig({...config,aisle:{...config.aisle,distanceMetres:{near:10,gallery:25,landmark:100}}});
  assert.equal(aislePrice(changed,'landmark',7).maxVisibleDistanceM,100);
  assert.equal(aisleVisibility(changed,r,85,start).visible,false);
  assert.equal(aisleVisibility(config,r,10,Date.parse(r.endsAt)).visible,false);
  assert.throws(()=>normalizeCommerceConfig({...config,aisle:{...config.aisle,distanceMetres:{near:50,gallery:25,landmark:100}}}));
});

test('Le catalogue divisé par deux et les quatre stations 3D sont cohérents',()=>{
  assert.equal(config.aisle.stations.length,4);
  assert.deepEqual(config.aisle.stations,['S01','S02','S03','S04']);
  assert.equal(config.aisle.footprintWidthM,1.5);
  assert.equal(config.aisle.footprintLengthM,1.8);
  assert.equal(config.aisle.maxHeightM,2.5);
  assert.equal(aislePrice(config,'near',1).amount,145);
  assert.equal(aislePrice(config,'near',7).amount,645);
  assert.equal(aislePrice(config,'near',30).amount,1995);
  assert.equal(aislePrice(config,'gallery',1).amount,295);
  assert.equal(aislePrice(config,'gallery',7).amount,1245);
  assert.equal(aislePrice(config,'gallery',30).amount,3995);
  assert.equal(aislePrice(config,'landmark',1).amount,495);
  assert.equal(aislePrice(config,'landmark',30).amount,7950);
  assert.throws(()=>createPreviewReservation({config,reservations:[],type:'aisle',stationId:'S05',objectType:'sculpture',distanceId:'near',days:1},start));
});
