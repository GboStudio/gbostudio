const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
const base=[
{id:1,title:'After the Rain',author:'Maya',category:'image',tools:'ChatGPT + image generation',description:'Une image gardée parce qu’elle ressemble exactement au souvenir que j’avais en tête.',size:'standard',image:'linear-gradient(145deg,#a9bbc5,#e8c7bc 58%,#47565e)',date:'Oct. 2026'},
{id:2,title:'Chair 04',author:'Niko',category:'3d',tools:'ChatGPT + Blender',description:'Une chaise imaginée à partir de contraintes d’impression 3D et de bois cintré.',size:'large',date:'Oct. 2026'},
{id:3,title:'Nocturne',author:'Léa',category:'words',tools:'ChatGPT',description:'Un texte court né d’une conversation sur les villes vides la nuit.',size:'mini',words:'Nous étions encore là quand les lumières ont décidé de partir.',date:'Oct. 2026'},
{id:4,title:'Ocean Interface',author:'Sami',category:'design',tools:'ChatGPT + Figma',description:'Une interface de navigation pensée comme une carte marine.',size:'standard',image:'linear-gradient(160deg,#0d2330,#65a6b7 55%,#f1eee6)',date:'Oct. 2026'},
{id:5,title:'Fold Lamp',author:'Ana',category:'build',tools:'ChatGPT + Fusion 360',description:'Une lampe réellement fabriquée après plusieurs itérations avec l’IA.',size:'large',image:'radial-gradient(circle at 50% 43%,#f5edbc 0 13%,#675949 14% 30%,#151513 31% 100%)',date:'Oct. 2026'},
{id:6,title:'Wrong Fruit',author:'Pablo',category:'weird',tools:'ChatGPT + image generation',description:'Je ne sais toujours pas pourquoi j’ai demandé ça. Mais je l’aime bien.',size:'mini',image:'radial-gradient(circle at 45% 40%,#fe7d42 0 19%,#8bb944 20% 28%,#e7dfcf 29%)',date:'Oct. 2026'},
{id:7,title:'House on Wind',author:'Eli',category:'3d',tools:'ChatGPT + Rhino',description:'Une maison théorique dessinée autour d’un flux d’air plutôt que d’une parcelle.',size:'xl',date:'Oct. 2026'},
{id:8,title:'Stay Curious',author:'June',category:'words',tools:'ChatGPT',description:'Une phrase simple que je voulais voir quelque part hors de mon historique.',size:'standard',words:'Stay curious longer than you stay certain.',date:'Oct. 2026'},
{id:9,title:'Soft Machine',author:'Rina',category:'image',tools:'ChatGPT + image generation',description:'Une étude sur les objets industriels qui donnent envie d’être touchés.',size:'large',image:'linear-gradient(135deg,#d4c7b7,#f4f0e7 45%,#a6ada5)',date:'Oct. 2026'},
{id:10,title:'Pocket Garden',author:'Hugo',category:'build',tools:'ChatGPT + CAD',description:'Un petit système imprimable pour faire pousser des herbes aromatiques.',size:'standard',image:'linear-gradient(145deg,#223427,#9caa78 58%,#ece8d8)',date:'Oct. 2026'},
{id:11,title:'Paper City',author:'Mina',category:'design',tools:'ChatGPT + Illustrator',description:'Une affiche construite à partir d’une ville imaginaire décrite uniquement avec des verbes.',size:'mini',image:'linear-gradient(135deg,#ece0d1,#bd6a5f 42%,#2d3240)',date:'Oct. 2026'},
{id:12,title:'The Quiet Object',author:'Sol',category:'3d',tools:'ChatGPT + Blender',description:'Un objet sans fonction. Juste une présence.',size:'standard',date:'Oct. 2026'},
{id:13,title:'Window 7',author:'Noah',category:'image',tools:'ChatGPT + image generation',description:'Le paysage que je voulais voir depuis ma chambre quand j’étais enfant.',size:'large',image:'linear-gradient(180deg,#89a3bd,#e9c7a6 62%,#5e5a46 63%)',date:'Oct. 2026'},
{id:14,title:'Better Error',author:'Ari',category:'weird',tools:'ChatGPT + code',description:'Une erreur graphique devenue plus intéressante que le projet initial.',size:'standard',image:'repeating-linear-gradient(90deg,#121212 0 12px,#d6ff35 12px 16px,#f3eee4 16px 28px)',date:'Oct. 2026'},
{id:15,title:'Tiny Story',author:'Lou',category:'words',tools:'ChatGPT',description:'Une histoire de dix mots.',size:'mini',words:'Elle ouvrit la boîte. Le futur y respirait encore.',date:'Oct. 2026'},
{id:16,title:'Bench 01',author:'Kian',category:'build',tools:'ChatGPT + SketchUp',description:'Un banc produit après avoir demandé comment faire tenir trois personnes sans créer trois places séparées.',size:'large',image:'linear-gradient(150deg,#85796e,#d7cec2 50%,#3d3935)',date:'Oct. 2026'},
{id:17,title:'Signal',author:'Eva',category:'design',tools:'ChatGPT + Figma',description:'Identité visuelle pour un projet qui n’existera probablement jamais.',size:'standard',image:'linear-gradient(135deg,#161616 0 45%,#d1ff39 45% 58%,#f0eee5 58%)',date:'Oct. 2026'},
{id:18,title:'Tomorrow, Maybe',author:'Iris',category:'image',tools:'ChatGPT + image generation',description:'Une image produite à partir d’une phrase : demain, mais sans certitude.',size:'xl',image:'linear-gradient(165deg,#d9d6cf,#b7c6d3 45%,#f1c1a6 70%,#393f49)',date:'Oct. 2026'}];
let pieces=base.slice(0,6), filter='all', plan={size:'standard',price:9.9}, upload='', selectedSlot=null;
try{const s=JSON.parse(localStorage.getItem('tem-demo')||'[]');if(Array.isArray(s))pieces=[...base.slice(0,6),...s]}catch(e){}
const grid=$('#grid'),viewport=$('#viewport');
const FORMATS={
  mini:{name:'Petit portrait',dimensions:'20 × 30 cm',ratio:2/3,price:9.90},
  portrait:{name:'Portrait',dimensions:'40 × 60 cm',ratio:2/3,price:19.90},
  landscape:{name:'Paysage',dimensions:'60 × 40 cm',ratio:3/2,price:19.90},
  tall:{name:'Grand portrait',dimensions:'60 × 90 cm',ratio:2/3,price:30},
  wide:{name:'Grand paysage',dimensions:'90 × 60 cm',ratio:3/2,price:30},
  panorama:{name:'Panoramique',dimensions:'100 × 40 cm',ratio:5/2,price:30},
  floor:{name:'Emplacement au sol',dimensions:'1,20 × 1,20 m',ratio:1,price:499}
};
// Deux premiers cadres à gauche (0, 2) et à droite (1, 3) : espaces publicitaires hors vente.
const AD_RESERVED_SLOTS=new Set([0,1,2,3]);
const SLOT_SIZES=['landscape','portrait','mini','wide','portrait','landscape','panorama','tall','mini','wide','portrait','landscape','panorama','tall','portrait','wide','mini','landscape','wide','portrait','panorama','landscape','tall'];
const FLOOR_POSITIONS=[{id:'S01',z:12,x:1.45},{id:'S02',z:32,x:-1.45},{id:'S03',z:58,x:1.45}];
const euros=n=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const normalizeSize=s=>({standard:'landscape',large:'wide',xl:'panorama'}[s]||s);
function getSlots(){
  const placements=new Map();
  [4,5,8,11,14,17].forEach((slot,index)=>{if(pieces[index] && pieces[index].id<=18) placements.set(slot,pieces[index]);});
  pieces.filter(p=>p.id>18 && typeof p.slot!=='string').forEach(p=>{
    let slot=Number.isInteger(p.slot)&&p.slot>=0?p.slot:-1;
    if(slot<0||AD_RESERVED_SLOTS.has(slot)||placements.has(slot)){slot=4;while(AD_RESERVED_SLOTS.has(slot)||placements.has(slot))slot++;}
    placements.set(slot,p);
  });
  const highest=Math.max(17,...placements.keys()),total=Math.max(23,highest+5);
  return Array.from({length:total},(_,id)=>{
    const piece=placements.get(id)||null,size=piece&&piece.id>18?normalizeSize(piece.size):SLOT_SIZES[id%SLOT_SIZES.length];
    return{id,size,price:FORMATS[size]?.price||19.9,format:FORMATS[size]||FORMATS.landscape,piece,reservedForAds:AD_RESERVED_SLOTS.has(id)};
  });
}
function getFloorSlots(){
  return FLOOR_POSITIONS.map(s=>({...s,size:'floor',price:499,format:FORMATS.floor,piece:pieces.find(p=>p.slot===s.id)||null}));
}
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function bg(p){if(p.image?.startsWith('data:'))return `url("${p.image}")`;return p.image||'linear-gradient(145deg,#ddd8cd,#f8f6f0)'}
function render(){grid.innerHTML='';const arr=filter==='all'?pieces:pieces.filter(p=>p.category===filter);arr.forEach(p=>{const el=document.createElement('article');el.className=`tile ${p.size} ${p.category==='words'?'words':''} ${p.category==='3d'?'threed':''}`;el.dataset.id=p.id;if(p.category==='words'){el.innerHTML=`<div class="wordsArt">${esc(p.words||p.title)}</div><div class="lab"><div><b>${esc(p.title)}</b><span>${esc(p.author)}</span></div><span>#${String(p.id).padStart(3,'0')}</span></div><button></button>`}else if(p.category==='3d'){el.innerHTML=`<div class="img"></div><div class="shape"></div><div class="shade"></div><div class="lab"><div><b>${esc(p.title)}</b><span>${esc(p.author)}</span></div><span>#${String(p.id).padStart(3,'0')}</span></div><button></button>`}else{el.innerHTML=`<div class="img"></div><div class="shade"></div><div class="lab"><div><b>${esc(p.title)}</b><span>${esc(p.author)}</span></div><span>#${String(p.id).padStart(3,'0')}</span></div><button></button>`}if(p.category!=='words'&&p.category!=='3d')el.querySelector('.img').style.backgroundImage=bg(p);el.querySelector('button').onclick=()=>openPiece(p);grid.appendChild(el)});stats()}
function stats(){ $('#liveCount').textContent=pieces.length;$('#countHero').textContent=String(pieces.length).padStart(3,'0');const m=4.8+pieces.reduce((a,p)=>a+({mini:.22,standard:.42,large:.72,xl:1.12}[p.size]||.42),0);$('#metersHero').textContent=m.toFixed(1).replace('.',',')+' M'}
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render();viewport.scrollTo({left:0,behavior:'smooth'})});
$('#reset').onclick=()=>viewport.scrollTo({left:0,behavior:'smooth'});$('#random').onclick=()=>{const a=filter==='all'?pieces:pieces.filter(p=>p.category===filter);if(!a.length)return;const p=a[Math.floor(Math.random()*a.length)],el=grid.querySelector(`[data-id="${p.id}"]`);if(el){viewport.scrollTo({left:Math.max(0,el.offsetLeft-viewport.clientWidth/2),behavior:'smooth'});el.animate([{transform:'translateY(0)'},{transform:'translateY(-12px)'},{transform:'translateY(0)'}],{duration:700});setTimeout(()=>openPiece(p),600)}};
let down=false,sx=0,sl=0;viewport.onmousedown=e=>{down=true;sx=e.pageX-viewport.offsetLeft;sl=viewport.scrollLeft};window.onmouseup=()=>down=false;viewport.onmouseleave=()=>down=false;viewport.onmousemove=e=>{if(!down)return;e.preventDefault();viewport.scrollLeft=sl-(e.pageX-viewport.offsetLeft-sx)*1.35};
function openPiece(p){const m=$('#media');m.className='media';m.style.backgroundImage='';m.textContent='';if(p.category==='words'){m.classList.add('words');m.textContent=p.words||p.title}else if(p.category==='3d')m.classList.add('threed');else m.style.backgroundImage=bg(p);$('#pcat').textContent=`${p.category.toUpperCase()} / #${String(p.id).padStart(3,'0')}`;$('#ptitle').textContent=p.title;$('#pauthor').textContent=p.author;$('#pdesc').textContent=p.description;$('#ptools').textContent=p.tools;$('#pdate').textContent=p.date;$('#psize').textContent=FORMATS[normalizeSize(p.size)]?.name||p.size.toUpperCase();$('#sharePiece').onclick=()=>shareGeneric(p);$('#piece').showModal()}
$('#closePiece').onclick=()=>$('#piece').close();function shareGeneric(p){const url=location.href.split('#')[0]+`#piece-${p.id}`;if(navigator.share)navigator.share({title:p.title,text:`${p.title} — exposé dans The Empty Museum`,url}).catch(()=>{});else navigator.clipboard?.writeText(url)}
function setReserveStage(n){
  $('#exhibit').classList.toggle('is-step-two',n===2);
  document.querySelectorAll('#exhibit [data-stage]').forEach(el=>{el.hidden=Number(el.dataset.stage)!==n;});
  $('#form').scrollTop=0;
}
function openExhibit(size='landscape',price=null,slot=null){
  if(Number.isInteger(slot)&&AD_RESERVED_SLOTS.has(slot))return;
  const chosen=FORMATS[size]||FORMATS.landscape;
  plan={size,price:price===null?chosen.price:Number(price)};
  selectedSlot=slot;
  const isFloor=typeof slot==='string';
  const name=isFloor?'ESPACE AU SOL N°'+slot.slice(1):(Number.isInteger(slot)?'MUR '+(slot%2?'DROIT':'GAUCHE')+' · CADRE N°'+String(slot+1).padStart(2,'0'):'EMPLACEMENT LIBRE');
  $('#slotName').textContent=name;
  $('#formatName').textContent=chosen.name;
  $('#dimensions').textContent=chosen.dimensions;
  $('#reservePrice').textContent=euros(plan.price);
  $('#price').textContent=euros(plan.price);
  $('#reservePreview').style.setProperty('--frame-ratio',String(chosen.ratio));
  $('#reservePreview').classList.toggle('is-floor',isFloor);
  $('#reserveExplain').textContent=isFloor
    ?'Cet espace au sol est réservé à une sculpture, un objet ou une installation. Dans cette démo, vous pouvez présenter votre projet avec une photo et un texte.'
    :'Ce cadre précis vous est réservé pendant 12 mois. Votre image conserve ses proportions : elle ne sera ni étirée ni déformée.';
  setReserveStage(1);
  $('#exhibit').showModal();
}
function firstVacantWall(size=null){return getSlots().find(s=>!s.piece&&!s.reservedForAds&&(!size||s.size===size))||getSlots().find(s=>!s.piece&&!s.reservedForAds);}
$$('[data-open]').forEach(b=>b.onclick=()=>{const s=firstVacantWall();if(s)openExhibit(s.size,s.price,s.id);});
$$('[data-plan]').forEach(b=>b.onclick=()=>{
  const size=b.dataset.plan;
  if(size==='floor'){const x=getFloorSlots().find(s=>!s.piece);if(x)openExhibit('floor',499,x.id);}
  else{const x=firstVacantWall(size);if(x)openExhibit(x.size,x.price,x.id);}
});
$('#reserveContinue').onclick=()=>setReserveStage(2);
$('#reserveBack').onclick=()=>setReserveStage(1);
$('#title').oninput=()=>$('#prevTitle').textContent=($('#title').value||'VOTRE CRÉATION').toUpperCase();
$('#file').onchange=e=>{
  const f=e.target.files?.[0];if(!f)return;
  if(!f.type.startsWith('image/')){alert('Choisissez une image.');return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const ratio=Math.min(1,1100/Math.max(img.width,img.height));
      const work=document.createElement('canvas');
      work.width=Math.max(1,Math.round(img.width*ratio));
      work.height=Math.max(1,Math.round(img.height*ratio));
      const c=work.getContext('2d');c.drawImage(img,0,0,work.width,work.height);
      upload=work.toDataURL('image/jpeg',.82);
      $('#preview').style.backgroundImage='url("'+upload+'")';
    };img.src=String(reader.result);
  };reader.readAsDataURL(f);
};
const sketch=$('#sketch'),sketchCtx=sketch?.getContext('2d');
let sketchUsed=false,sketchPointer=null;
if(sketchCtx){
  sketchCtx.fillStyle='#faf8f3';sketchCtx.fillRect(0,0,sketch.width,sketch.height);
  sketchCtx.strokeStyle='#1d2420';sketchCtx.lineWidth=4;sketchCtx.lineCap='round';sketchCtx.lineJoin='round';
  const pos=e=>{const r=sketch.getBoundingClientRect();return{x:(e.clientX-r.left)*sketch.width/r.width,y:(e.clientY-r.top)*sketch.height/r.height}};
  sketch.addEventListener('pointerdown',e=>{e.preventDefault();sketch.setPointerCapture(e.pointerId);sketchPointer=e.pointerId;const p=pos(e);sketchCtx.beginPath();sketchCtx.moveTo(p.x,p.y);sketchCtx.lineTo(p.x+.1,p.y+.1);sketchCtx.stroke();sketchUsed=true;});
  sketch.addEventListener('pointermove',e=>{if(sketchPointer!==e.pointerId)return;const p=pos(e);sketchCtx.lineTo(p.x,p.y);sketchCtx.stroke();});
  const done=e=>{if(sketchPointer!==e.pointerId)return;sketchPointer=null;upload=sketch.toDataURL('image/png');$('#preview').style.backgroundImage='url("'+upload+'")';};
  sketch.addEventListener('pointerup',done);sketch.addEventListener('pointercancel',done);
  $('#clearSketch').onclick=()=>{sketchCtx.fillStyle='#faf8f3';sketchCtx.fillRect(0,0,sketch.width,sketch.height);sketchUsed=false;upload='';$('#preview').style.backgroundImage='';};
}
$('#publish').onclick=()=>{const p={id:Math.max(18,...pieces.map(p=>Number(p.id)||18))+1,slot:selectedSlot,title:$('#title').value.trim()||'Untitled',author:$('#author').value.trim()||'Anonymous',category:$('#category').value,tools:$('#tools').value.trim()||'Création personnelle',description:$('#desc').value.trim()||'Une création exposée dans The Empty Museum.',size:plan.size,date:new Date().toLocaleDateString('fr-FR',{month:'short',year:'numeric'}),image:upload||'linear-gradient(145deg,#c7d1d8,#eee5d8 60%,#6f7b83)',words:$('#category').value==='words'?($('#desc').value.trim()||'Untitled'):''};pieces.push(p);try{localStorage.setItem('tem-demo',JSON.stringify(pieces.filter(x=>x.id>18)))}catch(e){alert('La création est visible pendant cette visite, mais le stockage de votre appareil est saturé. Réduisez la taille du fichier pour la conserver.')}$('#exhibit').close();filter='all';$$('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));render();setTimeout(()=>viewport.scrollTo({left:grid.scrollWidth,behavior:'smooth'}),80);drawShare(p);$('#share').showModal();$('#form').reset();$('#prevTitle').textContent='VOTRE CRÉATION';$('#preview').style.backgroundImage='';upload='';selectedSlot=null;if(sketchCtx){sketchCtx.fillStyle='#faf8f3';sketchCtx.fillRect(0,0,sketch.width,sketch.height);sketchUsed=false;}window.dispatchEvent(new Event('tem:exhibited'))};
function drawShare(p){const c=$('#canvas'),x=c.getContext('2d'),W=c.width,H=c.height;x.fillStyle='#efede5';x.fillRect(0,0,W,H);x.strokeStyle='#161613';x.lineWidth=3;x.strokeRect(75,75,W-150,H-150);x.fillStyle='#11110f';x.font='700 25px Arial';x.fillText('THE EMPTY MUSEUM',110,130);x.fillStyle='#77736b';x.font='700 20px Arial';x.fillText(`#${String(p.id).padStart(3,'0')} / APERÇU LOCAL`,110,185);x.fillStyle='#11110f';x.font='700 65px Arial';wrap(x,p.title.toUpperCase(),110,340,W-220,73,3);x.font='italic 46px Georgia';x.fillStyle='#4f4d48';wrap(x,`by ${p.author}`,110,575,W-220,55,2);x.font='500 24px Arial';x.fillStyle='#6c6963';wrap(x,p.description,110,735,W-220,35,5);x.fillStyle='#11110f';x.font='700 22px Arial';x.fillText(`${p.size.toUpperCase()} / 12 MONTHS`,110,H-170);x.fillStyle='#77736b';x.font='500 18px Arial';x.fillText('UN MUSÉE POUR TOUTES LES CRÉATIONS',110,H-125)}
function wrap(ctx,t,x,y,w,lh,n){const words=String(t).split(/\s+/),lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>w&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);lines.slice(0,n).forEach((l,i)=>ctx.fillText(l,x,y+i*lh))}
$('#closeShare').onclick=()=>$('#share').close();$('#download').onclick=()=>{const a=document.createElement('a');a.download='the-empty-museum-exhibition.png';a.href=$('#canvas').toDataURL('image/png');a.click()};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);$('#copy').textContent='LIEN COPIÉ ✓';setTimeout(()=>$('#copy').textContent='COPIER LE LIEN',1400)}catch(e){}};$('#shareNative').onclick=async()=>{if(navigator.share)try{await navigator.share({title:'The Empty Museum',text:'Ma création est exposée dans The Empty Museum.',url:location.href})}catch(e){}};render();

// A direct link works for demo pieces and browser-local creations stored on this device.
function openLinkedPiece(){const m=location.hash.match(/^#piece-(\d+)$/);if(!m)return;const p=pieces.find(piece=>piece.id===Number(m[1]));if(p)openPiece(p)}
window.addEventListener('hashchange',openLinkedPiece);openLinkedPiece();

// Read-only bridge for the immersive gallery; the public demo remains browser-local.
window.TEM = { getPieces: () => pieces, getSlots, getFloorSlots, openPiece, openExhibit };
