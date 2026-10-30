import * as THREE from "three";

// Architectural identity for The Empty Museum.
// A white limestone sequence of portals and quieter exhibition bays. No
// artwork, commerce, or future ceiling mounts are created by this module.
export function buildMuseumScenography({scene,architecture,half,height,length,mobile}){
  const plaster=new THREE.MeshStandardMaterial({color:0xfaf9f6,roughness:.78});
  const porcelain=new THREE.MeshStandardMaterial({color:0xfffefa,roughness:.39});
  const limestone=new THREE.MeshStandardMaterial({color:0xe9e7e1,roughness:.76});
  const plasterShadow=new THREE.MeshStandardMaterial({color:0xe4e3dc,roughness:.94});
  const brass=new THREE.MeshStandardMaterial({color:0xb2a17f,roughness:.29,metalness:.62});
  const brushedBronze=new THREE.MeshStandardMaterial({color:0x766950,roughness:.36,metalness:.58});
  const matteGlass=new THREE.MeshStandardMaterial({color:0xfffdf4,roughness:.18,metalness:.02,transparent:true,opacity:.87});
  const whiteLight=new THREE.MeshBasicMaterial({color:0xffffff});
  const ivoryLight=new THREE.MeshBasicMaterial({color:0xfff5df});
  const dynamicLights=[];
  let lastFocus=-1;

  function place(parent,geo,mat,x,y,z,{rotX=0,rotY=0,rotZ=0,shadow=false}={}){
    const obj=new THREE.Mesh(geo,mat);
    obj.position.set(x,y,z);
    obj.rotation.set(rotX,rotY,rotZ);
    obj.castShadow=shadow&&!mobile;
    obj.receiveShadow=!mobile;
    parent.add(obj);
    return obj;
  }
  function box(p,w,h,d,mat,x,y,z,opts={}){
    return place(p,new THREE.BoxGeometry(w,h,d),mat,x,y,z,opts);
  }
  function column(p,x,z,scale=1){
    const main=place(p,new THREE.CylinderGeometry(.24*scale,.28*scale,3.18*scale,28),plaster,
      x,1.82*scale,z,{shadow:true});
    const fluteCount=mobile?8:16;
    for(let j=0;j<fluteCount;j++){
      const a=j*Math.PI*2/fluteCount,rad=.245*scale;
      place(p,new THREE.CylinderGeometry(.022*scale,.025*scale,3.0*scale,7),porcelain,
        x+Math.cos(a)*rad,1.82*scale,z+Math.sin(a)*rad);
    }
    box(p,.69*scale,.17*scale,.69*scale,limestone,x,.17*scale,z);
    box(p,.57*scale,.12*scale,.57*scale,porcelain,x,3.45*scale,z);
    box(p,.72*scale,.14*scale,.72*scale,plaster,x,3.62*scale,z);
    return main;
  }
  function arch(p,z,ringRadius=3.08){
    const centerY=3.02;
    const archMaterial=plaster;
    // Two white concentric scallops add real depth and natural grazing shadows.
    for(const [r,t,depth,mat] of [
      [ringRadius,.155,.12,plaster],
      [ringRadius-.21,.048,.20,limestone],
      [ringRadius-.29,.020,.23,porcelain]
    ]){
      const ring=place(p,new THREE.TorusGeometry(r,t,12,64,Math.PI),mat,
        0,centerY,z+depth);
      ring.rotation.z=0;
    }
    for(const side of [-1,1]){
      column(p,side*ringRadius,z,.91);
      // Slim bronze vertical reveals — architectural ornament, not gold walls.
      box(p,.026,2.25,.08,brushedBronze,side*(ringRadius-.18),1.42,z+.18);
      box(p,.64,.08,.65,brass,side*ringRadius,3.37,z);
    }
    const keystone=box(p,.33,.28,.29,porcelain,0,centerY+ringRadius-.07,z+.12);
    keystone.rotation.z=Math.PI/4;
  }
  // Pool of diffused daylight under each ceiling oculus. Texture opacity falls
  // off continuously; a gentle focal cue rather than a spotlight decal.
  const daylightPoolTexture=(()=>{
    const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
    const g=canvas.getContext("2d");
    const grad=g.createRadialGradient(128,128,4,128,128,127);
    grad.addColorStop(0,"rgba(255,255,252,.64)");
    grad.addColorStop(.55,"rgba(255,255,250,.32)");
    grad.addColorStop(.80,"rgba(255,255,248,.09)");
    grad.addColorStop(1,"rgba(255,255,248,0)");
    g.fillStyle=grad;g.fillRect(0,0,256,256);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
  })();
  const daylightPool=new THREE.MeshBasicMaterial({
    map:daylightPoolTexture,transparent:true,opacity:.62,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    side:THREE.DoubleSide
  });
  for(const z of [21,48,76,104,138]){
    place(architecture,new THREE.PlaneGeometry(5.4,5.4),daylightPool,
      0,.046,z,{rotX:-Math.PI/2});
  }
  function floorMedallion(z,outer=2.18){
    for(const [r,t,mat] of [
      [outer,.018,brass],
      [outer-.17,.04,porcelain],
      [outer-.46,.018,brass],
      [outer-.82,.015,limestone],
    ]){
      place(architecture,new THREE.TorusGeometry(r,t,8,96),mat,
        0,.035,z,{rotX:-Math.PI/2});
    }
    // A quiet inset of eight thin radial marks.
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      const r=outer-.65;
      const m=box(architecture,.019,.018,.42,brass,Math.cos(a)*r,.038,z+Math.sin(a)*r);
      m.rotation.y=-a;
    }
  }
  function whiteBench(x,z){
    box(architecture,.78,.13,1.7,plaster,x,.55,z,{shadow:true});
    for(const d of [-.59,.59]){
      box(architecture,.61,.43,.24,limestone,x,.28,z+d);
    }
    box(architecture,.52,.013,1.42,porcelain,x,.625,z);
  }
  function flutedBay(side,z,number){
    const x=side*(half-.27);
    // A linen-white stone panel gives each work breathing space.
    box(architecture,.075,3.55,3.13,plaster,x,2.73,z);
    for(const s of [-1,1]){
      box(architecture,.042,3.70,.10,limestone,x-side*.067,2.72,z+s*1.54);
      box(architecture,.022,3.27,.06,brass,x-side*.10,2.73,z+s*1.60);
    }
    // A slim art shelf/lip and hidden grazing fixture below the display.
    box(architecture,.12,.024,3.08,porcelain,x-side*.11,.91,z);
    box(architecture,.03,.022,2.94,whiteLight,x-side*.15,.89,z);
    if(number%7===0){
      box(architecture,.22,.12,3.18,plasterShadow,x-side*.15,4.60,z);
      box(architecture,.025,.02,2.87,ivoryLight,x-side*.16,4.52,z);
    }
  }

  // Major experiences: a monumental vestibule and three gallery portals.
  const portals=[{z:4.45,r:3.07},{z:38.6,r:3.01},{z:79.4,r:3.01},{z:121.6,r:3.07}];
  for(const p of portals){arch(architecture,p.z,p.r);floorMedallion(p.z+2.65);}
  // Smaller white-on-white ceiling cornices signal transitions between exhibits.
  for(const z of [18.8,58.5,99.5,135]){
    const g=new THREE.Group();g.position.set(0,0,z);architecture.add(g);
    for(const side of [-1,1]){
      box(g,.23,4.7,.18,plaster,side*(half-.40),2.35,0);
      box(g,.33,.12,.22,limestone,side*(half-.39),4.72,0);
    }
    box(g,half*2-.72,.11,.20,porcelain,0,height-.34,0);
    box(g,half*2-.76,.015,.15,whiteLight,0,height-.49,0);
  }
  // Gallery bays are architectural reliefs: art frames remain separate exhibits.
  // Only the original 38 bays are built, preserving the exact sales geometry.
  for(let i=0;i<38;i++){
    const z=5.7+i*3.5;
    const side=i%2?1:-1;
    flutedBay(side,z,i);
  }
  // Minimal rest plinths and small tree-like sculptural lights; no pretend artworks.
  for(const [i,z] of [29.3,68.9,110.8].entries()){
    const side=i%2?1:-1;
    whiteBench(side*2.80,z);
    const cylinder=place(architecture,new THREE.CylinderGeometry(.055,.065,1.95,16),
      brass,side*3.3,1.13,z+2.3);
    const canopy=place(architecture,new THREE.SphereGeometry(.26,24,16),
      matteGlass,side*3.3,2.19,z+2.3);
    const core=place(architecture,new THREE.SphereGeometry(.12,16,12),
      whiteLight,side*3.3,2.19,z+2.3);
  }

  // The lighting rig tracks nearby artworks rather than creating 38 costly
  // realtime spotlights; fixtures are visible on the roof throughout.
  const spots=[];
  for(let i=0;i<(mobile?2:4);i++){
    const light=new THREE.SpotLight(0xfff5e0,mobile?26:42,7.8,.52,.68,1.4);
    light.castShadow=false;
    light.visible=false;
    scene.add(light,light.target);
    spots.push(light);
  }
  const trackMaterial=new THREE.MeshStandardMaterial({color:0xeae9e4,roughness:.45,metalness:.27});
  const fixture=new THREE.MeshStandardMaterial({color:0xf7f6f0,roughness:.38,metalness:.13});
  const lensMat=new THREE.MeshBasicMaterial({color:0xfff7e6});
  // Lighting rails along both walls, tiny physical spots at regular intervals.
  for(const side of [-1,1]){
    const x=side*(half-1.0);
    box(architecture,.038,.038,length,trackMaterial,x,height-.28,length/2);
    for(let z=5.7;z<length-3;z+=7){
      box(architecture,.12,.12,.25,fixture,x,height-.34,z);
      const head=place(architecture,new THREE.CylinderGeometry(.082,.10,.19,14),
        fixture,x-side*.065,height-.46,z,{rotZ:side*.37});
      place(architecture,new THREE.CircleGeometry(.075,20),lensMat,
        x-side*.13,height-.55,z,{rotX:Math.PI/2});
    }
  }
  function updateSpotlights(z,slots){
    const nearest=slots.filter(s=>s.piece && !s.reservedForAds)
      .map(s=>({...s,at:5.7+s.id*3.5}))
      .filter(s=>Math.abs(s.at-z)<21)
      .sort((a,b)=>Math.abs(a.at-z)-Math.abs(b.at-z))
      .slice(0,spots.length);
    const signature=nearest.map(s=>s.id).join(",");
    if(signature===lastFocus)return;
    lastFocus=signature;
    for(let i=0;i<spots.length;i++){
      const light=spots[i],slot=nearest[i];
      if(!slot){light.visible=false;continue;}
      const side=slot.id%2?1:-1,spotX=side*(half-1.35);
      light.visible=true;
      light.position.set(spotX,height-.55,slot.at);
      light.target.position.set(side*(half-.35),2.8,slot.at);
      light.target.updateMatrixWorld();
    }
  }
  return {updateSpotlights};
}
