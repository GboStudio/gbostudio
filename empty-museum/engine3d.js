import * as THREE from "three";

(() => {
  "use strict";
  const overlay = document.getElementById("walkOverlay");
  const canvas = document.getElementById("walkCanvas");
  if (!overlay || !canvas || !window.TEM) return;
  const can3D = document.createElement("canvas");
  if (!can3D.getContext("webgl2") && !can3D.getContext("webgl")) throw new Error("WebGL unavailable");
  const $ = s => document.querySelector(s);
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const mobile = matchMedia("(pointer:coarse)").matches;
  const HALF = 4.6, HEIGHT = 6.4, STEP = 3.5, LENGTH = 9 + window.TEM.getSlots().length*STEP;
  const WARM = 0xf6f4ee, WHITE = 0xf9f8f5;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f4ef);
  scene.fog = new THREE.FogExp2(0xf5f4ef,0.0065);
  const camera = new THREE.PerspectiveCamera(mobile?77:69,1,.07,240);
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.46;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xf5f4ef,1);

  scene.add(new THREE.HemisphereLight(0xffffff,0xc2b6a2,2.6));
  const ambient = new THREE.AmbientLight(0xfff5e8,.62);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff7e8,2.7);
  sun.position.set(-8,18,15);
  if (!mobile) {
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-15;sun.shadow.camera.right=15;
    sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
    sun.shadow.camera.near=.5;sun.shadow.camera.far=60;
    sun.shadow.bias=-.0003;
  }
  scene.add(sun);

  const material=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const stone=material(0xf1eee7,.68), stoneAlt=material(0xece9e2,.78);
  const floorMat=material(0xdedcd4,.31), grout=material(0xc7c5bd,.94);
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
  tileMat.map=stoneTexture();tileMat.needsUpdate=true;
  box(architecture,HALF*2,.28,LENGTH,tileMat,0,-.16,LENGTH/2,false,true);
  box(architecture,HALF*2,.34,LENGTH,stoneAlt,0,HEIGHT+.19,LENGTH/2);
  // Tall luminous central skylight: the roof stays architecturally open and light-filled.
  box(architecture,2.76,.07,LENGTH,glass,0,HEIGHT+.005,LENGTH/2);
  box(architecture,2.84,.045,LENGTH,lightTrim,0,HEIGHT-.052,LENGTH/2);
  box(architecture,2.68,.032,LENGTH,new THREE.MeshBasicMaterial({color:0xf3fff6}),0,HEIGHT-.088,LENGTH/2);
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
    box(architecture,HALF*2-.6,.17,.44,plinthMat,0,HEIGHT-.08,z);
    box(architecture,HALF*2-.63,.016,.48,brass,0,HEIGHT-.25,z);
    const light=new THREE.PointLight(0xffeedc,mobile?8:13,mobile?11:15,2);
    light.position.set(0,HEIGHT-.65,z);
    architecture.add(light);
  }
  // Skylight oculi and discreet bronze concentric detailing.
  for(let z=16;z<LENGTH-5;z+=28){
    const geometry=new THREE.TorusGeometry(1.08,.095,12,50);
    const ring=mesh(architecture,geometry,plinthMat,0,HEIGHT-.13,z);
    ring.rotation.x=-Math.PI/2;
    const inner=mesh(architecture,new THREE.RingGeometry(.84,.9,56),brass,0,HEIGHT-.2,z);
    inner.rotation.x=-Math.PI/2;
    const halo=new THREE.PointLight(0xfff8dc,15,12,2);
    halo.position.set(0,HEIGHT-.55,z);
    architecture.add(halo);
  }
  // Entrance architecture and monumental branding, integrated into the stone.
  box(architecture,8.95,HEIGHT,.19,stone,0,HEIGHT/2,LENGTH+.08);
  box(architecture,7.95,.045,.07,brass,0,2.55,LENGTH-.05);
  box(architecture,8.95,HEIGHT,.17,stoneAlt,0,HEIGHT/2,-.36);
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
  function addFrame(group,w,h,x,y,z,rot,frontMat,slot){
    const frame=box(group,w+.15,h+.15,.095,brass,x,y,z,true);
    frame.rotation.y=rot;
    const matte=box(group,w+.085,h+.085,.104,plinthMat,x,y,z,true);
    matte.rotation.y=rot;
    const plane=surface(group,w,h,frontMat,x,y,z+((rot>0)?.065:-.065),rot);
    // Position plane toward the corridor, not only toward +Z.
    plane.position.set(x+(rot>0?.069:-.069),y,z);
    plane.material.side=THREE.DoubleSide;
    markInteractive(plane,slot);
    return plane;
  }
  function drawWallSlot(slot){
    const i=slot.id,z=5.7+i*STEP,side=i%2?1:-1,x=side*(HALF-.27);
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
      map:canvasPanel("THE EMPTY MUSEUM","ESPACE PUBLICITAIRE","RÉSERVÉ AUX PARTENAIRES","NON DISPONIBLE","wall",true),roughness:.86,side:THREE.DoubleSide
    });
    else mat=new THREE.MeshStandardMaterial({
      map:canvasPanel("WALL / "+String(i+1).padStart(3,"0"),"AVAILABLE",slot.format?.name||"CADRE LIBRE",String(slot.price).replace(".",",")+" € / 12 MOIS","wall"),roughness:.87,side:THREE.DoubleSide
    });
    if(slot.reservedForAds){addFrame(interactive,w,h,x,y,z,rot,mat,null);}
    else addFrame(interactive,w,h,x,y,z,rot,mat,slot);
    const plaque=box(interactive,.48,.06,.12,brass,x-side*.035,y-h*.5-.28,z);
    plaque.rotation.y=rot;
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
    if(isMedium){
      const glow=box(interactive,w+.26,.048,.27,lightTrim,x,y+h/2+.078,z);
      glow.material=new THREE.MeshBasicMaterial({color:0xf7ffe6});
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
    if(piece.floorType==="statue"){
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
    for(const child of [...interactive.children]){interactive.remove(child);
      child.traverse(o=>{if(o.geometry)o.geometry.dispose();});
    }
    clickable.length=0;
    window.TEM.getSlots().forEach(drawWallSlot);
    window.TEM.getCeilingSlots().forEach(drawCeilingSlot);
    window.TEM.getFloorSlots().forEach(platform);
  }
  drawInventory();

  let active=false,frame=0,last=0,yaw=0,pitch=0,walkTo=null,down=null,focusBefore=null;
  const held=new Set(),keys=new Set();
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const clock=new THREE.Clock();
  const view={x:0,y:1.72,z:.85};
  const progress=$("#walkProgress"),meter=$("#walkMeter");
  const guide=$("#walkGuide");
  if(guide)guide.textContent="VRAIE GALERIE 3D · AVANCEZ, REGARDEZ AUTOUR DE VOUS ET TOUCHEZ LES CADRES, PLAFONDS OU SOCLES LIBRES.";
  $(".walk-identity small").textContent="GALERIE ARCHITECTURALE · WEBGL 3D";
  const panel=document.createElement("div");panel.className="engine-status";
  panel.innerHTML='<span class="engine-chip">● RENDERED IN 3D</span><span class="engine-chip engine-location">ORIGINAL GALLERY · 2026</span>';
  overlay.appendChild(panel);
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
    const pressed=(...names)=>names.some(n=>keys.has(n)||held.has(n));
    const turning=Number(pressed("ArrowRight","turn-right"))-Number(pressed("ArrowLeft","turn-left"));
    let fwd=Number(pressed("ArrowUp","KeyW","KeyZ","forward"))-Number(pressed("ArrowDown","KeyS","back"));
    const strafe=Number(pressed("KeyD"))-Number(pressed("KeyQ","KeyA"));
    if(walkTo!==null && !fwd && !strafe){
      if(view.z<walkTo-.5)fwd=1;else walkTo=null;
    }
    yaw+=turning*dt*1.32;
    const speed=(pressed("ShiftLeft","ShiftRight")?11.5:6.1)*dt;
    view.x+=Math.sin(yaw)*fwd*speed+Math.cos(yaw)*strafe*speed;
    view.z+=Math.cos(yaw)*fwd*speed-Math.sin(yaw)*strafe*speed;
    view.x=clamp(view.x,-HALF+.93,HALF-.93);
    view.z=clamp(view.z,.8,LENGTH-2.8);
    const stepBob=(fwd||strafe)?Math.sin(time*.012)*.018:0;
    view.y=1.72+stepBob;
    orient();
    renderer.render(scene,camera);
    const frees=window.TEM.getSlots().filter(s=>!s.piece&&!s.reservedForAds).length+
      window.TEM.getCeilingSlots().filter(s=>!s.piece).length+
      window.TEM.getFloorSlots().filter(s=>!s.piece).length;
    if(progress) progress.textContent=Math.floor(view.z)+" / "+Math.floor(LENGTH)+" M · "+window.TEM.getPieces().length+" CRÉATIONS · "+frees+" PLACES LIBRES";
    if(meter)meter.style.width=(100*view.z/LENGTH)+"%";
    const loc=panel.querySelector(".engine-location");
    if(loc)loc.textContent=view.z<46?"ORIGINAL GALLERY · 2026":view.z<95?"THE EXPANSION · 02":"THE LONG HALL · 03";
    frame=requestAnimationFrame(tick);
  }
  function open(){
    if(active)return;
    focusBefore=document.activeElement;
    active=true;last=performance.now();view.x=0;view.z=.85;yaw=0;pitch=0;walkTo=null;
    overlay.hidden=false;document.body.classList.add("walk-is-open");
    resize();orient();
    frame=requestAnimationFrame(tick);
    overlay.querySelector(".walk-close")?.focus({preventScroll:true});
  }
  function close(){
    if(!active)return;
    active=false;cancelAnimationFrame(frame);
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
    if(down.drag){yaw+=dx*.0042;pitch=clamp(pitch-dy*.0033,-.7,.73);walkTo=null;}
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
  window.addEventListener("tem:exhibited",()=>drawInventory());
  requestAnimationFrame(open);
})();
