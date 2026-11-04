/* THE UNREAL MUSEUM · V3 — museum-first immersive visitor.
   The gallery mirrors the local demo's 38 initial wall bays, five floor stations
   and ceiling-unlock rule. It remains a LOCAL DEMONSTRATION, not a public backend. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js';
import {getPublishedArtworks} from './museum-cloud.js?v=20261103';
if(window.__TEM_GALLERY_FALLBACK_STARTED||window.__TEM_GALLERY_FALLBACK_REQUESTED) throw Error('Gallery fallback already requested');
const $=s=>document.querySelector(s), clamp=THREE.MathUtils.clamp;
const presets=[
  ['After the Rain','Maya','image','ChatGPT + génération d’image','Une image gardée parce qu’elle ressemble à un souvenir.',0,4],
  ['Chair 04','Niko','3d','ChatGPT + Blender','Une chaise née de contraintes d’impression 3D et de bois cintré.',1,5],
  ['Nocturne','Léa','words','ChatGPT','Nous étions encore là quand les lumières ont décidé de partir.',2,8],
  ['Ocean Interface','Sami','design','ChatGPT + Figma','Une interface inspirée des cartes marines.',3,11],
  ['Fold Lamp','Ana','build','ChatGPT + Fusion 360','Une lampe réellement fabriquée après plusieurs itérations.',4,14],
  ['Wrong Fruit','Pablo','weird','ChatGPT + génération d’image','Une expérience visuelle étrange et joyeuse.',5,17]
];
const wallWorks=new Map(), floorWorks=[], ceilingWorks=[];
const cloudSnapshot=await getPublishedArtworks({timeoutMs:2900});
for(let i=0;i<presets.length;i++){
  const p=presets[i];wallWorks.set(p[6],{id:i+1,title:p[0],author:p[1]+' · Démo',category:p[2],tools:p[3],description:p[4],theme:p[5],slot:p[6],demo:true});
}
try{
  const data=JSON.parse(localStorage.getItem('tem-demo')||'[]');
  if(Array.isArray(data))for(const p of data.slice(0,75)){
    if(!p||!Number.isFinite(Number(p.id)))continue;
    const w={id:Number(p.id),title:String(p.title||'Sans titre').slice(0,100),author:String(p.author||'Anonyme').slice(0,80),
      category:String(p.category||'image').slice(0,30),tools:String(p.tools||'Création personnelle').slice(0,100),
      description:String(p.description||p.words||'Une création exposée dans The Unreal Museum.').slice(0,650),
      image:/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(p.image||'')?p.image:null,
      words:String(p.words||'').slice(0,300),theme:Number(p.id)%8,demo:false,slot:p.slot};
    if(typeof p.slot==='string'&&/^S\d+$/i.test(p.slot))floorWorks.push(w);
    else if(typeof p.slot==='string'&&/^P\d+$/i.test(p.slot))ceilingWorks.push(w);
    else{
      let n=Number(p.slot);
      if(!Number.isInteger(n)||n<4||n>250||wallWorks.has(n)){
        n=4;while(wallWorks.has(n))n++;
      }
      w.slot=n;wallWorks.set(n,w);
    }
  }
}catch(e){console.warn('[TEM] Lecture des œuvres locales impossible',e);}
/* Shared exhibition is read-only. Approved records replace demo/local
   records at identical slots; moderation and purchases are NOT browser tasks. */
for(const w of cloudSnapshot.artworks){
  const item={id:w.id,slot:w.slot,title:w.title,author:w.author,
    category:w.category,description:w.description,tools:w.tools,
    image:w.image,modelUrl:w.modelUrl,theme:w.theme,public:true,demo:false};
  if(typeof w.slot==='number') wallWorks.set(w.slot,item);
  else if(String(w.slot).startsWith('S')){
    const index=floorWorks.findIndex(v=>v.slot===w.slot);
    if(index>=0)floorWorks.splice(index,1);floorWorks.push(item);
  }else if(String(w.slot).startsWith('P')){
    const index=ceilingWorks.findIndex(v=>v.slot===w.slot);
    if(index>=0)ceilingWorks.splice(index,1);ceilingWorks.push(item);
  }
}
const COUNT=Math.max(38,Math.min(160,Math.max(...wallWorks.keys())+5));
const LENGTH=9+COUNT*3.5, END=-LENGTH, MAXZ=6.1, HALF=4.6, HEIGHT=4.5;
const initialOccupied=Array.from(wallWorks.keys()).filter(n=>n<38&&n>=4).length,ceilingUnlocked=initialOccupied>=34;
const savedKey='tem-v4-visit';let saved={};try{saved=JSON.parse(localStorage.getItem(savedKey)||'{}')||{}}catch(e){}
const mobile=matchMedia('(max-width: 760px)').matches,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const st={index:Math.max(0,Number(saved.index)||0),mode:saved.mode==='free'?'free':'guided',quality:saved.quality==='eco'?'eco':'hd',
  mood:saved.mood==='evening'?'evening':'day',playing:false,detail:false,entered:false,timer:0,
  yaw:Number(saved.yaw)||0,pitch:Number(saved.pitch)||0,drag:null,moved:false,lastSaved:0};
