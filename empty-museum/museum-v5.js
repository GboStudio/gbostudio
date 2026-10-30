// The Empty Museum · V7 — simplified mobile gallery navigation.
// The renderer remains responsible for all camera physics.
// Visitors can look freely while moving safely down the central aisle.
export function createMuseumV5Navigation({overlay,canvas,mobile,home,setZoom}) {
  const shell=document.createElement("div");
  shell.className="museum-v5-shell";
  shell.innerHTML=`
    <div class="museum-v5-reticle" aria-hidden="true"></div>
    <div class="museum-v5-help" aria-live="polite">GLISSEZ POUR REGARDER · TOUCHEZ « AVANCER » POUR MARCHER</div>
    <div class="museum-v5-notice" aria-live="polite"></div>
    <div class="museum-v5-drive" aria-label="Déplacement assisté">
      <button type="button" id="museumAdvance" aria-pressed="false" aria-label="Commencer à avancer dans l'allée">
        <strong aria-hidden="true">↑</strong><span>AVANCER</span>
      </button>
      <small>UN APPUI POUR AVANCER</small>
    </div>
    <div class="museum-v5-joystick" aria-label="Déplacement libre">
      <div class="joystick-ring" role="group" aria-label="Joystick de déplacement : haut, bas, gauche et droite">
        <div class="joystick-knob"></div>
      </div>
      <small>MODE LIBRE</small>
    </div>
    <div class="museum-v5-dock">
      <button type="button" id="museumTour" aria-pressed="false">▶ &nbsp; VISITE GUIDÉE</button>
      <button type="button" id="museumHome" aria-label="Revenir au début du musée">⌖ &nbsp; DÉBUT</button>
      <button type="button" id="museumFreeToggle" aria-pressed="false">◌ &nbsp; MODE LIBRE</button>
      <button type="button" id="museumFull" aria-label="Passer en plein écran">⛶ &nbsp; PLEIN ÉCRAN</button>
    </div>`;
  overlay.appendChild(shell);
  const $=sel=>shell.querySelector(sel);
  const tourBtn=$("#museumTour"),cruiseBtn=$("#museumAdvance"),freeBtn=$("#museumFreeToggle");
  const reticle=$(".museum-v5-reticle"),notice=$(".museum-v5-notice"),help=$(".museum-v5-help"),guide=overlay.querySelector(".walk-guide");
  const zone=$(".joystick-ring"),knob=$(".joystick-knob"),joystick=$(".museum-v5-joystick");
  let stick={x:0,y:0},touchId=null,auto=false,cruise=false,free=false,elapsed=0,visible=false,pausedTour=false,resumeRequested=false;
  let toastTimer=0,helpTimer=0,guideTimer=0;
  function toast(message){
    notice.textContent=message;
    notice.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>notice.classList.remove("show"),2600);
  }
  function paintTour(){
    tourBtn.setAttribute("aria-pressed",String(auto));
    tourBtn.classList.toggle("is-playing",auto);
    tourBtn.textContent=auto?"Ⅱ  ·  PAUSE VISITE":pausedTour?"▶  ·  REPRENDRE LA VISITE":"▶  ·  VISITE GUIDÉE";
    overlay.classList.toggle("museum-v5-tour",auto);
  }
  function paintCruise(){
    cruiseBtn.setAttribute("aria-pressed",String(cruise));
    cruiseBtn.setAttribute("aria-label",cruise?"Arrêter d'avancer":"Avancer automatiquement dans l'allée");
    cruiseBtn.classList.toggle("is-moving",cruise);
    cruiseBtn.querySelector("strong").textContent=cruise?"Ⅱ":"↑";
    cruiseBtn.querySelector("span").textContent=cruise?"STOP":"AVANCER";
    const label=$(".museum-v5-drive small");
    if(label)label.textContent=cruise?"TOUCHEZ POUR VOUS ARRÊTER":"UN APPUI POUR AVANCER";
  }
  function stopCruise(){cruise=false;paintCruise();}
  function setTour(next,silent=false){
    if(next){
      resumeRequested=pausedTour;
      if(cruise)stopCruise();
      if(free){free=false;shell.classList.remove("is-free");freeBtn.setAttribute("aria-pressed","false");freeBtn.textContent="◌  MODE LIBRE";releaseStick();}
      pausedTour=false;
    }else if(auto){pausedTour=true;}
    auto=Boolean(next);
    elapsed=0;
    paintTour();
    if(!silent)toast(auto?"VISITE GUIDÉE · LE MUSÉE S'OCCUPE DU TRAJET":pausedTour?"VISITE EN PAUSE · TOUCHEZ REPRENDRE":"VISITE LIBRE");
  }
  function finishTour(){
    auto=false;pausedTour=false;resumeRequested=false;paintTour();
  }
  function manual(){if(auto)setTour(false,true);}
  function toggleCruise(){
    if(!visible)return;
    if(auto)manual();
    cruise=!cruise;
    paintCruise();
    if(cruise)toast("VOUS AVANCEZ AU CENTRE · GLISSEZ POUR REGARDER");
  }
  cruiseBtn.addEventListener("click",toggleCruise);
  tourBtn.addEventListener("click",()=>setTour(!auto));
  $("#museumHome").addEventListener("click",()=>{
    finishTour();stopCruise();home();
    toast("RETOUR AU DÉBUT DU MUSÉE");
  });
  freeBtn.addEventListener("click",()=>{
    manual();stopCruise();free=!free;
    shell.classList.toggle("is-free",free);
    freeBtn.setAttribute("aria-pressed",String(free));
    freeBtn.textContent=free?"✓  MODE SIMPLE":"◌  MODE LIBRE";
    releaseStick();
    toast(free?"MODE LIBRE · DÉPLACEZ LE JOYSTICK À DROITE":"MODE SIMPLE · AVANCEZ SANS DIRIGER");
  });
  $("#museumFull").addEventListener("click",async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await overlay.requestFullscreen?.();
    }catch{toast("PLEIN ÉCRAN NON DISPONIBLE");}
  });
  function updateStick(event){
    const b=zone.getBoundingClientRect();
    let x=(event.clientX-b.left-b.width/2)/(b.width*.38);
    let y=(event.clientY-b.top-b.height/2)/(b.height*.38);
    const m=Math.hypot(x,y);
    if(m>1){x/=m;y/=m;}
    stick={x:Math.abs(x)<.13?0:x,y:Math.abs(y)<.13?0:y};
    knob.style.transform="translate("+Math.round(x*31)+"px,"+Math.round(y*31)+"px)";
    if(Math.hypot(x,y)>.1){
      if(auto)manual();
      joystick.classList.add("active");
    }
  }
  function releaseStick(event){
    if(touchId!==null && event && event.pointerId!==touchId)return;
    touchId=null;stick={x:0,y:0};
    knob.style.transform="translate(0px,0px)";
    joystick.classList.remove("active");
  }
  zone.addEventListener("pointerdown",event=>{
    if(touchId!==null || !free)return;
    event.preventDefault();event.stopPropagation();
    touchId=event.pointerId;zone.setPointerCapture(event.pointerId);updateStick(event);
  });
  zone.addEventListener("pointermove",event=>{
    if(event.pointerId===touchId){event.preventDefault();updateStick(event);}
  });
  for(const evt of ["pointerup","pointercancel","lostpointercapture"])
    zone.addEventListener(evt,releaseStick);
  window.addEventListener("blur",()=>{releaseStick();stopCruise();});
  window.addEventListener("keydown",event=>{
    if(!visible||document.querySelector("dialog[open]"))return;
    if(event.code==="KeyR"){finishTour();stopCruise();home();}
    if(event.code==="KeyG")setTour(!auto);
    if(event.code==="Space" && mobile){event.preventDefault();toggleCruise();}
  });
  function update(dt){
    if(auto)elapsed+=dt;
    const resume=auto&&resumeRequested;
    resumeRequested=false;
    return {
      forward:mobile&&free?-stick.y:0,
      strafe:mobile&&free?stick.x:0,
      cruise:mobile&&cruise&&!free,
      simple:mobile&&!free,
      auto,resume,t:elapsed
    };
  }
  function enter(){
    visible=true;finishTour();stopCruise();free=false;
    shell.classList.remove("is-free");
    freeBtn.setAttribute("aria-pressed","false");
    freeBtn.textContent="◌  MODE LIBRE";
    setZoom?.(mobile?69:64);
    guide?.classList.remove("is-faded");
    clearTimeout(guideTimer);
    guideTimer=setTimeout(()=>guide?.classList.add("is-faded"),mobile?8000:6500);
    help.classList.add("show");
    clearTimeout(helpTimer);
    helpTimer=setTimeout(()=>help.classList.remove("show"),mobile?14000:7500);
  }
  function leave(){
    visible=false;finishTour();stopCruise();releaseStick();
    help.classList.remove("show");
    clearTimeout(guideTimer);
  }
  function setNear(flag){reticle.classList.toggle("is-near",Boolean(flag));}
  return {update,enter,leave,setTour,finishTour,setNear,toast,isTour:()=>auto,
    manual,stopCruise,isCruising:()=>cruise};
}
