import * as THREE from "three";
import {getModel,loadModel,disposeModel} from "./models3d.js";
import {buildMuseumScenography} from "./scenography.js?v=20261105wallwash2";
import {makeWhiteLuxuryMaterials} from "./luxury-v8.js?v=20261109realism11";
import {enhanceScannedPBR} from "./pbr-scanned.js?v=20261109realism11";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {addPhysicalGalleryV3} from "./physical-gallery-v3.js?v=20261109realism11";
import {addBakedEntranceV4} from "./baked-architecture-v4.js?v=20261106a";
import {createMuseumV5Navigation} from "./museum-v5.js?v=20261109dualstick2";
import {museumCameraMotion} from "./movement3d.js?v=20261105motion1";
import {planExhibitionStops,routeNextIndex,routeResumeIndex,approachDuration,smoothstep} from "./tour-journey.js?v=20261105nearest1";

(() => {
  "use strict";
  // V5 styling is loaded only with WebGL: the 2D fallback retains its controls.
  const cinematicStyle=document.createElement("link");
  cinematicStyle.rel="stylesheet";
  cinematicStyle.href="./museum-v5.css?v=20261031realism9b";
  document.head.appendChild(cinematicStyle);
  const tourStyle=document.createElement("link");tourStyle.rel="stylesheet";tourStyle.href="./tour-v10.css?v=20261103guided4";document.head.appendChild(tourStyle);
  const mobileStyle=document.createElement("link");
  mobileStyle.rel="stylesheet";mobileStyle.href="./museum-mobile-v12.css?v=20261104c";
  document.head.appendChild(mobileStyle);
  const mobileCompactStyle=document.createElement("link");
  mobileCompactStyle.rel="stylesheet";mobileCompactStyle.href="./museum-mobile-v13.css?v=20261106exit1";
  document.head.appendChild(mobileCompactStyle);
  const dualStickStyle=document.createElement("link");
  dualStickStyle.rel="stylesheet";dualStickStyle.href="./dual-joystick-v1.css?v=20261109dualstick2";
  document.head.appendChild(dualStickStyle);
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
  scene.background = new THREE.Color(0xf0efeb);
  scene.fog = new THREE.FogExp2(0xeceae5,0.0011);
  const camera = new THREE.PerspectiveCamera(mobile?64:59,1,.07,240);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:!mobile,alpha:false,powerPreference:mobile?"low-power":"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.45:1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Warm museum white needs plausible daylight detail, not crushed grey midtones.
  renderer.toneMappingExposure = .91;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xf7f6f3,1);
  // A neutral, physically-based indoor reflection environment: brushed metals
  // and honed stone respond to light as physical materials, not flat sprites.
  try {
    const pmrem=new THREE.PMREMGenerator(renderer);
    const room=new RoomEnvironment();
    scene.environment=pmrem.fromScene(room,.025).texture;
    room.dispose();pmrem.dispose();
    scene.environmentIntensity=mobile?.31:.42;
  } catch(error){console.warn("[TEM] Reflected ambience unavailable",error);}

  scene.add(new THREE.HemisphereLight(0xfff7ed,0xb5afa5,.62));
  const ambient = new THREE.AmbientLight(0xfff8ed,.12);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff3e5,.95);
  sun.position.set(-8,18,15);
  // V9: true contact and frame shadows on iPhone too; constrained shadow
  // volume follows the visitor so the 140m gallery needs only one light map.
  sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
  sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=55;
  sun.shadow.bias=-.00025;
  sun.shadow.normalBias=.012;
  sun.shadow.radius=mobile?2:2.8;
  scene.add(sun);

  // V8 WHITE LUXURY: honed limestone / physical plaster / quiet metal.
  const material=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const luxury=makeWhiteLuxuryMaterials({mobile,length:LENGTH});
  // Upgrade the existing materials in place; never block gallery navigation.
  // If the scanned maps fail, the original high-quality procedural surfaces remain.
  let physicalGallery=null;
  enhanceScannedPBR(luxury,{mobile,length:LENGTH})
    .then(()=>physicalGallery?.refreshFloor(luxury.floor))
    .catch(e=>console.warn("[TEM] Scanned PBR unavailable, retaining originals",e));
  const stone=luxury.wall,stoneAlt=luxury.wallAlt;
  const floorMat=luxury.floor,grout=material(0xd4d1cb,.96);
  const plinthMat=luxury.whiteStone,inlay=material(0xc5bfb1,.67,.19);
  const brass=luxury.matteGold,lightTrim=new THREE.MeshBasicMaterial({color:0xfbfaf5});
  const glass=material(0xf2f5f2,.24,.02),artBacking=material(0xf8f8f5,.91);
  const darkStone=material(0x696b66,.77);

  const architecture=new THREE.Group(), interactive=new THREE.Group();
  scene.add(architecture,interactive);
  const clickable=[];
  const metalLines=[];
  function mesh(parent,geometry,mat,x=0,y=0,z=0,cast=false,receive=false){
    const m=new THREE.Mesh(geometry,mat);
    m.position.set(x,y,z);
    m.castShadow=Boolean(cast);
    m.receiveShadow=Boolean(receive||mat===stone||mat===stoneAlt||mat===floorMat||mat===plinthMat);
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

  // Mineral PBR floor, subtly veined slabs, hairline joints and micro-relief.
  box(architecture,HALF*2,.28,LENGTH,floorMat,0,-.16,LENGTH/2,false,true);
  // Premium architecture has its own instanced, bevelled stone slabs and
  // stationary indirect-occlusion atlas; never modify exhibition inventory.
  try{
    physicalGallery=addPhysicalGalleryV3({
      architecture,half:HALF,height:HEIGHT,length:LENGTH,mobile,floorMaterial:floorMat
    });
    overlay.dataset.museumArchitecture="physical-v3";
    console.info("[TEM] Gallery architecture",physicalGallery.stats);
  }catch(error){console.warn("[TEM] Physical gallery enhancement disabled",error);}

  // WHITE CEILING: layered plaster vault, completely free from exhibits at launch.
  // All ceiling pieces are concealed until the wall gallery reaches capacity.
  const ceilingPlaster=material(0xf9f8f4,.95);
  const ceilingRelief=material(0xf7f5ef,.91);
  const ceilingShadow=material(0xe1e1db,.96);
  const ceilingLED=new THREE.MeshBasicMaterial({color:0xf4f5f0,side:THREE.DoubleSide});
  box(architecture,HALF*2,.34,LENGTH,ceilingPlaster,0,HEIGHT+.19,LENGTH/2);
  // Recessed white skylight: no dark glass, colored fixtures or hanging frames.
  box(architecture,2.90,.10,LENGTH,ceilingRelief,0,HEIGHT-.012,LENGTH/2);
  box(architecture,2.67,.029,LENGTH,ceilingRelief,0,HEIGHT-.077,LENGTH/2);
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
  // V9: abandon the identical sculpted columns every seven metres.
  // In a real white-cube gallery, long unbroken wall planes are the luxury.
  // Quiet ceiling joints articulate 20m galleries without CGI repetition.
  for(let z=19.8;z<LENGTH-1;z+=20){
    box(architecture,HALF*2-.12,.024,.038,ceilingShadow,0,HEIGHT-.18,z);
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
      const softLight=new THREE.PointLight(0xfffbf4,1.6,10,2);
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
    g.fillText("THE UNREAL MUSEUM",w/2,104);
    g.fillStyle="#a69b88";
    g.font="22px Arial, sans-serif";
    g.letterSpacing="5px";
    g.fillText("A PLACE FOR WHAT WE CREATE",w/2,156);
  },1024,256);
  const inscription=new THREE.MeshBasicMaterial({map:portalInk,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const portalFront=surface(portalSign,3.95,.61,inscription,0,0,-.067,Math.PI);
  portalFront.renderOrder=3;
  // Optional real Cycles light-baked architectural entrance: V3 remains usable
  // until the generated GLB has been verified and downloaded.
  // Loading stays asynchronous; the visitor can already explore the V3
  // gallery while the verified Blender light-bake arrives. Software WebGL
  // and slower desktop devices need more than the old hard 15s cutoff.
  addBakedEntranceV4({scene,overlay,timeoutMs:mobile?25000:90000}).catch(error=>
    console.warn("[TEM] Nonblocking V4 architectural enhancement",error));
  // No gold stripes or decorative circles cutting through the real stone floor.
  // The actual large-format stone joints provide the entire floor rhythm.
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
    g.font="400 83px Georgia";g.textAlign="center";g.fillText("THE UNREAL MUSEUM",w/2,176);
    g.fillStyle="#88867f";g.font="600 24px Arial";g.letterSpacing="6px";g.fillText("A SPACE FOR WHAT WE CREATE",w/2,260);
    g.fillStyle="#aa9d86";g.fillRect(w/2-35,300,70,2);
  },1280,420);
  // Physically scaled entrance signage: preserve its entire silhouette on
  // a narrow portrait phone, instead of cropping enormous black letters.
  const welcome=surface(architecture,mobile?3.05:5.2,mobile?1.00:1.70,
    new THREE.MeshBasicMaterial({map:stamp,transparent:true,side:THREE.DoubleSide,depthWrite:false}),
    0,4.80,7.9,Math.PI);
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
  // Reserved, still blank: no large lettering inside empty picture frames.
  function futureExhibitionTexture(slot){
    return canvasTexture((g,w,h)=>{
      const gr=g.createLinearGradient(0,0,w,h);
      gr.addColorStop(0,"#fdfdfa");gr.addColorStop(.56,"#f5f5f2");gr.addColorStop(1,"#eeeeea");
      g.fillStyle=gr;g.fillRect(0,0,w,h);
      g.strokeStyle="rgba(192,189,180,.23)";g.lineWidth=1.5;
      g.strokeRect(34,34,w-68,h-68);
      g.textAlign="center";g.fillStyle="#b7b3aa";
      g.font="400 25px Georgia";g.fillText("À exposer",w/2,h*.52);
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
      g.fillText("CURATED SPACE · THE UNREAL MUSEUM",w/2,h*.67,w*.86);
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
  const agedGold=material(0x9b8664,.48,.56);
  const champagneGold=material(0xb5a07c,.46,.57);
  const darkBronze=material(0x55524c,.62,.32);
  const pictureMat=material(0xfdfdfa,.94,0);
  const displayLamp=new THREE.MeshStandardMaterial({
    color:0xfffbf5,emissive:0xfffbf3,emissiveIntensity:.17,roughness:.71
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
      g.fillText("THE UNREAL MUSEUM",59,92,w-120);
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
  // Static, low-cost baked contact occlusion: subtle feathered shadow around
  // each frame, directly against the fluted plaster bay.
  const frameContactMap=canvasTexture((g,w,h)=>{
    const grad=g.createRadialGradient(w/2,h/2,w*.18,w/2,h/2,w*.68);
    grad.addColorStop(0,"rgba(31,28,24,.24)");
    grad.addColorStop(.58,"rgba(31,28,24,.18)");
    grad.addColorStop(.82,"rgba(31,28,24,.07)");
    grad.addColorStop(1,"rgba(31,28,24,0)");
    g.clearRect(0,0,w,h);g.fillStyle=grad;g.fillRect(0,0,w,h);
  },256,256);
  const frameContactMaterial=new THREE.MeshBasicMaterial({
    map:frameContactMap,transparent:true,depthWrite:false,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
  });
  // One complete exhibition unit: a dimensional float-mount and its museum plaque.
  // Museum-grade floating mounts: accurate depth, restrained fine metal,
  // feathered contact shadow, a real matboard and discreet brass cartel.
  function addFrame(group,w,h,x,y,z,rot,frontMat,slot){
    const unit=new THREE.Group();
    unit.position.set(x,y,z);unit.rotation.y=rot;group.add(unit);
    // Wall bays have a shallow relief. Put the shadow on its physical surface,
    // rather than hiding it behind the wall (which made the frames look pasted on).
    const shadow=surface(unit,w+.47,h+.50,frameContactMaterial,0,-.015,-.090);
    shadow.renderOrder=0;
    // Thin rounded metal lips catch real grazing highlights instead of producing
    // perfectly sharp computer-generated boxes.
    const outer=mesh(unit,new RoundedBoxGeometry(w+.126,h+.126,.084,2,.010),darkBronze,0,0,-.018,true);
    const gilded=mesh(unit,new RoundedBoxGeometry(w+.084,h+.084,.092,2,.009),agedGold,0,0,.026,true);
    box(unit,w+.053,h+.053,.094,pictureMat,0,0,.062,true);
    const art=surface(unit,w,h,frontMat,0,0,.114);
    art.material.side=THREE.DoubleSide;
    if(slot&&!slot.reservedForAds)markInteractive(art,slot);
    // Brushed brass label, mounted beside rather than over the piece.
    const plaqueW=.33,plaqueH=.49;
    const px=w/2+.14+plaqueW/2,py=-.21;
    box(unit,plaqueW+.012,plaqueH+.014,.037,darkBronze,px,py,.020,true);
    box(unit,plaqueW+.005,plaqueH+.005,.039,champagneGold,px,py,.044,true);
    const plaqueMat=new THREE.MeshStandardMaterial({
      map:museumLabel(slot),color:0xffffff,metalness:.17,roughness:.49,side:THREE.DoubleSide
    });
    const label=surface(unit,plaqueW,plaqueH,plaqueMat,px,py,.068);
    if(slot&&!slot.reservedForAds)markInteractive(label,slot);
    for(const s of [-1,1])for(const v of [-1,1]){
      sculptureScrew(unit,px+s*(plaqueW/2-.024),py+v*(plaqueH/2-.024),.078);
    }
    return art;
  }
  function drawWallSlot(slot){
    const i=slot.id,z=5.7+i*STEP,side=i%2?1:-1,x=side*(HALF-.39);
    const dims={
      mini:[1.35,1.83],portrait:[1.42,2.15],landscape:[2.36,1.6],
      tall:[1.48,2.67],wide:[2.78,1.95],panorama:[2.8,1.18],
      standard:[2.36,1.6],large:[2.78,1.95],xl:[2.8,1.18]
    };
    const [w,h]=dims[slot.size]||dims.landscape;
    const y=2.10,rot=side<0?Math.PI/2:-Math.PI/2;
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
  // The 34 commercial bays use independent, geometrically correct frames.
  // Unlike the historical oversized plaque on every bay, these share museum
  // materials and avoid rendering 116 giant 640x950 textures on mobile.
  const modularBareMat=new THREE.MeshStandardMaterial({
    color:0xf1ede7,roughness:.93,metalness:0,side:THREE.DoubleSide
  });
  const modularMountMat=new THREE.MeshStandardMaterial({
    color:0xe3dfd5,roughness:.82,metalness:0
  });
  const modularFrameMat=new THREE.MeshStandardMaterial({
    color:0x655c50,roughness:.48,metalness:.34
  });
  function drawCommercialFrame(slot){
    const side=slot.side;
    const x=side*(HALF-.39),z=slot.z+(slot.xM+slot.widthM/2-1.5);
    const y=slot.y,w=slot.widthM,h=slot.heightM;
    const rot=side<0?Math.PI/2:-Math.PI/2;
    const unit=new THREE.Group();
    unit.position.set(x,y,z);unit.rotation.y=rot;
    interactive.add(unit);
    // A shadow-line frame and shallow museum float-mount keep the gallery
    // quiet even with a high density of small pieces.
    box(unit,w+.035,h+.035,.05,modularFrameMat,0,0,-.025);
    box(unit,w+.012,h+.012,.055,modularMountMat,0,0,.012);
    const imageMaterial=slot.piece?pictureMaterial(slot.piece):modularBareMat;
    const art=surface(unit,w-.015,h-.015,imageMaterial,0,0,.047);
    markInteractive(art,slot);
    if(slot.piece){
      // Label below the frame, not beside it, so the small subdivisions cannot
      // hide neighboring works. A small 3D brass label remains clickable.
      const labelWidth=Math.min(.31,w*.75),labelHeight=Math.min(.065,h*.14);
      box(unit,labelWidth,labelHeight,.012,champagneGold,0,-h/2-.052,.021);
    }
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
      console.warn("[The Unreal Museum] Unable to display locally stored model",slot.id,error);
      // The placeholder stays visible; the exhibit remains selectable.
    }
  }

  function platform(slot){
    const x=slot.x,z=slot.z;
    if(!slot.piece){
      // Empty floor lots are flush inlaid squares, never floating slabs.
      const inset=new THREE.MeshBasicMaterial({
        color:0xb5ad9d,transparent:true,opacity:.075,depthWrite:false,side:THREE.DoubleSide
      });
      const floorLot=mesh(interactive,new THREE.PlaneGeometry(1.18,1.18),inset,x,.045,z);
      floorLot.rotation.x=-Math.PI/2;
      markInteractive(floorLot,slot);
      const trace=material(0xb0a38d,.58,.24);
      const corner=.25,edge=.018;
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const px=x+sx*.59,pz=z+sz*.59;
        box(interactive,corner,edge,.014,trace,px-sx*corner/2,.049,pz);
        box(interactive,.014,edge,corner,trace,px,.049,pz-sz*corner/2);
      }
      const tileLabel=canvasTexture((g,w,h)=>{
        g.clearRect(0,0,w,h);g.textAlign="center";g.textBaseline="middle";
        g.fillStyle="#898277";g.font="600 36px Arial";
        g.letterSpacing="5px";g.fillText("PLACE "+slot.id,w/2,h*.53);
      },500,120);
      const label=new THREE.MeshBasicMaterial({map:tileLabel,transparent:true,depthWrite:false,side:THREE.DoubleSide});
      const m=mesh(interactive,new THREE.PlaneGeometry(.54,.13),label,x,.053,z+.41);
      m.rotation.x=-Math.PI/2;
      return;
    }
    // Occupied installation gets a real freestanding stone plinth.
    const base=box(interactive,1.25,.20,1.25,plinthMat,x,.12,z,true,true);
    box(interactive,1.27,.014,1.27,brass,x,.227,z);
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
    // Four partner bays retain their historical reserved plaques.
    window.TEM.getSlots().filter(slot=>slot.reservedForAds).forEach(drawWallSlot);
    // The commercial distribution is now 116 independent frames.
    (window.TEM.getWallDisplaySlots?.()||window.TEM.getSlots().filter(slot=>!slot.reservedForAds))
      .forEach(slot=>slot.isCommercial?drawCommercialFrame(slot):drawWallSlot(slot));
    // The pristine ceiling stays free of objects until all original wall
    // exhibitions are occupied. Structure and six future mounts already exist.
    window.TEM.getCeilingSlots().filter(slot=>slot.unlocked || slot.piece).forEach(drawCeilingSlot);
    window.TEM.getFloorSlots().forEach(platform);
  }
  drawInventory();

  let active=false,frame=0,last=0,yaw=0,pitch=0,yawTarget=0,pitchTarget=0,walkTo=null,down=null,focusBefore=null;
  let velX=0,velZ=0,rayTime=0;
  // Museum V10: guided journey uses ONLY occupied exhibits, not anonymous wall bays.
  const TOUR_SESSION_KEY="tem-guided-tour-session-v1";
  const TOUR_SESSION_LIFETIME=30*24*60*60*1000;
  const tourState={stops:[],index:-1,motion:null,dwell:0,userMoved:false,started:false,restored:false};
  let lastTourSnapshot=0;
  function clearTourSession(){
    try{localStorage.removeItem(TOUR_SESSION_KEY);}catch{}
  }
  function readTourSession(){
    try{
      const data=JSON.parse(localStorage.getItem(TOUR_SESSION_KEY)||"null");
      if(!data||data.v!==1||!data.id||!Number.isFinite(data.z)||!Number.isFinite(data.x)||
        !Number.isFinite(data.ts)||Date.now()-data.ts>TOUR_SESSION_LIFETIME)return null;
      return data;
    }catch{return null;}
  }
  function plannedStops(){
    return planExhibitionStops(window.TEM.getSlots(),{
      step:STEP,half:HALF,start:5.7,
      floorSlots:window.TEM.getFloorSlots(),ceilingSlots:window.TEM.getCeilingSlots()
    });
  }
  function framingFor(stop,mode){
    const wide=mode==="room";
    if(!wide)return {x:stop.cameraX,z:stop.cameraZ,
      fx:stop.focusX,fy:stop.focusY,fz:stop.focusZ,fov:mobile?56:51};
    if(stop.kind==="floor"){
      return {x:clamp(stop.slot.x*.22,-1.2,1.2),z:stop.z-4.1,
        fx:stop.focusX,fy:stop.focusY,fz:stop.focusZ,fov:mobile?67:63};
    }
    if(stop.kind==="ceiling"){
      return {x:.7,z:stop.z-3.1,
        fx:stop.focusX,fy:stop.focusY,fz:stop.focusZ,fov:mobile?68:64};
    }
    return {x:stop.cameraX>0?.28:-.28,z:stop.z-3.0,
      fx:stop.focusX,fy:stop.focusY,fz:stop.focusZ,fov:mobile?68:64};
  }
  function saveTourSession(){
    if(!active||!tourState.started||tourState.index<0)return;
    const stop=tourState.stops[tourState.index];if(!stop)return;
    const snapshot={
      v:1,ts:Date.now(),id:stop.id,x:view.x,z:view.z,
      yaw,pitch,mode:v5.getViewMode(),
      phase:tourState.motion?"approach":story.hidden?"between":"viewing",
      dwell:tourState.dwell,userMoved:tourState.userMoved
    };
    try{localStorage.setItem(TOUR_SESSION_KEY,JSON.stringify(snapshot));}catch{}
  }
  const story=document.createElement("aside");
  story.className="tem-tour-story";
  story.id="temTourStory";story.hidden=true;
  story.setAttribute("aria-live","polite");
  story.innerHTML='<div class="tem-tour-top"><span id="temTourNumber">GALERIE · COLLECTION</span><button type="button" class="tem-tour-close" id="temTourClose" aria-label="Masquer la présentation">×</button></div><h3 id="temTourTitle"></h3><p id="temTourDescription"></p><div class="tem-tour-meta" id="temTourMeta"></div><div class="tem-tour-actions"><button type="button" class="tem-tour-view" id="temTourView">DÉCOUVRIR LA PIÈCE ↗</button><button type="button" id="temTourNext">ŒUVRE SUIVANTE →</button></div><div class="tem-tour-progress" id="temTourProgress"></div>';
  overlay.appendChild(story);
  const arrival=document.createElement("div");arrival.className="tem-tour-arrival";
  arrival.id="temTourArrival";arrival.hidden=true;arrival.setAttribute("aria-live","polite");overlay.appendChild(arrival);
  let arrivalTimer=0;
  function hideTourStory(){story.hidden=true;arrival.hidden=true;clearTimeout(arrivalTimer);}
  function resetTourState(clearSaved=false){
    tourState.index=-1;tourState.motion=null;tourState.dwell=0;tourState.userMoved=false;
    tourState.stops=[];tourState.started=false;tourState.restored=false;
    overlay.dataset.tourStop="0";hideTourStory();
    if(clearSaved)clearTourSession();
  }
  function showTourStory(){
    const stop=tourState.stops[tourState.index];if(!stop)return;
    const total=tourState.stops.length;
    story.querySelector("#temTourNumber").textContent=String(tourState.index+1).padStart(2,"0")+" / "+String(total).padStart(2,"0")+"   ·   "+stop.label+" "+stop.side;
    story.querySelector("#temTourTitle").textContent=stop.piece.title||"Sans titre";
    story.querySelector("#temTourDescription").textContent=stop.piece.description||"Une création à découvrir dans le musée.";
    story.querySelector("#temTourMeta").textContent=(stop.piece.author||"Créateur") +"   ·   "+(stop.piece.tools||"Création assistée");
    const progress=story.querySelector("#temTourProgress");progress.textContent="";
    for(let i=0;i<total;i++){const marker=document.createElement("i");if(i<=tourState.index)marker.className="done";progress.appendChild(marker);}
    story.querySelector("#temTourNext").textContent=tourState.index===total-1?"RECOMMENCER LA VISITE ↺":"ŒUVRE SUIVANTE →";
    story.hidden=false;
    overlay.dataset.tourStop=String(tourState.index+1);
    arrival.textContent=(tourState.index+1)+" / "+total+"  ·  "+stop.piece.title;
    arrival.hidden=false;clearTimeout(arrivalTimer);arrivalTimer=setTimeout(()=>arrival.hidden=true,2400);
    tourState.dwell=0;
    saveTourSession();
  }
  function goToArtworkIndex(index,stops=plannedStops()){
    const stop=stops[index];if(!stop)return false;
    tourState.stops=stops;tourState.index=index;tourState.dwell=0;
    tourState.userMoved=false;tourState.restored=false;
    hideTourStory();
    const shot=framingFor(stop,v5.getViewMode());
    const dx=shot.fx-shot.x,dz=shot.fz-shot.z;
    let destYaw=Math.atan2(dx,dz);
    while(destYaw-yaw>Math.PI)destYaw-=Math.PI*2;
    while(destYaw-yaw< -Math.PI)destYaw+=Math.PI*2;
    const targetPitch=Math.atan2(shot.fy-1.72,Math.hypot(dx,dz));
    const distance=Math.hypot(shot.x-view.x,shot.z-view.z);
    camera.fov=shot.fov;camera.updateProjectionMatrix();
    tourState.motion={
      fromX:view.x,fromZ:view.z,fromYaw:yaw,fromPitch:pitch,
      x:shot.x,z:shot.z,yaw:destYaw,pitch:targetPitch,
      elapsed:0,startedAt:performance.now(),
      duration:approachDuration(distance,matchMedia("(prefers-reduced-motion: reduce)").matches)
    };
    arrival.textContent="DIRECTION : "+(stop.piece.title||"ŒUVRE");
    arrival.hidden=false;clearTimeout(arrivalTimer);
    arrivalTimer=setTimeout(()=>arrival.hidden=true,1900);
    saveTourSession();
    return true;
  }
  function goToNextArtwork({fromCurrent=false}={}){
    const stops=plannedStops();
    if(!stops.length){v5.toast("LE MUSÉE N’A PAS ENCORE D’ŒUVRE À PRÉSENTER");v5.finishTour();clearTourSession();return false;}
    const prevId=tourState.stops[tourState.index]?.id;
    const mapped=prevId?stops.findIndex(st=>st.id===prevId):-1;
    const next=fromCurrent?routeResumeIndex(stops,view.z,{currentX:view.x}):routeNextIndex(stops,mapped,view.z);
    if(!fromCurrent&&mapped===stops.length-1&&next===0){
      view.x=0;view.z=.85;view.y=1.72;velX=0;velZ=0;
      yaw=0;yawTarget=0;pitch=0;pitchTarget=0;
    }
    return goToArtworkIndex(next,stops);
  }
  function restoreTourSession(){
    const data=readTourSession();if(!data)return false;
    const stops=plannedStops(),index=stops.findIndex(stop=>stop.id===data.id);
    if(index<0){clearTourSession();return false;}
    tourState.stops=stops;tourState.index=index;tourState.motion=null;
    tourState.started=true;tourState.restored=true;
    tourState.userMoved=Boolean(data.userMoved);
    tourState.dwell=clamp(data.dwell||0,0,7);
    v5.setViewMode(data.mode==="room"?"room":"art",true);
    const shot=framingFor(stops[index],v5.getViewMode());
    camera.fov=shot.fov;camera.updateProjectionMatrix();
    view.x=clamp(data.x,-HALF+1.4,HALF-1.4);
    view.z=clamp(data.z,.80,LENGTH-2.8);
    yaw=Number.isFinite(data.yaw)?data.yaw:0;
    pitch=Number.isFinite(data.pitch)?clamp(data.pitch,-.98,.98):0;
    yawTarget=yaw;pitchTarget=pitch;velX=0;velZ=0;
    const distance=Math.hypot(shot.x-view.x,shot.z-view.z);
    if(data.phase==="viewing"&&distance<1){
      showTourStory();
      tourState.dwell=clamp(data.dwell||0,0,7);
    }else hideTourStory();
    overlay.dataset.tourStop=String(index+1);
    v5.setResumeAvailable(true);
    v5.toast("VISITE SAUVEGARDÉE · REPRENEZ OÙ VOUS ÉTIEZ");
    return true;
  }
  story.querySelector("#temTourNext").addEventListener("click",()=>{
    v5.manual();goToNextArtwork();
  });
  story.querySelector("#temTourView").addEventListener("click",()=>{
    const stop=tourState.stops[tourState.index];if(stop)selected(stop.slot);
  });
  story.querySelector("#temTourClose").addEventListener("click",()=>story.hidden=true);
  const held=new Set(),keys=new Set();
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const view={x:0,y:1.72,z:.85};
  let lastSpotPosition=-Infinity, lastShadowPosition=-Infinity;
  const progress=$("#walkProgress"),meter=$("#walkMeter");
  const guide=$("#walkGuide");
  if(guide)guide.textContent="ENTREZ DANS LES GALERIES · ADMIREZ LES ŒUVRES ET LEURS CARTELS DORÉS. LES SPOTS SE CONCENTRENT SUR LES EXPOSITIONS. LE PLAFOND RESTE BLANC.";
  $(".walk-identity small").textContent="GALERIES MONUMENTALES · MUSÉE 3D";
  const panel=document.createElement("div");panel.className="engine-status";
  panel.innerHTML='<span class="engine-chip">● RENDERED IN 3D</span><span class="engine-chip engine-location">ORIGINAL GALLERY · 2026</span>';
  overlay.appendChild(panel);
  function onGuidedTourChange({playing,paused}){
    overlay.dataset.tourPlaying=String(playing);
    overlay.dataset.tourPaused=String(paused);
    if(playing){
      tourState.started=true;
      // Every time a guided tour is started or resumed, begin at the exhibit
      // CLOSEST TO THE VISITOR'S CURRENT 3D POSITION. Never teleport back to
      // the saved visit or assume that the old numbered stop is still nearby.
      const stops=plannedStops();
      const nearest=routeResumeIndex(stops,view.z,{currentX:view.x});
      if(nearest<0){v5.finishTour();v5.toast("AUCUNE ŒUVRE EXPOSÉE POUR LE MOMENT");return;}
      const shot=framingFor(stops[nearest],v5.getViewMode());
      const alreadyViewing=tourState.stops[tourState.index]?.id===stops[nearest].id
        && !story.hidden && !tourState.userMoved
        && Math.hypot(view.x-shot.x,view.z-shot.z)<.75;
      tourState.restored=false;
      if(alreadyViewing){
        tourState.stops=stops;tourState.index=nearest;tourState.motion=null;
      }else{
        goToArtworkIndex(nearest,stops);
      }
      return;
    }
    if(paused && tourState.motion && !tourState.motion.pausedAt){
      tourState.motion.pausedAt=performance.now();
      velX=0;velZ=0;
    }
    if(paused)saveTourSession();
  }
  function movedByVisitor(){
    tourState.userMoved=true;
    tourState.motion=null;
    hideTourStory();
  }
  const v5=createMuseumV5Navigation({
    overlay,canvas,mobile,
    home:()=>{
      resetTourState(true);view.x=0;view.z=.85;view.y=1.72;
      yaw=0;pitch=0;yawTarget=0;pitchTarget=0;walkTo=null;velX=0;velZ=0;
    },
    setZoom:(fov)=>{camera.fov=fov;camera.updateProjectionMatrix();},
    adjustZoom:(delta)=>{camera.fov=clamp(camera.fov+delta,40,75);camera.updateProjectionMatrix();},
    nextStop:()=>goToNextArtwork(),
    onTourChange:onGuidedTourChange,
    onViewChange:(mode)=>{
      const stop=tourState.stops[tourState.index];
      if(stop && active){
        goToArtworkIndex(tourState.index,tourState.stops);
      }else{
        camera.fov=mode==="room"?64:mobile?56:59;camera.updateProjectionMatrix();
      }
      saveTourSession();
    }
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
    // Expose actual consumed inputs for automated checks of live joystick
    // steering, not merely static signs in the UI.
    overlay.dataset.museumInputForward=fwd.toFixed(3);
    overlay.dataset.museumInputStrafe=strafe.toFixed(3);
    overlay.dataset.museumInputLookX=input.lookX.toFixed(3);
    overlay.dataset.museumInputLookY=input.lookY.toFixed(3);
    if(turning||fwd||strafe||input.lookX||input.lookY){
      // Manual input wins. An old click-to-walk route must never restart
      // when the visitor releases the joystick.
      walkTo=null;
      if(input.auto){
        v5.takeControl();
        // The current frame already captured the old guided-mode snapshot.
        // Clear it now, otherwise guided routing can restart in this frame.
        input.auto=false;
        input.simple=false;
        input.resume=false;
      }
      movedByVisitor();
    }
    if(input.auto && !blocked){
      // Auto-tour follows the same real-artwork journey as the mobile Next button.
      if(!tourState.motion){
        const onStory=!story.hidden && tourState.index>=0;
        if(!onStory)goToNextArtwork({fromCurrent:tourState.index<0});
        else {
          tourState.dwell+=dt;
          if(tourState.dwell>=7.8){
            if(tourState.index===tourState.stops.length-1){
              v5.finishTour();
              tourState.started=false;clearTourSession();
              v5.toast("FIN DE LA VISITE · REPRENEZ À VOTRE RYTHME");
            }else goToNextArtwork();
          }
        }
      }
      fwd=0;strafe=0;
    }else{
      yawTarget+=(turning*1.22+input.lookX*1.9)*dt;
      pitchTarget=clamp(pitchTarget-input.lookY*dt*1.32,-.98,.98);
      if(walkTo!==null && !fwd && !strafe){
        if(view.z<walkTo-.45)fwd=.8;
        else walkTo=null;
      }
    }
    yaw+=(yawTarget-yaw)*Math.min(1,dt*(input.auto?4.2:6.2));
    pitch+=(pitchTarget-pitch)*Math.min(1,dt*(input.auto?4.2:6));
    if(blocked){fwd=0;strafe=0;walkTo=null;velX=0;velZ=0;}
    // One-tap advance is independent of where the visitor is looking:
    // keep the visitor in the central aisle, not against a side wall.
    if(input.cruise && !blocked){fwd=1;strafe=0;walkTo=null;}
    const assisted=Boolean(input.auto || input.simple || input.cruise);
    const moveSpeed=pressed("ShiftLeft","ShiftRight")?4.6:(input.auto?3.4:input.cruise?2.4:2.25);
    const magnitude=Math.max(1,Math.hypot(fwd,strafe));
    // Camera is rotated by PI + yaw: its on-screen right is -X at the entrance.
    // Both keyboard (D/Q) and touch joystick use the same camera-relative basis.
    const motion=museumCameraMotion(yaw,fwd,strafe);
    const wantX=input.auto?0:(input.simple && Math.abs(fwd)>.01?-view.x*1.25:motion.x*moveSpeed/magnitude);
    const wantZ=assisted?fwd*moveSpeed:motion.z*moveSpeed/magnitude;
    const damping=Math.min(1,dt*(input.auto?5.7:8));
    velX+=(wantX-velX)*damping;
    velZ+=(wantZ-velZ)*damping;
    view.x=clamp(view.x+velX*dt,-HALF+1.4,HALF-1.4);
    if(assisted && (Math.abs(fwd)>.01||Math.abs(strafe)>.01))view.x+=(0-view.x)*Math.min(1,dt*3.6);
    view.z=clamp(view.z+velZ*dt,.80,LENGTH-2.8);
    // Cinematic approach: shift toward the actual piece, then turn to face it.
    // This overrides empty-corridor cruise while preserving keyboard free roam.
    if(tourState.motion && !tourState.motion.pausedAt && !blocked){
      const m=tourState.motion;
      // Use real elapsed time: software WebGL and lower-end phones may render slowly.
      m.elapsed=Math.max(0,(time-m.startedAt)/1000);
      const t=smoothstep(m.elapsed/m.duration);
      view.x=m.fromX+(m.x-m.fromX)*t;
      view.z=m.fromZ+(m.z-m.fromZ)*t;
      yaw=m.fromYaw+(m.yaw-m.fromYaw)*t;
      pitch=m.fromPitch+(m.pitch-m.fromPitch)*t;
      yawTarget=yaw;pitchTarget=pitch;
      velX=0;velZ=0;
      if(t>=1){
        tourState.motion=null;
        showTourStory();
      }
    }
    if(input.cruise && view.z>=LENGTH-3.0){
      v5.stopCruise();
      v5.toast("VOUS ÊTES AU BOUT DE LA GALERIE");
    }
    const walking=Math.abs(velX)+Math.abs(velZ)>.12;
    view.y=1.72+(walking&&!input.auto?Math.sin(time*.008)*.003:0);
    orient();
    overlay.dataset.tourCameraZ=view.z.toFixed(3);
    overlay.dataset.tourCameraX=view.x.toFixed(3);
    overlay.dataset.tourCameraYaw=yaw.toFixed(4);
    overlay.dataset.tourCameraPitch=pitch.toFixed(4);
    overlay.dataset.museumCameraFov=camera.fov.toFixed(2);
    overlay.dataset.tourAutoWalking=String(walkTo!==null);
    if(tourState.started && time-lastTourSnapshot>1750){
      lastTourSnapshot=time;saveTourSession();
    }
    // Move the constrained sun shadow cascade with the visitor, including iPhone.
    if(Math.abs(view.z-lastShadowPosition)>(mobile?7:4)){
      sun.position.set(-7,15,view.z+12);
      sun.target.position.set(0,0,view.z+12);
      sun.target.updateMatrixWorld();
      lastShadowPosition=view.z;
    }
    if(Math.abs(view.z-lastSpotPosition)>.65){
      museumArtDirection.updateSpotlights(view.z,window.TEM.getSlots());
      lastSpotPosition=view.z;
    }
    if(time-rayTime>180){
      rayTime=time;
      v5.setNear(!input.auto&&Boolean(interactions(0,0)));
    }
    renderer.render(scene,camera);
    const frees=(window.TEM.getWallDisplaySlots?.()||window.TEM.getSlots().filter(s=>!s.reservedForAds)).filter(s=>!s.piece).length+
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
    active=true;last=performance.now();view.x=0;view.z=.85;yaw=0;pitch=0;yawTarget=0;pitchTarget=0;velX=0;velZ=0;walkTo=null;resetTourState();
    v5.enter();
    // Fresh entry: start from the entrance; guided mode will seek the nearest
    // real exhibit from the live camera position, never an old saved stop.
    clearTourSession();
    overlay.hidden=false;document.body.classList.add("walk-is-open");
    resize();orient();
    frame=requestAnimationFrame(tick);
    window.__TUM_PREMIUM_READY=true;
    overlay.querySelector(".walk-close")?.focus({preventScroll:true});
  }
  function close(){
    if(!active)return;
    saveTourSession();
    active=false;cancelAnimationFrame(frame);
    v5.leave();resetTourState();
    held.clear();keys.clear();walkTo=null;down=null;
    overlay.hidden=true;document.body.classList.remove("walk-is-open");
    if(new URLSearchParams(location.search).get('visit')==='immersive'){
      const u=new URL(location.href);u.searchParams.delete('visit');u.searchParams.delete('retry3d');
      history.replaceState(null,'',u.pathname+(u.search||'')+u.hash);
    }
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
  window.addEventListener("blur",()=>{held.clear();keys.clear();saveTourSession();});
  window.addEventListener("pagehide",saveTourSession);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      held.clear();keys.clear();velX=0;velZ=0;walkTo=null;down=null;
      v5.releaseInputs();saveTourSession();
    }
  });
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
    if(down.drag){
      // Dragging the view immediately hands control back to the visitor,
      // even during a guided tour or camera transition.
      v5.takeControl();
      movedByVisitor();
      yawTarget+=dx*(mobile?.0052:.0039);
      pitchTarget=clamp(pitchTarget-dy*.0037,-.98,.98);
      walkTo=null;
    }
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
      else if(!mobile && ny<-.12&&Math.cos(yaw)>.25){
        // Prevent accidental one-tap auto-walking on touchscreens: the
        // joystick should be the only free-roam movement control on phones.
        v5.takeControl();movedByVisitor();walkTo=Math.min(LENGTH-3,view.z+12);
      }
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
  window.addEventListener("tem:exhibited",()=>{
    lastSpotPosition=-Infinity;drawInventory();resetTourState(true);v5.setResumeAvailable(false);
  });
  canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();
    close();
    overlay.querySelector(".walk-guide").textContent="L’affichage 3D a été interrompu. Rechargez la page pour réessayer.";
  });
  if(new URLSearchParams(location.search).get('visit')==='immersive'){
    requestAnimationFrame(open);
  }
})();
