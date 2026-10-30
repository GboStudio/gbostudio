/* GBO Studio V9 — accessible interactive product lab and understated entrance. */
(() => {
  "use strict";
  const root=document.documentElement;
  const lab=document.querySelector("[data-v9-lab]");
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!reduce && "IntersectionObserver" in window){
    const items=[...document.querySelectorAll(".v9-reveal")];
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add("v9-in");
          observer.unobserve(entry.target);
        }
      });
    },{threshold:0.06,rootMargin:"0px 0px -25px"});
    items.forEach(item=>observer.observe(item));
    root.classList.add("v9-ready");
  }
  if(!lab)return;
  const data={
    kapsy:{
      img:"kapsy-01.jpg",
      fr:{title:"Un souvenir pour demain.",desc:"Scellez une capsule fictive et révélez ce qu’elle contient.",action:"Ouvrir la capsule",reset:"Refermer la capsule",result:"✦ Souvenir de démonstration révélé. Vos données restent sur votre appareil.",alt:"Capture réelle de Kapsy"},
      en:{title:"A memory for tomorrow.",desc:"Seal an illustrative capsule, then reveal what's inside.",action:"Open the capsule",reset:"Close the capsule",result:"✦ Demo memory revealed. No information has been sent.",alt:"Real screenshot of Kapsy"}
    },
    conscience:{
      img:"conscience-01.jpg",
      fr:{title:"Chaque progrès compte.",desc:"Validez une habitude fictive, comme dans un suivi de progression.",action:"Valider l’habitude",reset:"Réinitialiser",result:"✓ Habitude de démonstration validée. Aucun compte nécessaire.",alt:"Capture réelle de Conscience"},
      en:{title:"Every small step counts.",desc:"Complete a fictional habit in a quick progress preview.",action:"Complete habit",reset:"Reset preview",result:"✓ Demo habit completed. No account required.",alt:"Real screenshot of Conscience"}
    },
    pannego:{
      img:"pannego-01.jpg",
      fr:{title:"Un incident. Une solution.",desc:"Résolvez un incident fictif et visualisez le suivi.",action:"Clôturer l’incident",reset:"Rouvrir l’incident",result:"✓ Incident fictif clôturé. Aucun dossier réel n’a été créé.",alt:"Capture réelle de PanneGo"},
      en:{title:"One issue. One solution.",desc:"Resolve a fictional issue and see its status change.",action:"Close incident",reset:"Reopen incident",result:"✓ Demo incident closed. No real record was created.",alt:"Real screenshot of PanneGo"}
    }
  };
  const tabs=[...lab.querySelectorAll("[data-v9-tab]")];
  const panel=lab.querySelector("[data-v9-panel]");
  const title=lab.querySelector("[data-v9-title]");
  const desc=lab.querySelector("[data-v9-desc]");
  const action=lab.querySelector("[data-v9-action]");
  const image=lab.querySelector("[data-v9-image]");
  const result=lab.querySelector("[data-v9-result]");
  const link=lab.querySelector("[data-v9-link]");
  let active="kapsy",done=false;
  const render=()=>{
    const lang=root.dataset.lang==="en"?"en":"fr";
    const copy=data[active][lang];
    title.textContent=copy.title;
    desc.textContent=copy.desc;
    action.textContent=done?copy.reset:copy.action;
    action.setAttribute("aria-pressed",String(done));
    result.textContent=done?copy.result:"";
    image.src="/assets/store/"+data[active].img;
    image.alt=copy.alt;
    link.href="/"+active+".html";
    link.textContent=lang==="en"?"Explore the app ↗":"Découvrir l’application ↗";
    lab.dataset.state=done?"done":"idle";
    tabs.forEach(tab=>{
      const selected=tab.dataset.v9Tab===active;
      tab.setAttribute("aria-selected",String(selected));
      tab.tabIndex=selected?0:-1;
      if(selected)panel.setAttribute("aria-labelledby",tab.id);
    });
  };
  const select=(key,focus)=>{
    if(!data[key])return;
    active=key;done=false;render();
    if(focus)tabs.find(t=>t.dataset.v9Tab===key)?.focus();
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>select(tab.dataset.v9Tab,false));
    tab.addEventListener("keydown",event=>{
      if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
      event.preventDefault();
      const idx=event.key==="Home"?0:event.key==="End"?tabs.length-1:
        (index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
      select(tabs[idx].dataset.v9Tab,true);
    });
  });
  action.addEventListener("click",()=>{done=!done;render();});
  let startX=0,startY=0;
  panel.addEventListener("touchstart",event=>{
    if(event.touches.length!==1)return;
    startX=event.touches[0].clientX;startY=event.touches[0].clientY;
  },{passive:true});
  panel.addEventListener("touchend",event=>{
    if(!event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-startX;
    const dy=event.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.4){
      const i=tabs.findIndex(t=>t.dataset.v9Tab===active);
      select(tabs[(i+(dx<0?1:-1)+tabs.length)%tabs.length].dataset.v9Tab,false);
    }
  },{passive:true});
  new MutationObserver(records=>{
    if(records.some(r=>r.attributeName==="data-lang"))render();
  }).observe(root,{attributes:true,attributeFilter:["data-lang"]});
  render();
})();
