/* Public, read-only shared exhibition adapter.
   "Enabled=false" preserves the local demo and never sends private data. */
const config=typeof window!=='undefined'?window.TEM_MUSEUM_CONFIG||{}:{};
const published=(v)=>typeof v==='string'&&/^sb_publishable_[A-Za-z0-9_]+$/.test(v);
export function isMuseumCloudEnabled(){
  if(config.enabled!==true || !published(config.publishableKey))return false;
  try{const u=new URL(config.supabaseUrl);return u.protocol==='https:'&&/^[\w.-]+$/.test(u.hostname);}
  catch{return false;}
}
const str=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const url=(v)=>{
  if(!v||typeof v!=='string')return null;
  try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}
};
export function normalizeArtwork(item){
  if(!item||typeof item!=='object')return null;
  const slotType=item.slot_type,slotIndex=Number(item.slot_index);
  if(!['wall','floor','ceiling'].includes(slotType)||!Number.isInteger(slotIndex))return null;
  if(slotType==='wall'&&(slotIndex<4||slotIndex>250))return null;
  if(slotType==='floor'&&(slotIndex<1||slotIndex>5))return null;
  if(slotType==='ceiling'&&(slotIndex<1||slotIndex>6))return null;
  const id=str(item.id,60);
  if(!/^[0-9a-f-]{36}$/i.test(id))return null;
  const key=slotType==='wall'?slotIndex:(slotType==='floor'?'S':'P')+String(slotIndex).padStart(2,'0');
  return {id,slot:key,category:str(item.category,30)||'image',
    title:str(item.title,100)||'Sans titre',author:str(item.artist_name,80)||'Anonyme',
    description:str(item.description,650),tools:str(item.tools,100)||'Création originale',
    image:url(item.image_url),modelUrl:url(item.model_url),
    public:true,demo:false,theme:slotIndex%8};
}
export async function getPublishedArtworks({timeoutMs=3200}={}){
  if(!isMuseumCloudEnabled())return {status:'demo',artworks:[]};
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const base=new URL(config.supabaseUrl);
    const endpoint=new URL('/rest/v1/museum_artworks',base);
    endpoint.searchParams.set('select','id,slot_type,slot_index,title,artist_name,category,tools,description,image_url,model_url,published_at');
    endpoint.searchParams.set('status','eq.published');
    endpoint.searchParams.set('order','published_at.asc');
    endpoint.searchParams.set('limit',String(Math.min(150,Math.max(1,Number(config.maxResults)||120))));
    const r=await fetch(endpoint.toString(),{
      headers:{apikey:config.publishableKey,Accept:'application/json'},
      signal:ctrl.signal,cache:'no-store'
    });
    if(!r.ok)throw new Error('Museum API HTTP '+r.status);
    const payload=await r.json();
    if(!Array.isArray(payload))throw new Error('Unexpected response');
    return {status:'live',artworks:payload.map(normalizeArtwork).filter(Boolean)};
  }catch(e){console.warn('[TEM] Cloud unavailable, staying in demo mode:',e?.message||e);
    return {status:'offline',artworks:[]};
  }finally{clearTimeout(timeout);}
}
export function sharedKey(work){
  if(typeof work?.id==='string'&&/^[a-f0-9-]{36}$/i.test(work.id))return work.id;
  return String(work?.id??'');
}
