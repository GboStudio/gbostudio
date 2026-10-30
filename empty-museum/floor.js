import { validateFile,saveModel,deleteModel,previewModel,stopModelPreview } from "./models3d.js";
(() => {
  'use strict';
  const dialog=document.getElementById('floorStudio');
  if(!dialog || !window.TEM) return;
  const $=s=>dialog.querySelector(s);
  const buttons=[...dialog.querySelectorAll('[data-floor-type]')];
  const canvas=$('#floorPreviewCanvas'),ctx=canvas.getContext('2d');
  const colors={photo:'#d8b68b',statue:'#d8b68b',billboard:'#d8b68b',neon:'#8fd6e8',model:'#d5c8b4'};
  let modelFile=null,modelValidated=false,modelRequest=0;
  let state={slot:'S01',type:'photo',author:'',title:'',text:'',shape:'spire',tint:'#d8b68b',image:''},angle=-.25;
  const LINE_LIMIT=46;
  const colorHex=s=>/^#[0-9a-fA-F]{6}$/.test(s||'')?s:'#d8b68b';
  function openFloor(id){
    const slot=window.TEM.getFloorSlots().find(s=>s.id===id && !s.piece);
    if(!slot)return;
    state={slot:id,type:'photo',author:'',title:'',text:'',shape:'spire',tint:colors.photo,image:''};
    modelFile=null;modelValidated=false;modelRequest++;stopModelPreview();
    $('#floorModelFile').value='';
    $('#floorModelCanvas').hidden=true;
    $('#floorPreviewCanvas').hidden=false;
    $('#floorSlotLabel').textContent='SOL '+id+' · 1,20 × 1,20 M';
    $('#floorAuthor').value='';
    $('#floorTitle').value='';
    $('#floorText').value='';
    $('#floorShape').value='spire';
    $('#floorTint').value=colors.photo;
    $('#floorFile').value='';
    $('#floorError').textContent='';
    angle=-.25;
    select('photo');
    dialog.showModal();
  }
  function select(type){
    state.type=type;state.tint=colors[type];
    $('#floorTint').value=state.tint;
    buttons.forEach(b=>{const selected=b.dataset.floorType===type;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    $('#floorShapeGroup').hidden=type!=='statue';
    $('#floorUploadGroup').hidden=type==='statue'||type==='neon'||type==='model';
    $('#floorModelGroup').hidden=type!=='model';
    $('#floorModelHelp').hidden=type!=='model';
    $('#floorTextGroup').hidden=type==='photo'||type==='model';
    $('#floorTintGroup').hidden=type==='model';
    if(type!=='model'){
      stopModelPreview();
      $('#floorModelCanvas').hidden=true;
      $('#floorPreviewCanvas').hidden=false;
    }else{
      $('#floorPreviewCanvas').hidden=!!modelValidated;
      $('#floorModelCanvas').hidden=!modelValidated;
      $('#floorPreviewCaption').textContent=modelValidated?'APERÇU 3D · GLISSEZ POUR TOURNER':'AJOUTEZ UN MODÈLE POUR VOIR L’APERÇU 3D';
      if(modelFile&&modelValidated) previewModel(modelFile,$('#floorModelCanvas')).catch(e=>showError(e.message||'Impossible d’afficher le modèle.'));
    }
    if(type!=='model')$('#floorPreviewCaption').textContent='APERÇU INDICATIF';
    $('#floorTextLabel').firstChild.nodeValue=type==='neon'?'VOTRE PHRASE LUMINEUSE':type==='billboard'?'TEXTE DU PANNEAU':'PETITE INSCRIPTION (FACULTATIF)';
    $('#floorUploadLabel').textContent=type==='billboard'?'AJOUTER UNE IMAGE AU PANNEAU (FACULTATIF)':'AJOUTER VOTRE PHOTO';
    $('#floorText').maxLength=type==='neon'?30:LINE_LIMIT;
    $('#floorText').placeholder=type==='neon'?'Écrivez une phrase courte':type==='billboard'?'Votre slogan ou annonce':'Ex. Édition 01';
    $('#floorError').textContent='';
    preview();
  }
  buttons.forEach(b=>b.addEventListener('click',()=>select(b.dataset.floorType)));
  for (const [id,key] of [['floorAuthor','author'],['floorTitle','title'],['floorText','text'],['floorShape','shape'],['floorTint','tint']]) {
    $('#'+id).addEventListener('input',e=>{state[key]=e.target.value;preview();});
  }
  $('#floorFile').addEventListener('change',e=>{
    const f=e.target.files?.[0]; if(!f)return;
    if(!['image/jpeg','image/png','image/webp'].includes(f.type)){showError('Utilisez une image JPG, PNG ou WebP.');return;}
    if(f.size>15*1024*1024){showError('Cette image dépasse 15 Mo. Choisissez une image plus légère.');return;}
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
        const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*scale);c.height=Math.round(img.naturalHeight*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        state.image=c.toDataURL('image/jpeg',.79);
        $('#floorError').textContent='';
        preview();
      };
      img.onerror=()=>showError('Impossible de lire cette image.');
      img.src=String(fr.result);
    };
    fr.readAsDataURL(f);
  });
  $('#floorModelFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    modelRequest++;
    const requestId=modelRequest;
    modelFile=null;modelValidated=false;
    stopModelPreview();
    $('#floorModelCanvas').hidden=true;
    $('#floorPreviewCanvas').hidden=false;
    $('#floorError').textContent='Analyse du modèle 3D…';
    try{
      await validateFile(file);
      if(requestId!==modelRequest || state.type!=='model')return;
      modelFile=file;
      await previewModel(file,$('#floorModelCanvas'));
      if(requestId!==modelRequest || state.type!=='model')return;
      modelValidated=true;
      $('#floorPreviewCanvas').hidden=true;
      $('#floorModelCanvas').hidden=false;
      $('#floorPreviewCaption').textContent='APERÇU 3D · GLISSEZ POUR TOURNER';
      $('#floorError').textContent=file.name+' · '+(file.size/1048576).toFixed(1)+' Mo · prêt à exposer';
    }catch(error){
      if(requestId!==modelRequest)return;
      modelFile=null;modelValidated=false;
      $('#floorModelFile').value='';
      $('#floorPreviewCanvas').hidden=false;
      $('#floorModelCanvas').hidden=true;
      showError(error.message||'Ce fichier 3D est incompatible.');
    }
  });
  $('#floorClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{modelRequest++;stopModelPreview();});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  function showError(t){const el=$('#floorError');el.textContent=t;el.scrollIntoView({block:'center',behavior:'smooth'});}
  let currentImage=null,lastImgSrc='';
  function project(x,y,z) {
    const ca=Math.cos(angle),sa=Math.sin(angle);
    const rx=x*ca+z*sa,rz=z*ca-x*sa;
    return [360+rx*170,370-y*175+rz*55];
  }
  function polygon(points,fill,stroke='#899083',lw=1){
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));
    ctx.closePath(); if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function quad(verts,fill,stroke){polygon(verts.map(v=>project(...v)),fill,stroke);}
  function textFit(str,x,y,maxWidth,fontSize,color,glow=false) {
    const t=(str||'').trim();
    if(!t)return;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='800 '+fontSize+'px Arial, sans-serif';ctx.fillStyle=color;
    if(glow){ctx.shadowColor=color;ctx.shadowBlur=22;}
    const lines=[];
    let current='';
    for(const word of t.split(/\s+/)){
      const tmp=(current?current+' ':'')+word;
      if(ctx.measureText(tmp).width>maxWidth&&current){lines.push(current);current=word;}else current=tmp;
    }
    if(current)lines.push(current);
    const limited=lines.slice(0,3);
    limited.forEach((line,i)=>ctx.fillText(line,x,y+(i-(limited.length-1)/2)*fontSize*1.1,maxWidth));
    ctx.restore();
  }
  function preview(){
    if(!ctx)return;
    const w=canvas.width,h=canvas.height;
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#f6f5f0');g.addColorStop(.66,'#e9e9e0');g.addColorStop(1,'#d5d5c8');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#e2e0d6';ctx.fillRect(0,340,w,h-340);
    ctx.strokeStyle='#c8c8be';ctx.lineWidth=1;
    for(let x=-5;x<=5;x++) {ctx.beginPath();let p=project(x,0,-3),q=project(x,0,4);ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    for(let z=-4;z<=5;z++) {let p=project(-5,0,z),q=project(5,0,z);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    const floor=[[-.6,.015,-.6],[.6,.015,-.6],[.6,.015,.6],[-.6,.015,.6]].map(v=>project(...v));
    polygon(floor,'#dfe6d8','#9aa992',2);
    polygon([[-.56,.08,-.56],[.56,.08,-.56],[.56,.08,.56],[-.56,.08,.56]].map(v=>project(...v)),'#f6f4e8','#b5b5a5',2);
    ctx.fillStyle='#687365';ctx.font='700 13px Arial';ctx.textAlign='left';ctx.fillText('INSTALLATION · '+state.slot,30,39);
    ctx.fillStyle='#7b827a';ctx.font='11px Arial';ctx.fillText('TOURNEZ L’APERÇU EN GLISSANT',30,61);

    const tint=colorHex(state.tint);
    if(state.type==='statue'){
      const levels=[[.32,.20],[.45,.21],[.50,.20],[.55,.35],[.70,.37]];
      for(let i=0;i<levels.length-1;i++){const r=levels[i][1],rn=levels[i+1][1],lo=levels[i][0],hi=levels[i+1][0];
        for(let j=0;j<12;j++){const a=j*Math.PI/6,b=(j+1)*Math.PI/6;
          quad([[Math.cos(a)*r,lo,Math.sin(a)*r],[Math.cos(b)*r,lo,Math.sin(b)*r],[Math.cos(b)*rn,hi,Math.sin(b)*rn],[Math.cos(a)*rn,hi,Math.sin(a)*rn]],i%2?'#b2aa99':'#e0d2b7',null);
        }
      }
      if(state.shape==='orb'){
        for(let i=0;i<7;i++)for(let j=0;j<12;j++){
          const a=Math.PI*i/7,b=Math.PI*(i+1)/7,u=2*Math.PI*j/12,v=2*Math.PI*(j+1)/12;
          const p=(t,h)=>[Math.sin(t)*Math.cos(h)*.45,.98+Math.cos(t)*.45,Math.sin(t)*Math.sin(h)*.45];
          quad([p(a,u),p(a,v),p(b,v),p(b,u)],j%2?tint:'#a3a69d',null);
        }
      }else if(state.shape==='rings'){
        for(let k=0;k<3;k++){
          const y=.68+k*.36;
          for(let j=0;j<12;j++){
            let a=2*Math.PI*j/12,b=2*Math.PI*(j+1)/12;
            quad([[.43*Math.cos(a),y,.43*Math.sin(a)],[.43*Math.cos(b),y,.43*Math.sin(b)],[.32*Math.cos(b),y+.06,.32*Math.sin(b)],[.32*Math.cos(a),y+.06,.32*Math.sin(a)]],j%2?tint:'#bbc0af',null);
          }
        }
      }else{
        for(let j=0;j<12;j++){
          const a=2*Math.PI*j/12,b=2*Math.PI*(j+1)/12;
          quad([[.37*Math.cos(a),.66,.37*Math.sin(a)],[.37*Math.cos(b),.66,.37*Math.sin(b)],[0,1.65,0]],j%2?tint:'#a69c8a',null);
        }
      }
      textFit(state.text,360,440,330,16,'#4b4e45');
    }else{
      const top=state.type==='photo'?1.63:state.type==='billboard'?1.67:1.58;
      const bottom=.55;
      quad([[-.06,.25,-.1],[.06,.25,-.1],[.06,top-.15,-.1],[-.06,top-.15,-.1]],'#8f8c7f','#706c61');
      const face=[[-.53,bottom,0],[.53,bottom,0],[.53,top,0],[-.53,top,0]];
      quad(face,state.type==='neon'?'#172624':state.type==='photo'?'#ddd6c8':'#303a35','#adb4a3');
      const q=face.map(v=>project(...v)),left=Math.min(...q.map(p=>p[0])),right=Math.max(...q.map(p=>p[0])),upper=Math.min(...q.map(p=>p[1])),lower=Math.max(...q.map(p=>p[1]));
      const fw=right-left,fh=lower-upper;
      ctx.save();polygon(q,null,null);ctx.clip();
      if(state.image && state.type!=='neon'){
        if(state.image!==lastImgSrc){const img=new Image();img.onload=()=>{currentImage=img;preview()};img.src=state.image;lastImgSrc=state.image;}
        if(currentImage&&currentImage.complete){const ratio=Math.min(fw/currentImage.width,fh/currentImage.height);const iw=currentImage.width*ratio,ih=currentImage.height*ratio;ctx.drawImage(currentImage,left+(fw-iw)/2,upper+(fh-ih)/2,iw,ih);}
      }
      if(state.type==='photo'){
        if(!state.image){ctx.fillStyle='#ddd9d0';ctx.fillRect(left+fw*.09,upper+fh*.09,fw*.82,fh*.82);textFit('VOTRE PHOTO',360,250,fw*.76,22,'#565d56');}
      }else if(state.type==='billboard'){
        if(!state.image){ctx.fillStyle='#2e3a36';ctx.fillRect(left,upper,fw,fh);}
        textFit(state.text||'VOTRE ANNONCE',360,260,fw*.8,24,'#f2eada');
      }else{
        textFit(state.text||'VOTRE MESSAGE',360,260,fw*.9,31,tint,true);
      }
      ctx.restore();
      polygon(q,null,tint,3);
    }
    ctx.fillStyle='#566258';ctx.textAlign='center';ctx.font='600 13px Arial';ctx.fillText(state.title||'VOTRE FUTURE INSTALLATION',w/2,h-26);
  }
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;angle+=(e.clientX-pointer.x)*.012;pointer.x=e.clientX;preview();});
  const stop=()=>pointer=null;canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  $('#floorPublish').addEventListener('click',async()=>{
    const s=window.TEM.getFloorSlots().find(f=>f.id===state.slot&&!f.piece);
    if(!s){showError('Cet emplacement est indisponible.');return;}
    const title=state.title.trim()||('Installation '+state.slot);
    const author=state.author.trim()||'Anonyme';
    const text=state.text.trim();
    if(state.type==='photo'&&!state.image){showError('Ajoutez une photo pour exposer ce format.');return;}
    if((state.type==='neon'||state.type==='billboard')&&!text&&!state.image){showError('Saisissez votre texte ou ajoutez une image.');return;}
    if(state.type==='neon'&&text.length>30){showError('Le message lumineux doit contenir 30 caractères maximum.');return;}
    if(state.type==='model'&&(!modelFile||!modelValidated)){showError('Importez un GLB, glTF autonome ou STL valide avant de publier.');return;}
    const publishButton=$('#floorPublish');
    if(publishButton.disabled)return;
    publishButton.disabled=true;
    const oldLabel=publishButton.textContent;
    publishButton.textContent='ENREGISTREMENT…';
    let saved=null;
    try{
      if(state.type==='model')saved=await saveModel(modelFile);
    }catch(error){
      showError(error.message||'Enregistrement du modèle impossible.');
      publishButton.disabled=false;publishButton.textContent=oldLabel;return;
    }
    const p={slot:state.slot,size:'floor',floorType:state.type,floorColor:colorHex(state.tint),floorShape:state.shape,floorText:text,
      category:state.type==='model'||state.type==='statue'?'3d':state.type==='photo'?'image':state.type==='neon'?'words':'design',
      title,author,description:state.type==='model'?'Modèle 3D personnel exposé sur le socle '+state.slot+'.':text||'Installation créée pour The Empty Museum.',
      tools:state.type==='model'?'Import 3D : '+saved.format.toUpperCase():'Studio du musée',
      image:state.image,modelKey:saved?.key||null,modelName:saved?.name||null,modelFormat:saved?.format||null,
      durationMonths:1};
    const accepted=window.TEM.publishFloor(p);
    if(!accepted){
      if(saved?.key)await deleteModel(saved.key);
      showError('L’emplacement vient d’être occupé, choisissez un autre socle.');
      publishButton.disabled=false;publishButton.textContent=oldLabel;return;
    }
    dialog.close();
    publishButton.disabled=false;publishButton.textContent=oldLabel;
  });
  window.TEM.openFloor=openFloor;
  preview();
})();