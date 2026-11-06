import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

/**
 * Load the verified Blender Cycles-baked entrance. This is STATIC LIGHTING:
 * its albedo, direct lighting and indirect rebounds were computed in Blender.
 * Use an unlit runtime material to avoid applying the live gallery lights twice.
 * The V3 gallery remains fully playable if the asset fails to load or times out.
 *
 * No new collision surfaces or advertising slots are created.
 */
export async function addBakedEntranceV4({
  scene,overlay,
  url="./assets/entrance-v4-baked.glb?v=20261106bake1",
  timeoutMs=15000
}={}){
  if(!scene || !overlay)throw Error("Missing museum scene or overlay");
  overlay.dataset.museumLighting="v3-fallback";
  let controller;
  let timeout;
  try{
    controller=new AbortController();
    timeout=setTimeout(()=>controller.abort("Bake fetch timed out"),timeoutMs);
    const response=await fetch(url,{
      method:"GET",signal:controller.signal,cache:"force-cache"
    });
    if(!response.ok)throw Error("Baked GLB returned HTTP "+response.status);
    const length=Number(response.headers.get("content-length"))||0;
    if(length>25_000_000)throw Error("Baked GLB exceeds the mobile payload budget");
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength<10_000||bytes.byteLength>25_000_000)throw Error("Baked GLB byte count invalid");
    const loader=new GLTFLoader();
    const gltf=await loader.parseAsync(bytes,"./assets/");
    const model=gltf.scene;
    let textured=0,triangles=0,drawCalls=0;
    model.traverse(obj=>{
      if(!obj.isMesh)return;
      const source=Array.isArray(obj.material)?obj.material[0]:obj.material;
      const map=source?.map;
      if(!map)throw Error("Baked scene contains untextured architecture");
      textured++;
      if(obj.geometry?.index)triangles+=obj.geometry.index.count/3;
      else triangles+=(obj.geometry?.attributes?.position?.count||0)/3;
      drawCalls++;
    });
    if(!textured||drawCalls>12||triangles>160_000)throw Error("Baked asset exceeds geometry budget");
    model.traverse(obj=>{
      if(!obj.isMesh)return;
      const originals=Array.isArray(obj.material)?obj.material:[obj.material];
      obj.material=originals.map(m=>{
        if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({
          map:m.map,color:0xf7f6f2,side:THREE.DoubleSide,
          // ACES compresses the warm Cycles highlights to the same range as
          // the rest of the PBR gallery. Un-tonemapped bakes turned the white
          // stone yellow and visually dominated the iPhone screen.
          depthWrite:true,transparent:false,toneMapped:true
        });
      });
      if(obj.material.length===1)obj.material=obj.material[0];
      obj.castShadow=false;
      obj.receiveShadow=false;
      obj.frustumCulled=true;
    });
    scene.add(model);
    overlay.dataset.museumLighting="cycles-baked-v4";
    overlay.dataset.museumBakePrimitives=String(drawCalls);
    console.info("[TEM] Blender Cycles-baked entrance mounted",{
      bytes:bytes.byteLength,triangles:Math.round(triangles),drawCalls
    });
    return {ok:true,model,bytes:bytes.byteLength,drawCalls,triangles};
  }catch(error){
    // A failed optional enhancement should never disable the actual museum.
    console.warn("[TEM] V4 baked entrance not available. Preserving V3.",error);
    return {ok:false,error:String(error)};
  }finally{
    if(timeout)clearTimeout(timeout);
  }
}