let scene,renderer,camera,clock,raycaster,raypoint,ambient,sun,fillLight,roofMaterial,floorMat,raf;
const works=[],clickables=[],keyset=new Set(),wholeWalls=[],obstacles=[];
let wallWashTexture=null,shadowTexture=null;
const wallSectionCandidates=[];
for(let base=6;base+5<COUNT;base+=6){
  for(const side of [-1,1]){
    const slots=side<0?[base,base+2,base+4]:[base+1,base+3,base+5];
    if(slots.every(n=>n>=4&&!wallWorks.has(n)))wallSectionCandidates.push({base,side,slots});
  }
}
let activeWall=null, gltfLoaderModule=null;const desired=new THREE.Vector3(0,1.72,3.8),desiredRotation=new THREE.Quaternion(),lookCam=new THREE.PerspectiveCamera();
const SWATCH=[['#29404a','#e4b5a5','#f7dec9'],['#cbbfa8','#635b4b','#efe8d8'],['#262532','#9b8998','#e9ddd5'],
  ['#0d3440','#6cb1bb','#cfe9e3'],['#272e23','#bcaa80','#f2daa2'],['#eed6c3','#ef8358','#69977c'],
  ['#1c3038','#91a5aa','#dae0d3'],['#bba99d','#73877d','#e9d2c6']];
function material(color,r=.85,metal=0){return new THREE.MeshStandardMaterial({color,roughness:r,metalness:metal});}
function box(parent,w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
function labelTexture(title,sub,dark=false){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
 x.fillStyle=dark?'#28302d':'#ebe6dc';x.fillRect(0,0,512,128);x.fillStyle=dark?'#eee8d6':'#33352f';x.font='bold 27px Arial';
 x.fillText(String(title).toUpperCase().slice(0,30),24,51,460);x.font='18px Arial';x.fillStyle=dark?'#c2bea9':'#7b786f';x.fillText(String(sub).slice(0,46),24,93,462);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function artworkTexture(w){const c=document.createElement('canvas');c.width=512;c.height=576;const x=c.getContext('2d'),p=SWATCH[(w.theme||0)%SWATCH.length];
 const g=x.createLinearGradient(0,0,512,576);g.addColorStop(0,p[0]);g.addColorStop(.67,p[1]);g.addColorStop(1,p[2]);x.fillStyle=g;x.fillRect(0,0,512,576);
 if(w.category==='words'){
   x.fillStyle='#f4efe5';x.fillRect(31,32,450,512);x.fillStyle='#292824';x.font='italic 38px Georgia';x.textAlign='center';
   const words=(w.words||w.description||w.title).split(/\s+/);let lines=[''];for(const word of words){const last=lines.length-1;
   if(x.measureText(lines[last]+' '+word).width>395&&lines[last])lines.push(word);else lines[last]+=(lines[last]?' ':'')+word;}
   lines.slice(0,5).forEach((l,i)=>x.fillText(l,256,260+(i-(Math.min(lines.length,5)-1)/2)*50,400));
 }else if((w.theme||0)%8===3){x.strokeStyle='#d6efdfaa';for(let i=0;i<23;i++){x.beginPath();x.ellipse(255,290,30+i*11,40+i*13,i*.17,0,7);x.stroke();}}
 else if((w.theme||0)%8===5){x.fillStyle='#f08455';x.beginPath();x.ellipse(255,300,147,185,-.3,0,7);x.fill();x.fillStyle='#609477';x.beginPath();x.ellipse(328,145,77,39,-.6,0,7);x.fill();}
 else if((w.theme||0)%8===4){const glow=x.createRadialGradient(270,245,10,270,245,230);glow.addColorStop(0,'#fff4bf');glow.addColorStop(.35,'#f1c28f');glow.addColorStop(1,'#f1c28f00');x.fillStyle=glow;x.fillRect(0,0,512,576);x.fillStyle='#5e574e';x.fillRect(250,340,18,170);x.fillRect(196,508,122,10);}
 else if((w.theme||0)%8===6){for(let j=0;j<9;j++){x.fillStyle=j%2?'#e0dfd0':'#7d999b';x.beginPath();const X=j*72-55;x.moveTo(X,576);x.lineTo(X+28,133+j%3*42);x.lineTo(X+70,111+j%4*42);x.lineTo(X+135,576);x.fill();}}
 else for(let i=0;i<8;i++){x.save();x.translate(256,270);x.rotate(i*Math.PI/4);x.strokeStyle=i%2?p[2]:p[0];x.globalAlpha=.73;x.lineWidth=11+i;x.beginPath();x.ellipse(0,-25,75+i*9,160-i*7,.2,0,7);x.stroke();x.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
 if(w.image){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{x.fillStyle='#edeae2';x.fillRect(0,0,512,576);const scale=Math.min(512/img.width,576/img.height);const sw=img.width*scale,sh=img.height*scale;x.drawImage(img,(512-sw)/2,(576-sh)/2,sw,sh);t.needsUpdate=true;};img.onerror=()=>console.warn('[TUM] Artwork image unavailable',w.title);img.src=w.image;}
 return {texture:t,canvas:c};}
function floorTexture(){const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');x.fillStyle='#cecac0';x.fillRect(0,0,512,512);
 for(let i=0;i<180;i++){x.strokeStyle=i%3?'#a7a29728':'#f6f4ed66';x.lineWidth=.5+i%3*.2;x.beginPath();const y=(i*53)%512;x.moveTo(-20,y);x.bezierCurveTo(180,y+(i%7-3)*8,350,y-(i%5)*7,535,y+(i%3)*3);x.stroke();}
 for(let i=0;i<3;i++){x.strokeStyle='#aba59988';x.lineWidth=1;x.strokeRect(i*171,0,171,512);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2.7,LENGTH/12);return tex;}

function seededTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=256;
 const ctx=c.getContext('2d'),data=ctx.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const n=((x*73856093)^(y*19349663))>>>0,v=237+n%13-6,k=(y*256+x)*4;
  data.data[k]=Math.min(255,v+3);data.data[k+1]=v;data.data[k+2]=Math.max(0,v-3);data.data[k+3]=255;
 }
 ctx.putImageData(data,0,0);const t=new THREE.CanvasTexture(c);
 t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,LENGTH/22);return t;
}
function lightTextures(){
 const c=document.createElement('canvas');c.width=256;c.height=512;
 const g=c.getContext('2d'),rad=g.createRadialGradient(128,100,4,128,210,245);
 rad.addColorStop(0,'rgba(255,251,229,.47)');rad.addColorStop(.3,'rgba(255,245,222,.25)');
 rad.addColorStop(1,'rgba(255,248,232,0)');g.fillStyle=rad;g.fillRect(0,0,256,512);
 wallWashTexture=new THREE.CanvasTexture(c);
 const sh=document.createElement('canvas');sh.width=128;sh.height=128;
 const x=sh.getContext('2d'),shade=x.createRadialGradient(64,64,0,64,64,64);
 shade.addColorStop(0,'rgba(31,31,29,.45)');shade.addColorStop(.55,'rgba(31,31,29,.15)');shade.addColorStop(1,'rgba(31,31,29,0)');
 x.fillStyle=shade;x.fillRect(0,0,128,128);shadowTexture=new THREE.CanvasTexture(sh);
}
function shadowAt(x,z,size=1.2){
 if(!shadowTexture)return;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(size*2.2,size*2.2),
   new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.65,depthWrite:false}));
 m.rotation.x=-Math.PI/2;m.position.set(x,.019,z);scene.add(m);
}
function blocking(x,z){return obstacles.some(o=>{
 const dx=x-o.x,dz=z-o.z,r=o.r+.36;return dx*dx+dz*dz<r*r;
});}
function foyer(){
 const brass=material(0xa18b6a,.29,.57),marble=material(0xe7e2da,.66);
 box(scene,1.2,.32,1.2,marble,0,.16,.1);
 box(scene,1.25,.045,1.25,brass,0,.345,.1);
 const pts=[];for(let i=0;i<=160;i++){
   const t=i/160,r=.13+.42*Math.sin(Math.PI*t),a=t*Math.PI*4.8;
   pts.push(new THREE.Vector3(Math.cos(a)*r,t*2.22,Math.sin(a)*r));
 }
 const sculpture=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),240,.057,10,false),brass);
 sculpture.position.set(0,.35,.1);scene.add(sculpture);
 const gem=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,2),
  new THREE.MeshPhysicalMaterial({color:0xc0d9d7,metalness:.12,roughness:.15,transparent:true,opacity:.83}));
 gem.position.set(0,1.5,.1);scene.add(gem);
 const skylight=new THREE.Mesh(new THREE.CircleGeometry(1.55,60),
   new THREE.MeshBasicMaterial({color:0xfff9e9,side:THREE.DoubleSide}));
 skylight.rotation.x=-Math.PI/2;skylight.position.set(0,HEIGHT-.025,1.45);scene.add(skylight);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.60,.058,12,64),brass);
 ring.rotation.x=Math.PI/2;ring.position.set(0,HEIGHT-.017,1.45);scene.add(ring);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.55),
   new THREE.MeshBasicMaterial({map:labelTexture('THE UNREAL MUSEUM','UNE GALERIE POUR L’IMAGINAIRE'),side:THREE.DoubleSide}));
 sign.position.set(0,2.8,MAXZ-.13);sign.rotation.y=Math.PI;scene.add(sign);
 obstacles.push({x:0,z:.1,r:.85});shadowAt(0,.1,1.25);
}

