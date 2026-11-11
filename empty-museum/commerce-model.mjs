/**
 * THE UNREAL MUSEUM — commercial architecture V1.
 * Pricing and reservations on this static site are SIMULATIONS.
 * A trusted backend must validate prices, stock and payment before launch.
 */
export const WALL_FORMATS = Object.freeze([
  {id:'very_large',label:'Très grand',count:1,columns:1,rows:1,spanX:4,spanY:4},
  {id:'large',label:'Grand',count:2,columns:2,rows:1,spanX:2,spanY:4},
  {id:'normal',label:'Normal',count:4,columns:2,rows:2,spanX:2,spanY:2},
  {id:'medium',label:'Moyen',count:8,columns:4,rows:2,spanX:1,spanY:2},
  {id:'small',label:'Petit',count:16,columns:4,rows:4,spanX:1,spanY:1}
]);
export const DISTANCE_LEVELS = Object.freeze([
  {id:'near',label:'Proximité',meters:15},
  {id:'gallery',label:'Galerie',meters:35},
  {id:'landmark',label:'Monumental',meters:75}
]);
export const AISLE_DURATIONS = Object.freeze([
  {days:1,label:'1 journée'},
  {days:7,label:'1 semaine'},
  {days:30,label:'1 mois'}
]);
export const AISLE_TYPES = Object.freeze([
  {id:'sculpture',label:'Sculpture 3D'},
  {id:'object',label:'Objet / modèle 3D'},
  {id:'installation',label:'Installation animée'}
]);
export const COMMERCE_STORAGE_KEY = 'tum-commerce-preview-v2';
export const RESERVATION_STORAGE_KEY = 'tum-commerce-reservations-preview-v2';

export const DEFAULT_COMMERCE_CONFIG = Object.freeze({
  schemaVersion:1,
  wall:{moduleLengthM:3,exhibitHeightM:2.4,marginM:0.12,gapM:0.045,moduleCount:38,defaultFormat:'normal',
    pricing:{
      very_large:{monthly:59.5,annual:595},
      large:{monthly:34.5,annual:345},
      normal:{monthly:19.5,annual:195},
      medium:{monthly:9.5,annual:95},
      small:{monthly:4.5,annual:45}
    }},
  aisle:{stations:['S01','S02','S03','S04'],footprintWidthM:1.5,footprintLengthM:1.8,maxHeightM:2.5,distanceMetres:{near:15,gallery:35,landmark:75},
    pricing:{
      near:{'1':145,'7':645,'30':1995},
      gallery:{'1':295,'7':1245,'30':3995},
      landmark:{'1':495,'7':2495,'30':7950}
    }}
});

const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const numeric = (value,min,max) => {
  const number = typeof value==='number'?value:Number(value);
  if(!Number.isFinite(number)||number<min||number>max)throw new RangeError('Valeur hors limites : '+value);
  return number;
};
const euros = value => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(value);
export {euros};

export function normalizeCommerceConfig(input=DEFAULT_COMMERCE_CONFIG){
  if(!input||typeof input!=='object'||Number(input.schemaVersion)!==1)throw new Error('Version de configuration incompatible.');
  const w=input.wall||{},a=input.aisle||{},defaultW=DEFAULT_COMMERCE_CONFIG.wall,defaultA=DEFAULT_COMMERCE_CONFIG.aisle;
  const wall={
    moduleLengthM:3, // Contrat architectural : un module = exactement 3 m
    exhibitHeightM:numeric(w.exhibitHeightM??defaultW.exhibitHeightM,1.2,4.5),
    marginM:numeric(w.marginM??defaultW.marginM,0.05,0.5),
    gapM:numeric(w.gapM??defaultW.gapM,0.01,0.12),
    moduleCount:Math.trunc(numeric(w.moduleCount??defaultW.moduleCount,1,500)),
    defaultFormat:WALL_FORMATS.some(f=>f.id===w.defaultFormat)?w.defaultFormat:defaultW.defaultFormat,
    pricing:{}
  };
  if(w.moduleLengthM!==undefined&&Number(w.moduleLengthM)!==3)throw new Error('Les modules doivent mesurer 3 mètres.');
  if(wall.marginM*2+wall.gapM*3>=3||wall.marginM*2+wall.gapM*3>=wall.exhibitHeightM)throw new Error('Marges trop importantes.');
  for(const f of WALL_FORMATS){
    wall.pricing[f.id]={
      monthly:numeric(w.pricing?.[f.id]?.monthly??defaultW.pricing[f.id].monthly,0,1000000),
      annual:numeric(w.pricing?.[f.id]?.annual??defaultW.pricing[f.id].annual,0,10000000)
    };
  }
  const aisle={stations:[...defaultA.stations],footprintWidthM:numeric(a.footprintWidthM??defaultA.footprintWidthM,0.5,3),footprintLengthM:numeric(a.footprintLengthM??defaultA.footprintLengthM,0.5,3),maxHeightM:numeric(a.maxHeightM??defaultA.maxHeightM,0.5,4),distanceMetres:{},pricing:{}};
  for(const level of DISTANCE_LEVELS){
    aisle.distanceMetres[level.id]=numeric(a.distanceMetres?.[level.id]??defaultA.distanceMetres[level.id],5,200);
    aisle.pricing[level.id]={};
    for(const duration of AISLE_DURATIONS){
      const key=String(duration.days);
      aisle.pricing[level.id][key]=numeric(a.pricing?.[level.id]?.[key]??defaultA.pricing[level.id][key],0,10000000);
    }
  }
  if(aisle.distanceMetres.near>=aisle.distanceMetres.gallery||aisle.distanceMetres.gallery>=aisle.distanceMetres.landmark)throw new Error('Les portées doivent être croissantes.');
  return {schemaVersion:1,wall,aisle};
}

