import * as THREE from "three";

/**
 * THE EMPTY MUSEUM — SCANNED PBR UPGRADE
 * Poly Haven CC0 photogrammetric/reference textures.
 * Deferred loading: original procedural luxury materials remain valid if
 * offline, WebGL1, CDN down, blocked by CORS, or any map fails.
 *
 * Source: https://polyhaven.com/a/white_plaster_02
 * Source: https://polyhaven.com/a/marble_01
 * License: https://polyhaven.com/license
 */
const CDN="https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/";
function fetchMap(loader,id,channel,x,y,isColor=false) {
  return new Promise(resolve=>{
    const url=`${CDN}${id}/${id}_${channel}_1k.jpg`;
    loader.load(url,t=>{
      t.wrapS=t.wrapT=THREE.RepeatWrapping;
      t.repeat.set(x,y);
      t.anisotropy=4;
      if(isColor)t.colorSpace=THREE.SRGBColorSpace;
      t.needsUpdate=true;
      resolve(t);
    },undefined,()=>resolve(null));
  });
}
export async function enhanceScannedPBR(luxury,{mobile=false,length=28}={}) {
  const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
  const wallRepeatX=Math.max(3,Math.round(length/3));
  const floorRepeatY=Math.max(4,Math.round(length/2.2));
  // Museum gallery walls are intended to be WARM WHITE.
  // The scanned white_plaster_02 diffuse map reads dark brown under ACES and
  // turned the room into a concrete tunnel. Retain the bright procedural
  // painted plaster albedo; add only real micro-relief and roughness variation.
  const [wallNormal,wallRough]=await Promise.all([
    fetchMap(loader,"white_plaster_02","nor_gl",wallRepeatX,2),
    mobile?Promise.resolve(null):fetchMap(loader,"white_plaster_02","rough",wallRepeatX,2)
  ]);
  const wallUpgraded=Boolean(wallNormal||wallRough);
  if(wallUpgraded)for(const mat of [luxury.wall,luxury.wallAlt]){
    if(wallNormal){
      mat.normalMap=wallNormal;
      mat.normalScale.set(.13,.13);
      mat.bumpMap=null;
    }
    if(wallRough){mat.roughnessMap=wallRough;mat.roughness=.94;}
    // Deliberately do not touch mat.map or mat.color.
    mat.needsUpdate=true;
  }
  // Keep the calibrated warm limestone albedo. A scanned marble diffuse
  // is far too contrasty for this room and makes distant walls look dirty.
  // Use only true scanned micro-normal and roughness data on the stone.
  const [floorNormal,floorRough]=await Promise.all([
    fetchMap(loader,"marble_01","nor_gl",3,floorRepeatY),
    mobile?Promise.resolve(null):fetchMap(loader,"marble_01","rough",3,floorRepeatY)
  ]);
  const floorUpgraded=Boolean(floorNormal||floorRough);
  if(floorUpgraded){
    if(floorNormal){
      luxury.floor.normalMap=floorNormal;
      luxury.floor.normalScale.set(.10,.10);
      luxury.floor.bumpMap=null;
    }
    if(floorRough)luxury.floor.roughnessMap=floorRough;
    luxury.floor.roughness=.83;
    luxury.floor.clearcoat=.025;
    luxury.floor.clearcoatRoughness=.85;
    luxury.floor.needsUpdate=true;
  }
  document.documentElement.dataset.temScannedPbr=(wallUpgraded||floorUpgraded)?"active":"fallback";
  return {wall:wallUpgraded,floor:floorUpgraded};
}