function architecture(){const walls=material(0xffffff,.97),plaster=material(0xe8e6e0,.97),trim=material(0xa39178,.4,.4),dark=material(0x373b39,.46,.35);
 walls.map=seededTexture();walls.needsUpdate=true;lightTextures();
 floorMat=material(0xffffff,.82);floorMat.map=floorTexture();
 const mid=(MAXZ+END)/2,len=MAXZ-END;
 box(scene,HALF*2,.18,len,floorMat,0,-.09,mid);box(scene,HALF*2,.22,len,plaster,0,HEIGHT+.1,mid);
 for(const side of [-1,1]){box(scene,.22,HEIGHT,len,walls,side*HALF,HEIGHT/2,mid);box(scene,.11,.18,len,trim,side*(HALF-.13),.11,mid);box(scene,.075,.1,len,trim,side*(HALF-.12),HEIGHT-.12,mid);}
 box(scene,HALF*2,HEIGHT,.23,walls,0,HEIGHT/2,END);box(scene,HALF*2,HEIGHT,.2,walls,0,HEIGHT/2,MAXZ);
 // Architectural portals rhythmically divide the long space into intimate rooms.
 const portals=Math.ceil(COUNT/6);
 for(let section=1;section<portals;section++){
   const z=-(6+section*6*3.5);
   for(const side of [-1,1]){box(scene,.36,HEIGHT-.28,.62,plaster,side*(HALF-.31),2.1,z);box(scene,.055,HEIGHT-.2,.65,trim,side*(HALF-.55),2.1,z);}
   box(scene,HALF*2-.7,.26,.64,plaster,0,HEIGHT-.25,z);
   const placard=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.36),new THREE.MeshBasicMaterial({map:labelTexture('GALERIE '+String(section+1).padStart(2,'0'),'THE UNREAL MUSEUM')}));
   placard.position.set(0,HEIGHT-.53,z+.35);scene.add(placard);
 }
 // Luminous recessed ceiling panels; unlit meshes avoid an expensive spotlight per bay.
 const lightPanel=new THREE.MeshBasicMaterial({color:0xfff5df});
 for(let z=0;z>END+2;z-=7){box(scene,2.4,.012,1.25,lightPanel,0,HEIGHT-.015,z);box(scene,2.75,.03,1.52,dark,0,HEIGHT+.007,z);}
 for(let z=1;z>END+3;z-=24){const lamp=new THREE.PointLight(0xffeed6,3.4,11,2);lamp.position.set(0,HEIGHT-.45,z);scene.add(lamp);}
 ambient=new THREE.HemisphereLight(0xfffaf0,0xa9aaa4,2.5);sun=new THREE.DirectionalLight(0xffe8d1,1.0);sun.position.set(-2,8,4);
 fillLight=new THREE.AmbientLight(0xffffff,.35);scene.add(ambient,sun,fillLight);
 // Occasional understated visitor benches, away from floor-installation sites.
 for(let i=0;i<Math.floor(COUNT/11);i++){
   const z=-(29+i*38.5),wood=material(0x9d8a72,.62),leg=material(0x313735,.46,.4);
   box(scene,1.7,.09,.45,wood,0,.57,z);
   for(const x of [-.67,.67])box(scene,.055,.57,.39,leg,x,.285,z);
   obstacles.push({x:0,z,r:1.02});shadowAt(0,z,1.4);
 }
 foyer();
 const last=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.9),new THREE.MeshBasicMaterial({map:labelTexture('THE UNREAL MUSEUM','THE WALL CONTINUES'),side:THREE.DoubleSide}));last.position.set(0,2.75,END+.15);scene.add(last);
}
function picture(side,z,w,slot){const mount=new THREE.Group();mount.position.set(side*(HALF-.15),2.42,z);mount.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(mount);
 const wSize=w?({mini:1.3,portrait:1.5,landscape:2.2,wide:2.7,tall:1.85,panorama:2.8}[w.size]||2.12):2.1;
 const hSize=w?({mini:1.65,portrait:2.05,landscape:1.6,wide:1.84,tall:2.33,panorama:1.2}[w.size]||1.78):1.8;
 if(w){const bronze=material(0x93836d,.36,.6),ink=material(0x272929,.48,.26);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.6),
   new THREE.MeshBasicMaterial({map:wallWashTexture,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));
  glow.position.set(0,.3,.018);mount.add(glow);
  box(mount,wSize+.11,hSize+.11,.055,ink,0,0,0);box(mount,wSize+.055,hSize+.055,.065,bronze,0,0,.045);
  const tex=artworkTexture(w);const plane=new THREE.Mesh(new THREE.PlaneGeometry(wSize,hSize),new THREE.MeshBasicMaterial({map:tex.texture,side:THREE.DoubleSide}));
  plane.position.z=.086;mount.add(plane);const record={type:'wall',w,slot,x:side*(HALF-.15),y:2.42,z,side,preview:tex.canvas};
  works.push(record);plane.userData.record=record;clickables.push(plane);
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.42,.33),new THREE.MeshBasicMaterial({map:labelTexture(w.title,w.author),side:THREE.DoubleSide}));plaque.position.set(0,-hSize/2-.32,.09);mount.add(plaque);
  for(const sx of [-.69,.69]){
    const screw=new THREE.Mesh(new THREE.SphereGeometry(.017,10,8),bronze);
    screw.position.set(sx,-hSize/2-.32,.10);mount.add(screw);
  }
 }else if(slot<4){const plane=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.16),new THREE.MeshBasicMaterial({map:labelTexture('PARTENAIRES',String(slot+1).padStart(2,'0')+' / ESPACE RÉSERVÉ',true),side:THREE.DoubleSide}));plane.position.z=.055;mount.add(plane);}
 else{
  // White wall preserved; tiny brass registration plaque indicates a future emplacement.
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.93,.23),new THREE.MeshBasicMaterial({map:labelTexture('ESPACE LIBRE','TEM / '+String(slot+1).padStart(3,'0')),side:THREE.DoubleSide}));
  sign.position.set(0,-1.03,.065);mount.add(sign);
  const spot=new THREE.Mesh(new THREE.PlaneGeometry(2.30,1.9),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));spot.position.z=.065;spot.userData.emptySlot=slot;mount.add(spot);clickables.push(spot);
 }
}
/* Only a complete, unoccupied trio of same-side bays is a sellable
   "private wall". Never expose an overlapping frame/wall checkout in frontend. */
