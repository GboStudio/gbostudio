import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// All uploaded models remain on the visitor's device: no public upload, payment or publication.
const DB_NAME = "tem-exhibitions-models-v1";
const STORE = "modelFiles";
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_VERTICES = 950000;
const SUPPORTED = new Set(["glb","gltf","stl"]);

export function modelFormat(name="") {
  const ext=String(name).split(".").pop().toLowerCase();
  return SUPPORTED.has(ext)?ext:null;
}
export function modelKey(){
  return "model-"+(globalThis.crypto?.randomUUID?.() || Date.now()+"-"+Math.random().toString(36).slice(2));
}
export async function validateFile(file) {
  if (!file || !(file instanceof Blob)) throw Error("Choisissez un fichier 3D.");
  const format=modelFormat(file.name);
  if(!format)throw Error("Formats acceptés : GLB, glTF autonome et STL.");
  if(!file.size)throw Error("Ce fichier est vide.");
  if(file.size>MAX_BYTES)throw Error("Fichier trop lourd : 25 Mo maximum.");
  if(format==="gltf"){
    let json;
    try{json=JSON.parse(await file.text());}catch(e){throw Error("Le fichier glTF n’est pas un JSON valide.");}
    if(!json?.asset?.version || !String(json.asset.version).startsWith("2."))throw Error("Seuls les fichiers glTF 2.0 sont pris en charge.");
    for(const entry of [...(json.buffers||[]),...(json.images||[])]){
      if(entry.uri && !entry.uri.startsWith("data:")){
        throw Error("Le fichier .gltf référence des fichiers externes. Exportez-le en .glb ou avec ressources intégrées.");
      }
    }
    if((json.extensionsRequired||[]).some(x=>/draco|meshopt|basisu|ktx2/i.test(x))){
      throw Error("Compression non prise en charge dans cette démo. Exportez un GLB standard, sans Draco/Meshopt/KTX2.");
    }
  }
  return format;
}
function openDB(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in globalThis))return reject(Error("Stockage local des modèles non disponible sur ce navigateur."));
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error("Ouverture du stockage impossible."));
    request.onblocked=()=>reject(Error("Stockage occupé : fermez les autres onglets du musée."));
  });
}
async function withStore(mode, operation){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    let done=false,value;
    const tx=db.transaction(STORE,mode);
    const store=tx.objectStore(STORE);
    let request;
    try{request=operation(store);}catch(error){db.close();reject(error);return;}
    request.onsuccess=()=>{value=request.result;};
    request.onerror=()=>{done=true;reject(request.error||Error("Erreur de stockage."));};
    tx.oncomplete=()=>{db.close();if(!done)resolve(value);};
    tx.onerror=()=>{db.close();if(!done)reject(tx.error||Error("Erreur de stockage."));};
    tx.onabort=()=>{db.close();if(!done)reject(tx.error||Error("Le stockage a été interrompu."));};
  });
}
export async function saveModel(file,key=modelKey()){
  const format=await validateFile(file);
  try{
    await withStore("readwrite",store=>store.put({key,filename:file.name,format,blob:file,createdAt:Date.now()}));
  }catch(error){
    throw Error("Impossible de conserver ce modèle sur votre appareil (stockage plein ou interdit). Réessayez avec un fichier plus léger.");
  }
  return {key,format,name:file.name,bytes:file.size};
}
export async function getModel(key){
  if(typeof key!=="string" || !key.startsWith("model-"))return null;
  try{return await withStore("readonly",store=>store.get(key)) || null;}
  catch(e){return null;}
}
export async function deleteModel(key){
  if(typeof key==="string" && key.startsWith("model-"))return withStore("readwrite",store=>store.delete(key));
}