export function makeWallSlots(config,moduleNumber,formatId){
  const c=normalizeCommerceConfig(config);
  const f=WALL_FORMATS.find(item=>item.id===formatId);
  if(!f)throw new Error('Format non reconnu.');
  if(!Number.isInteger(moduleNumber)||moduleNumber<1||moduleNumber>c.wall.moduleCount)throw new Error('Module hors limites.');
  const {exhibitHeightM,marginM,gapM}=c.wall;
  const unitW=(3-2*marginM-3*gapM)/4;
  const unitH=(exhibitHeightM-2*marginM-3*gapM)/4;
  const items=[];
  for(let row=0;row<4;row+=f.spanY){
    for(let column=0;column<4;column+=f.spanX){
      const x=marginM+column*(unitW+gapM);
      const y=marginM+row*(unitH+gapM);
      const width=f.spanX*unitW+(f.spanX-1)*gapM;
      const height=f.spanY*unitH+(f.spanY-1)*gapM;
      const leaves=[];
      for(let dy=0;dy<f.spanY;dy++)for(let dx=0;dx<f.spanX;dx++)leaves.push((row+dy)*4+column+dx);
      items.push({id:'M'+String(moduleNumber).padStart(3,'0')+'-'+f.id+'-'+(items.length+1),
        moduleNumber,formatId,ordinal:items.length+1,xM:x,yM:y,widthM:width,heightM:height,leaves});
    }
  }
  if(items.length!==f.count)throw new Error('Subdivision invalide.');
  return items;
}

export function wallPrice(config,formatId,term){
  const c=normalizeCommerceConfig(config);
  if(!WALL_FORMATS.some(f=>f.id===formatId)||!['monthly','annual'].includes(term))throw new Error('Tarification inconnue.');
  return {amount:c.wall.pricing[formatId][term],currency:'EUR',term,termMonths:term==='monthly'?1:12};
}
/**
 * Mur total: three contiguous wall modules on one side.
 * Price = sum of the frame prices those modules already carry.
 * No extra wall discount. Annual amounts follow each frame's annual price
 * (10 × monthly in the default catalogue), not 12 × monthly.
 * Ceiling spots are not wall frames and are rejected.
 */