function wallInstallations(){
  for(const section of wallSectionCandidates){
    const z=-(5.7+(section.base+2)*3.5), side=section.side;
    const mount=new THREE.Group();
    mount.position.set(side*(HALF-.13),1.34,z);
    mount.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    scene.add(mount);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.3),
      new THREE.MeshBasicMaterial({map:labelTexture('MUR TOTAL','APERÇU · DÉMONSTRATION'),side:THREE.DoubleSide}));
    label.position.z=.09;
    mount.add(label);
    const pickArea=new THREE.Mesh(new THREE.PlaneGeometry(2.1,.68),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    pickArea.position.z=.105;
    pickArea.userData.privateWall=section;mount.add(pickArea);clickables.push(pickArea);
    wholeWalls.push(section);
  }
}
function showWall(section){
  hideIntro();closeDetails();
  activeWall=section;currentReserve=null;st.playing=false;st.detail=true;st.mode='guided';
  const z=-(5.7+(section.base+2)*3.5);
  desired.set(section.side*1.6,1.72,clamp(z+2.5,END+2,MAXZ));
  lookCam.position.copy(desired);lookCam.lookAt(section.side*(HALF-.15),2.20,z);
  desiredRotation.copy(lookCam.quaternion);sync();
  $('#detailNumber').textContent='MUR PRIVATIF / '+String(section.base/6+1).padStart(2,'0');
  $('#detailCategory').textContent='EXPOSITION EXCLUSIVE · PROJET';
  $('#detailTitle').textContent='LE MUR TOTAL. VOTRE UNIVERS.';
  $('#detailDescription').textContent='Un pan entier de galerie regroupant trois emplacements du même côté, sur un module architectural d’environ 21 mètres de long. Idéal pour une fresque, un triptyque ou un univers immersif. Disponibilité indicative dans cette démonstration ; les réservations, la modération et les paiements seront centralisés avant toute commercialisation.';
  $('#detailAuthor').textContent='EXCLUSIVITÉ TEMPORAIRE';
  $('#detailTools').textContent='FRESQUE · PANORAMA · COLLECTION';
  $('#detailThumb').style.backgroundImage='none';
  $('#detailThumb').style.backgroundColor='#ede9e1';
  $('#share').textContent='PROPOSER MON PROJET ↗';
  $('#detail').classList.add('open');$('#detail').setAttribute('aria-hidden','false');
  save(true);
}
function describeWalls(){
  if(!wholeWalls.length){
    $('#temWall').disabled=true;$('#temWall').textContent='MUR TOTAL · À VENIR';return;
  }
  $('#temWall').textContent='MURS TOTAUX · '+wholeWalls.length;
}
function sculpturalStudy(seed,m){
 const group=new THREE.Group();
 if(seed%3===0){
   const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.34,.10,110,16,2,3),m);
   knot.rotation.set(.4,.2,.3);group.add(knot);
 }else if(seed%3===1){
   const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.47,1),m);
   core.rotation.set(.3,.35,.2);group.add(core);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.033,10,56),material(0x4b4f4c,.36,.65));
   ring.rotation.set(.3,.6,.4);group.add(ring);
 }else{
   const columns=[[-.18,0,.20,.65,.1],[.16,-.1,.10,.52,.48],[0,.18,-.20,.55,-.33]];
   for(const [x,y,z,h,r] of columns){
     const part=new THREE.Mesh(new THREE.CylinderGeometry(.11,.20,h,7,1),m);
     part.position.set(x,y,z);part.rotation.z=r;group.add(part);
   }
 }
 return group;
}
async function mountApprovedGlb(src,standIn,pedestal){
 const u=new URL(src);
 if(u.protocol!=='https:'||!u.pathname.toLowerCase().endsWith('.glb'))return;
 // Only load public assets from the museum host or configured cloud storage.
 const allowed=[location.hostname];
 try{if(window.TEM_MUSEUM_CONFIG?.supabaseUrl)allowed.push(new URL(window.TEM_MUSEUM_CONFIG.supabaseUrl).hostname);}catch(e){}
 if(!allowed.includes(u.hostname))return;
 if(!gltfLoaderModule)gltfLoaderModule=import('https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/loaders/GLTFLoader.js');
 const {GLTFLoader}=await gltfLoaderModule;
 const loader=new GLTFLoader();
 loader.load(u.href,gltf=>{
   const object=gltf.scene;
   const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
   if(!Number.isFinite(size.length())||size.length()<.001)return;
   const scale=Math.min(1.28/Math.max(.1,size.x),1.40/Math.max(.1,size.y),1.28/Math.max(.1,size.z));
   const center=bounds.getCenter(new THREE.Vector3());
   object.scale.setScalar(scale);object.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
   standIn.clear();standIn.add(object);
 },undefined,e=>console.warn('[TEM] GLB loading failed',e));
}
function floorStations(){const stations=[12,32,58,96,123];const marker=material(0xafa48f,.66,.3);
 for(let i=0;i<stations.length;i++){
  const slot='S'+String(i+1).padStart(2,'0'),z=-stations[i],x=i%2?-1.45:1.45;
  const circle=new THREE.Mesh(new THREE.CylinderGeometry(.89,.89,.012,48),marker);circle.position.set(x,.014,z);scene.add(circle);
  const p=floorWorks.find(w=>w.slot===slot);if(!p)continue;
  const pedestal=material(0xd4d0c5,.8),bronze=material(0x807153,.42,.4);
  obstacles.push({x,z,r:.88});shadowAt(x,z,1.14);
  box(scene,1.27,.73,1.27,pedestal,x,.37,z);
  const sculpture=sculpturalStudy(i,bronze);sculpture.position.set(x,1.37,z);scene.add(sculpture);
  if(p.modelUrl)mountApprovedGlb(p.modelUrl,sculpture).catch(e=>console.warn('[TEM] Cannot display approved model:',e));
  const record={type:'floor',w:p,slot,x,y:1.25,z,side:x<0?-1:1};works.push(record);sculpture.userData.record=record;clickables.push(sculpture);
 }
}
function ceilingStations(){if(!ceilingUnlocked&&!ceilingWorks.length)return;
 const points=[18,40,62,85,109,132];const bronze=material(0x8a7b66,.45,.5);
 for(let i=0;i<points.length;i++){
  const slot='P'+String(i+1).padStart(2,'0'),w=ceilingWorks.find(w=>w.slot===slot);
  if(!w)continue;
  const z=-points[i],y=HEIGHT-.85,tex=artworkTexture(w);
  const hanging=new THREE.Mesh(new THREE.PlaneGeometry(i%3===2?2.3:1.6,i%3===2?1.3:1.45),new THREE.MeshBasicMaterial({map:tex.texture,side:THREE.DoubleSide}));
  hanging.position.set(i%2?.9:-.9,y,z);hanging.rotation.y=Math.PI/8;scene.add(hanging);
  for(const x of [-.65,.65])box(scene,.018,.7,.018,bronze,hanging.position.x+x,HEIGHT-.35,z);
  const record={type:'ceiling',w,slot,x:hanging.position.x,y,z,side:i%2?1:-1,preview:tex.canvas};works.push(record);hanging.userData.record=record;clickables.push(hanging);
 }
}
function applyMood(){if(!ambient)return;const night=st.mood==='evening';ambient.intensity=night?1.55:2.5;sun.intensity=night?.33:1;fillLight.intensity=night?.19:.35;
 scene.background.set(night?0x494b4a:0xe9e7e1);scene.fog.color.set(night?0x626564:0xe9e7e1);
 renderer.toneMappingExposure=night?1.16:1.34;$('#temMood').textContent=night?'AMBIANCE · SOIR':'AMBIANCE · JOUR';}
