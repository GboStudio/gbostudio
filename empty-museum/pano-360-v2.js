// THE UNREAL MUSEUM — equirectangular panorama v2.
// Revert the painted room in one step: set enabled to false.
// Frames, tours, slots, joysticks and the 2D fallback are unchanged either way.
// The 2D canvas fallback does not sample this sphere; it keeps its own gallery.

export const PANO_360_V2=Object.freeze({
  enabled:true,
  full:"./assets/pano/pano-360-ia-v2.jpg",
  fullEdge:6144,
  safeWebp:"./assets/pano/pano-360-ia-v2-4096.webp",
  safeJpeg:"./assets/pano/pano-360-ia-v2-4096.jpg",
  safeEdge:4096
});

// Phones stay on the 4096 derivative. Many mobile WebGL limits are 4096,
// and the 6144 master is about 75 MB once expanded on the GPU.
export function pano360V2Sources(maxTextureSize,mobile){
  const edge=Number(maxTextureSize)||0;
  if(!mobile && edge>=PANO_360_V2.fullEdge)return [PANO_360_V2.full];
  return [PANO_360_V2.safeWebp,PANO_360_V2.safeJpeg];
}

// Camera-locked equirectangular backdrop. A single photo has no parallax:
// walking still moves the real 3D frames, which can overlap the painted ones.
// Hiding the procedural shell is what makes the photo visible; the interactive
// group (frames, aisle pieces, tours) stays in the scene.
export async function mountPano360V2({THREE,scene,renderer,mobile,shellRoots}={}){
  const roots=Array.isArray(shellRoots)?shellRoots:[];
  const state={
    applied:false,
    edge:0,
    url:"",
    conceal(root){
      if(!root||roots.includes(root)){
        if(root&&state.applied)root.visible=false;
        return;
      }
      roots.push(root);
      if(state.applied)root.visible=false;
    }
  };
  if(!PANO_360_V2.enabled||!THREE||!scene||!renderer)return state;
  const max=renderer.capabilities?.maxTextureSize||0;
  if(max && max<PANO_360_V2.safeEdge){
    console.warn("[TEM] Panorama 360 v2 skipped: GPU texture limit",max);
    return state;
  }
  const loader=new THREE.TextureLoader();
  let texture=null,used="",lastError=null;
  for(const url of pano360V2Sources(max,Boolean(mobile))){
    try{
      texture=await loader.loadAsync(url);
      used=url;
      break;
    }catch(error){lastError=error;}
  }
  if(!texture)throw lastError||new Error("Panorama 360 v2 missing");
  const width=texture.image?.width||texture.source?.data?.width||0;
  if(width<2)throw new Error("Panorama 360 v2 decoded empty");
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;
  texture.anisotropy=1;
  scene.background=texture;
  scene.backgroundBlurriness=0;
  scene.backgroundIntensity=1;
  state.applied=true;
  state.url=used;
  state.edge=used===PANO_360_V2.full?PANO_360_V2.fullEdge:PANO_360_V2.safeEdge;
  for(const root of roots)if(root)root.visible=false;
  console.info("[TEM] Panorama 360 v2",state.edge,used);
  return state;
}
