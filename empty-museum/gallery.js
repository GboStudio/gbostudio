import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js';
// A slower third-party CDN must not override the fully working local fallback.
if (window.__TEM_GALLERY_FALLBACK_STARTED || window.__TEM_GALLERY_FALLBACK_REQUESTED) throw new Error('Local museum gallery already requested');
const $=s=>document.querySelector(s);
const works=[
{title:'AFTER THE RAIN',author:'Maya · Démo',kind:'ART / IMAGE',tools:'ChatGPT + génération d’image',desc:'Le souvenir d’une ville après la pluie, retravaillé jusqu’à retrouver exactement la lumière imaginée.',theme:0,ratio:1.22},
{title:'FORM STUDY 04',author:'Niko · Démo',kind:'OBJET / 3D',tools:'ChatGPT + Blender',desc:'Une étude de mobilier née du dialogue entre contraintes physiques et imagination artificielle.',theme:1,ratio:.76},
{title:'THE LAST SUN',author:'Ana · Démo',kind:'ART / IMAGE',tools:'ChatGPT + génération d’image',desc:'Une recherche abstraite sur les couleurs du crépuscule et la géométrie du silence.',theme:2,ratio:1.13},
{title:'STAY CURIOUS',author:'June · Démo',kind:'TEXTE / DESIGN',tools:'ChatGPT + Figma',desc:'Une phrase devenue affiche, pensée comme une déclaration visible au milieu du musée.',theme:3,ratio:.8},
{title:'ARCHITECTURE 01',author:'Eli · Démo',kind:'ARCHITECTURE / 3D',tools:'ChatGPT + Rhino',desc:'Une architecture fictive qui grandit autour de la lumière, plutôt qu’autour d’un terrain.',theme:4,ratio:1.12},
{title:'SOFT MACHINE',author:'Rina · Démo',kind:'ART / IMAGE',tools:'ChatGPT + génération d’image',desc:'Un dialogue entre la douceur des formes organiques et la précision du métal.',theme:5,ratio:.84},
{title:'OCEAN INTERFACE',author:'Sami · Démo',kind:'INTERFACE / DESIGN',tools:'ChatGPT + Figma',desc:'Un système de navigation dont l’interface s’inspire des cartes marines.',theme:6,ratio:1.18},
{title:'FOLD LAMP',author:'Ana · Démo',kind:'OBJET FABRIQUÉ',tools:'ChatGPT + Fusion 360',desc:'Une lampe modélisée et itérée à l’aide de l’IA avant son prototypage.',theme:7,ratio:.8},
{title:'THE FIRST WALL',author:'GBO Studio · Démo',kind:'INSTALLATION',tools:'ChatGPT + Three.js',desc:'Le manifeste du musée : tout commence par un mur vide.',theme:8,ratio:1.3}
];
const state={selected:4,targetX:0,currentX:0,look:0,active:false,pointerDown:null,materials:0};
let scene,camera,renderer,raycaster,artMeshes=[],clock,still=0;
const W=32,H=6.8,far=-14.2;
const marker=$('#loadstate'),loader=$('#loader'),loadbar=$('#loadbar');
function paintTexture(theme){
const c=document.createElement('canvas');c.width=720;c.height=840;const x=c.getContext('2d');const g=(a,b)=>{const z=x.createLinearGradient(0,0,720,840);z.addColorStop(0,a);z.addColorStop(1,b);x.fillStyle=z;x.fillRect(0,0,720,840)};
if(theme===0){g('#152a2c','#e1b8a1');for(let i=0;i<11;i++){x.fillStyle='rgba(15,40,45,'+(0.13+i*.035)+')';x.fillRect(i*75-60,350-(i%4)*56,55+i%2*12,470)}x.fillStyle='#e7d4ba';x.fillRect(0,630,720,24);for(let i=0;i<33;i++){x.fillStyle='rgba(238,222,194,.2)';x.fillRect((i*71)%720,645+(i*23)%120,90,2)}}
if(theme===1){g('#cfc9b8','#a49b87');x.translate(355,390);for(let j=0;j<8;j++){x.save();x.rotate(j*Math.PI/4);x.strokeStyle=j%2?'#4b4335':'#82715b';x.lineWidth=22-j;x.beginPath();x.ellipse(0,-36,92+j*7,210-j*8,.15,0,Math.PI*2);x.stroke();x.restore()}x.fillStyle='#16130e';x.fillRect(-110,170,220,8)}
if(theme===2){g('#532c2c','#c49d85');const gr=x.createRadialGradient(350,305,20,350,305,290);gr.addColorStop(0,'#eee1b4');gr.addColorStop(.45,'#d89965');gr.addColorStop(1,'rgba(182,73,48,0)');x.fillStyle=gr;x.fillRect(0,0,720,840);x.fillStyle='#311c26';x.fillRect(0,490,720,350);x.beginPath();x.ellipse(345,470,290,260,0,0,Math.PI);x.fill();x.fillStyle='#e9cb9d';x.beginPath();x.arc(345,420,175,0,Math.PI*2);x.fill();x.fillStyle='#3c2428';x.fillRect(0,484,720,356)}
if(theme===3){g('#e9e7de','#dfdacc');x.fillStyle='#232723';x.textAlign='center';x.font='800 110px Arial';x.fillText('STAY',360,245);x.fillText('CURIOUS',360,355);x.font='24px Georgia';x.fillText('LONGER THAN YOU',360,460);x.fillText('STAY CERTAIN.',360,500);x.fillStyle='#9b865b';x.fillRect(140,575,440,4)}
if(theme===4){g('#1e2829','#728486');for(let i=0;i<9;i++){let xx=i*100-60;x.fillStyle=i%2?'#d7d9cd':'#aeb6b1';x.beginPath();x.moveTo(xx,800);x.lineTo(xx+30,240-i%3*45);x.lineTo(xx+85,210-i%4*35);x.lineTo(xx+190,800);x.closePath();x.fill()}x.fillStyle='#304042';x.fillRect(0,700,720,140);for(let i=0;i<17;i++){x.strokeStyle='#4c5550';x.beginPath();x.moveTo(0,i*49);x.lineTo(720,i*49);x.stroke()}}
if(theme===5){g('#d1c7b7','#aaa395');for(let i=0;i<4;i++){const y=150+i*172;let grd=x.createRadialGradient(360,y,10,360,y,150);grd.addColorStop(0,i%2?'#f1d9c5':'#d9bfb3');grd.addColorStop(.7,i%2?'#ad9b9a':'#8d9491');grd.addColorStop(1,'rgba(48,52,56,0)');x.fillStyle=grd;x.beginPath();x.ellipse(370+(i%2)*75-35,y,190,110,i%2?.45:-.45,0,Math.PI*2);x.fill()}}
if(theme===6){g('#101f2d','#3a8f9c');for(let i=0;i<20;i++){x.strokeStyle='rgba(231,240,216,'+(0.09+i*.008)+')';x.lineWidth=1;x.beginPath();x.ellipse(330,440,100+i*22,120+i*25,i*.19,0,Math.PI*2);x.stroke()}x.fillStyle='#e9f0d7';x.font='bold 40px Arial';x.fillText('OCEAN',65,100);x.font='17px Arial';x.fillText('NAVIGATION INTERFACE / 01',65,133)}
if(theme===7){g('#222821','#7f7968');x.fillStyle='#dfc18a';x.shadowColor='#dfbc78';x.shadowBlur=90;x.beginPath();x.ellipse(340,343,190,130,-.4,0,Math.PI*2);x.fill();x.shadowBlur=0;x.fillStyle='#484338';x.fillRect(320,400,40,310);x.fillStyle='#b9aea2';x.fillRect(250,680,180,12)}
if(theme===8){g('#f5f1e9','#d7d3ca');x.fillStyle='#1d1e1c';x.textAlign='center';x.font='800 68px Arial';x.fillText('THE EMPTY',360,335);x.fillText('MUSEUM',360,416);x.font='20px Georgia';x.fillText('It starts with one wall.',360,470);x.strokeStyle='#988555';x.lineWidth=3;x.strokeRect(68,66,584,708)}
const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return {tex,url:c.toDataURL('image/jpeg',.86)}}
function bakedLightmap(area){
const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
ctx.fillStyle=area==='wall'?'#a6a39c':'#888782';ctx.fillRect(0,0,512,256);
const lamps=area==='wall'?10:9;
for(let i=0;i<lamps;i++){let px=(i+.5)*512/lamps;let py=area==='wall'?104:95;let gr=ctx.createRadialGradient(px,py,2,px,py,area==='wall'?87:105);gr.addColorStop(0,area==='wall'?'rgba(251,244,223,.57)':'rgba(255,244,216,.28)');gr.addColorStop(1,'rgba(255,249,229,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,512,256)}
let edge=ctx.createLinearGradient(0,0,0,256);edge.addColorStop(0,'rgba(36,37,36,.08)');edge.addColorStop(.34,'rgba(255,246,216,.08)');edge.addColorStop(1,'rgba(44,39,29,.24)');ctx.fillStyle=edge;ctx.fillRect(0,0,512,256);
const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex}
function withUv2(g){g.setAttribute('uv2',g.attributes.uv.clone());return g}
const CDN='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/';
function texture(url,repeatX,repeatY,color){
const l=new THREE.TextureLoader();l.setCrossOrigin('anonymous');
l.load(url,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=renderer.capabilities.getMaxAnisotropy()>=4?4:2;if(color)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;state.materials++;},undefined,()=>{});
return l}
function pbrMaterial(name,rx,ry,base,roughness,lightMap){
const m=new THREE.MeshStandardMaterial({color:base,roughness,metalness:0,lightMap,lightMapIntensity:.9});
const l=new THREE.TextureLoader();l.setCrossOrigin('anonymous');
function fetch(suffix,apply,cs){const url=CDN+name+'/'+name+'_'+suffix+'_1k.jpg';l.load(url,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;if(cs)t.colorSpace=THREE.SRGBColorSpace;apply(t);m.needsUpdate=true;state.materials++;},undefined,()=>{});}
fetch('diff',t=>{m.map=t;},true);fetch('nor_gl',t=>{m.normalMap=t;m.normalScale.set(.26,.26)},false);fetch('rough',t=>{m.roughnessMap=t},false);
return m}
function box(w,h,d,mat,x,y,z,shadows=false){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.receiveShadow=shadows;scene.add(o);return o}
function createRoom(){
const lightWall=bakedLightmap('wall'),lightFloor=bakedLightmap('floor');
const wallmat=pbrMaterial('white_plaster_02',14,2,.96,.86,lightWall);
const floormat=pbrMaterial('marble_01',9,4,0xffffff,.4,lightFloor);
const ceilmat=new THREE.MeshStandardMaterial({color:0xf3f1e9,roughness:.94});
const wall= new THREE.Mesh(withUv2(new THREE.PlaneGeometry(W,H)),wallmat);wall.position.set(0,H/2,far);wall.receiveShadow=true;scene.add(wall);
const floor=new THREE.Mesh(withUv2(new THREE.PlaneGeometry(W,26)),floormat);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.016,-3.6);floor.receiveShadow=true;scene.add(floor);
const ceiling=box(W,.30,26,ceilmat,0,H+.15,-3.8);
const sideMat=new THREE.MeshStandardMaterial({color:0xe5e2d9,roughness:.91});
box(.36,H,26,sideMat,-W/2, H/2,-3.8);box(.36,H,26,sideMat,W/2,H/2,-3.8);
const plinth=new THREE.MeshStandardMaterial({color:0xa7a197,roughness:.6});
box(W,.12,.13,plinth,0,.09,far+.08);box(W,.045,.13,plinth,0,H-.06,far+.09);
const trim=new THREE.MeshStandardMaterial({color:0x7c7060,metalness:.48,roughness:.35});
box(W,.025,.05,trim,0,.24,far+.15);
for(let i=0;i<10;i++){
 const x=-14.4+i*3.2;
 const light=new THREE.Mesh(new THREE.BoxGeometry(.52,.055,1.3),new THREE.MeshBasicMaterial({color:0xfffdf1}));
 light.position.set(x,H-.045,-10.4);scene.add(light);
 const slot=box(.67,.028,1.48,new THREE.MeshStandardMaterial({color:0xb2ada2,roughness:.78}),x,H-.025,-10.4);
 const spot=new THREE.SpotLight(0xffeed4,2.2,16,.46,.72,1.3);spot.position.set(x,H-.22,-10.4);spot.target.position.set(x,2.85,far+.15);scene.add(spot,spot.target);
 const down=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.05,24),new THREE.MeshStandardMaterial({color:0xd3c7ae,roughness:.48,metalness:.25}));
 down.rotation.x=Math.PI/2;down.position.set(x,H-.05,-11.55);scene.add(down);
}
for(let i=0;i<13;i++){const x=-15.1+i*2.6;
 const gap=box(.013,H,.017,new THREE.MeshStandardMaterial({color:0xeae7df,roughness:.9}),x,H/2,far+.014);
}
const tmat=new THREE.MeshStandardMaterial({color:0x9e8a61,metalness:.65,roughness:.31});
const steel=new THREE.MeshStandardMaterial({color:0x464644,metalness:.74,roughness:.36});
for(let i=-1;i<=1;i++){
 const pole= new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.55,12),steel);pole.position.set(i*3.4,.28,2);scene.add(pole);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.038,26),steel);base.position.set(i*3.4,.03,2);scene.add(base)
}
const markCanvas=document.createElement('canvas');markCanvas.width=1024;markCanvas.height=256;const cx=markCanvas.getContext('2d');cx.fillStyle='#b6a178';cx.font='bold 54px Arial';cx.textAlign='center';cx.fillText('THE ORIGINAL WALL   ·   2026',512,132);
const signTex=new THREE.CanvasTexture(markCanvas);signTex.colorSpace=THREE.SRGBColorSpace;
const sign=new THREE.Mesh(new THREE.PlaneGeometry(4,.95),new THREE.MeshBasicMaterial({map:signTex,transparent:true,depthWrite:false}));sign.position.set(0,5.9,far+.07);scene.add(sign);
return {wallmat,floormat}}
function createArt(){
const frame=new THREE.MeshStandardMaterial({color:0x32312d,roughness:.34,metalness:.45});
const gold=new THREE.MeshStandardMaterial({color:0xae9361,roughness:.27,metalness:.76});
const labelMat=new THREE.MeshStandardMaterial({color:0xf1e9d7,roughness:.7});
const plaqueCanvas=(work,i)=>{const c=document.createElement('canvas');c.width=480;c.height=130;const g=c.getContext('2d');g.fillStyle='#e4dbc4';g.fillRect(0,0,480,130);g.fillStyle='#282621';g.font='bold 24px Arial';g.fillText(work.title.slice(0,24),20,44);g.font='18px Arial';g.fillText(work.author,20,76);g.font='14px Arial';g.fillText('TEM / '+String(i+1).padStart(3,'0'),20,105);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
works.forEach((w,i)=>{
 const x=-13.15+i*3.28,ratio=w.ratio,h=2.35,ww=h*ratio;
 const art=paintTexture(w.theme);w.image=art.url;
 let fr=box(ww+.17,h+.17,.09,frame,x,3.28,far+.15,true);
 let goldrim=box(ww+.08,h+.08,.047,gold,x,3.28,far+.225);
 let plane=new THREE.Mesh(new THREE.PlaneGeometry(ww,h),new THREE.MeshStandardMaterial({map:art.tex,roughness:.78,metalness:0}));
 plane.position.set(x,3.28,far+.255);plane.userData.work=i;scene.add(plane);artMeshes.push(plane);
 const glare=new THREE.Mesh(new THREE.PlaneGeometry(ww,h),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.1,metalness:0,transmission:0,transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false}));
 glare.position.set(x,3.28,far+.265);scene.add(glare);
 let plaque=new THREE.Mesh(new THREE.PlaneGeometry(.94,.26),new THREE.MeshStandardMaterial({map:plaqueCanvas(w,i),roughness:.53,metalness:.03}));
 plaque.position.set(x,1.61,far+.19);scene.add(plaque);
 const screw=new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.008,12),gold);screw.rotation.x=Math.PI/2;screw.position.set(x-.43,1.61,far+.199);scene.add(screw);
});
$('#totalPieces').textContent=String(works.length).padStart(2,'0')}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xe7e5df);scene.fog=new THREE.Fog(0xe6e4dd,15,49);
 camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.08,110);camera.position.set(0,2.2,10.5);camera.lookAt(0,3.05,far);
 renderer=new THREE.WebGLRenderer({canvas:$('#scene'),antialias:!(innerWidth<720),alpha:false,powerPreference:innerWidth<720?'low-power':'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,innerWidth<720?1.45:1.75));renderer.setSize(innerWidth,innerHeight,false);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
 renderer.shadowMap.enabled=false;
 scene.add(new THREE.AmbientLight(0xfff8ec,1.0));scene.add(new THREE.HemisphereLight(0xffffff,0xc1b5a6,1.45));
 const sun=new THREE.DirectionalLight(0xffffff,1.45);sun.position.set(2,8,8);scene.add(sun);
 createRoom();createArt();raycaster=new THREE.Raycaster();clock=new THREE.Clock();
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{state.pointerDown={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now()};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!state.pointerDown)return;const delta=e.clientX-state.pointerDown.x;state.targetX=THREE.MathUtils.clamp(state.targetX-delta*.024,-12.2,12.2);state.pointerDown.x=e.clientX;state.pointerDown.y=e.clientY});
 canvas.addEventListener('pointerup',e=>{if(!state.pointerDown)return;const dx=Math.abs(e.clientX-state.pointerDown.sx),dy=Math.abs(e.clientY-state.pointerDown.sy);state.pointerDown=null;if(dx<9&&dy<9){const rect=canvas.getBoundingClientRect();const p=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(p,camera);const found=raycaster.intersectObjects(artMeshes,false);if(found.length)select(found[0].object.userData.work,true)}});
 canvas.addEventListener('wheel',e=>{e.preventDefault();state.targetX=THREE.MathUtils.clamp(state.targetX+e.deltaY*.013,-12.2,12.2)},{passive:false});
 window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')navigate(-1);if(e.key==='ArrowRight')navigate(1);if(e.key==='Escape')closeDetails()});
 window.addEventListener('resize',()=>{const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.fov=w<720?69:55;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<720?1.45:1.75));renderer.setSize(w,h,false)});
 const hash=parseInt(location.hash.slice(1),10);if(hash>0&&hash<=works.length)select(hash-1,true);
 render()}
