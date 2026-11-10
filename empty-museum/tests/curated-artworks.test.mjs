import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {planExhibitionStops} from '../tour-journey.js';

/* Five curated demo works chosen by Guillaume (Nov. 2026): exact images,
   exact cartel texts, 3:4 frames, never on partner bays, never cut by
   the architecture, and "Le Premier Spectateur" first on the visitor path. */
const require=createRequire(import.meta.url);
const mix=require('../gallery-mix.js');
const app=readFileSync('empty-museum/app.js','utf8');
const baseSource=app.match(/const base=\[[\s\S]*?\}\];/)?.[0];
assert.ok(baseSource,'demo collection `base` must stay a literal array');
const base=runInNewContext(baseSource+'\nbase');
const curated=base.filter(p=>p.curated);

const EXPECTED=[
  ['Le Premier Spectateur','le-premier-spectateur','Toute création mérite son public. Parfois, un seul regard suffit à en faire un chef-d’œuvre.'],
  ['Le Dernier Bal','le-dernier-bal','Dans un monde qui s’efface, l’amour qui dure finit par rallumer les autres.'],
  ['Le Gamin de 1987','le-gamin-de-1987','On nous montre l’adulte qu’on devrait devenir. Lui, il a choisi de rester heureux.'],
  ['Kintsugi','kintsugi','On ne répare pas un cœur pour cacher ses fêlures, mais pour en faire de l’or.'],
  ['Lundi, 8h12','lundi-8h12','Les héros sont partout. Il suffit de ne pas encore avoir perdu ses yeux d’enfant pour les voir.']
];

function jpegSize(buf){
  let i=2;
  while(i<buf.length){
    if(buf[i]!==0xff){i++;continue;}
    const marker=buf[i+1],len=buf.readUInt16BE(i+2);
    if(marker>=0xc0&&marker<=0xc3)return {height:buf.readUInt16BE(i+5),width:buf.readUInt16BE(i+7)};
    i+=2+len;
  }
  throw Error('No JPEG SOF marker');
}
function webpSize(buf){
  assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(buf.toString('ascii',8,12),'WEBP');
  const chunk=buf.toString('ascii',12,16);
  if(chunk==='VP8 ')return {width:buf.readUInt16LE(26)&0x3fff,height:buf.readUInt16LE(28)&0x3fff};
  if(chunk==='VP8L'){const b=buf.readUInt32LE(21);return {width:(b&0x3fff)+1,height:((b>>14)&0x3fff)+1};}
  if(chunk==='VP8X')return {width:1+buf.readUIntLE(24,3),height:1+buf.readUIntLE(27,3)};
  throw Error('Unknown WebP chunk '+chunk);
}

test('five curated works carry the exact titles and cartel texts, in path order',()=>{
  assert.equal(curated.length,5);
  const byPath=[...curated].sort((a,b)=>a.slot.localeCompare(b.slot));
  assert.deepEqual(byPath.map(p=>p.title),EXPECTED.map(e=>e[0]));
  for(const [title,slug,text] of EXPECTED){
    const p=curated.find(x=>x.title===title);
    assert.equal(p.description,text);
    assert.equal(p.imageAsset.webp,`assets/oeuvres/${slug}.webp`);
    assert.equal(p.imageAsset.jpg,`assets/oeuvres/${slug}.jpg`);
    assert.ok(p.id>=1&&p.id<=5,'curated works replace the first five displayed demo IDs');
    assert.equal(p.author,'','no author is credited until Guillaume confirms it');
  }
});

test('curated images are 3:4, mobile-weight WebP with JPG fallback',()=>{
  for(const p of curated){
    for(const [kind,read] of [['webp',webpSize],['jpg',jpegSize]]){
      const file='empty-museum/'+p.imageAsset[kind];
      const buf=readFileSync(file),{width,height}=read(buf);
      assert.ok(Math.abs(width/height-p.aspect)<.005,file+' is not 3:4 ('+width+'x'+height+')');
      assert.ok(height>=1000,file+' too small for a 2 m frame');
      assert.ok(statSync(file).size<(kind==='webp'?300:400)*1024,file+' too heavy for mobile');
    }
  }
});

