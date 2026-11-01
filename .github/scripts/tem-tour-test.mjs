import assert from 'node:assert/strict';
import {planExhibitionStops,routeNextIndex,approachDuration,smoothstep} from '../../empty-museum/tour-journey.js';
const slots=[
{id:0,piece:{title:'Partner'},reservedForAds:true},
{id:2,piece:null,reservedForAds:false},
{id:4,piece:{title:'First',author:'A'},reservedForAds:false},
{id:5,piece:{title:'Second',author:'B'},reservedForAds:false},
{id:14,piece:{title:'Third',author:'C'},reservedForAds:false}
];
const stops=planExhibitionStops(slots,{floorSlots:[{id:'S01',piece:null,z:12,x:1},{id:'S03',piece:{title:'Sculpture'},z:58,x:1.45}]});
assert.equal(stops.length,4,'Should skip empty and advertising bays');
assert.deepEqual(stops.map(s=>s.piece.title),['First','Second','Third','Sculpture']);
assert.equal(stops[0].side,'GAUCHE');
assert.equal(stops[1].side,'DROITE');
assert.equal(routeNextIndex(stops,-1,0),0);
assert.equal(routeNextIndex(stops,0,0),1);
assert.equal(routeNextIndex(stops,stops.length-1,100),0);
assert.ok(stops.every(s=>Math.abs(s.cameraX)<3.5));
assert.ok(stops[0].cameraZ<stops[0].z);
assert.ok(approachDuration(100,false)<=3.15);
assert.equal(smoothstep(0),0);
assert.equal(smoothstep(1),1);
console.log('PASS museum guide: occupied pieces, no empty bays, left/right wall, floor, wrap and camera targets');