function render(){requestAnimationFrame(render);if(document.hidden)return;
 const dt=Math.min(clock.getDelta(),.05),smooth=1-Math.exp(-dt*3.3);
 state.currentX+=(state.targetX-state.currentX)*smooth;
 camera.position.x=state.currentX;camera.position.z=innerWidth<600?11.7:10.5;camera.position.y=innerWidth<600?2.1:2.28;
 camera.lookAt(state.currentX*.85,3.05,far);renderer.render(scene,camera)}
function select(i,open){state.selected=(i+works.length)%works.length;const w=works[state.selected];state.targetX=THREE.MathUtils.clamp(-13.15+state.selected*3.28,-12.2,12.2);$('#navIndex').textContent=String(state.selected+1).padStart(2,'0')+' / '+String(works.length).padStart(2,'0');$('#zoneTitle').textContent=w.title+' — TEM / '+String(state.selected+1).padStart(3,'0');if(open)showDetails(w,state.selected)}
function showDetails(w,i){$('#detailNumber').textContent='COLLECTION / '+String(i+1).padStart(3,'0');$('#detailCategory').textContent=w.kind;$('#detailTitle').textContent=w.title;$('#detailDescription').textContent=w.desc;$('#detailAuthor').textContent=w.author;$('#detailTools').textContent=w.tools;$('#detailThumb').style.backgroundImage='url('+w.image+')';$('#detail').classList.add('open');$('#detail').setAttribute('aria-hidden','false');history.replaceState(null,'',location.pathname+'#'+(i+1))}
function closeDetails(){$('#detail').classList.remove('open');$('#detail').setAttribute('aria-hidden','true')}
function navigate(dir){closeDetails();select(state.selected+dir,false);dismissIntro()}
function dismissIntro(){$('#intro').classList.add('dismissed');state.active=true}
$('#explore').addEventListener('click',()=>{dismissIntro();select(state.selected,false)});
$('#prev').addEventListener('click',()=>navigate(-1));$('#next').addEventListener('click',()=>navigate(1));
$('#random').addEventListener('click',()=>{closeDetails();dismissIntro();select(Math.floor(Math.random()*works.length),true)});
$('#closeDetail').addEventListener('click',closeDetails);
$('#share').addEventListener('click',async()=>{const link=location.origin+location.pathname+'#'+(state.selected+1);try{await navigator.clipboard.writeText(link);$('#share').textContent='LIEN COPIÉ ✓';setTimeout(()=>$('#share').textContent='COPIER LE LIEN DE CETTE ŒUVRE ↗',1800)}catch(e){prompt('Copier ce lien',link)}});
function ready(){loadbar.style.width='100%';marker.textContent='GALERIE PRÊTE';$('#enter').hidden=false;$('#enter').addEventListener('click',()=>loader.classList.add('hidden'));setTimeout(()=>loader.classList.add('hidden'),1100)}
try{loadbar.style.width='32%';init();loadbar.style.width='79%';ready()}catch(e){console.error('Three.js gallery error:',e);window.TEMStartFallback?.(e);if(!window.TEMStartFallback){loader.classList.add('hidden');$('#fallback').hidden=false}}