export async function loadModel(file,knownFormat=null){
  const format=knownFormat || await validateFile(file);
  let model;
  if(format==="stl"){
    const geometry=new STLLoader().parse(await file.arrayBuffer());
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:0xc7c2b5,roughness:.47,metalness:.2,side:THREE.DoubleSide});
    model=new THREE.Group();
    model.add(new THREE.Mesh(geometry,material));
  }else{
    const data=format==="gltf"?await file.text():await file.arrayBuffer();
    const gltf=await new GLTFLoader().parseAsync(data,"");
    model=gltf.scene;
  }
  let vertices=0;
  model.traverse(o=>{
    if(!o.isMesh)return;
    const positions=o.geometry?.attributes?.position;
    if(positions)vertices+=positions.count;
    if(vertices>MAX_VERTICES)throw Error("Ce modèle est trop complexe pour le musée (limite de 950 000 sommets).");
    if(!o.material)o.material=new THREE.MeshStandardMaterial({color:0xc5c7c3,roughness:.6});
    o.castShadow=true;
    o.receiveShadow=true;
  });
  const bounds=new THREE.Box3().setFromObject(model);
  const dimensions=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(dimensions.x+dimensions.y+dimensions.z)||dimensions.length()<1e-8){
    throw Error("Le modèle est vide ou ses dimensions ne sont pas valides.");
  }
  const center=bounds.getCenter(new THREE.Vector3());
  const normalized=new THREE.Group();
  // Use a child group so transforms remain independent of the world's pedestal.
  model.position.sub(center);
  normalized.add(model);
  const footprint=Math.max(dimensions.x,dimensions.z,1e-6);
  const factor=Math.min(.98/footprint,1.16/Math.max(dimensions.y,1e-6));
  model.scale.multiplyScalar(factor);
  normalized.position.y=dimensions.y*factor/2;
  normalized.userData.importedModel=true;
  return normalized;
}
export function disposeModel(group){
  if(!group)return;
  group.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.geometry?.dispose?.();
    const materials=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const mat of materials){
      if(!mat)continue;
      for(const k of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","alphaMap"]){
        mat[k]?.dispose?.();
      }
      mat.dispose?.();
    }
  });
}

// A real orbitable 3D preview in the floor installation editor.
let previewSession=null;
export function stopModelPreview(){
  if(!previewSession)return;
  const s=previewSession;previewSession=null;
  cancelAnimationFrame(s.raf);
  s.controls?.dispose();
  if(s.model)disposeModel(s.model);
  s.renderer?.dispose();
}
export async function previewModel(file,canvas){
  await validateFile(file);
  stopModelPreview();
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xf4f3ee);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb6b0a3,2.8));
  const key=new THREE.DirectionalLight(0xfff9f1,3.3);key.position.set(-3,6,5);scene.add(key);
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(.71,.74,.11,64),
    new THREE.MeshStandardMaterial({color:0xe7e3da,roughness:.48,metalness:.04}));
  ground.position.y=.04;scene.add(ground);
  const camera=new THREE.PerspectiveCamera(44,720/500,.05,35);
  camera.position.set(1.95,1.5,2.2);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"default"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;
  controls.dampingFactor=.07;
  controls.enablePan=false;
  controls.minDistance=1.25;
  controls.maxDistance=4.8;
  controls.maxPolarAngle=Math.PI*.76;
  controls.target.set(0,.62,0);
  const session={scene,camera,renderer,controls,model:null,raf:0,canvas};
  previewSession=session;
  let model;
  try{model=await loadModel(file);}
  catch(e){if(previewSession===session)stopModelPreview();throw e;}
  if(previewSession!==session){disposeModel(model);return;}
  model.position.y+=.12;
  scene.add(model);session.model=model;
  function render(){
    if(previewSession!==session)return;
    if(!canvas.isConnected){stopModelPreview();return;}
    if(!canvas.hidden && canvas.offsetWidth>0){
      const w=canvas.clientWidth,h=Math.max(1,canvas.clientHeight);
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
      controls.update();renderer.render(scene,camera);
    }
    session.raf=requestAnimationFrame(render);
  }
  render();
}
