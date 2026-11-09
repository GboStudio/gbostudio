/**
 * Defensive structural preflight for browser-local glTF/GLB/STL.
 * Does not replace virus scanning or server-side validation for public uploads.
 */
const MAX_BUFFER_BYTES=25*1024*1024;
const MAX_ACCESSORS=12000;
const MAX_VERTEX_COUNT=950000;
const MAX_TOTAL_ACCESSOR_ELEMENTS=6_000_000;

const boundedArray=(json,key,max)=>{
  const value=json[key]??[];
  if(!Array.isArray(value)||value.length>max)throw Error('Modèle 3D trop complexe : '+key);
  return value;
};

export function inspectGLTF(json){
  if(!json||typeof json!=='object'||Array.isArray(json)||
     !/^2\.(?:\d+)$/.test(String(json.asset?.version??'')))
    throw Error('Seuls les fichiers glTF 2.0 sont pris en charge.');
  const nodes=boundedArray(json,'nodes',10000);
  boundedArray(json,'meshes',2000);
  const images=boundedArray(json,'images',64);
  const buffers=boundedArray(json,'buffers',64);
  const views=boundedArray(json,'bufferViews',10000);
  const accessors=boundedArray(json,'accessors',MAX_ACCESSORS);
  boundedArray(json,'textures',128);
  boundedArray(json,'materials',1000);
  boundedArray(json,'animations',100);
  const extensions=[...boundedArray(json,'extensionsRequired',100),...boundedArray(json,'extensionsUsed',100)];
  if(extensions.some(x=>typeof x!=='string'||/draco|meshopt|basisu|ktx2/i.test(x)))
    throw Error('Ce modèle utilise une extension 3D non autorisée.');
  const safeURI=/^data:(?:application\/(?:octet-stream|gltf-buffer)|image\/(?:png|jpeg|webp));base64,[a-z0-9+/=]+$/i;
  for(const entry of [...buffers,...images]){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('Ressource 3D invalide.');
    if(entry.uri!==undefined && (typeof entry.uri!=='string'||!safeURI.test(entry.uri)))
      throw Error('Ce modèle référence une ressource externe ou non autorisée.');
  }
  for(const b of buffers){
    if(!Number.isSafeInteger(b.byteLength)||b.byteLength<0||b.byteLength>MAX_BUFFER_BYTES)
      throw Error('Taille du tampon 3D invalide.');
  }
  for(const v of views){
    if(!v||!Number.isInteger(v.buffer)||v.buffer<0||v.buffer>=buffers.length||
       !Number.isSafeInteger(v.byteLength)||v.byteLength<0||
       v.byteLength>MAX_BUFFER_BYTES||
       !Number.isSafeInteger(v.byteOffset??0)||(v.byteOffset??0)<0||
       (v.byteOffset??0)+v.byteLength>buffers[v.buffer].byteLength)
      throw Error('Plage mémoire 3D invalide.');
  }
  let elements=0;
  for(const a of accessors){
    if(!a||!Number.isSafeInteger(a.count)||a.count<0||a.count>MAX_VERTEX_COUNT)
      throw Error('Le modèle demande trop de sommets.');
    elements+=a.count;
    if(elements>MAX_TOTAL_ACCESSOR_ELEMENTS)throw Error('Le modèle dépasse le budget mémoire 3D.');
    if(a.sparse && (!Number.isSafeInteger(a.sparse.count)||a.sparse.count>a.count||a.sparse.count<0))
      throw Error('Données 3D fragmentées invalides.');
  }
  // Reject cyclic node graphs before Three.js traverses their hierarchy.
  const state=new Uint8Array(nodes.length);
  for(let root=0;root<nodes.length;root++){
    if(state[root]!==0)continue;
    const stack=[{id:root,exit:false}];
    let visits=0;
    while(stack.length){
      if(++visits>100000)throw Error('Structure hiérarchique 3D trop complexe.');
      const current=stack.pop();
      if(current.exit){state[current.id]=2;continue;}
      if(state[current.id]===1)throw Error('Le modèle 3D contient une boucle hiérarchique.');
      if(state[current.id]===2)continue;
      const node=nodes[current.id];
      if(!node||typeof node!=='object')throw Error('Nœud 3D invalide.');
      const children=node.children??[];
      if(!Array.isArray(children)||children.length>10000)throw Error('Enfants 3D invalides.');
      state[current.id]=1;
      stack.push({id:current.id,exit:true});
      for(const child of children){
        if(!Number.isInteger(child)||child<0||child>=nodes.length)
          throw Error('Référence de nœud 3D invalide.');
        stack.push({id:child,exit:false});
      }
    }
  }
  return true;
}

export async function validateSTLFile(file){
  if(!file||typeof file.size!=='number'||file.size<15||file.size>MAX_BUFFER_BYTES)
    throw Error('Fichier STL vide ou trop volumineux.');
  const header=new Uint8Array(await file.slice(0,84).arrayBuffer());
  if(header.length===84){
    const triangles=new DataView(header.buffer,header.byteOffset,header.byteLength).getUint32(80,true);
    if(84+triangles*50===file.size){
      if(triangles>310000)throw Error('Modèle STL trop complexe (310 000 triangles maximum).');
      return 'binary';
    }
  }
  const prefix=new TextDecoder().decode(header).trimStart();
  if(!/^solid(?:\s|$)/i.test(prefix))
    throw Error('STL invalide : structure binaire ou ASCII non reconnue.');
  return 'ascii';
}
