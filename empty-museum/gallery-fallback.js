/* THE UNREAL MUSEUM — offline-first canvas navigation.
 * This fallback has no CDN, no WebGL, no font dependency and no external assets.
 */
(() => {
"use strict";
if (window.__TEM_GALLERY_FALLBACK_STARTED) return;
window.__TEM_GALLERY_FALLBACK_STARTED = true;
const $=s=>document.querySelector(s), loader=$("#loader");
const old=$("#scene");if(!old)return;
const canvas=document.createElement("canvas");canvas.id="scene";canvas.setAttribute("aria-label","Galerie du musée, déplaçable par glissement");canvas.tabIndex=0;old.replaceWith(canvas);
const ctx=canvas.getContext("2d",{alpha:false}); if(!ctx)return;
const works=[
["AFTER THE RAIN","Maya · démo","ART / IMAGE","ChatGPT et génération d'image","Une ville au sortir de la pluie. Les lumières de l'architecture deviennent un souvenir.",0],
["FORM STUDY 04","Niko · démo","OBJET / 3D","ChatGPT et Blender","Une sculpture de matière née d'une recherche sur les volumes.",1],
["THE LAST SUN","Ana · démo","ART / IMAGE","ChatGPT et génération d'image","Une lumière qui paraît s'éteindre, mais laisse une couleur.",2],
["STAY CURIOUS","June · démo","TEXTE / DESIGN","ChatGPT et Figma","Une affiche comme une déclaration d'intention.",3],
["ARCHITECTURE 01","Eli · démo","ARCHITECTURE / 3D","ChatGPT et Rhino","Des structures qui s'élèvent autour de la lumière.",4],
["SOFT MACHINE","Rina · démo","ART / IMAGE","ChatGPT et génération d'image","L'alliance de l'organique et de la machine.",5],
["OCEAN INTERFACE","Sami · démo","INTERFACE / DESIGN","ChatGPT et Figma","Un langage graphique inspiré des cartes marines.",6],
["FOLD LAMP","Ana · démo","OBJET FABRIQUÉ","ChatGPT et Fusion 360","Une lampe modelée pour une lumière douce.",7],
["THE FIRST WALL","GBO Studio · démo","INSTALLATION","ChatGPT","Le manifeste du musée : un premier mur vide qui s'ouvre aux créations.",8]
];
const imageStyles=[["#142f33","#dfb99c"],["#c3b6a5","#716a62"],["#612d2e","#e9b781"],["#ede8d9","#a79a7c"],["#20343a","#b6c0bb"],["#d5bfb0","#686962"],["#102b37","#4cb0a5"],["#333b2e","#dec18c"],["#e8e4db","#a69c85"]];
const textures=works.map((w,i)=>{
 const a=document.createElement("canvas");a.width=480;a.height=560;const p=a.getContext("2d"),[c1,c2]=imageStyles[i],g=p.createLinearGradient(0,0,480,560);g.addColorStop(0,c1);g.addColorStop(1,c2);p.fillStyle=g;p.fillRect(0,0,480,560);
 p.save();
 if(i===0){for(let j=0;j<9;j++){p.fillStyle="#13242b";p.globalAlpha=.35+j*.04;p.fillRect(j*64-20,220-(j%3)*48,40,320);}p.globalAlpha=.4;p.fillStyle="#d9d3b4";for(let j=0;j<22;j++)p.fillRect((j*53)%480,455+(j*23)%90,80,2)}
 else if(i===1){p.translate(235,274);for(let j=0;j<8;j++){p.save();p.rotate(j*.79);p.strokeStyle=j%2?"#ded7c7":"#423e35";p.lineWidth=18;p.beginPath();p.ellipse(0,-18,52,146,.25,0,7);p.stroke();p.restore()}}
 else if(i===2){p.fillStyle="#ecbf87";p.beginPath();p.arc(250,250,138,0,7);p.fill();p.fillStyle="#482c31";p.fillRect(0,330,480,230);p.fillStyle="#9d625d";p.fillRect(0,320,480,6)}
 else if(i===3||i===8){p.fillStyle="#232521";p.textAlign="center";p.font="bold 56px Arial";if(i===3){p.fillText("STAY",240,215);p.fillText("CURIOUS",240,282)}else{p.font="bold 46px Arial";p.fillText("THE EMPTY",240,240);p.fillText("MUSEUM",240,305)}p.font="17px Georgia";p.fillText("A MUSEUM OF IDEAS",240,354)}
 else if(i===4){for(let j=0;j<9;j++){p.fillStyle=j%2?"#cbd2c8":"#657678";p.beginPath();p.moveTo(j*60-35,530);p.lineTo(j*60+3,140-j%3*30);p.lineTo(j*60+40,150-j%4*18);p.lineTo(j*60+100,530);p.fill()}}
 else if(i===5){for(let j=0;j<6;j++){const r=p.createRadialGradient(220+j%2*35,140+j*64,9,220+j%2*35,140+j*64,125);r.addColorStop(0,j%2?"#e8d3c6":"#ceb5ad");r.addColorStop(1,"#65706c00");p.fillStyle=r;p.beginPath();p.ellipse(240,140+j*64,145,69,j*.15,0,7);p.fill()}}
 else if(i===6){p.strokeStyle="#e1e5d6";p.globalAlpha=.28;for(let j=0;j<20;j++){p.beginPath();p.ellipse(240,305,42+j*11,30+j*15,j*.18,0,7);p.stroke()}p.globalAlpha=1;p.font="bold 34px Arial";p.fillStyle="#fff";p.fillText("OCEAN",42,80)}
 else if(i===7){p.fillStyle="#dfc290";p.shadowColor="#f0cc8e";p.shadowBlur=50;p.beginPath();p.ellipse(220,260,150,85,-.3,0,7);p.fill();p.shadowBlur=0;p.fillStyle="#504438";p.fillRect(214,322,16,171);p.fillRect(170,487,107,9)}
 p.restore();return a
});
let W=1,H=1,dpr=1,pos=0,target=0,selected=4,boxes=[],drag=null,started=false;
function resize(){const r=canvas.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,W<700?1.4:1.8);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function grad(a,b,y0=0,y1=H){const g=ctx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g}
function poly(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function draw(){
 if(!ctx)return; const hz=H*.23,bt=H*.78;
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle=grad("#f6f4ed","#dfdcd3");ctx.fillRect(0,0,W,H);
 // Perspective: bright rear white wall + receding ceiling and mineral floor.
 const left=-W*.19,right=W*1.19;
 poly([[0,0],[W,0],[right,hz],[left,hz]],grad("#f7f6ef","#e4e0d6",0,hz));
 poly([[0,H],[W,H],[right,bt],[left,bt]],grad("#e2ddd2","#f0ede5",bt,H));
 poly([[left,hz],[right,hz],[right,bt],[left,bt]],grad("#efeee9","#ebe8e1",hz,bt));
 // Cornices, accent glow, minimal brass edge and terrazzo floor joints.
 rect(0,hz, W, 2,"#d6d2c9");rect(0,bt-2,W,2,"#c5bbad");
 rect(0,bt+2,W,2,"#9f9075");
 for(let i=0;i<15;i++){const X=(i/14)*W;poly([[W/2+(X-W/2)*.25,bt],[W/2+(X-W/2)*1.4,H],[W/2+(X-W/2)*1.4+1,H],[W/2+(X-W/2)*.25+1,bt]],"#ccc7bc55")}
 for(let j=1;j<5;j++){const t=j/5;const y=bt+(H-bt)*t*t;rect(0,y,W,1,"#b8aea12c")}
 // Diffuse art lighting on a continuous museum wall.
 const sy=H*.35, unit=Math.max(115,Math.min(240,W*.215)),x0=W*.5-pos*unit;
 boxes=[];
 for(let i=0;i<works.length;i++){
  const X=x0+(i-4)*unit,aw=unit*.68,ah=Math.min(H*.39,unit*.91),Y=sy;
  if(X+aw/2< -50 || X-aw/2>W+50)continue;
  const light=ctx.createRadialGradient(X,Y-19,3,X,Y+ah*.27,Math.max(100,aw*1.2));light.addColorStop(0,"rgba(255,255,241,.65)");light.addColorStop(1,"rgba(255,255,241,0)");rect(X-aw*.9,Y-30,aw*1.8,ah+80,light);
  ctx.shadowBlur=12;ctx.shadowColor="rgba(44,39,30,.32)";rect(X-aw/2-6,Y-6,aw+12,ah+12,"#282824");ctx.shadowBlur=0;
  rect(X-aw/2-3,Y-3,aw+6,ah+6,"#ae9870");
  ctx.drawImage(textures[i],X-aw/2,Y,aw,ah);
  rect(X-28,Y+ah+13,56,19,"#dcd0b4");ctx.fillStyle="#413827";ctx.textAlign="center";ctx.font="bold 8px Arial";ctx.fillText("TEM / "+String(i+1).padStart(3,"0"),X,Y+ah+25);
  // Individual gallery spotlights, flush with the white ceiling.
  rect(X-18,hz-11,36,3,"#dfdbd2");rect(X-9,hz-8,18,2,"#f9ebc6");
  boxes.push({x:X-aw/2,y:Y,w:aw,h:ah,i});
 }
 // Architectural sign and subtly vignetted interior.
 ctx.textAlign="center";ctx.fillStyle="#998a69";ctx.font="bold "+Math.max(10,Math.min(15,W*.016))+"px Arial";ctx.letterSpacing="3px";
 ctx.fillText("THE UNREAL MUSEUM  /  ORIGINAL WALL 2026",W/2,Math.max(82,hz-52));
 const v=ctx.createRadialGradient(W/2,H/2,W*.1,W/2,H/2,W*.85);v.addColorStop(0,"#0000");v.addColorStop(1,"#625e5324");rect(0,0,W,H,v);
}
function focus(i,details=false){selected=(i+works.length)%works.length;target=selected-4;$("#navIndex").textContent=String(selected+1).padStart(2,"0")+" / 09";$("#zoneTitle").textContent=works[selected][0]+" — TEM / "+String(selected+1).padStart(3,"0");if(details)show(selected)}
function show(i){
const w=works[i];$("#detailNumber").textContent="COLLECTION / "+String(i+1).padStart(3,"0");$("#detailCategory").textContent=w[2];$("#detailTitle").textContent=w[0];$("#detailDescription").textContent=w[4];$("#detailAuthor").textContent=w[1];$("#detailTools").textContent=w[3];$("#detailThumb").style.backgroundImage="url("+textures[i].toDataURL("image/png")+")";
$("#detail").classList.add("open");$("#detail").setAttribute("aria-hidden","false");history.replaceState(null,"",location.pathname+"#"+(i+1))}
function close(){$("#detail").classList.remove("open");$("#detail").setAttribute("aria-hidden","true")}
function introOff(){$("#intro").classList.add("dismissed");started=true}
function next(d){close();introOff();focus(selected+d)}
function animate(){if(!document.hidden){const delta=target-pos; if(Math.abs(delta)>.001){pos+=delta*.13;draw()}}requestAnimationFrame(animate)}
canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,start:e.clientX,sy:e.clientY};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x;target=Math.max(-4,Math.min(4,target-dx/Math.max(115,Math.min(240,W*.215))));drag.x=e.clientX});
canvas.addEventListener("pointerup",e=>{if(!drag)return;const moved=Math.abs(e.clientX-drag.start)+Math.abs(e.clientY-drag.sy);drag=null;if(moved<12){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=boxes.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(hit){focus(hit.i,true);introOff()}}else{focus(Math.round(target+4),false);introOff()}});
canvas.addEventListener("wheel",e=>{e.preventDefault();target=Math.max(-4,Math.min(4,target+e.deltaY*.004));focus(Math.round(target+4),false);introOff()},{passive:false});
window.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")next(-1);if(e.key==="ArrowRight")next(1);if(e.key==="Escape")close()});
window.addEventListener("resize",resize);
$("#explore")?.addEventListener("click",()=>{introOff();focus(selected)});
$("#prev")?.addEventListener("click",()=>next(-1));$("#next")?.addEventListener("click",()=>next(1));
$("#random")?.addEventListener("click",()=>{close();introOff();focus(Math.floor(Math.random()*works.length),true)});
$("#closeDetail")?.addEventListener("click",close);
$("#share")?.addEventListener("click",async()=>{const url=location.origin+location.pathname+"#"+(selected+1);try{await navigator.clipboard.writeText(url);$("#share").textContent="LIEN COPIÉ ✓"}catch(e){prompt("Copier",url)}});
const fromHash=Number(location.hash.slice(1));if(fromHash>=1&&fromHash<=works.length)focus(fromHash-1,true);else focus(4);
$("#totalPieces").textContent="09";resize();animate();
if(loader){loader.classList.add("hidden");}
$("#graphicsLabel").textContent="GALERIE ACCESSIBLE · RENDU LOCAL";
})();