function save(force=false){const now=Date.now();if(!force&&now-st.lastSaved<1800)return;st.lastSaved=now;
 try{localStorage.setItem(savedKey,JSON.stringify({index:st.index,mode:st.mode,quality:st.quality,mood:st.mood,
  position:[camera.position.x,camera.position.y,camera.position.z],yaw:st.yaw,pitch:st.pitch}))}catch(e){}
}
function sync(){if(!works.length)return;
 st.index=clamp(st.index,0,works.length-1);const r=works[st.index];
 $('#navIndex').textContent=String(st.index+1).padStart(2,'0')+' / '+String(works.length).padStart(2,'0');
 $('#zoneTitle').textContent=String(r.w.title).toUpperCase()+' / '+String(r.slot);
 $('#temGuide').classList.toggle('active',st.mode==='guided');$('#temFree').classList.toggle('active',st.mode==='free');
 $('#temPlay').disabled=st.mode!=='guided';$('#temPlay').textContent=st.playing?'Ⅱ PAUSE':'▶ VISITE AUTO';
 $('#temDirections').classList.toggle('visible',st.mode==='free');
 $('#temCount').textContent=String(st.index+1).padStart(2,'0')+' / '+String(works.length).padStart(2,'0')+' ŒUVRES';
 $('#temProgress').style.width=(100*(st.index+1)/works.length)+'%';
 $('#temQuality').textContent=st.quality==='eco'?'QUALITÉ · ÉCO':'QUALITÉ · HD';
 $('#temPosition').textContent=Math.max(0,Math.round(-camera.position.z))+' / '+Math.round(LENGTH)+' M';
}
function focus(index){if(!works.length)return;
 st.index=(index+works.length)%works.length;st.timer=0;
 if(st.mode==='guided'){
  const r=works[st.index];
  const offset=r.type==='wall'?r.side*1.25:r.type==='floor'?r.side*2.3:0;
  desired.set(offset,1.72,clamp(r.z+1.6,END+1.5,MAXZ));
  lookCam.position.copy(desired);lookCam.lookAt(r.x,r.y,r.z);desiredRotation.copy(lookCam.quaternion);
 }
 sync();save(true);
}
function closeDetails(){activeWall=null;st.detail=false;$('#detail').classList.remove('open');$('#detail').setAttribute('aria-hidden','true');}
let currentReserve=null;
function showRecord(r){if(!r)return;st.playing=false;st.detail=true;currentReserve=null;activeWall=null;
 const w=r.w;$('#detailNumber').textContent='COLLECTION / '+String(r.slot).toUpperCase();$('#detailCategory').textContent=String(w.category).toUpperCase();
 $('#detailTitle').textContent=w.title.toUpperCase();$('#detailDescription').textContent=w.description;
 $('#detailAuthor').textContent=w.author;$('#detailTools').textContent=w.tools;
 let thumb='none';if(w.image)thumb='url('+w.image+')';
 else if(r.preview)try{thumb='url('+r.preview.toDataURL('image/jpeg',.75)+')'}catch(e){}
 $('#detailThumb').style.backgroundImage=thumb;
 $('#detailThumb').style.backgroundColor='#d6d1c8';$('#share').textContent='COPIER LE LIEN DE CETTE ŒUVRE ↗';
 $('#detail').classList.add('open');$('#detail').setAttribute('aria-hidden','false');
 history.replaceState(null,'',location.pathname+'#art-'+w.id);sync();save(true);
}
function showEmpty(slot){st.playing=false;st.detail=true;currentReserve=slot;activeWall=null;
 $('#detailNumber').textContent='EMPLACEMENT / '+String(slot+1).padStart(3,'0');$('#detailCategory').textContent='MUR ORIGINAL · DISPONIBLE';
 $('#detailTitle').textContent='UN MUR QUI ATTEND VOTRE CRÉATION';
 $('#detailDescription').textContent='Cet espace est libre dans la démonstration. Choisissez un format puis exposez votre création sur le site du musée.';
 $('#detailAuthor').textContent='À VOUS';$('#detailTools').textContent='IMAGE · TEXTE · DESIGN · 3D';$('#detailThumb').style.backgroundImage='none';
 $('#detailThumb').style.backgroundColor='#eeebe4';$('#share').textContent='CHOISIR UN EMPLACEMENT ↗';
 $('#detail').classList.add('open');$('#detail').setAttribute('aria-hidden','false');
}
function hideIntro(){
 const first=!st.entered;$('#intro').classList.add('dismissed');st.entered=true;
 $('#shell').classList.add('tem-entered');if(first&&st.mode==='guided')focus(st.index);
 canvas.focus({preventScroll:true});
}
function mode(next){if(next==='free'&&st.mode!=='free'){
 desired.copy(camera.position);const d=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
 st.yaw=Math.atan2(-d.x,-d.z);st.pitch=clamp(Math.asin(d.y),-.75,.75);
 }st.mode=next;st.playing=false;st.timer=0;if(next==='guided')focus(st.index);sync();save(true);}
