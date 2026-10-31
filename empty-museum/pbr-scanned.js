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
function apply(material,albedo,normal,roughness,{tint=0xffffff,normalScale=.3}) {
  // Do not overwrite working procedural textures on a partial fetch error.
  if(!albedo)return false;
  material.map=albedo;
  if(normal){material.normalMap=normal;material.normalScale.set(normalScale,normalScale);material.bumpMap=null;}
  if(roughness){material.roughnessMap=roughness;material.roughness=.92;}
  material.color.setHex(tint);
  material.needsUpdate=true;
  return true;
}
export async function enhanceScannedPBR(luxury,{mobile=false,length=28}={}) {
  const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
  const wallRepeatX=Math.max(3,Math.round(length/3));
  const floorRepeatY=Math.max(4,Math.round(length/2.2));
  const wallMaps=await Promise.all([
    fetchMap(loader,"white_plaster_02","diff",wallRepeatX,2,true),
    fetchMap(loader,"white_plaster_02","nor_gl",wallRepeatX,2),
    mobile?Promise.resolve(null):fetchMap(loader,"white_plaster_02","rough",wallRepeatX,2)
  ]);
  const wallUpgraded=apply(luxury.wall,...wallMaps,{tint:0xfaf9f6,normalScale:.18});
  if(wallUpgraded)apply(luxury.wallAlt,...wallMaps,{tint:0xf6f5f0,normalScale:.18});
  const floorMaps=await Promise.all([
    fetchMap(loader,"marble_01","diff",3,floorRepeatY,true),
    fetchMap(loader,"marble_01","nor_gl",3,floorRepeatY),
    mobile?Promise.resolve(null):fetchMap(loader,"marble_01","rough",3,floorRepeatY)
  ]);
  const floorUpgraded=apply(luxury.floor,...floorMaps,{tint:0xf4f2ee,normalScale:.20});
  if(floorUpgraded){luxury.floor.roughness=.46;luxury.floor.clearcoat=.12;}
  document.documentElement.dataset.temScannedPbr=(wallUpgraded||floorUpgraded)?"active":"fallback";
  return {wall:wallUpgraded,floor:floorUpgraded};
}
