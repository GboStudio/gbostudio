import {
  DEFAULT_COMMERCE_CONFIG,COMMERCE_STORAGE_KEY,RESERVATION_STORAGE_KEY,
  WALL_FORMATS,DISTANCE_LEVELS,AISLE_DURATIONS,AISLE_TYPES,
  normalizeCommerceConfig,makeWallSlots,wallPrice,aislePrice,
  canReserveWall,canReserveAisle,createPreviewReservation,isActive,euros
} from './commerce-model.mjs';

const $=(selector)=>document.querySelector(selector);
const $$=(selector)=>Array.from(document.querySelectorAll(selector));
const LAYOUT_STORAGE_KEY='tum-commerce-module-layouts-preview-v1';
const deepCopy=value=>JSON.parse(JSON.stringify(value));
function stored(key,fallback) {
  try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback}
  catch(e){return fallback}
}
let config;
try{config=normalizeCommerceConfig(stored(COMMERCE_STORAGE_KEY,DEFAULT_COMMERCE_CONFIG))}
catch(error){config=normalizeCommerceConfig(DEFAULT_COMMERCE_CONFIG)}
let reservations=stored(RESERVATION_STORAGE_KEY,[]);
if(!Array.isArray(reservations))reservations=[];
let layouts=stored(LAYOUT_STORAGE_KEY,{});
if(!layouts||typeof layouts!=='object'||Array.isArray(layouts))layouts={};
let moduleNumber=1,selectedSlot=null,term='monthly',distanceId='gallery',days=7,stationId='S01',objectType='sculpture';
function persist(){
  localStorage.setItem(COMMERCE_STORAGE_KEY,JSON.stringify(config));
  localStorage.setItem(RESERVATION_STORAGE_KEY,JSON.stringify(reservations));
  localStorage.setItem(LAYOUT_STORAGE_KEY,JSON.stringify(layouts));
}
function notify(message,isError=false){
  $('#error').classList.toggle('visible',isError);
  $('#ok').classList.toggle('visible',!isError);
  (isError?$('#error'):$('#ok')).textContent=message;
  (isError?$('#ok'):$('#error')).classList.remove('visible');
}
function activeWallBookings(number){
  return reservations.filter(r=>r?.type==='wall'&&r.moduleNumber===number&&isActive(r));
}
function activeAisleBookings(id){
  return reservations.filter(r=>r?.type==='aisle'&&r.stationId===id&&isActive(r));
}
function formatForModule(number){
  return activeWallBookings(number)[0]?.formatId||layouts[String(number)]||config.wall.defaultFormat;
}
function numberFR(n,digits=2){return Number(n).toLocaleString('fr-FR',{maximumFractionDigits:digits})}
function renderWalls(){
  $('#module').innerHTML=Array.from({length:config.wall.moduleCount},(_,i)=>{
    const number=i+1;
    return '<option value="'+number+'">MODULE '+String(number).padStart(3,'0')+'</option>'
  }).join('');
  moduleNumber=Math.min(moduleNumber,config.wall.moduleCount);
  $('#module').value=String(moduleNumber);
  const formatId=formatForModule(moduleNumber);
  const count=activeWallBookings(moduleNumber).length;
  $('#formats').innerHTML=WALL_FORMATS.map(format=>'<button type="button" data-format="'+format.id+'" aria-pressed="'+(formatId===format.id)+'"><strong>'+format.count+'</strong><small>'+format.label+'</small></button>').join('');
  const slots=makeWallSlots(config,moduleNumber,formatId);
  if(!slots.some(s=>s.id===selectedSlot))selectedSlot=slots.find(s=>canReserveWall(reservations,moduleNumber,s.id).ok)?.id||slots[0].id;
  const selected=slots.find(s=>s.id===selectedSlot)||slots[0];
  const slotFmt=WALL_FORMATS.find(f=>f.id===formatId);
  const booked=activeWallBookings(moduleNumber);
  $('#wallGrid').innerHTML=slots.map(slot=>{
    const n=slot.leaves[0],column=n%4+1,row=Math.floor(n/4)+1;
    const sold=booked.some(b=>b.slotId===slot.id);
    const choice=selectedSlot===slot.id;
    return '<button type="button" class="slot'+(sold?' sold':'')+(choice?' selected':'')+'" data-slot="'+slot.id+'" style="grid-column:'+column+' / span '+slotFmt.spanX+';grid-row:'+row+' / span '+slotFmt.spanY+'" aria-pressed="'+choice+'" title="'+slotFmt.label+' '+slot.ordinal+'">'+
      '<strong>'+(sold?'RÉSERVÉ':'CADRE '+slot.ordinal)+'</strong><small>'+numberFR(slot.widthM,2)+' × '+numberFR(slot.heightM,2)+' m</small></button>'
  }).join('');
  $('#wallHeight').textContent=numberFR(config.wall.exhibitHeightM)+' m';
  $('#occupancy').textContent=count+' / '+slots.length+' réservés';
  $('#wallSelection').textContent=slotFmt.label+' · module '+String(moduleNumber).padStart(3,'0')+' · emplacement '+selected.ordinal;
  $('#wallDimensions').textContent='Dimensions estimées : '+numberFR(selected.widthM)+' × '+numberFR(selected.heightM)+' mètres';
  $$('#wallTerms [data-term]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.term===term)));
  const amount=wallPrice(config,formatId,term).amount;
  $('#wallPrice').innerHTML=euros(amount)+' <small>/ '+(term==='monthly'?'mois':'an')+'</small>';
  $('#wallPriceNote').textContent=term==='annual'
    ? 'Abonnement sur 12 mois · renouvellement automatique seulement après intégration des paiements'
    : 'Abonnement mensuel · renouvellement automatique seulement après intégration des paiements';
  $('#bookWall').disabled=!!booked.find(b=>b.slotId===selectedSlot);
  $('#bookWall').textContent=$('#bookWall').disabled?'Emplacement déjà réservé':'Simuler cette réservation →';
  $('#moduleCount').value=String(config.wall.moduleCount);
  $('#exhibitHeight').value=String(config.wall.exhibitHeightM);
}
function renderAisle(){
  $('#station').innerHTML=config.aisle.stations.map(id=>'<option value="'+id+'">STATION '+id+(activeAisleBookings(id).length?' · OCCUPÉE':'')+'</option>').join('');
  if(!config.aisle.stations.includes(stationId))stationId=config.aisle.stations[0];
  $('#station').value=stationId;
  $('#objectType').innerHTML=AISLE_TYPES.map(item=>'<option value="'+item.id+'">'+item.label+'</option>').join('');
  $('#objectType').value=objectType;
  $('#distances').innerHTML=DISTANCE_LEVELS.map(item=>'<button type="button" data-distance="'+item.id+'" aria-pressed="'+(distanceId===item.id)+'">'+item.label+' · '+item.meters+' m</button>').join('');
  $('#durations').innerHTML=AISLE_DURATIONS.map(item=>'<button type="button" data-days="'+item.days+'" aria-pressed="'+(days===item.days)+'">'+item.label+'</button>').join('');
  const choiceIndex=DISTANCE_LEVELS.findIndex(d=>d.id===distanceId);
  $('#aisleMap').innerHTML=DISTANCE_LEVELS.map((d,i)=>'<div class="aisle-segment'+(i<=choiceIndex?' on':'')+'"><span>'+(i===0?'◆':i===1?'◇':'·')+'</span><strong>'+d.meters+' m</strong><small>'+(i<=choiceIndex?'Zone incluse':'Au-delà du seuil')+'</small></div>').join('');
  const amount=aislePrice(config,distanceId,days).amount;
  $('#aisleSelection').textContent=AISLE_TYPES.find(o=>o.id===objectType).label+' · '+stationId;
  $('#aisleDetails').textContent=DISTANCE_LEVELS.find(d=>d.id===distanceId).label+' (jusqu’à '+aislePrice(config,distanceId,days).maxVisibleDistanceM+' m) · '+AISLE_DURATIONS.find(d=>d.days===days).label;
  $('#aislePrice').innerHTML=euros(amount)+' <small>/ durée</small>';
  $('#bookAisle').disabled=activeAisleBookings(stationId).length>0;
  $('#bookAisle').textContent=$('#bookAisle').disabled?'Station déjà occupée':'Simuler cette réservation →';
}
function renderWallPrices(){
  $('#wallPricesTable').innerHTML=WALL_FORMATS.map(format=>{
    const slot=makeWallSlots(config,1,format.id)[0];
    const p=config.wall.pricing[format.id];
    return '<tr><td><strong>'+format.label+'</strong></td><td>'+format.count+'</td>'+
      '<td><input aria-label="'+format.label+' mensuel" data-wall-price="'+format.id+'" data-term="monthly" min="0" max="1000000" type="number" step=".01" value="'+p.monthly+'"></td>'+
      '<td><input aria-label="'+format.label+' annuel" data-wall-price="'+format.id+'" data-term="annual" min="0" max="10000000" type="number" step=".01" value="'+p.annual+'"></td>'+
      '<td>'+numberFR(slot.widthM)+' × '+numberFR(slot.heightM)+' m</td></tr>';
  }).join('');
}
function renderAislePrices(){
  $('#aislePricesTable').innerHTML=DISTANCE_LEVELS.map(level=>
    '<tr><td><strong>'+level.label+' · '+level.meters+' m</strong></td>'+
    AISLE_DURATIONS.map(duration=>
      '<td><input aria-label="'+level.label+' '+duration.label+'" data-aisle-price="'+level.id+'" data-days="'+duration.days+'" type="number" step=".01" min="0" max="10000000" value="'+config.aisle.pricing[level.id][String(duration.days)]+'"></td>'
    ).join('')+'</tr>'
  ).join('');
}
function renderManagement(){
  $('#metricModules').textContent=String(config.wall.moduleCount);
  $('#metricStations').textContent=String(config.aisle.stations.length);
  const active=reservations.filter(r=>isActive(r));
  $('#metricReservations').textContent=String(active.length);
  $('#reservations').innerHTML=active.length?active.slice().reverse().map(r=>{
    const name=r.type==='wall'?('Mur '+r.moduleNumber+' / '+r.formatId+' / '+r.slotId):('Allée '+r.stationId+' / '+r.objectType);
    const end=new Date(r.endsAt).toLocaleDateString('fr-FR');
    return '<div class="reservation"><div><strong>'+name+'</strong><small>'+euros(r.amount)+' · Fin '+end+'</small></div><button data-cancel="'+r.id+'" type="button">Annuler</button></div>';
  }).join(''):'<p class="muted">Aucune réservation simulée active.</p>';
}
function render(){
  renderWalls();
  renderAisle();
  renderManagement();
}
$$('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  const tab=button.dataset.tab;
  $$('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
  $$('.view').forEach(view=>view.classList.toggle('active',view.id===tab));
}));
$('#module').addEventListener('change',event=>{
  moduleNumber=Number(event.target.value);selectedSlot=null;renderWalls();
});
$('#formats').addEventListener('click',event=>{
  const button=event.target.closest('[data-format]');if(!button)return;
  const newFormat=button.dataset.format;
  const booked=activeWallBookings(moduleNumber);
  if(booked.length&&booked[0].formatId!==newFormat){
    notify('Ce module contient déjà des réservations : son découpage ne peut pas changer.',true);return;
  }
  layouts[String(moduleNumber)]=newFormat;
  selectedSlot=null;persist();renderWalls();
});
$('#wallGrid').addEventListener('click',event=>{
  const button=event.target.closest('[data-slot]');if(!button)return;
  selectedSlot=button.dataset.slot;renderWalls();
});
$('#wallTerms').addEventListener('click',event=>{
  const button=event.target.closest('[data-term]');if(!button)return;
  term=button.dataset.term;renderWalls();
});
$('#saveGeometry').addEventListener('click',()=>{
  try{
    const value=Number($('#moduleCount').value);
    const highest=reservations.filter(r=>r.type==='wall'&&isActive(r)).reduce((n,r)=>Math.max(n,Number(r.moduleNumber)||0),0);
    if(value<highest)throw new Error('Impossible de supprimer un module contenant une réservation active.');
    const next=normalizeCommerceConfig({...config,wall:{...config.wall,moduleCount:value,exhibitHeightM:Number($('#exhibitHeight').value)}});
    if(!Number.isInteger(value)||value!==next.wall.moduleCount)throw new Error('Nombre entier de modules requis.');
    config=next;moduleNumber=Math.min(moduleNumber,value);persist();render();renderWallPrices();notify('Paramètres géométriques enregistrés localement.');
  }catch(error){notify(error.message,true)}
});
$('#saveWallPrices').addEventListener('click',()=>{
  try{
    const candidate=deepCopy(config);
    $$('[data-wall-price]').forEach(input=>{
      candidate.wall.pricing[input.dataset.wallPrice][input.dataset.term]=Number(input.value);
      if(input.value.trim()==='')throw new Error('Un tarif mural est vide.');
    });
    config=normalizeCommerceConfig(candidate);persist();render();renderWallPrices();
    notify('Tarifs muraux enregistrés localement (simulation).');
  }catch(error){notify(error.message,true)}
});
$('#bookWall').addEventListener('click',()=>{
  try{
    const formatId=formatForModule(moduleNumber);
    const choice=createPreviewReservation({config,reservations,type:'wall',moduleNumber,formatId,slotId:selectedSlot,term});
    reservations.push(choice);persist();selectedSlot=null;render();notify('Réservation murale simulée, sans paiement.'); 
  }catch(error){notify(error.message,true)}
});
$('#station').addEventListener('change',event=>{stationId=event.target.value;renderAisle()});
$('#objectType').addEventListener('change',event=>{objectType=event.target.value;renderAisle()});
$('#distances').addEventListener('click',event=>{
  const button=event.target.closest('[data-distance]');if(!button)return;
  distanceId=button.dataset.distance;renderAisle();
});
$('#durations').addEventListener('click',event=>{
  const button=event.target.closest('[data-days]');if(!button)return;
  days=Number(button.dataset.days);renderAisle();
});
$('#bookAisle').addEventListener('click',()=>{
  try{
    const reservation=createPreviewReservation({config,reservations,type:'aisle',stationId,objectType,distanceId,days});
    reservations.push(reservation);persist();render();notify('Installation 3D simulée, sans paiement.');
  }catch(error){notify(error.message,true)}
});
$('#saveAislePrices').addEventListener('click',()=>{
  try{
    const candidate=deepCopy(config);
    $$('[data-aisle-price]').forEach(input=>{
      if(input.value.trim()==='')throw new Error('Un tarif premium est vide.');
      candidate.aisle.pricing[input.dataset.aislePrice][input.dataset.days]=Number(input.value);
    });
    config=normalizeCommerceConfig(candidate);persist();render();renderAislePrices();
    notify('Tarifs premium enregistrés localement (simulation).');
  }catch(error){notify(error.message,true)}
});
$('#reservations').addEventListener('click',event=>{
  const button=event.target.closest('[data-cancel]');if(!button)return;
  const r=reservations.find(x=>x.id===button.dataset.cancel);
  if(r){r.status='cancelled';persist();render();notify('Réservation de démonstration annulée.')}
});
$('#clearBookings').addEventListener('click',()=>{
  if(!window.confirm('Effacer les réservations simulées sur cet appareil ?'))return;
  reservations=[];persist();render();notify('Réservations simulées effacées.');
});
$('#reset').addEventListener('click',()=>{
  if(!window.confirm('Réinitialiser tarifs, paramètres et réservations de cette démonstration ?'))return;
  config=normalizeCommerceConfig(DEFAULT_COMMERCE_CONFIG);
  reservations=[];layouts={};moduleNumber=1;selectedSlot=null;
  persist();render();renderWallPrices();renderAislePrices();notify('Configuration de démonstration réinitialisée.');
});
$('#export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({architectureConfig:config,moduleLayouts:layouts},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='the-unreal-museum-commerce-config.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#import').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>100000)throw new Error('Le fichier est trop volumineux.');
    const data=JSON.parse(await file.text());
    const next=normalizeCommerceConfig(data.architectureConfig||data);
    const nextLayouts=data.moduleLayouts||{};
    if(!nextLayouts||typeof nextLayouts!=='object'||Array.isArray(nextLayouts))throw new Error('Découpages invalides.');
    const sanitized={};
    for(const [id,formatId] of Object.entries(nextLayouts)){
      const n=Number(id);
      if(!Number.isInteger(n)||n<1||n>next.wall.moduleCount||!WALL_FORMATS.some(f=>f.id===formatId))throw new Error('Module importé invalide.');
      sanitized[String(n)]=formatId;
    }
    for(const r of reservations.filter(r=>r.type==='wall'&&isActive(r))){
      if(r.moduleNumber>next.wall.moduleCount)throw new Error('Le fichier exclut un module actuellement réservé.');
      if(sanitized[String(r.moduleNumber)]&&sanitized[String(r.moduleNumber)]!==r.formatId)throw new Error('Le nouveau découpage chevauche une réservation existante.');
    }
    config=next;layouts=sanitized;moduleNumber=1;selectedSlot=null;
    persist();render();renderWallPrices();renderAislePrices();notify('Configuration importée sur cet appareil.');
  }catch(error){notify('Import impossible : '+error.message,true)}
  finally{event.target.value=''}
});
render();renderWallPrices();renderAislePrices();