test('curated works use portrait "large" frames outside partner bays and clear of the architecture',()=>{
  const scen=readFileSync('empty-museum/scenography.js','utf8');
  const pilasters=JSON.parse(scen.match(/for\(const z of (\[[\d.,]+\])\)\{\s*const g=new THREE\.Group\(\)/)[1]);
  const portals=[...scen.match(/const portals=\[(.*?)\];/)[1].matchAll(/z:([\d.]+)/g)].map(m=>Number(m[1]));
  const furniture=JSON.parse(scen.match(/Minimal rest plinths[^\n]*\n\s*for\(const \[i,z\] of (\[[\d.,]+\])\.entries\(\)\)/)[1]);
  assert.ok(pilasters.length>=4&&portals.length>=4&&furniture.length>=3,'architecture positions must be parsed from scenography.js');
  const cells=new Map(mix.allWallSlots().map(s=>[s.id,s]));
  for(const p of curated){
    const cell=cells.get(p.slot);
    assert.ok(cell,p.slot+' must be a real saleable frame');
    assert.ok(!mix.PARTNER_BAYS.includes(cell.parentBayId),'partner bays stay reserved');
    assert.equal(cell.formatId,'large');
    assert.ok(cell.heightM>cell.widthM/p.aspect,'3:4 work fits the cell without distortion, with room for its cartel');
    const side=cell.parentBayId%2?1:-1;
    const zc=5.7+cell.parentBayId*3.5+side*(cell.xM+cell.widthM/2-1.5);
    const z0=zc-cell.widthM/2-.02,z1=zc+cell.widthM/2+.02;
    for(const z of pilasters)assert.ok(z+.115<z0||z-.115>z1,p.slot+' is cut by the pilaster at z='+z);
    for(const z of portals)assert.ok(z+.6<z0||z-.6>z1,p.slot+' touches the portal at z='+z);
    // Rest benches (1.7 m long) and their globe floor lamps (z+2.3) stand in front of the walls.
    for(const [i,z] of furniture.entries()){
      if((i%2?1:-1)!==side)continue;
      assert.ok(z+.85+.6<z0||z-.85-.6>z1,p.slot+' is masked by the bench at z='+z);
      assert.ok(z+2.3+.9<z0||z+2.3-.9>z1,p.slot+' is masked by the floor lamp at z='+(z+2.3));
    }
    for(const s of mix.AISLE_STATIONS)
      if(Math.sign(s.x)===side)assert.ok(Math.abs(s.z-zc)>3,p.slot+' is hidden behind aisle station '+s.id);
  }
});

test('"Le Premier Spectateur" is the first stop of the guided tour',()=>{
  const slots=mix.allWallSlots().map(panel=>{
    const piece=base.slice(0,6).find(p=>p.slot===panel.id)||null;
    return {...panel,side:panel.parentBayId%2?1:-1,z:5.7+panel.parentBayId*3.5,
      y:.9+panel.yM+panel.heightM/2,isCommercial:true,piece};
  });
  // The one remaining legacy demo (Wrong Fruit, 6th of the displayed six) stays on bay 17, frame 1.
  const kept=base.find(p=>p.id===6);
  assert.equal(kept.title,'Wrong Fruit');
  slots.find(s=>s.parentBayId===17&&s.ordinal===1).piece=kept;
  const stops=planExhibitionStops(slots);
  assert.equal(stops[0].piece.title,'Le Premier Spectateur');
  const order=stops.filter(s=>s.piece.curated).map(s=>s.piece.title);
  assert.deepEqual(order,EXPECTED.map(e=>e[0]));
});
