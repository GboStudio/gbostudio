/* THE EMPTY MUSEUM — Immersive gallery v2. Demo/local-first, Three.js 0.171.
   Current live exhibition backend is not connected. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js';
if (window.__TEM_GALLERY_FALLBACK_REQUESTED || window.__TEM_GALLERY_FALLBACK_STARTED) throw new Error('Fallback already active');
const $ = s=>document.querySelector(s);
const originals=[
['After the Rain','Maya','ART / IMAGE','ChatGPT + génération d’image','Une ville après la pluie et la lumière des souvenirs.',0],
['Chair 04','Niko','OBJET / 3D','ChatGPT + Blender','Une étude de mobilier entre design et sculpture.',1],
['Nocturne','Léa','TEXTE / POÉSIE','ChatGPT','Un texte inspiré de ces instants où la ville se tait.',2],
['Ocean Interface','Sami','DESIGN / INTERFACE','ChatGPT + Figma','Un système de navigation inspiré des cartes marines.',3],
['Fold Lamp','Ana','OBJET / DESIGN','ChatGPT + Fusion 360','Une lampe conçue autour de la diffusion de la lumière.',4],
['Wrong Fruit','Pablo','ART / EXPÉRIMENTAL','ChatGPT + génération d’image','Une création étrange qui revendique sa singularité.',5],
['Architecture 01','Eli','ARCHITECTURE / 3D','ChatGPT + Rhino','Un espace construit autour de la lumière.',6],
['Soft Machine','Rina','ART / IMAGE','ChatGPT + génération d’image','La rencontre entre matière et formes organiques.',7],
['The First Wall','GBO Studio','INSTALLATION','ChatGPT + Three.js','Tout commence par un mur blanc.',8]
];
const works=originals.map((r,i)=>({id:i+1,title:r[0],author:r[1]+' · Démo',kind:r[2],tools:r[3],desc:r[4],theme:r[5],demo:true}));
try{
  const saved=JSON.parse(localStorage.getItem('tem-demo')||'[]');
  if(Array.isArray(saved)) for(const p of saved.slice(0,75)){
    if(!p||typeof p!=='object')continue;
    const id=Number(p.id);if(!Number.isFinite(id))continue;
    works.push({id,title:String(p.title||'Sans titre').slice(0,100),
      author:String(p.author||'Anonyme').slice(0,70),
      kind:String(p.category||'CRÉATION').toUpperCase().slice(0,70),
      tools:String(p.tools||'Création personnelle').slice(0,100),
      desc:String(p.description||'Une création exposée dans le musée.').slice(0,600),
      image:/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(p.image||'')?p.image:null,
      theme:works.length%9,demo:false});
  }
}catch(e){console.warn('Local collection cannot be read',e);}
const C=works.length, MAXZ=6.3, MINZ=-Math.max(28,8+Math.ceil(C/2)*4.15);
const LS='tem-3d-position-v2',mobile=matchMedia('(max-width: 760px)').matches;
let saved={};
try{saved=JSON.parse(localStorage.getItem(LS)||'{}')||{}}catch(e){}
const st={i:Math.min(C-1,Math.max(0,Number(saved.i)||0)),mode:saved.mode==='free'?'free':'guided',playing:false,
  entered:false,detail:false,quality:saved.quality==='eco'?'eco':'hd',yaw:Number(saved.yaw)||0,
  pitch:Number(saved.pitch)||0,drag:null,move:false,time:0,lastSave:0};
let scene,camera,renderer,clock,raycaster,texRay,animation;
const art=[],frames=[],keys=new Set();
const desired=new THREE.Vector3(0,1.73,4.5),quat=new THREE.Quaternion(),orient=new THREE.Object3D();
const clamp=THREE.MathUtils.clamp,canvas=$('#scene');
const palettes=[
['#253f46','#e5bfb1','#f3e2ca'],['#cfc3b1','#64594e','#e9d8b8'],
['#201f2a','#afa5ad','#f3e9d7'],['#102b41','#4da8b1','#e3f1d5'],
['#272e22','#a99176','#f6dfa6'],['#e4c3ac','#f27e54','#4e9575'],
['#263e42','#a2b0a5','#e7e3d8'],['#b9ada6','#697b72','#e0cabc'],
['#f0eae0','#dfd8cc','#242720']
];
function artTexture(w){
 const c=document.createElement('canvas');c.width=512;c.height=560;
 const g=c.getContext('2d'),p=palettes[w.theme%9],grad=g.createLinearGradient(0,0,512,560);
 grad.addColorStop(0,p[0]);grad.addColorStop(.68,p[1]);grad.addColorStop(1,p[2]);g.fillStyle=grad;g.fillRect(0,0,512,560);
 const n=w.theme%9;
 if(n===2||n===8){g.fillStyle=n===8?'#242720':'#f8f3e8';g.textAlign='center';g.font='bold 48px Georgia';
 g.fillText(n===8?'THE EMPTY':'NOCTURNE',256,245,466);g.fillText(n===8?'MUSEUM':'· · ·',256,305,466);}
 else if(n===3){g.strokeStyle='#beddd0aa';for(let j=0;j<21;j++){g.beginPath();g.ellipse(256,280,28+j*15,38+j*13,j*.2,0,7);g.stroke()}
 g.fillStyle='#dceee8';g.font='bold 45px Arial';g.fillText('OCEAN',50,88);}
 else if(n===5){g.fillStyle='#ea7b50';g.beginPath();g.ellipse(260,330,155,185,-.28,0,7);g.fill();g.fillStyle='#57906b';g.beginPath();g.ellipse(330,157,85,42,-.5,0,7);g.fill();}
 else if(n===6){for(let j=0;j<9;j++){g.fillStyle=j%2?'#d1d8ce':'#657c7d';g.beginPath();const x=j*70-50;g.moveTo(x,560);g.lineTo(x+20,110+j%3*40);g.lineTo(x+70,100+j%4*35);g.lineTo(x+120,560);g.fill();}}
 else if(n===4){const glow=g.createRadialGradient(256,220,8,256,220,235);glow.addColorStop(0,'#fff7ca');glow.addColorStop(.35,'#e5ba82');glow.addColorStop(1,'#e5ba8200');g.fillStyle=glow;g.fillRect(0,0,512,560);g.fillStyle='#544d40';g.fillRect(246,325,18,165);g.fillRect(185,490,140,9);}
 else {for(let j=0;j<10;j++){g.save();g.translate(255,275);g.rotate(j*.628);g.strokeStyle=j%2?p[0]:p[2];g.globalAlpha=.62;g.lineWidth=10+j;g.beginPath();g.ellipse(0,-46,70+j*6,150-j*6,.16,0,7);g.stroke();g.restore();}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
 if(w.image){const im=new Image();im.onload=()=>{g.fillStyle='#f4f0e8';g.fillRect(0,0,512,560);const k=Math.min(512/im.width,560/im.height),iw=im.width*k,ih=im.height*k;g.drawImage(im,(512-iw)/2,(560-ih)/2,iw,ih);t.needsUpdate=true;};im.src=w.image;}
 return {texture:t,preview:c};
}
function label(a,b){
 const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
 g.fillStyle='#eee9df';g.fillRect(0,0,512,128);g.fillStyle='#292a28';g.font='bold 28px Arial';g.fillText(String(a).toUpperCase().slice(0,30),22,53,470);
 g.font='18px Arial';g.fillStyle='#6c6c66';g.fillText(String(b).slice(0,46),22,92,470);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function block(parent,w,h,d,m,x,y,z){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function construct(){
 const white=mat(0xf0eee9,.98),stone=mat(0xcac6bc,.65),bronze=mat(0x96846c,.42,.5),dark=mat(0x343734,.5,.32),ceil=mat(0xe8e6df,.95);
 const length=8-MINZ,mid=(8+MINZ)/2;
 block(scene,11.5,.18,length,stone,0,-.09,mid);
 block(scene,11.5,.22,length,ceil,0,4.71,mid);
 block(scene,.26,4.76,length,white,-5.62,2.35,mid);
 block(scene,.26,4.76,length,white,5.62,2.35,mid);
 block(scene,11.5,4.76,.2,white,0,2.35,MINZ);
 block(scene,11.5,4.76,.2,white,0,2.35,7.8);
 for(const side of [-1,1]){block(scene,.065,.13,length,bronze,side*5.47,.12,mid);block(scene,.06,.1,length,bronze,side*5.47,4.52,mid);}
 for(let z=4;z>MINZ;z-=4.15)block(scene,11.15,.012,.045,mat(0xb5b1a7,.95),0,.007,z);
 const light=new THREE.HemisphereLight(0xfffcf5,0xb3aaa0,2.45);scene.add(light);
 const sun=new THREE.DirectionalLight(0xfff2df,1.25);sun.position.set(-3,9,5);scene.add(sun);
 for(let j=0;j<Math.ceil(C/2);j++){
  const z=-4.7-j*4.15;
  block(scene,1.6,.035,.23,mat(0x52534d,.45,.35),0,4.52,z);
  for(const side of [-1,1]){
   const x=side*3.65;
   block(scene,.33,.018,.36,new THREE.MeshBasicMaterial({color:0xfff1d3}),x,4.54,z);
  }
  if(j%3===0){const l=new THREE.PointLight(0xffe9ce,4,11,2);l.position.set(0,4.0,z);scene.add(l);}
 }
 for(let j=0;j<C;j++){
  const w=works[j],side=j%2===0?-1:1,z=-4.7-Math.floor(j/2)*4.15;
  const mount=new THREE.Group();mount.position.set(side*5.44,2.72,z);mount.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(mount);
  const width=w.kind.includes('OBJET')?1.78:1.94,height=2.10;
  block(mount,width+.14,height+.14,.09,dark,0,0,0);
  block(mount,width+.075,height+.075,.095,bronze,0,0,.055);
  const im=artTexture(w),picture=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:im.texture,side:THREE.DoubleSide}));
  picture.position.z=.115;picture.userData.index=j;mount.add(picture);
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(1.52,.38),new THREE.MeshBasicMaterial({map:label(w.title,w.author),side:THREE.DoubleSide}));
  plaque.position.set(0,-1.38,.13);mount.add(plaque);
  art.push(picture);frames.push({x:side*5.43,y:2.72,z,side,preview:im.preview});
  if(j%7===1){
   const pedestal=mat(0xc1bdb4,.84);
   block(scene,.98,.88,.98,pedestal,0,.44,z);
   const sculpture=new THREE.Mesh(new THREE.TorusKnotGeometry(.40,.10,100,12,2,3),mat(0x88775d,.35,.47));
   sculpture.position.set(0,1.44,z);sculpture.rotation.x=.3;scene.add(sculpture);
  }
 }
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.5,1.15),new THREE.MeshBasicMaterial({map:label('THE EMPTY MUSEUM','THE WALL CONTINUES'),side:THREE.DoubleSide}));
 sign.position.set(0,2.9,MINZ+.17);scene.add(sign);
}
function save(force=false){
 const now=Date.now();if(!force&&now-st.lastSave<1800)return;st.lastSave=now;
 try{localStorage.setItem(LS,JSON.stringify({i:st.i,mode:st.mode,quality:st.quality,
   pos:[camera.position.x,camera.position.y,camera.position.z],yaw:st.yaw,pitch:st.pitch}))}catch(e){}
}
function sync(){
 $('#navIndex').textContent=String(st.i+1).padStart(2,'0')+' / '+String(C).padStart(2,'0');
 $('#zoneTitle').textContent=works[st.i].title.toUpperCase()+' — TEM / '+String(st.i+1).padStart(3,'0');
 $('#temGuide').classList.toggle('active',st.mode==='guided');$('#temFree').classList.toggle('active',st.mode==='free');
 $('#temPlay').disabled=st.mode!=='guided';$('#temPlay').textContent=st.playing?'Ⅱ PAUSE':'▶ VISITE AUTO';
 $('#temSteps').classList.toggle('visible',st.mode==='free');
 $('#temProgress').style.width=(100*(st.i+1)/C)+'%';
 $('#temCount').textContent='ŒUVRE '+String(st.i+1).padStart(2,'0');
 $('#temQuality').textContent=st.quality==='eco'?'ÉCO':'HD';
}
function focus(i){
 st.i=(i+C)%C;st.time=0;
 if(st.mode==='guided'){
  const p=frames[st.i];
  desired.set(p.side*1.35,1.73,clamp(p.z+1.45,MINZ+1.7,MAXZ));
  orient.position.copy(desired);orient.lookAt(p.x,p.y,p.z);quat.copy(orient.quaternion);
 }
 sync();save(true);
}
function setMode(mode){
 st.mode=mode;st.playing=false;st.time=0;
 if(mode==='free'){
  desired.copy(camera.position);
  const d=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  st.yaw=Math.atan2(-d.x,-d.z);st.pitch=clamp(Math.asin(d.y),-.8,.8);
 }else focus(st.i);
 sync();save(true);
}
function hideIntro(){
 $('#intro').classList.add('dismissed');st.entered=true;$('#shell').classList.add('tem-entered');
 canvas.focus({preventScroll:true});
}
function details(i){
 st.i=i;st.playing=false;st.detail=true;sync();
 const w=works[i];
 $('#detailNumber').textContent='COLLECTION / '+String(i+1).padStart(3,'0');
 $('#detailCategory').textContent=w.kind;$('#detailTitle').textContent=w.title.toUpperCase();
 $('#detailDescription').textContent=w.desc;$('#detailAuthor').textContent=w.author;$('#detailTools').textContent=w.tools;
 $('#detailThumb').style.backgroundImage=w.image?'url('+w.image+')':'url('+frames[i].preview.toDataURL('image/jpeg',.74)+')';
 $('#detail').classList.add('open');$('#detail').setAttribute('aria-hidden','false');
 history.replaceState(null,'',location.pathname+'#art-'+w.id);save(true);
}
function close(){st.detail=false;$('#detail').classList.remove('open');$('#detail').setAttribute('aria-hidden','true');}
function navigate(d){hideIntro();close();if(st.mode!=='guided')setMode('guided');st.playing=false;focus(st.i+d);}
function selectPointer(e){
 const r=canvas.getBoundingClientRect();
 texRay.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
 raycaster.setFromCamera(texRay,camera);const hit=raycaster.intersectObjects(art,false)[0];
 if(hit){hideIntro();if(st.mode!=='guided')setMode('guided');focus(hit.object.userData.index);details(st.i);}
}
function size(){
 const b=canvas.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height);
 camera.fov=w<760?73:61;camera.aspect=w/h;camera.updateProjectionMatrix();
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,st.quality==='eco'?1:mobile?1.45:1.85));
 renderer.setSize(w,h,false);
}
function ui(){
 const el=document.createElement('div');el.className='tem-bar';el.innerHTML=
  '<div class="tem-switch"><button id="temGuide" type="button">VISITE GUIDÉE</button><button id="temFree" type="button">EXPLORER LIBREMENT</button></div>'+
  '<div class="tem-switch"><button id="temPlay" type="button">▶ VISITE AUTO</button><button id="temQuality" type="button">HD</button></div>'+
  '<div class="tem-load"><span id="temCount">ŒUVRE 01</span><i><b id="temProgress"></b></i></div>';
 $('#shell').append(el);
 const steps=document.createElement('div');steps.id='temSteps';steps.className='tem-steps';
 steps.innerHTML='<button id="temForward" type="button" aria-label="Avancer">↑</button><button id="temBack" type="button" aria-label="Reculer">↓</button>';$('#shell').append(steps);
 $('#temGuide').onclick=()=>setMode('guided');$('#temFree').onclick=()=>setMode('free');
 $('#temPlay').onclick=()=>{if(st.mode!=='guided')setMode('guided');st.playing=!st.playing;st.time=0;sync();};
 $('#temQuality').onclick=()=>{st.quality=st.quality==='eco'?'hd':'eco';size();sync();save(true);};
 for(const [id,key] of [['#temForward','KeyW'],['#temBack','KeyS']]){
  const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);b.setPointerCapture(e.pointerId)});
  for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>keys.delete(key));
 }
 if(saved.i!==undefined)$('#explore').innerHTML='REPRENDRE MA VISITE <span>↗</span>';
 $('#totalPieces').textContent=String(C).padStart(2,'0');
 $('.hud-left small').textContent=C+' ŒUVRES · GALERIE DÉMO';
 $('#graphicsLabel').textContent='THREE.JS · 3D IMMERSIVE · LOCAL';
 $('.instructions>span').textContent='GLISSER POUR REGARDER · ZQSD POUR MARCHER · TOUCHER UNE ŒUVRE';
 $('#share').textContent='COPIER LE LIEN DE CETTE ŒUVRE ↗';
 sync();
}
function controls(){
 $('#explore').onclick=hideIntro;
 $('#enter').onclick=()=>$('#loader').classList.add('hidden');
 $('#prev').onclick=()=>navigate(-1);$('#next').onclick=()=>navigate(1);
 $('#random').onclick=()=>{hideIntro();close();setMode('guided');focus(Math.floor(Math.random()*C));details(st.i);};
 $('#closeDetail').onclick=close;
 $('#share').onclick=async()=>{const url=location.origin+location.pathname+'#art-'+works[st.i].id;try{await navigator.clipboard.writeText(url);$('#share').textContent='LIEN COPIÉ ✓';setTimeout(()=>$('#share').textContent='COPIER LE LIEN DE CETTE ŒUVRE ↗',1700)}catch(e){prompt('Copier',url)}};
 canvas.style.touchAction='none';
 canvas.addEventListener('pointerdown',e=>{if(!st.entered)return;st.drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY};st.move=false;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{
  const p=st.drag;if(!p||p.id!==e.pointerId)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(Math.abs(e.clientX-p.sx)+Math.abs(e.clientY-p.sy)>9)st.move=true;
  if(st.mode==='free'){st.yaw-=dx*.0038;st.pitch=clamp(st.pitch-dy*.0027,-.8,.8);}
  else if(st.move&&Math.abs(e.clientX-p.sx)>96){const dir=dx<0?1:-1;st.playing=false;focus(st.i+dir);p.sx=e.clientX;}
 });
 canvas.addEventListener('pointerup',e=>{if(st.drag&&!st.move)selectPointer(e);st.drag=null;});
 canvas.addEventListener('pointercancel',()=>st.drag=null);
 canvas.addEventListener('wheel',e=>{if(!st.entered)return;e.preventDefault();if(st.mode==='guided')navigate(e.deltaY>0?1:-1);else{
  desired.x=clamp(desired.x-Math.sin(st.yaw)*e.deltaY*.015,-4.4,4.4);
  desired.z=clamp(desired.z-Math.cos(st.yaw)*e.deltaY*.015,MINZ+1.5,MAXZ);
 }},{passive:false});
 window.addEventListener('keydown',e=>{
  if(e.target?.matches?.('input,textarea,select'))return;
  if(e.key==='Escape'){close();st.playing=false;sync();return;}
  if(st.detail)return;
  if(st.mode==='guided'&&['ArrowRight','ArrowLeft',' '].includes(e.key)){
   e.preventDefault();if(e.key==='ArrowRight')navigate(1);else if(e.key==='ArrowLeft')navigate(-1);else{st.playing=!st.playing;sync();}}
  keys.add(e.code);
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',()=>keys.clear());
 document.addEventListener('visibilitychange',()=>{if(document.hidden){st.playing=false;save(true);sync();}});
 window.addEventListener('pagehide',()=>save(true));
 window.addEventListener('resize',size);
}
function frame(){
 animation=requestAnimationFrame(frame);
 if(document.hidden)return;
 const dt=Math.min(.05,clock.getDelta()),s=1-Math.exp(-dt*3.7);
 if(st.entered&&st.mode==='free'&&!st.detail){
  const forward=new THREE.Vector3(-Math.sin(st.yaw),0,-Math.cos(st.yaw)),
        right=new THREE.Vector3(Math.cos(st.yaw),0,-Math.sin(st.yaw)),
        move=new THREE.Vector3();
  if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);
  if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);
  if(keys.has('KeyD'))move.add(right);
  if(keys.has('KeyA')||keys.has('KeyQ'))move.sub(right);
  if(move.lengthSq()){move.normalize().multiplyScalar(dt*3.6);desired.add(move);desired.x=clamp(desired.x,-4.4,4.4);desired.z=clamp(desired.z,MINZ+1.5,MAXZ);}
  orient.rotation.order='YXZ';orient.rotation.set(st.pitch,st.yaw,0);quat.copy(orient.quaternion);
  let nearest=0,dist=Infinity;for(let i=0;i<frames.length;i++){const d=Math.abs(frames[i].z-camera.position.z);if(d<dist){dist=d;nearest=i;}}
  if(nearest!==st.i){st.i=nearest;sync();}
 }
 if(st.entered&&st.mode==='guided'&&st.playing&&!st.detail){
  st.time+=dt;if(st.time>8){if(st.i===C-1){st.playing=false;sync();}else focus(st.i+1);}
 }
 camera.position.lerp(desired,s);camera.quaternion.slerp(quat,s);
 renderer.render(scene,camera);
 save();
}
function init(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,alpha:false,powerPreference:mobile?'low-power':'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 scene=new THREE.Scene();scene.background=new THREE.Color(0xe9e6e0);scene.fog=new THREE.Fog(0xe9e6e0,24,Math.max(52,Math.abs(MINZ)+16));
 camera=new THREE.PerspectiveCamera(61,1,.07,Math.abs(MINZ)+30);camera.position.set(0,1.73,4.5);
 raycaster=new THREE.Raycaster();texRay=new THREE.Vector2();clock=new THREE.Clock();
 construct();ui();controls();
 if(saved.mode==='free'&&Array.isArray(saved.pos)&&saved.pos.length===3){
  desired.set(clamp(Number(saved.pos[0])||0,-4.4,4.4),1.73,clamp(Number(saved.pos[2])||4.5,MINZ+1.5,MAXZ));
  camera.position.copy(desired);orient.rotation.order='YXZ';orient.rotation.set(st.pitch,st.yaw,0);quat.copy(orient.quaternion);camera.quaternion.copy(quat);
 }
 const hash=location.hash.match(/^#(?:art-)?(\d+)$/);
 if(hash){let idx=works.findIndex(w=>w.id===Number(hash[1]));if(idx<0&&Number(hash[1])<=C)idx=Number(hash[1])-1;if(idx>=0)st.i=idx;}
 if(st.mode==='guided')focus(st.i);
 size();sync();
 $('#loadbar').style.width='100%';$('#loadstate').textContent='GALERIE PRÊTE';$('#enter').hidden=false;
 $('#loader').classList.add('hidden');animation=requestAnimationFrame(frame);
}
try{init();}catch(e){console.error('Museum 3D init error',e);if(animation)cancelAnimationFrame(animation);window.TEMStartFallback?.(e);if(!window.TEMStartFallback){$('#loader').classList.add('hidden');$('#fallback').hidden=false;}}
