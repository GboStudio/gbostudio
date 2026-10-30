import * as THREE from "three";
import {getModel,loadModel,disposeModel} from "./models3d.js";
import {buildMuseumScenography} from "./scenography.js";
import {createMuseumV5Navigation} from "./museum-v5.js";

(() => {
  "use strict";
  // V5 styling is loaded only with WebGL: the 2D fallback retains its controls.
  const cinematicStyle=document.createElement("link");
  cinematicStyle.rel="stylesheet";
  cinematicStyle.href="./museum-v5.css?v=20261030visual5";
  document.head.appendChild(cinematicStyle);
  const overlay = document.getElementById("walkOverlay");
  const canvas = document.getElementById("walkCanvas");
  if (!overlay || !canvas || !window.TEM) return;
  if (!window.WebGLRenderingContext) throw new Error("WebGL unavailable");
  const $ = s => document.querySelector(s);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const mobile = matchMedia("(pointer:coarse)").matches;
  const HALF = 4.6, HEIGHT = 6.4, STEP = 3.5, LENGTH = 9 + window.TEM.getSlots().length*STEP;
  const WARM = 0xf6f4ee, WHITE = 0xf9f8f5;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f4ef);
  scene.fog = new THREE.FogExp2(0xeceae5,0.0052);
  const camera = new THREE.PerspectiveCamera(mobile?69:64,1,.07,240);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xf5f4ef,1);

  scene.add(new THREE.HemisphereLight(0xfffcf4,0xc8c1b7,1.45));
  const ambient = new THREE.AmbientLight(0xfff9f0,.32);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfffaf0,1.75);
  sun.position.set(-8,18,15);
  if (!mobile) {
    sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-15;sun.shadow.camera.right=15;
    sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
    sun.shadow.camera.near=.5;sun.shadow.camera.far=60;
    sun.shadow.bias=-.0003;
  }
  scene.add(sun);

  const material=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const stone=material(0xf1eee7,.68), stoneAlt=material(0xece9e2,.78);
  const floorMat=material(0xdedcd4,.43), grout=material(0xc7c5bd,.94);
  const plinthMat=material(0xf9f8f3,.49), inlay=material(0xc5bba9,.43,.35);
  const brass=material(0xab9c83,.3,.63), lightTrim=new THREE.MeshBasicMaterial({color:0xffefcf});
  const glass=material(0xe8f2e7,.16,.15);
  const artBacking=material(0xf9f7f1,.85);
  const darkStone=material(0x555951,.66);

  const architecture=new THREE.Group(), interactive=new THREE.Group();
  scene.add(architecture,interactive);
  const clickable=[];
  const metalLines=[];
  function mesh(parent,geometry,mat,x=0,y=0,z=0,cast=false,receive=false){
    const m=new THREE.Mesh(geometry,mat);
    m.position.set(x,y,z);m.castShadow=cast&&!mobile;m.receiveShadow=receive&&!mobile;
    parent.add(m);return m;
  }
  function box(parent,w,h,d,mat,x,y,z,cast=false,receive=false){
    return mesh(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z,cast,receive);
  }
  function cylinder(parent,rt,rb,h,mat,x,y,z,segments=24){
    return mesh(parent,new THREE.CylinderGeometry(rt,rb,h,segments),mat,x,y,z,true);
  }
  function surface(parent,w,h,mat,x,y,z,rotY=0){
    const m=mesh(parent,new THREE.PlaneGeometry(w,h),mat,x,y,z);
    m.rotation.y=rotY;return m;
  }
  function markInteractive(m,slot){
    m.userData.target=slot;clickable.push(m);
    return m;
  }

  // Deterministic, unique marble slabs and fine-grain limestone, generated locally.
  function stoneTexture(){
    const c=document.createElement("canvas");c.width=512;c.height=512;
    const g=c.getContext("2d");
    g.fillStyle="#eae8e3";g.fillRect(0,0,512,512);
    for(let i=0;i<1100;i++){
      const x=(i*239.81)%512,y=(i*143.47)%512;
      g.fillStyle=i%3?"rgba(120,112,97,.018)":"rgba(255,255,255,.065)";
      g.fillRect(x,y,i%7?1.5:3,1);
    }
    g.strokeStyle="rgba(82,78,66,.10)";g.lineWidth=1.2;
    for(let y=0;y<=512;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
    for(let x=0;x<=512;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,512);g.stroke();}
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,LENGTH/10);
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  const tileMat=material(0xffffff,.32);
  tileMat.map=stoneTexture();tileMat.bumpMap=tileMat.map;tileMat.bumpScale=.024;tileMat.needsUpdate=true;
  box(architecture,HALF*2,.28,LENGTH,tileMat,0,-.16,LENGTH/2,false,true);
  // WHITE CEILING: layered plaster vault, completely free from exhibits at launch.
  // All ceiling pieces are concealed until the wall gallery reaches capacity.
  const ceilingPlaster=material(0xffffff,.81);
  const ceilingRelief=material(0xfafaf8,.75);
  const ceilingShadow=material(0xe8e8e3,.92);
  const ceilingLED=new THREE.MeshBasicMaterial({color:0xfafffb,side:THREE.DoubleSide});
  box(architecture,HALF*2,.34,LENGTH,ceilingPlaster,0,HEIGHT+.19,LENGTH/2);
  // Recessed white skylight: no dark glass, colored fixtures or hanging frames.
  box(architecture,2.90,.10,LENGTH,ceilingRelief,0,HEIGHT-.012,LENGTH/2);
  box(architecture,2.67,.029,LENGTH,ceilingLED,0,HEIGHT-.077,LENGTH/2);
  for(const side of [-1,1]){
    // A quiet plaster reveal gives depth to the apparently seamless white ceiling.
    box(architecture,.070,.09,LENGTH,ceilingShadow,side*1.48,HEIGHT-.105,LENGTH/2);
    box(architecture,.044,.031,LENGTH,ceilingLED,side*1.39,HEIGHT-.148,LENGTH/2);
  }
  for(const side of [-1,1]){
    box(architecture,.22,HEIGHT,LENGTH,side<0?stone:stoneAlt,side*(HALF+.03),HEIGHT/2,LENGTH/2);
    box(architecture,.22,.34,LENGTH,plinthMat,side*(HALF-.02),.17,LENGTH/2);
    box(architecture,.028,.045,LENGTH,brass,side*2.45,.022,LENGTH/2);
    box(architecture,.045,.07,LENGTH,lightTrim,side*(HALF-.22),HEIGHT-.26,LENGTH/2);
    box(architecture,.09,.14,LENGTH,plinthMat,side*(HALF-.22),HEIGHT-.17,LENGTH/2);
  }
  // Pacing: recurring pale stone ribs make a 142 m journey feel like a real museum.
  for(let z=2.4;z<LENGTH-1;z+=7.1){
    for(const side of [-1,1]){
      box(architecture,.35,HEIGHT-.19,.48,stoneAlt,side*(HALF-.19),(HEIGHT-.19)/2,z,true);
      box(architecture,.18,HEIGHT-.3,.22,plinthMat,side*(HALF-.46),(HEIGHT-.3)/2,z);
      box(architecture,.06,HEIGHT-.65,.07,lightTrim,side*(HALF-.57),(HEIGHT-.45)/2,z);
      box(architecture,1.1,.12,.58,stone,side*(HALF-.33),HEIGHT-.15,z);
    }
    // White plaster transverse beams replace the old bronze roof bands.
    box(architecture,HALF*2-.6,.19,.44,ceilingRelief,0,HEIGHT-.08,z);
    box(architecture,HALF*2-.63,.017,.47,ceilingLED,0,HEIGHT-.25,z);
    // One soft local light for every third architectural rib; strong daylight
    // and emissive trims cover the gaps without excessive mobile GPU cost.
    if(Math.round((z-2.4)/7.1)%3===0){
      const light=new THREE.PointLight(0xffeedc,mobile?4:9,mobile?10:14,2);
      light.position.set(0,HEIGHT-.65,z);
      architecture.add(light);
    }
  }
  // Five monumental white-on-white sculpted oculi.
  // Light grazing the nested reliefs guides the eye upward while the ceiling
  // remains white, uncluttered and technically ready for later exhibitions.
  const ceilingOculi=[21,48,76,104,138];
  const oculusGroups=[];
  const reliefRings=[1.15,1.53,1.91];
  for(const [index,z] of ceilingOculi.entries()){
    const gallery=new THREE.Group();
    gallery.position.set(0,HEIGHT-.25,z);
    architecture.add(gallery);
    oculusGroups.push(gallery);
    const backplate=new THREE.Mesh(
      new THREE.CylinderGeometry(2.13,2.13,.085,64),ceilingShadow);
    backplate.position.y=.045;gallery.add(backplate);
    const whiteLens=new THREE.Mesh(
      new THREE.CylinderGeometry(1.07,1.07,.078,64),
      new THREE.MeshStandardMaterial({
        color:0xfdfefa,roughness:.58,metalness:0,
        emissive:0xf5faf2,emissiveIntensity:.15
      })
    );
    whiteLens.position.y=-.007;gallery.add(whiteLens);
    for(const [i,radius] of reliefRings.entries()){
      const relief=new THREE.Mesh(
        new THREE.TorusGeometry(radius,i===0?.080:.058,12,72),
        i===1?ceilingPlaster:ceilingRelief
      );
      relief.rotation.x=Math.PI/2;
      relief.position.y=-.071-(i*.016);
      gallery.add(relief);
    }
    const innerGlow=new THREE.Mesh(
      new THREE.RingGeometry(.97,1.01,64),
      ceilingLED
    );
    innerGlow.rotation.x=Math.PI/2;
    innerGlow.position.y=-.116;
    gallery.add(innerGlow);
    // Recessed radial relief accents echo fine museum plasterwork.
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6;
      const rad=1.74;
      const relief=box(gallery,.035,.046,.27,ceilingRelief,
        Math.cos(a)*rad,-.084,Math.sin(a)*rad);
      relief.rotation.y=-a;
    }
    if(!mobile && index%2===0){
      const softLight=new THREE.PointLight(0xffffff,2.3,11,2);
      softLight.position.set(0,HEIGHT-1.35,z);
      architecture.add(softLight);
    }
  }
  // White flush-integrated mounting rails: prepared for six future ceiling slots.
  // These barely visible plates never look like empty picture frames.
  for(const z of [18,40,62,85,109,132]){
    box(architecture,.96,.019,.075,ceilingRelief,0,HEIGHT-.18,z);
    for(const side of [-1,1]){
      box(architecture,.055,.013,.14,ceilingPlaster,side*.37,HEIGHT-.201,z);
    }
  }
  // A genuinely varied museum with full-scale portals, fluted limestone bays,
  // discreet visitor rests, inlaid medallions and exhibit-focused track lights.
  const museumArtDirection=buildMuseumScenography({
    scene,architecture,half:HALF,height:HEIGHT,length:LENGTH,mobile
  });
  // Entrance architecture and monumental branding, integrated into the stone.
  box(architecture,8.95,HEIGHT,.19,stone,0,HEIGHT/2,LENGTH+.08);
  box(architecture,7.95,.045,.07,brass,0,2.55,LENGTH-.05);
  box(architecture,8.95,HEIGHT,.17,stoneAlt,0,HEIGHT/2,-.36);
  // Signature architectural inscription: embedded into the very first portal,
  // not an on-screen graphic. White stone, hairline bronze and engraved text.
  const portalSign=new THREE.Group();
  portalSign.position.set(0,5.00,4.18);
  architecture.add(portalSign);
  box(portalSign,4.12,.69,.105,plinthMat,0,0,0,true);
  box(portalSign,4.16,.018,.125,brass,0,.35,0);
  box(portalSign,4.16,.018,.125,brass,0,-.35,0);
  const portalInk=canvasTexture((g,w,h)=>{
    g.clearRect(0,0,w,h);
    g.textAlign="center";
    g.fillStyle="#75654b";
    g.font="56px Georgia, serif";
    g.letterSpacing="3px";
    g.fillText("THE EMPTY MUSEUM",w/2,104);
    g.fillStyle="#a69b88";
    g.font="22px Arial, sans-serif";
    g.letterSpacing="5px";
    g.fillText("A PLACE FOR WHAT WE CREATE",w/2,156);
  },1024,256);
  const inscription=new THREE.MeshBasicMaterial({map:portalInk,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const portalFront=surface(portalSign,3.95,.61,inscription,0,0,-.067,Math.PI);
  portalFront.renderOrder=3;
  // Neutral architectural inset lines on the central walkway.
  for(const side of [-1,1]){
    box(architecture,.035,.015,LENGTH,brass,side*1.72,.023,LENGTH/2);
  }
  for(let z=3;z<LENGTH;z+=7){
    box(architecture,HALF*2,.012,.022,grout,0,.027,z);
  }
  function canvasTexture(painter,w=768,h=512){
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const g=c.getContext("2d");painter(g,w,h);
    const t=new THREE.CanvasTexture(c);
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;return t;
  }
  function fitLines(g,text,x,y,maxWidth,lineHeight,maxLines=3){
    const words=String(text||"").trim().split(/\s+/),lines=[];
    let line="";
    for(const word of words){
      const trial=line?line+" "+word:word;
      if(line && g.measureText(trial).width>maxWidth){lines.push(line);line=word;}
      else line=trial;
    }
    if(line)lines.push(line);
    lines.slice(0,maxLines).forEach((s,i)=>g.fillText(s,x,y+i*lineHeight,maxWidth));
  }
  const stamp=canvasTexture((g,w,h)=>{
    g.clearRect(0,0,w,h);g.fillStyle="#252823";
    g.font="400 83px Georgia";g.textAlign="center";g.fillText("THE EMPTY MUSEUM",w/2,176);
    g.fillStyle="#88867f";g.font="600 24px Arial";g.letterSpacing="6px";g.fillText("A SPACE FOR WHAT WE CREATE",w/2,260);
    g.fillStyle="#aa9d86";g.fillRect(w/2-35,300,70,2);
  },1280,420);
  const welcome=surface(architecture,7.1,2.33,new THREE.MeshBasicMaterial({map:stamp,transparent:true,side:THREE.DoubleSide,depthWrite:false}),0,4.85,7.9,Math.PI);
  welcome.renderOrder=4;

  // Materials for artworks are produced at runtime; uploaded images remain visible.
  function artworkTexture(piece,w=768,h=550){
    return canvasTexture((g,W,H)=>{
      const hue=(Number(piece.id)*51)%360;
      const grad=g.createLinearGradient(0,0,W,H);
      grad.addColorStop(0,"hsl("+hue+",20%,75%)");
      grad.addColorStop(.65,"hsl("+((hue+45)%360)+",16%,89%)");
      grad.addColorStop(1,"hsl("+((hue+152)%360)+",20%,64%)");
      g.fillStyle=grad;g.fillRect(0,0,W,H);
      const id=Number(piece.id)||1;
      if(piece.category==="words"){
        g.fillStyle="#f8f6ef";g.fillRect(0,0,W,H);
        g.fillStyle="#262923";g.textAlign="center";g.font="italic 35px Georgia";
        fitLines(g,piece.words||piece.floorText||piece.title,W/2,210,W*.72,58,4);
      }else if(piece.category==="3d"){
        g.fillStyle="rgba(27,32,30,.8)";
        g.beginPath();g.moveTo(W*.5,H*.12);g.lineTo(W*.8,H*.39);g.lineTo(W*.66,H*.83);
        g.lineTo(W*.26,H*.70);g.lineTo(W*.21,H*.33);g.closePath();g.fill();
        g.fillStyle="rgba(255,255,255,.35)";g.beginPath();
        g.moveTo(W*.5,H*.12);g.lineTo(W*.8,H*.39);g.lineTo(W*.51,H*.57);g.lineTo(W*.21,H*.33);g.closePath();g.fill();
      }else{
        g.globalAlpha=.45;
        for(let i=0;i<6;i++){
          g.fillStyle="hsl("+((hue+i*26)%360)+",24%,"+(45+i*5)+"%)";
          g.beginPath();g.ellipse((.18+(i*.17)%0.8)*W,(.2+(i*.11)%0.7)*H,W*(.08+i*.045),H*(.13+i*.02),i*.6,0,Math.PI*2);g.fill();
        }
        g.globalAlpha=1;
      }
      g.fillStyle="rgba(255,255,255,.92)";g.fillRect(0,H-91,W,91);
      g.fillStyle="#2b2e28";g.textAlign="left";g.font="700 25px Arial";
      fitLines(g,String(piece.title||"UNTITLED").toUpperCase(),28,H-50,W-56,26,1);
      g.font="500 17px Arial";g.fillStyle="#6d6f69";g.fillText("BY "+(piece.author||"ANONYMOUS"),28,H-19,W-56);
    },w,h);
  }
  function canvasPanel(label,title,subtitle,price,kind,filled){
    return canvasTexture((g,W,H)=>{
      g.fillStyle=filled?"#f9f7f1":(kind==="ceiling"?"#fcfdf7":"#f3f0e9");
      g.fillRect(0,0,W,H);
      g.strokeStyle=kind==="ceiling"?"#c6d8bb":"#d9d6cb";g.lineWidth=6;g.strokeRect(21,21,W-42,H-42);
      g.textAlign="center";
      g.fillStyle="#77766f";g.font="700 22px Arial";g.letterSpacing="4px";
      g.fillText(label,W/2,92);
      g.fillStyle="#2e362f";g.font="400 50px Georgia";
      fitLines(g,title,W/2,212,W*.84,58,2);
      g.fillStyle="#718070";g.font="500 21px Arial";
      g.fillText(subtitle,W/2,H-112,W*.86);
      g.fillStyle="#313c32";g.font="700 25px Arial";g.fillText(price,W/2,H-56);
    },900,580);
  }
  // An empty wall is a blank museum canvas, not a giant product listing.
  // Availability and the rate belong on the small gold cartel beside it.
  function futureExhibitionTexture(slot){
    return canvasTexture((g,w,h)=>{
      g.fillStyle="#fbfaf6";g.fillRect(0,0,w,h);
      const shade=g.createLinearGradient(0,0,w,h);
      shade.addColorStop(0,"rgba(255,255,255,.66)");
      shade.addColorStop(.55,"rgba(243,241,234,.03)");
      shade.addColorStop(1,"rgba(220,215,204,.19)");
      g.fillStyle=shade;g.fillRect(0,0,w,h);
      g.strokeStyle="rgba(176,169,147,.26)";g.lineWidth=2;g.strokeRect(42,42,w-84,h-84);
      g.fillStyle="#beb8a9";g.textAlign="center";g.textBaseline="middle";
      g.font="400 43px Georgia";
      g.fillText("The space for the next idea.",w/2,h*.47,w*.81);
      g.fillStyle="#a8a293";g.font="600 14px Arial";g.letterSpacing="5px";
      g.fillText("EXHIBITION "+String(slot.id+1).padStart(3,"0"),w/2,h*.67,w*.84);
    },1024,690);
  }
  function reservedExhibitionTexture(slot){
    return canvasTexture((g,w,h)=>{
      const grad=g.createLinearGradient(0,0,w,h);
      grad.addColorStop(0,"#55584f");grad.addColorStop(.55,"#282d2a");
      grad.addColorStop(1,"#43453e");
      g.fillStyle=grad;g.fillRect(0,0,w,h);
      g.strokeStyle="rgba(233,220,188,.45)";g.lineWidth=5;
      g.strokeRect(45,45,w-90,h-90);
      g.fillStyle="#f0eadc";g.textAlign="center";g.textBaseline="middle";
      g.font="400 53px Georgia";
      g.fillText("The Partner Collection",w/2,h*.45,w*.86);
      g.fillStyle="#d2bea0";g.font="600 17px Arial";g.letterSpacing="3px";
      g.fillText("CURATED SPACE · THE EMPTY MUSEUM",w/2,h*.67,w*.86);
    },1024,690);
  }
  function pictureMaterial(piece){
    const mat=new THREE.MeshStandardMaterial({map:artworkTexture(piece),roughness:.85,side:THREE.DoubleSide});
    if(piece.image && piece.image.startsWith("data:image/")){
      new THREE.TextureLoader().load(piece.image, t=>{
        t.colorSpace=THREE.SRGBColorSpace;
        t.anisotropy=4;
        mat.map=t;mat.needsUpdate=true;
      },undefined,()=>{});
    }
    return mat;
  }
  // Museum-grade mounting: warm backlighting, four-sided accent strips,
  // discreet picture lights, properly matted art, and engraved brass cartels.
  // Local XY coordinates make the same framing work on both side walls.
  const agedGold=material(0x9e8758,.32,.64);
  const champagneGold=material(0xc9ac6f,.25,.64);
  const darkBronze=material(0x3b3731,.42,.55);
  const pictureMat=material(0xf9f6ed,.88,.03);
  const displayLamp=new THREE.MeshStandardMaterial({
    color:0xfff4dc,emissive:0xffd9a1,emissiveIntensity:1.75,roughness:.34
  });
  const softGlow=canvasTexture((g,w,h)=>{
    g.clearRect(0,0,w,h);
    const rad=g.createRadialGradient(w/2,h/2,w*.20,w/2,h/2,w*.56);
    rad.addColorStop(0,"rgba(255,228,178,0)");
    rad.addColorStop(.60,"rgba(255,224,170,.08)");
    rad.addColorStop(.77,"rgba(255,222,164,.20)");
    rad.addColorStop(1,"rgba(255,236,193,0)");
    g.fillStyle=rad;g.fillRect(0,0,w,h);
  },512,512);
  const glowMaterial=new THREE.MeshBasicMaterial({
    map:softGlow,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide
  });

  function wrappedText(g,text,maxWidth,lineCap){
    const words=String(text||"").split(/\s+/).filter(Boolean);
    const lines=[];let line="";
    for(const word of words){
      const next=line?line+" "+word:word;
      if(line && g.measureText(next).width>maxWidth){lines.push(line);line=word;}
      else line=next;
    }
    if(line)lines.push(line);
    if(lines.length>lineCap && lines[lineCap-1]){
      lines[lineCap-1]=lines[lineCap-1].replace(/\s+$/,"")+"…";
    }
    return lines.slice(0,lineCap);
  }
  function museumLabel(slot){
    const piece=slot?.piece,number=String((slot?.id??0)+1).padStart(3,"0");
    return canvasTexture((g,w,h)=>{
      // Lightly brushed gold instead of a cheap neon or flat UI button.
      const bg=g.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,"#f8edcd");bg.addColorStop(.40,"#d5bb7f");
      bg.addColorStop(.56,"#efddb1");bg.addColorStop(1,"#b59a62");
      g.fillStyle=bg;g.fillRect(0,0,w,h);
      for(let i=0;i<55;i++){
        g.fillStyle="rgba(255,255,255,.035)";
        g.fillRect(0,(i*63.7)%h,w,1);
      }
      g.strokeStyle="rgba(76,56,25,.6)";g.lineWidth=8;g.strokeRect(19,19,w-38,h-38);
      g.strokeStyle="rgba(255,253,233,.48)";g.lineWidth=3;g.strokeRect(30,30,w-60,h-60);
      g.textAlign="left";g.textBaseline="alphabetic";
      g.fillStyle="#625437";g.font="700 20px Arial";g.letterSpacing="3px";
      g.fillText("THE EMPTY MUSEUM",59,92,w-120);
      g.fillStyle="#847452";g.font="600 20px Arial";
      g.fillText("EXHIBITION "+number,59,150,w-120);
      g.fillStyle="#342c20";
      g.font="500 42px Georgia";
      const title=piece?.title|| (slot?.reservedForAds?"EXPOSITION":"ESPACE LIBRE");
      wrappedText(g,title,w-118,3).forEach((ln,i)=>g.fillText(ln,59,252+i*55,w-115));
      g.fillStyle="#59482e";g.font="700 24px Arial";
      const author=piece?.author|| (slot?.reservedForAds?"PARTENAIRE":"À VOTRE NOM");
      g.fillText("PAR  "+author.toUpperCase().slice(0,33),59,468,w-118);
      g.strokeStyle="rgba(65,47,25,.4)";g.lineWidth=2;
      g.beginPath();g.moveTo(58,496);g.lineTo(w-58,496);g.stroke();
      const desc=piece?.description || (slot?.reservedForAds?
        "Espace réservé aux expositions partenaires.":
        "Cet emplacement attend votre création. Choisissez une œuvre pour la présenter au musée.");
      g.fillStyle="#4c402e";g.font="400 25px Georgia";g.letterSpacing="0px";
      wrappedText(g,desc,w-116,6).forEach((ln,i)=>g.fillText(ln,59,569+i*43,w-116));
      g.fillStyle="#7a6746";g.font="600 20px Arial";
      g.fillText(piece?((piece.tools||"CRÉATION").toUpperCase().slice(0,37)):
         (slot?.reservedForAds?"NON DISPONIBLE":slot?.format?.name?.toUpperCase()||"CADRE LIBRE"),
         59,h-143,w-118);
      g.strokeStyle="rgba(72,55,31,.37)";
      g.beginPath();g.moveTo(58,h-113);g.lineTo(w-58,h-113);g.stroke();
      g.font="700 22px Arial";g.fillStyle="#3f3325";
      g.fillText(piece?"COLLECTION PERMANENTE · DÉMO":
        slot?.reservedForAds?"ESPACE PARTENAIRE":
        String(slot?.price??"").replace(".",",")+" € / 12 MOIS",59,h-65,w-118);
    },640,950);
  }
  function sculptureScrew(group,x,y,z){
    const screw=mesh(group,new THREE.SphereGeometry(.014,10,8),agedGold,x,y,z);
    screw.scale.z=.5;
  }
  // One complete exhibition unit: a dimensional float-mount and its museum plaque.
  function addFrame(group,w,h,x,y,z,rot,frontMat,slot){
    const unit=new THREE.Group();
    unit.position.set(x,y,z);
    unit.rotation.y=rot;
    group.add(unit);
    // Local positive Z faces the museum visitor.
    const glow=surface(unit,w+.86,h+.86,glowMaterial,0,0,-.18);
    glow.renderOrder=1;
    box(unit,w+.24,h+.24,.10,darkBronze,0,0,-.025,true);
    box(unit,w+.18,h+.18,.115,agedGold,0,0,.023,true);
    box(unit,w+.12,h+.12,.128,pictureMat,0,0,.066,true);
    // Internal gold fillet and matboard, using actual strips instead of a flat texture.
    const strips=[
      [w+.17,.024,0,h/2+.084],[w+.17,.024,0,-h/2-.084],
      [.024,h+.17,w/2+.084,0],[.024,h+.17,-w/2-.084,0]
    ];
    for(const [sw,sh,sx,sy] of strips)box(unit,sw,sh,.025,champagneGold,sx,sy,.106);
    const art=surface(unit,w,h,frontMat,0,0,.111);
    art.material.side=THREE.DoubleSide;
    if(slot && !slot.reservedForAds)markInteractive(art,slot);
    // Warm edge-lit perimeter (all four sides, restrained museum white).
    const edgeLight=new THREE.MeshBasicMaterial({color:0xffeac5});
    for(const [sw,sh,sx,sy] of [
      [w+.25,.014,0,h/2+.126],[w+.25,.014,0,-h/2-.126],
      [.014,h+.25,w/2+.126,0],[.014,h+.25,-w/2-.126,0]
    ]){
      box(unit,sw,sh,.012,edgeLight,sx,sy,-.067);
    }
    // Two real brass picture-light luminaires over the top edge.
    // Illumination across the art is supplied by the emissive frame and the
    // existing gallery lights; no dozens of high-cost real-time spotlights.
    for(const px of [-Math.min(w*.27,.45),Math.min(w*.27,.45)]){
      const stem=box(unit,.020,.18,.020,agedGold,px,h/2+.175,.11);
      const housing=cylinder(unit,.075,.09,.17,darkBronze,px,h/2+.29,.17,14);
      housing.rotation.x=Math.PI/2;
      const lens=cylinder(unit,.068,.068,.012,displayLamp,px,h/2+.255,.22,14);
      lens.rotation.x=Math.PI/2;
    }
    // The cartel is next to the artwork, never covering it.
    const plaqueW=.405,plaqueH=.60;
    const px=w/2+.125+plaqueW/2,py=-.18;
    box(unit,plaqueW+.034,plaqueH+.037,.060,darkBronze,px,py,.016,true);
    box(unit,plaqueW+.021,plaqueH+.021,.071,champagneGold,px,py,.047,true);
    const plaqueMat=new THREE.MeshStandardMaterial({
      map:museumLabel(slot),color:0xffffff,metalness:.15,roughness:.46,side:THREE.DoubleSide
    });
    const label=surface(unit,plaqueW,plaqueH,plaqueMat,px,py,.092);
    if(slot && !slot.reservedForAds)markInteractive(label,slot);
    for(const sign of [-1,1])for(const vertical of [-1,1]){
      sculptureScrew(unit,px+sign*(plaqueW/2-.026),py+vertical*(plaqueH/2-.026),.101);
    }
    return art;
  }
  function drawWallSlot(slot){
    const i=slot.id,z=5.7+i*STEP,side=i%2?1:-1,x=side*(HALF-.25);
    const dims={
      mini:[1.35,1.83],portrait:[1.42,2.15],landscape:[2.36,1.6],
      tall:[1.48,2.67],wide:[2.78,1.95],panorama:[2.8,1.18],
      standard:[2.36,1.6],large:[2.78,1.95],xl:[2.8,1.18]
    };
    const [w,h]=dims[slot.size]||dims.landscape;
    const y=2.75,rot=side<0?Math.PI/2:-Math.PI/2;
    let mat;
    if(slot.piece)mat=pictureMaterial(slot.piece);
    else if(slot.reservedForAds)mat=new THREE.MeshStandardMaterial({
      map:reservedExhibitionTexture(slot),roughness:.87,side:THREE.DoubleSide
    });
    else mat=new THREE.MeshStandardMaterial({
      map:futureExhibitionTexture(slot),roughness:.92,side:THREE.DoubleSide
    });
    addFrame(interactive,w,h,x,y,z,rot,mat,slot);
  }
  function drawCeilingSlot(slot){
    const isMini=slot.style==="frame",isMedium=slot.style==="lightbox";
    const w=isMini?1.45:isMedium?2.25:2.78,h=isMini?.86:isMedium?1.03:1.16;
    const x=(Number(slot.id.slice(1))%2?.53:-.53),z=slot.z,y=HEIGHT-2.15;
    const casingMat=isMedium?material(0xd4e2ca,.29,.16):plinthMat;
    box(interactive,w+.16,h+.18,.13,casingMat,x,y,z,true);
    // Architectural suspension cables fixed into the ceiling.
    for(const dx of [-w*.38,w*.38]){
      cylinder(interactive,.012,.012,HEIGHT-(y+h/2)-.13,brass,x+dx,(HEIGHT+y+h/2)/2,z,8);
    }
    const mat=slot.piece?pictureMaterial(slot.piece):
      new THREE.MeshStandardMaterial({map:canvasPanel("CEILING / "+slot.id,"AVAILABLE",slot.format.name,String(slot.price).replace(".",",")+" € / 12 MOIS","ceiling"),roughness:.75,side:THREE.DoubleSide,emissive:isMedium?new THREE.Color(0x23392d):new THREE.Color(0),emissiveIntensity:isMedium?.18:0});
    const front=surface(interactive,w,h,mat,x,y,z-.073,Math.PI);
    markInteractive(front,slot);
    const back=surface(interactive,w,h,mat,x,y,z+.073,0);
    markInteractive(back,slot);
    // Once unlocked, each aerial exhibit becomes a softly luminous signature piece.
    // White perimeter lighting on BOTH faces draws the gaze without turning the
    // architecture into a shopping centre or covering the pure-white ceiling.
    const lineMat=new THREE.MeshBasicMaterial({color:0xfff9e9});
    for(const face of [-1,1]){
      const frontZ=z+face*.082;
      box(interactive,w+.13,.018,.018,lineMat,x,y+h/2+.070,frontZ);
      box(interactive,w+.13,.018,.018,lineMat,x,y-h/2-.070,frontZ);
      box(interactive,.018,h+.13,.018,lineMat,x-w/2-.070,y,frontZ);
      box(interactive,.018,h+.13,.018,lineMat,x+w/2+.070,y,frontZ);
    }
    // Discreet light pool on the stone floor directs the visitor upward.
    const spotMaterial=new THREE.MeshBasicMaterial({
      color:0xfffdf1,transparent:true,opacity:.25,depthWrite:false,
      side:THREE.DoubleSide
    });
    const beamSpot=mesh(interactive,new THREE.CircleGeometry(.55,48),spotMaterial,x,.032,z);
    beamSpot.rotation.x=-Math.PI/2;
    if(isMedium){
      const glow=box(interactive,w+.26,.048,.27,lightTrim,x,y+h/2+.078,z);
      glow.material=new THREE.MeshBasicMaterial({color:0xf7ffe6});
    }
  }
  let galleryRevision=0;
  const activeImported=new Set();
  async function mount3DModel(slot,root,revision){
    try{
      const saved=await getModel(slot.piece?.modelKey);
      if(!saved?.blob)throw Error("fichier local introuvable");
      const model=await loadModel(saved.blob,saved.format);
      if(revision!==galleryRevision){
        disposeModel(model);return;
      }
      model.position.set(0,.25,0);
      root.add(model);
      activeImported.add(model);
      model.traverse(obj=>{
        if(obj.isMesh){
          markInteractive(obj,slot);
          obj.castShadow=!mobile;
          obj.receiveShadow=!mobile;
        }
      });
      // Remove the descriptive placeholder when the real model is ready.
      for(const child of [...root.children]){
        if(child.userData.isModelPlaceholder){
          root.remove(child);
          child.traverse(o=>o.geometry?.dispose?.());
        }
      }
    }catch(error){
      console.warn("[The Empty Museum] Unable to display locally stored model",slot.id,error);
      // The placeholder stays visible; the exhibit remains selectable.
    }
  }
  function platform(slot){
    const x=slot.x,z=slot.z;
    const base=box(interactive,1.25,.2,1.25,plinthMat,x,.12,z,true,true);
    box(interactive,1.31,.035,1.31,brass,x,.225,z);
    if(!slot.piece){
      const surfaceMat=new THREE.MeshStandardMaterial({map:canvasPanel("FLOOR / "+slot.id,"AVAILABLE","1,20 × 1,20 M","499 € / 1 MOIS","floor"),roughness:.75});
      const cap=box(interactive,1.2,.016,1.2,surfaceMat,x,.243,z);
      markInteractive(cap,slot);
      const outline=box(interactive,1.32,.015,1.32,glass,x,.203,z);
      markInteractive(outline,slot);
      return;
    }
    const piece=slot.piece, tint=new THREE.Color(/^#[0-9a-f]{6}$/i.test(piece.floorColor||"")?piece.floorColor:0xb6a893);
    const sculpture=material(tint,.34,.24);
    let top;
    if(piece.floorType==="model" && piece.modelKey){
      const holder=new THREE.Group();
      holder.position.set(x,0,z);
      interactive.add(holder);
      // Accessible, clickable plinth while local model is being retrieved.
      const placeholder=mesh(holder,new THREE.DodecahedronGeometry(.34,1),
        material(0xc4c2b6,.44,.15),0,.65,0,true);
      placeholder.userData.isModelPlaceholder=true;
      markInteractive(placeholder,slot);
      mount3DModel(slot,holder,galleryRevision);
    }else if(piece.floorType==="statue"){
      const shape=piece.floorShape||"spire";
      if(shape==="orb")top=mesh(interactive,new THREE.SphereGeometry(.48,28,20),sculpture,x,1.16,z,true);
      else if(shape==="rings"){
        top=new THREE.Group();top.position.set(x,1.03,z);interactive.add(top);
        for(let j=0;j<3;j++){
          const ring=mesh(top,new THREE.TorusGeometry(.43-j*.08,.07,12,28),sculpture,0,(j-1)*.22,0,true);
          ring.rotation.x=(j-1)*.4;ring.rotation.y=j*.28;
        }
      }else top=mesh(interactive,new THREE.ConeGeometry(.44,1.23,7),sculpture,x,.99,z,true);
      cylinder(interactive,.39,.46,.25,darkStone,x,.36,z);
    }else{
      const pole=cylinder(interactive,.023,.025,.83,brass,x,.65,z,10);
      const background=box(interactive,1.03,.85,.075,material(0x424a44,.45),x,1.39,z,true);
      const mat=pictureMaterial(piece);
      top=surface(interactive,.96,.78,mat,x,1.4,z-.05,Math.PI);
      markInteractive(top,slot);
      const back=surface(interactive,.96,.78,mat,x,1.4,z+.05,0);markInteractive(back,slot);
    }
    if(top){top.traverse(obj=>{if(obj.isMesh)markInteractive(obj,slot)});}
    markInteractive(base,slot);
  }
  function drawInventory(){
    galleryRevision++;
    for(const imported of activeImported)disposeModel(imported);
    activeImported.clear();
    for(const child of [...interactive.children]){interactive.remove(child);
      child.traverse(o=>{if(o.geometry)o.geometry.dispose();});
    }
    clickable.length=0;
    window.TEM.getSlots().forEach(drawWallSlot);
    // The pristine ceiling stays free of objects until all original wall
    // exhibitions are occupied. Structure and six future mounts already exist.
    window.TEM.getCeilingSlots().filter(slot=>slot.unlocked || slot.piece).forEach(drawCeilingSlot);
    window.TEM.getFloorSlots().forEach(platform);
  }
  drawInventory();

  let active=false,frame=0,last=0,yaw=0,pitch=0,yawTarget=0,pitchTarget=0,walkTo=null,down=null,focusBefore=null;
  let velX=0,velZ=0,rayTime=0;
  const held=new Set(),keys=new Set();
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const view={x:0,y:1.72,z:.85};
  let lastSpotPosition=-Infinity;
  const progress=$("#walkProgress"),meter=$("#walkMeter");
  const guide=$("#walkGuide");
  if(guide)guide.textContent="ENTREZ DANS LES GALERIES · ADMIREZ LES ŒUVRES ET LEURS CARTELS DORÉS. LES SPOTS SE CONCENTRENT SUR LES EXPOSITIONS. LE PLAFOND RESTE BLANC.";
  $(".walk-identity small").textContent="GALERIES MONUMENTALES · MUSÉE 3D";
  const panel=document.createElement("div");panel.className="engine-status";
  panel.innerHTML='<span class="engine-chip">● RENDERED IN 3D</span><span class="engine-chip engine-location">ORIGINAL GALLERY · 2026</span>';
  overlay.appendChild(panel);
  const v5=createMuseumV5Navigation({
    overlay,canvas,mobile,
    home:()=>{
      view.x=0;view.z=.85;view.y=1.72;
      yawTarget=0;pitchTarget=0;walkTo=null;velX=0;velZ=0;
    },
    setZoom:(fov)=>{camera.fov=fov;camera.updateProjectionMatrix();}
  });
  function resize(){
    const r=canvas.getBoundingClientRect();
    if(!r.width || !r.height)return;
    renderer.setSize(r.width,r.height,false);
    camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
  }
  function orient(){
    camera.position.set(view.x,view.y,view.z);
    camera.rotation.order="YXZ";
    camera.rotation.set(pitch,Math.PI+yaw,0);
  }
  function interactions(nx,ny){
    mouse.set(nx,ny);
    raycaster.setFromCamera(mouse,camera);
    const intersections=raycaster.intersectObjects(clickable,false);
    for(const hit of intersections){
      if(hit.object.userData.target){
        return hit.object.userData.target;
      }
    }
    return null;
  }
  function selected(slot){
    if(!slot)return;
    if(slot.reservedForAds)return;
    if(slot.piece)window.TEM.openPiece(slot.piece);
    else window.TEM.openExhibit(slot.size,slot.price,slot.id);
  }
  function tick(time){
    if(!active)return;
    const dt=clamp((time-last)/1000 || .016,0,.045);
    last=time;
    const blocked=[...document.querySelectorAll("dialog")].some(d=>d.open);
    const pressed=(...names)=>names.some(n=>keys.has(n)||held.has(n));
    const input=v5.update(dt);
    let fwd=(pressed("ArrowUp","KeyW","KeyZ","forward")?1:0)
      -(pressed("ArrowDown","KeyS","back")?1:0)+input.forward;
    let strafe=(pressed("KeyD")?1:0)-(pressed("KeyQ","KeyA")?1:0)+input.strafe;
    const turning=Number(pressed("ArrowRight","turn-right"))-Number(pressed("ArrowLeft","turn-left"));
    if((turning||fwd||strafe) && input.auto) v5.manual();
    if(input.auto && !blocked){
      const phase=input.t%24;
      if(phase<11){
        fwd=.92;strafe=0;
        yawTarget=.07*Math.sin(phase*.55);
        pitchTarget=-.06-.07*Math.sin(phase*.21);
      }else if(phase<16){
        fwd=0;strafe=0;
        yawTarget=-(Math.min(1,(phase-11)/2)*1.12);
        pitchTarget=.01;
      }else if(phase<21){
        fwd=0;strafe=0;
        yawTarget=-1.12+Math.min(1,(phase-16)/3)*2.24;
        pitchTarget=.01;
      }else{
        fwd=.28;strafe=0;
        yawTarget=1.12*(1-(phase-21)/3);
        pitchTarget=-.08;
      }
      if(view.z>LENGTH-6){
        v5.setTour(false);
        fwd=0;
      }
    }else{
      yawTarget+=turning*dt*1.22;
      if(walkTo!==null && !fwd && !strafe){
        if(view.z<walkTo-.45)fwd=.8;
        else walkTo=null;
      }
    }
    yaw+=(yawTarget-yaw)*Math.min(1,dt*9);
    pitch+=(pitchTarget-pitch)*Math.min(1,dt*8);
    if(blocked){fwd=0;strafe=0;walkTo=null;}
    const moveSpeed=pressed("ShiftLeft","ShiftRight")?4.6:(input.auto?2.3:2.45);
    const magnitude=Math.max(1,Math.hypot(fwd,strafe));
    const wantX=(Math.sin(yaw)*fwd+Math.cos(yaw)*strafe)*moveSpeed/magnitude;
    const wantZ=(Math.cos(yaw)*fwd-Math.sin(yaw)*strafe)*moveSpeed/magnitude;
    const damping=Math.min(1,dt*(input.auto?3.1:8));
    velX+=(wantX-velX)*damping;
    velZ+=(wantZ-velZ)*damping;
    view.x=clamp(view.x+velX*dt,-HALF+.94,HALF-.94);
    view.z=clamp(view.z+velZ*dt,.80,LENGTH-2.8);
    const walking=Math.abs(velX)+Math.abs(velZ)>.12;
    view.y=1.72+(walking&&!input.auto?Math.sin(time*.009)*.008:0);
    orient();
    if(Math.abs(view.z-lastSpotPosition)>.65){
      museumArtDirection.updateSpotlights(view.z,window.TEM.getSlots());
      lastSpotPosition=view.z;
    }
    if(time-rayTime>180){
      rayTime=time;
      v5.setNear(!input.auto&&Boolean(interactions(0,0)));
    }
    renderer.render(scene,camera);
    const frees=window.TEM.getSlots().filter(s=>!s.piece&&!s.reservedForAds).length+
      window.TEM.getCeilingSlots().filter(s=>s.unlocked&&!s.piece).length+
      window.TEM.getFloorSlots().filter(s=>!s.piece).length;
    if(progress)progress.textContent=Math.floor(view.z)+" / "+Math.floor(LENGTH)+" M · "+window.TEM.getPieces().length+" CRÉATIONS · "+frees+" PLACES LIBRES";
    if(meter)meter.style.width=(100*view.z/LENGTH)+"%";
    const loc=panel.querySelector(".engine-location");
    if(loc)loc.textContent=view.z<46?"ORIGINAL GALLERY · 2026":view.z<95?"THE EXPANSION · 02":"THE LONG HALL · 03";
    frame=requestAnimationFrame(tick);
  }
  function open(){
    if(active)return;
    focusBefore=document.activeElement;
    active=true;last=performance.now();view.x=0;view.z=.85;yaw=0;pitch=0;yawTarget=0;pitchTarget=0;velX=0;velZ=0;walkTo=null;
    v5.enter();
    overlay.hidden=false;document.body.classList.add("walk-is-open");
    resize();orient();
    frame=requestAnimationFrame(tick);
    overlay.querySelector(".walk-close")?.focus({preventScroll:true});
  }
  function close(){
    if(!active)return;
    active=false;cancelAnimationFrame(frame);
    v5.leave();
    held.clear();keys.clear();walkTo=null;down=null;
    overlay.hidden=true;document.body.classList.remove("walk-is-open");
    focusBefore?.focus?.({preventScroll:true});
  }
  document.querySelectorAll("[data-walk-open]").forEach(b=>b.addEventListener("click",open));
  overlay.querySelectorAll("[data-walk-close]").forEach(b=>b.addEventListener("click",close));
  overlay.querySelectorAll("[data-walk-exhibit]").forEach(b=>b.addEventListener("click",()=>{
    const free=window.TEM.getSlots().find(s=>!s.piece&&!s.reservedForAds);
    if(free)selected(free);
  }));
  overlay.querySelectorAll("[data-walk-hold]").forEach(b=>{
    const key=b.dataset.walkHold;
    b.addEventListener("pointerdown",e=>{e.preventDefault();held.add(key);b.setPointerCapture(e.pointerId);});
    for(const name of ["pointercancel","pointerup","lostpointercapture"]){
      b.addEventListener(name,()=>held.delete(key));
    }
  });
  window.addEventListener("keydown",e=>{
    if(!active||[...document.querySelectorAll("dialog")].some(d=>d.open))return;
    if(e.code==="Escape"){e.preventDefault();close();return;}
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyZ","KeyA","KeyQ","KeyS","KeyD","ShiftLeft","ShiftRight"].includes(e.code)){
      e.preventDefault();keys.add(e.code);
    }
  });
  window.addEventListener("keyup",e=>keys.delete(e.code));
  window.addEventListener("blur",()=>{held.clear();keys.clear()});
  window.addEventListener("resize",()=>{if(active)resize()});
  canvas.addEventListener("pointerdown",e=>{
    if(!active)return;
    down={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,drag:false};
    if(v5.isTour())v5.manual();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove",e=>{
    if(!active)return;
    const rect=canvas.getBoundingClientRect();
    if(!down){
      const target=interactions((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height*2-1));
      canvas.style.cursor=target?"pointer":"grab";return;
    }
    if(down.id!==e.pointerId)return;
    const dx=e.clientX-down.x,dy=e.clientY-down.y;
    if(Math.abs(e.clientX-down.sx)>7||Math.abs(e.clientY-down.sy)>7)down.drag=true;
    if(down.drag){yawTarget+=dx*(mobile?.0052:.0039);pitchTarget=clamp(pitchTarget-dy*.0037,-.98,.98);walkTo=null;}
    down.x=e.clientX;down.y=e.clientY;
  });
  canvas.addEventListener("pointerup",e=>{
    if(!down||down.id!==e.pointerId)return;
    if(!down.drag){
      const rect=canvas.getBoundingClientRect();
      const nx=(e.clientX-rect.left)/rect.width*2-1;
      const ny=-((e.clientY-rect.top)/rect.height*2-1);
      const hit=interactions(nx,ny);
      if(hit){walkTo=null;selected(hit);}
      else if(ny<-.12&&Math.cos(yaw)>.25)walkTo=Math.min(LENGTH-3,view.z+12);
    }
    down=null;
  });
  canvas.addEventListener("pointercancel",()=>down=null);
  let pinchDistance=0;
  canvas.addEventListener("touchmove",event=>{
    if(!active||event.touches.length!==2)return;
    event.preventDefault();
    const [a,b]=event.touches;
    const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    if(pinchDistance>0){
      camera.fov=clamp(camera.fov-(d-pinchDistance)*.080,40,75);
      camera.updateProjectionMatrix();
    }
    pinchDistance=d;down=null;
  },{passive:false});
  canvas.addEventListener("touchend",()=>pinchDistance=0,{passive:true});
  canvas.addEventListener("touchcancel",()=>pinchDistance=0,{passive:true});
  canvas.addEventListener("wheel",event=>{
    if(!active)return;
    event.preventDefault();
    camera.fov=clamp(camera.fov+Math.sign(event.deltaY)*2.3,42,72);
    camera.updateProjectionMatrix();
  },{passive:false});
  window.addEventListener("tem:exhibited",()=>{lastSpotPosition=-Infinity;drawInventory();});
  canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();
    close();
    overlay.querySelector(".walk-guide").textContent="L’affichage 3D a été interrompu. Rechargez la page pour réessayer.";
  });
  requestAnimationFrame(open);
})();
