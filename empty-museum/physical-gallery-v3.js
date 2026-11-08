import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {planLimestoneSlabs,wallIrradianceProfile,stoneSlabStats} from "./gallery-layout-v3.js?v=20261106a";

/**
 * Architectural realism upgrade for the existing museum. All lighting
 * gradients are precomputed ONCE in tiny CPU canvases, not per frame.
 * Preserve inventory geometry, mobile navigation and the fallback renderer.
 *
 * This is an approximation of baked indirect lighting; it is NOT a Cycles
 * lightmap and should never be described as a path-traced render.
 */
export function addPhysicalGalleryV3({architecture,half,height,length,mobile,floorMaterial}){
  if(!architecture||!floorMaterial)throw Error("Physical gallery requires architecture and stone floor material");

  const slabs=planLimestoneSlabs({
    half,length,columns:4,targetLength:mobile?2.55:2.35,gap:.013
  });
  const stats=stoneSlabStats(slabs);
  if(!slabs.length)return {stats,refreshFloor(){},dispose(){}};

  const rows=stats.rows;
  const cellWidth=2*half/4;
  const cellDepth=length/rows;
  const mortar=new THREE.Mesh(
    new THREE.BoxGeometry(2*half,.002,length),
    new THREE.MeshStandardMaterial({color:0xc5c1b8,roughness:.97,metalness:0})
  );
  mortar.position.set(0,-.017,length/2);
  mortar.receiveShadow=true;
  architecture.add(mortar);

  function correctedTexture(source){
    if(!source)return null;
    // Long-room texture repeats cannot be applied to individual 2.3m slabs.
    // Copy the map so changes do not mutate the full-room material.
    const t=source.clone();
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(1,1);
    t.anisotropy=mobile?2:4;
    t.needsUpdate=true;
    return t;
  }
  const stone=floorMaterial.clone();
  stone.map=correctedTexture(floorMaterial.map);
  stone.bumpMap=correctedTexture(floorMaterial.bumpMap);
  stone.normalMap=correctedTexture(floorMaterial.normalMap);
  stone.roughnessMap=correctedTexture(floorMaterial.roughnessMap);
  // Honed limestone: broad soft highlights, never a glossy showroom floor.
  stone.roughness=.83;
  stone.clearcoat=.025;
  stone.clearcoatRoughness=.85;
  stone.needsUpdate=true;

  const geometry=new RoundedBoxGeometry(cellWidth-.013,.024,cellDepth-.013,2,.0035);
  const tiles=new THREE.InstancedMesh(geometry,stone,slabs.length);
  const dummy=new THREE.Object3D();
  const tint=new THREE.Color();
  for(let i=0;i<slabs.length;i++){
    const slab=slabs[i];
    dummy.position.set(slab.x,-.016,slab.z);
    dummy.rotation.set(0,slab.rotation,0);
    dummy.scale.set(1,1,1);
    dummy.updateMatrix();
    tiles.setMatrixAt(i,dummy.matrix);
    // Very restrained per-slab chromatic differences:
    // a tiled photograph with identical colors does not resemble natural stone.
    tint.setRGB(slab.tint,slab.tint*.996,slab.tint*.989);
    tiles.setColorAt(i,tint);
  }
  tiles.instanceMatrix.needsUpdate=true;
  if(tiles.instanceColor)tiles.instanceColor.needsUpdate=true;
  tiles.receiveShadow=true;
  tiles.castShadow=false;
  tiles.frustumCulled=false; // The long gallery spans multiple rooms; one bounds estimate would cull visible slabs.
  architecture.add(tiles);

  // The bay wall's low-frequency occlusion is static: a cheap alternative to
  // real-time screen-space ambient occlusion on iPhone.
  const c=document.createElement("canvas");c.width=256;c.height=512;
  const g=c.getContext("2d",{willReadFrequently:false});
  const pixels=g.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const u=x/(c.width-1),v=1-y/(c.height-1);
    const alpha=wallIrradianceProfile(u,v);
    const index=(y*c.width+x)*4;
    pixels.data[index]=40;
    pixels.data[index+1]=35;
    pixels.data[index+2]=29;
    pixels.data[index+3]=Math.round(alpha*255);
  }
  g.putImageData(pixels,0,0);
  const atlas=new THREE.CanvasTexture(c);
  atlas.colorSpace=THREE.SRGBColorSpace;
  atlas.generateMipmaps=true;
  atlas.minFilter=THREE.LinearMipmapLinearFilter;
  const wallOcclusionMat=new THREE.MeshBasicMaterial({
    map:atlas,transparent:true,depthWrite:false,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
  });
  const bays=Math.min(38,Math.floor((length-5.7)/3.5)+1);
  const wallGeom=new THREE.PlaneGeometry(3.12,3.265);
  const bayShade=new THREE.InstancedMesh(wallGeom,wallOcclusionMat,bays);
  for(let i=0;i<bays;i++){
    const side=i%2===0?-1:1;
    dummy.position.set(side*(half-.302),2.4,5.7+i*3.5);
    dummy.rotation.set(0,side<0?Math.PI/2:-Math.PI/2,0);
    dummy.scale.set(1,1,1);
    dummy.updateMatrix();bayShade.setMatrixAt(i,dummy.matrix);
  }
  bayShade.instanceMatrix.needsUpdate=true;
  bayShade.frustumCulled=false;
  bayShade.renderOrder=1;
  architecture.add(bayShade);

  // Indirect light at the cornice. The ceiling needs a believable
  // shadow transition before the eye reads its 6.4m height correctly.
  const top=document.createElement("canvas");top.width=32;top.height=256;
  const q=top.getContext("2d");
  const gradient=q.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,"rgba(39,34,28,.17)");
  gradient.addColorStop(.28,"rgba(46,41,35,.095)");
  gradient.addColorStop(.72,"rgba(46,41,35,.020)");
  gradient.addColorStop(1,"rgba(46,41,35,0)");
  q.fillStyle=gradient;q.fillRect(0,0,32,256);
  const corniceTex=new THREE.CanvasTexture(top);corniceTex.colorSpace=THREE.SRGBColorSpace;
  const corniceMat=new THREE.MeshBasicMaterial({
    map:corniceTex,transparent:true,depthWrite:false,side:THREE.DoubleSide
  });
  const cove=[];
  for(const side of [-1,1]){
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(length,.78),corniceMat);
    plane.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    plane.position.set(side*(half-.093),height-.40,length/2);
    plane.renderOrder=1;
    architecture.add(plane);cove.push(plane);
  }

  function refreshFloor(scannedMaterial){
    if(!scannedMaterial?.map)return;
    for(const name of ["map","bumpMap","normalMap","roughnessMap"]){
      const previous=stone[name];
      stone[name]=correctedTexture(scannedMaterial[name]);
      if(previous && previous!==floorMaterial[name])previous.dispose?.();
    }
    stone.roughness=.83;
    stone.clearcoat=.025;
    stone.clearcoatRoughness=.85;
    stone.needsUpdate=true;
  }
  function dispose(){
    architecture.remove(tiles,bayShade,mortar,...cove);
    tiles.geometry.dispose();
    mortar.geometry.dispose();mortar.material.dispose();
    wallGeom.dispose();
    atlas.dispose();wallOcclusionMat.dispose();
    corniceTex.dispose();corniceMat.dispose();
    for(const name of ["map","bumpMap","normalMap","roughnessMap"])stone[name]?.dispose?.();
    stone.dispose();
    cove.forEach(mesh=>mesh.geometry.dispose());
  }
  return {stats,refreshFloor,dispose,tiles,bayShade};
}
