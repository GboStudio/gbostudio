import * as THREE from "three";

// Architectural identity for The Empty Museum.
// A white limestone sequence of portals and quieter exhibition bays. No
// artwork, commerce, or future ceiling mounts are created by this module.
export function buildMuseumScenography({scene,architecture,half,height,length,mobile}){
  const plaster=new THREE.MeshStandardMaterial({color:0xfafaf8,roughness:.92});
  const porcelain=new THREE.MeshStandardMaterial({color:0xfdfdfa,roughness:.72});
  const limestone=new THREE.MeshStandardMaterial({color:0xeeefeb,roughness:.81});
  const plasterShadow=new THREE.MeshStandardMaterial({color:0xecece8,roughness:.97});
  const brass=new THREE.MeshStandardMaterial({color:0xa99a7d,roughness:.49,metalness:.49});
  const brushedBronze=new THREE.MeshStandardMaterial({color:0x9d978c,roughness:.57,metalness:.27});
  const matteGlass=new THREE.MeshPhysicalMaterial({color:0xfdfdfb,roughness:.26,metalness:0,transparent:true,opacity:.86,transmission:.04,thickness:.04});
  const whiteLight=new THREE.MeshBasicMaterial({color:0xffffff});
  const ivoryLight=new THREE.MeshBasicMaterial({color:0xfdfbf4});
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
  // Architectural white-cube thresholds rather than decorative stone arches.
  // Continuous straight reveals, a shadow line and natural human-scale opening.
  function arch(p,z){
    const wall=half-.23;
    const returnMat=new THREE.MeshStandardMaterial({color:0xf5f4f0,roughness:.91});
    const reveal=new THREE.MeshStandardMaterial({color:0xdad8d2,roughness:.94});
    for(const side of [-1,1]){
      box(p,.31,4.85,.23,plaster,side*wall,2.425,z,{shadow:true});
      box(p,.025,4.36,.035,reveal,side*(wall-.18),2.54,z+.095);
      box(p,.17,.25,.39,returnMat,side*(wall-.02),5.0,z);
    }
    // The lintel must feel structural without shrinking the aisle.
    box(p,half*2-.16,.43,.34,returnMat,0,5.16,z,{shadow:true});
    box(p,half*2-.32,.023,.035,reveal,0,4.94,z+.17);
    box(p,half*2-.36,.08,.31,plaster,0,5.41,z);
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
    map:daylightPoolTexture,transparent:true,opacity:.23,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    side:THREE.DoubleSide
  });
  for(const z of [21,48,76,104,138]){
    place(architecture,new THREE.PlaneGeometry(5.4,5.4),daylightPool,
      0,.046,z,{rotX:-Math.PI/2});
  }
  // Remove ornamental floor targets; the limestone slabs read as real architecture.
  function whiteBench(x,z){
    box(architecture,.78,.13,1.7,plaster,x,.55,z,{shadow:true});
    for(const d of [-.59,.59]){
      box(architecture,.61,.43,.24,limestone,x,.28,z+d);
    }
    box(architecture,.52,.013,1.42,porcelain,x,.625,z);
  }
  function flutedBay(side,z,number){
    // Quiet, dimensional museum wall, with an almost invisible plaster reveal.
    const x=side*(half-.27);
    box(architecture,.052,3.28,3.16,number%5===0?porcelain:plaster,x,2.40,z);
    for(const s of [-1,1]){
      const border=new THREE.MeshStandardMaterial({color:0xe0dfda,roughness:.96});
      box(architecture,.016,3.27,.014,border,x-side*.036,2.40,z+s*1.575);
    }
    // The painting creates the visual interest, not a golden wall frame.
    box(architecture,.045,.045,3.06,limestone,x-side*.031,.79,z);
  }

  // Major experiences: a monumental vestibule and three gallery portals.
  const portals=[{z:4.45,r:3.07},{z:38.6,r:3.01},{z:79.4,r:3.01},{z:121.6,r:3.07}];
  for(const p of portals)arch(architecture,p.z);
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
  // Subtle soft contact shadows beneath furniture, even on mobile.
  const shadeCanvas=document.createElement("canvas");shadeCanvas.width=128;shadeCanvas.height=128;
  const shadeCtx=shadeCanvas.getContext("2d");
  const shadeGrad=shadeCtx.createRadialGradient(64,64,4,64,64,63);
  shadeGrad.addColorStop(0,"rgba(32,31,26,.24)");
  shadeGrad.addColorStop(.55,"rgba(32,31,26,.09)");
  shadeGrad.addColorStop(1,"rgba(32,31,26,0)");
  shadeCtx.fillStyle=shadeGrad;shadeCtx.fillRect(0,0,128,128);
  const shadeTexture=new THREE.CanvasTexture(shadeCanvas);
  const shadowMaterial=new THREE.MeshBasicMaterial({map:shadeTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const [i,z] of [29.3,68.9,110.8].entries()){
    const shadow=place(architecture,new THREE.PlaneGeometry(1.5,2.0),shadowMaterial,
      (i%2?1:-1)*2.80,.041,z,{rotX:-Math.PI/2});
    shadow.renderOrder=2;
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
  for(let i=0;i<(mobile?3:6);i++){
    const light=new THREE.SpotLight(0xfffbf3,mobile?16:24,8.5,.45,.85,1.4);
    light.castShadow=false;
    light.visible=false;
    scene.add(light,light.target);
    spots.push(light);
  }
  const trackMaterial=new THREE.MeshStandardMaterial({color:0xecece8,roughness:.65,metalness:.13});
  const fixture=new THREE.MeshStandardMaterial({color:0xf8f8f6,roughness:.59,metalness:.08});
  const lensMat=new THREE.MeshBasicMaterial({color:0xfffcf7});
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