export function wholeWallPrice(config,formatIds,term){
  const c=normalizeCommerceConfig(config);
  if(!['monthly','annual'].includes(term))throw new Error('Tarification inconnue.');
  if(!Array.isArray(formatIds)||formatIds.length!==3)throw new Error('Un mur total couvre trois modules.');
  let amount=0,frameCount=0;
  for(const formatId of formatIds){
    if(typeof formatId!=='string'||formatId.startsWith('ceiling'))throw new Error('Le plafond n’entre pas dans le mur total.');
    const format=WALL_FORMATS.find(item=>item.id===formatId);
    if(!format)throw new Error('Format mural inconnu.');
    amount+=wallPrice(c,formatId,term).amount*format.count;
    frameCount+=format.count;
  }
  return {amount,currency:'EUR',term,termMonths:term==='annual'?12:1,frameCount,modules:formatIds.slice()};
}
export function aislePrice(config,distanceId,days){
  const c=normalizeCommerceConfig(config);
  if(!DISTANCE_LEVELS.some(d=>d.id===distanceId)||![1,7,30].includes(Number(days)))throw new Error('Option premium inconnue.');
  return {amount:c.aisle.pricing[distanceId][String(days)],currency:'EUR',days:Number(days),
    maxVisibleDistanceM:c.aisle.distanceMetres[distanceId]};
}
export function isActive(reservation,when=Date.now()){
  return reservation?.status==='active' && Number.isFinite(Date.parse(reservation.endsAt)) && Date.parse(reservation.endsAt)>when;
}
export function canReserveWall(reservations,moduleNumber,slotId,when=Date.now()){
  const active=reservations.filter(r=>r.type==='wall'&&r.moduleNumber===moduleNumber&&isActive(r,when));
  const slot=active.find(r=>r.slotId===slotId);
  if(slot)return {ok:false,reason:'Cet emplacement est déjà occupé.'};
  const layouts=new Set(active.map(r=>r.formatId));
  const formatId=slotId.match(/^M\d{3}-(very_large|large|normal|medium|small)-\d+$/)?.[1];
  if(!formatId)return {ok:false,reason:'Emplacement invalide.'};
  if(layouts.size && !layouts.has(formatId))return {ok:false,reason:'Module déjà engagé dans un autre découpage. Libérez les réservations avant de changer le format.'};
  return {ok:true};
}
export function canReserveAisle(reservations,stationId,when=Date.now()){
  return reservations.some(r=>r.type==='aisle'&&r.stationId===stationId&&isActive(r,when))
    ?{ok:false,reason:'Cette station 3D est déjà occupée.'}:{ok:true};
}
export function createPreviewReservation({config,reservations=[],type,slotId,moduleNumber,formatId,term,stationId,distanceId,days,objectType},when=Date.now()){
  const c=normalizeCommerceConfig(config);
  const now=new Date(when);
  if(!Number.isFinite(now.getTime()))throw new Error('Date invalide.');
  let amount,endsAt,reservation={id:'DEMO-'+when+'-'+Math.round(Math.random()*100000),type,status:'active',startsAt:now.toISOString()};
  if(type==='wall'){
    if(!makeWallSlots(c,moduleNumber,formatId).some(s=>s.id===slotId))throw new Error('Emplacement mural introuvable.');
    const check=canReserveWall(reservations,moduleNumber,slotId,when);
    if(!check.ok)throw new Error(check.reason);
    amount=wallPrice(c,formatId,term).amount;
    // Add calendar months without shifting January 31 into March.
    const months=term==='annual'?12:1;
    const d=new Date(when);
    const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()));
    const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(),lastDay));
    endsAt=target.toISOString();
    Object.assign(reservation,{moduleNumber,formatId,slotId,term});
  }else if(type==='aisle'){
    if(!c.aisle.stations.includes(stationId)||!AISLE_TYPES.some(t=>t.id===objectType))throw new Error('Installation non reconnue.');
    const check=canReserveAisle(reservations,stationId,when);
    if(!check.ok)throw new Error(check.reason);
    amount=aislePrice(c,distanceId,days).amount;
    endsAt=new Date(when+Number(days)*86400000).toISOString();
    Object.assign(reservation,{stationId,objectType,distanceId,days:Number(days),maxVisibleDistanceM:c.aisle.distanceMetres[distanceId]});
  }else throw new Error('Type de vente inconnu.');
  return {...reservation,amount,currency:'EUR',endsAt,mode:'browser-demo-no-payment'};
}

/**
 * Rendering guidance, not an authorization check or an occlusion bypass.
 * Return alpha=0 outside the configured draw distance or the rental window.
 * The 3D engine must still apply wall occlusion, frustum culling and LOD.
 */
export function aisleVisibility(config,reservation,visitorDistanceM,when=Date.now()){
  const c=normalizeCommerceConfig(config);
  const reach=reservation?.maxVisibleDistanceM??c.aisle.distanceMetres[reservation?.distanceId];
  const distance=Number(visitorDistanceM);
  if(reservation?.type!=='aisle'||!reach||!Number.isFinite(distance)||distance<0||!isActive(reservation,when))return {visible:false,alpha:0,maxDistanceM:reach||0};
  const fadeStart=Math.max(0,reach-Math.max(3,reach*.15));
  const alpha=distance>=reach?0:distance<=fadeStart?1:(reach-distance)/(reach-fadeStart);
  return {visible:alpha>0,alpha:Math.max(0,Math.min(1,alpha)),maxDistanceM:reach};
}
