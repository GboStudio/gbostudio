import assert from 'node:assert/strict';
import {planExhibitionStops,routeNextIndex,routeResumeIndex,approachDuration,smoothstep} from '../../empty-museum/tour-journey.js';
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
assert.equal(routeResumeIndex(stops,0),0,'Start a new tour from the entrance');
assert.equal(routeResumeIndex(stops,stops[1].cameraZ),1,'Resuming at an artwork keeps that exact artwork');
assert.equal(routeResumeIndex(stops,stops[1].cameraZ+2.2),1,'Resume the nearest work, not automatically the next work');
assert.equal(routeResumeIndex(stops,stops.at(-1).cameraZ+15),3,'After the last work, do not jump back to the museum entrance');
const between=(stops[0].z+stops[1].z)/2;
assert.equal(routeResumeIndex(stops,between,{currentX:-3}),0,'Nearest left artwork wins at a shared depth');
assert.equal(routeResumeIndex(stops,between,{currentX:3}),1,'Nearest right artwork wins at a shared depth');
assert.equal(routeResumeIndex(stops,58,{currentX:1.45}),3,'Nearby floor sculpture wins over a farther wall frame');
assert.equal(routeResumeIndex([],50),-1,'A museum without works has no valid stop');

assert.ok(stops.every(s=>Math.abs(s.cameraX)<3.5));
assert.ok(stops[0].cameraZ<stops[0].z);
assert.ok(approachDuration(100,false)<=3.15);
assert.equal(smoothstep(0),0);
assert.equal(smoothstep(1),1);
console.log('PASS museum guide: occupied pieces, no empty bays, left/right wall, floor, wrap, nearest-artwork resume across room sides and camera targets');