function next(delta){hideIntro();closeDetails();if(st.mode==='free')mode('guided');st.playing=false;focus(st.index+delta);}
function pick(e){const r=canvas.getBoundingClientRect();raypoint.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
 raycaster.setFromCamera(raypoint,camera);const h=raycaster.intersectObjects(clickables,false)[0];if(!h)return;
 const section=h.object.userData.privateWall;if(section){showWall(section);return;}
 const rcd=h.object.userData.record;if(rcd){hideIntro();if(st.mode!=='guided')mode('guided');focus(works.indexOf(rcd));showRecord(rcd);}
 else if(Number.isInteger(h.object.userData.emptySlot))showEmpty(h.object.userData.emptySlot);
}
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
 camera.aspect=w/h;camera.fov=w<760?71:63;camera.updateProjectionMatrix();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,st.quality==='eco'?1:mobile?1.4:1.85));renderer.setSize(w,h,false);
}
function buildUI(){const bar=document.createElement('div');bar.className='tem-v3-hud';bar.innerHTML=
 '<div class="tem-v3-switch"><button id="temGuide" type="button">VISITE GUIDÉE</button><button id="temFree" type="button">EXPLORER LIBREMENT</button></div>'+
 '<div class="tem-v3-switch"><button id="temPlay" type="button">▶ VISITE AUTO</button><button id="temWall" type="button">MUR PRIVATIF</button><button id="temMood" type="button">AMBIANCE · JOUR</button><button id="temQuality" type="button">QUALITÉ · HD</button></div>'+
 '<div class="tem-v3-progress"><span id="temCount"></span><i><b id="temProgress"></b></i><span id="temPosition"></span></div>';
 $('#shell').append(bar);
 const keys=document.createElement('div');keys.className='tem-v3-directions';keys.id='temDirections';keys.innerHTML='<button id="temUp" type="button" aria-label="Avancer">↑</button><button id="temLeft" type="button" aria-label="Aller à gauche">←</button><button id="temDown" type="button" aria-label="Reculer">↓</button><button id="temRight" type="button" aria-label="Aller à droite">→</button>';
 $('#shell').append(keys);
 $('#temGuide').onclick=()=>mode('guided');$('#temFree').onclick=()=>mode('free');
 $('#temWall').onclick=()=>{if(!wholeWalls.length)return;showWall(wholeWalls[0]);};describeWalls();
 $('#temPlay').onclick=()=>{if(st.mode!=='guided')mode('guided');st.playing=!st.playing;st.timer=0;sync();};
 $('#temMood').onclick=()=>{st.mood=st.mood==='day'?'evening':'day';applyMood();save(true);};
 $('#temQuality').onclick=()=>{st.quality=st.quality==='hd'?'eco':'hd';resize();sync();save(true);};
 for(const [id,k] of [['#temUp','KeyW'],['#temDown','KeyS'],['#temLeft','KeyA'],['#temRight','KeyD']]){
  const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();keyset.add(k);b.setPointerCapture(e.pointerId)});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>keyset.delete(k));
 }
 if(saved.index!==undefined)$('#explore').innerHTML='REPRENDRE MA VISITE <span>↗</span>';
 $('#totalPieces').textContent=String(works.length).padStart(2,'0');
 $('.hud-left small').textContent=works.length+' ŒUVRES · '+COUNT+' ESPACES MURAUX';
 $('.instructions>span').textContent='CLIQUER UNE ŒUVRE · ZQSD POUR MARCHER · GLISSER POUR REGARDER';
 $('#graphicsLabel').textContent='THREE.JS · MUSÉE 3D · '+(cloudSnapshot.status==='live'?'COLLECTION PUBLIÉE':'DÉMONSTRATION LOCALE');
 if(cloudSnapshot.status!=='live')$('.demo-note').textContent='Version de démonstration. Les créations enregistrées dans ce navigateur ne sont pas publiques. Aucun achat ni paiement n’est effectué ici.';
}
function controls(){
 $('#explore').onclick=hideIntro;$('#enter').onclick=()=>$('#loader').classList.add('hidden');
 $('#prev').onclick=()=>next(-1);$('#next').onclick=()=>next(1);
 $('#random').onclick=()=>{hideIntro();closeDetails();if(st.mode==='free')mode('guided');focus(Math.floor(Math.random()*works.length));showRecord(works[st.index]);};
 $('#closeDetail').onclick=closeDetails;
 $('#share').onclick=async()=>{
  if(activeWall!==null){location.href='mailto:contact.gbostudio@gmail.com?subject=The%20Unreal%20Museum%20-%20Mur%20privatif';return;}
  if(currentReserve!==null){location.href='/empty-museum/#pricing';return;}
  const url=location.origin+location.pathname+'#art-'+works[st.index].w.id;
  try{await navigator.clipboard.writeText(url);$('#share').textContent='LIEN COPIÉ ✓';setTimeout(()=>$('#share').textContent='COPIER LE LIEN DE CETTE ŒUVRE ↗',1800);}catch(e){prompt('Copier ce lien',url);}
 };
 canvas.style.touchAction='none';
 canvas.addEventListener('pointerdown',e=>{if(!st.entered)return;st.drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY};st.moved=false;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{const d=st.drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;
  if(Math.abs(e.clientX-d.sx)+Math.abs(e.clientY-d.sy)>9)st.moved=true;
  if(st.mode==='free'){st.yaw-=dx*.0039;st.pitch=clamp(st.pitch-dy*.0027,-.83,.83);}
  else if(st.moved&&Math.abs(e.clientX-d.sx)>110){next(dx<0?1:-1);d.sx=e.clientX;}
 });
 canvas.addEventListener('pointerup',e=>{if(st.drag&&!st.moved)pick(e);st.drag=null;});canvas.addEventListener('pointercancel',()=>st.drag=null);
 canvas.addEventListener('wheel',e=>{if(!st.entered)return;e.preventDefault();if(st.mode==='guided')next(e.deltaY>0?1:-1);
  else{
   const nx=clamp(desired.x-Math.sin(st.yaw)*e.deltaY*.013,-3.8,3.8);
   const nz=clamp(desired.z-Math.cos(st.yaw)*e.deltaY*.013,END+2,MAXZ);
   if(!blocking(nx,desired.z))desired.x=nx;
   if(!blocking(desired.x,nz))desired.z=nz;
  }
 },{passive:false});
 window.addEventListener('keydown',e=>{if(e.target?.matches?.('input,textarea,select'))return;
  if(e.key==='Escape'){closeDetails();st.playing=false;sync();return;}
  if(st.detail)return;
  if(st.mode==='guided'&&['ArrowLeft','ArrowRight',' '].includes(e.key)){
   e.preventDefault();if(e.key==='ArrowLeft')next(-1);else if(e.key==='ArrowRight')next(1);else{st.playing=!st.playing;sync();}}
  keyset.add(e.code);
 });window.addEventListener('keyup',e=>keyset.delete(e.code));window.addEventListener('blur',()=>keyset.clear());
 window.addEventListener('resize',resize);window.addEventListener('pagehide',()=>save(true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){st.playing=false;save(true);sync();}});
}
function animate(){raf=requestAnimationFrame(animate);if(document.hidden)return;
 const dt=Math.min(clock.getDelta(),.05),s=1-Math.exp(-dt*(reduced?15:3.4));
 if(st.entered&&!st.detail&&st.mode==='free'){
  const direction=new THREE.Vector3(-Math.sin(st.yaw),0,-Math.cos(st.yaw));
  const right=new THREE.Vector3(Math.cos(st.yaw),0,-Math.sin(st.yaw));const move=new THREE.Vector3();
  if(keyset.has('KeyW')||keyset.has('ArrowUp'))move.add(direction);
  if(keyset.has('KeyS')||keyset.has('ArrowDown'))move.sub(direction);
  if(keyset.has('KeyD'))move.add(right);if(keyset.has('KeyA')||keyset.has('KeyQ'))move.sub(right);
  if(move.lengthSq()){
   move.normalize().multiplyScalar(dt*3.65);
   const nx=clamp(desired.x+move.x,-3.8,3.8),nz=clamp(desired.z+move.z,END+2,MAXZ);
   if(!blocking(nx,desired.z))desired.x=nx;
   if(!blocking(desired.x,nz))desired.z=nz;
  }
  lookCam.rotation.order='YXZ';lookCam.rotation.set(st.pitch,st.yaw,0);desiredRotation.copy(lookCam.quaternion);
 }
 if(st.entered&&!st.detail&&st.mode==='guided'&&st.playing){st.timer+=dt;
  if(st.timer>=9){if(st.index===works.length-1){st.playing=false;sync();}else focus(st.index+1);}
 }
 camera.position.lerp(desired,s);camera.quaternion.slerp(desiredRotation,s);
 if(st.mode==='free'&&Math.round(performance.now()/300)%3===0){let best=st.index,dist=Infinity;
  for(let i=0;i<works.length;i++){const d=Math.abs(works[i].z-camera.position.z);if(d<dist){dist=d;best=i;}}
  if(best!==st.index){st.index=best;sync();}
 }
 if($('#temPosition'))$('#temPosition').textContent=Math.max(0,Math.round(-camera.position.z))+' / '+Math.round(LENGTH)+' M';
 renderer.render(scene,camera);save();
}
function init(){if(!window.WebGLRenderingContext)throw Error('WebGL not supported');
 renderer=new THREE.WebGLRenderer({canvas:$('#scene'),antialias:!mobile,alpha:false,powerPreference:mobile?'low-power':'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 scene=new THREE.Scene();scene.background=new THREE.Color(0xe9e7e1);scene.fog=new THREE.Fog(0xe9e7e1,17,58);
 camera=new THREE.PerspectiveCamera(63,1,.08,250);camera.position.set(0,1.72,3.8);
 raycaster=new THREE.Raycaster();raypoint=new THREE.Vector2();clock=new THREE.Clock();
 architecture();
 for(let i=0;i<COUNT;i++)picture(i%2?1:-1,-(5.7+i*3.5),wallWorks.get(i),i);
 floorStations();ceilingStations();wallInstallations();
 works.sort((a,b)=>b.z-a.z); // physical visit order: beginning to the far wall
 st.index=clamp(st.index,0,works.length-1);
 buildUI();controls();
 if(st.mode==='free'&&Array.isArray(saved.position)&&saved.position.length===3){
  desired.set(clamp(Number(saved.position[0])||0,-3.8,3.8),1.72,clamp(Number(saved.position[2])||3.8,END+2,MAXZ));camera.position.copy(desired);
  lookCam.rotation.order='YXZ';lookCam.rotation.set(st.pitch,st.yaw,0);desiredRotation.copy(lookCam.quaternion);camera.quaternion.copy(desiredRotation);
 }
 const hash=location.hash.match(/^#art-([\w-]+)$/);if(hash){const found=works.findIndex(r=>String(r.w.id)===hash[1]);if(found>=0)st.index=found;}
 if(st.mode==='guided'){camera.lookAt(0,1.72,-10);desiredRotation.copy(camera.quaternion);}resize();applyMood();sync();
 window.__TEM_V4_READY=true;
 $('#loadbar').style.width='100%';$('#loadstate').textContent='LE MUSÉE EST PRÊT';$('#enter').hidden=false;
 $('#loader').classList.add('hidden');raf=requestAnimationFrame(animate);
}
try{init();}catch(e){console.error('[TEM] Museum v4 cannot start',e);if(raf)cancelAnimationFrame(raf);window.TEMStartFallback?.(e);
 if(!window.TEMStartFallback){$('#loader')?.classList.add('hidden');$('#fallback').hidden=false;}}