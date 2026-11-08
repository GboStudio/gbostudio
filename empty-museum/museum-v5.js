// The Unreal Museum · V7 — simplified mobile gallery navigation.
// The renderer remains responsible for all camera physics.
// Visitors can look freely while moving safely down the central aisle.
export function createMuseumV5Navigation({overlay,canvas,mobile,home,setZoom,adjustZoom,nextStop,onTourChange,onViewChange}) {
  const shell=document.createElement("div");
  shell.className="museum-v5-shell";
  shell.innerHTML=`
    <div class="museum-v5-reticle" aria-hidden="true"></div>
    <div class="museum-v5-help" aria-live="polite">GAUCHE : REGARD · DROITE : DÉPLACEMENT · ZOOM + / −</div>
    <div class="museum-v5-notice" aria-live="polite"></div>
    <div class="museum-v5-drive" aria-label="Déplacement assisté">
      <button type="button" id="museumAdvance" aria-pressed="false" aria-label="Découvrir l’œuvre suivante de l’exposition">
        <strong aria-hidden="true">↗</strong><span>ŒUVRE SUIVANTE</span>
      </button>
      <small>UNE ŒUVRE À CHAQUE APPUI</small>
    </div>
    <div class="museum-v5-joystick" aria-label="Déplacement libre">
      <div class="joystick-ring" role="group" aria-label="Joystick droit : déplacement avant, arrière et latéral">
        <div class="joystick-knob"></div>
      </div>
      <small>DÉPLACEMENT</small>
    </div>
    <div class="museum-v5-lookstick" aria-label="Orientation de la caméra">
      <div class="lookstick-ring" role="group" aria-label="Joystick gauche : regarder à gauche, à droite, en haut et en bas">
        <div class="lookstick-knob"></div>
      </div>
      <small>REGARD</small>
    </div>
    <div class="museum-v5-zoom" role="group" aria-label="Zoom de la caméra">
      <button type="button" id="museumZoomOut" aria-label="Dézoomer">−</button>
      <span aria-hidden="true">ZOOM</span>
      <button type="button" id="museumZoomIn" aria-label="Zoomer">+</button>
    </div>
    <div class="museum-v5-dock">
      <button type="button" id="museumTour" aria-pressed="false">▶ &nbsp; VISITE GUIDÉE</button>
      <button type="button" id="museumNextStop" aria-label="Découvrir la prochaine œuvre">→ &nbsp; ŒUVRE SUIVANTE</button>
      <button type="button" id="museumView" aria-label="Changer le cadrage de la visite" aria-pressed="false">▣ &nbsp; VUE ŒUVRE</button>
      <button type="button" id="museumHome" aria-label="Revenir au début du musée">⌖ &nbsp; DÉBUT</button>
      <button type="button" id="museumFreeToggle" aria-pressed="false">◌ &nbsp; MODE LIBRE</button>
      <button type="button" id="museumFull" aria-label="Passer en plein écran">⛶ &nbsp; PLEIN ÉCRAN</button>
    </div>`;
  // Force the input layer above the WebGL canvas from the first frame:
  // stylesheet imports can resolve after the 3D engine is already interactive.
  shell.style.position="absolute";
  shell.style.inset="0";
  shell.style.zIndex="40";
  shell.style.pointerEvents="none";
  overlay.appendChild(shell);
  for(const cls of [".museum-v5-dock",".museum-v5-drive",".museum-v5-joystick",".museum-v5-lookstick",".museum-v5-zoom"]){
    const element=shell.querySelector(cls);
    if(element)element.style.pointerEvents="auto";
  }
  shell.querySelectorAll("button").forEach(button=>button.style.pointerEvents="auto");
  const $=sel=>shell.querySelector(sel);
  const tourBtn=$("#museumTour"),cruiseBtn=$("#museumAdvance"),freeBtn=$("#museumFreeToggle"),nextBtn=$("#museumNextStop"),viewBtn=$("#museumView");
  const reticle=$(".museum-v5-reticle"),notice=$(".museum-v5-notice"),help=$(".museum-v5-help"),guide=overlay.querySelector(".walk-guide");
  const zone=$(".joystick-ring"),knob=$(".joystick-knob"),joystick=$(".museum-v5-joystick");
  const lookZone=$(".lookstick-ring"),lookKnob=$(".lookstick-knob"),lookJoystick=$(".museum-v5-lookstick");
  let stick={x:0,y:0},touchId=null,lookStick={x:0,y:0},lookTouchId=null;
  let auto=false,cruise=false,free=false,elapsed=0,visible=false,pausedTour=false,resumeRequested=false,resumeAvailable=false,viewMode="art";
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
    tourBtn.textContent=auto?"Ⅱ  ·  PAUSE VISITE":(pausedTour||resumeAvailable)?"▶  ·  REPRENDRE LA VISITE":"▶  ·  VISITE GUIDÉE";
    overlay.classList.toggle("museum-v5-tour",auto);
  }
  function setResumeAvailable(flag){resumeAvailable=Boolean(flag);paintTour();}
  function setViewMode(mode,silent=false){
    viewMode=mode==="room"?"room":"art";
    viewBtn.setAttribute("aria-pressed",String(viewMode==="room"));
    viewBtn.textContent=viewMode==="room"?"◫  VUE SALLE":"▣  VUE ŒUVRE";
    viewBtn.setAttribute("aria-label",viewMode==="room"?"Passer en cadrage rapproché sur l’œuvre":"Voir l’œuvre et la salle en plan large");
    if(!silent)onViewChange?.(viewMode);
  }
  viewBtn.addEventListener("click",()=>setViewMode(viewMode==="art"?"room":"art"));
  // The former cruise button walked straight down an empty corridor.
  // Every press now brings the visitor directly to the next occupied exhibit.
  function paintCruise(){
    cruise=false;
    cruiseBtn.setAttribute("aria-pressed","false");
    cruiseBtn.setAttribute("aria-label","Découvrir l’œuvre suivante");
    cruiseBtn.classList.remove("is-moving");
    cruiseBtn.querySelector("strong").textContent="↗";
    cruiseBtn.querySelector("span").textContent="ŒUVRE SUIVANTE";
    const label=$(".museum-v5-drive small");
    if(label)label.textContent="UNE ŒUVRE À CHAQUE APPUI";
  }
  function stopCruise(){cruise=false;paintCruise();}
  function setTour(next,silent=false){
    if(next){
      resumeRequested=pausedTour||resumeAvailable;
      resumeAvailable=false;
      if(cruise)stopCruise();
      if(free){free=false;shell.classList.remove("is-free");freeBtn.setAttribute("aria-pressed","false");freeBtn.textContent="◌  MODE LIBRE";releaseStick();releaseLookStick();}
      pausedTour=false;
    }else if(auto){pausedTour=true;}
    auto=Boolean(next);
    elapsed=0;
    onTourChange?.({playing:auto,paused:!auto&&pausedTour,resume:resumeRequested});
    paintTour();
    if(!silent)toast(auto?"VISITE GUIDÉE · LE MUSÉE S'OCCUPE DU TRAJET":pausedTour?"VISITE EN PAUSE · TOUCHEZ REPRENDRE":"VISITE LIBRE");
  }
  function finishTour(){
    auto=false;pausedTour=false;resumeRequested=false;resumeAvailable=false;paintTour();
  }
  function manual(){if(auto)setTour(false,true);}
  function takeControl(){
    // A manual drag cancels guided camera movement and enables immediate
    // joystick steering, without making the visitor find a separate button.
    manual();
    stopCruise();
    if(!free){
      free=true;
      shell.classList.add("is-free");
      freeBtn.setAttribute("aria-pressed","true");
      freeBtn.textContent="✓  MODE LIBRE";
    }
  }
  function releaseInputs(){
    releaseStick();releaseLookStick();
    stopCruise();
    if(auto)manual();
  }
  function toggleCruise(){
    if(!visible)return;
    if(auto)manual();
    nextStop?.();
  }
  cruiseBtn.addEventListener("click",toggleCruise);
  nextBtn.addEventListener("click",toggleCruise);
  tourBtn.addEventListener("click",()=>setTour(!auto));
  $("#museumHome").addEventListener("click",()=>{
    finishTour();stopCruise();home();
    toast("RETOUR AU DÉBUT DU MUSÉE");
  });
  freeBtn.addEventListener("click",()=>{
    manual();stopCruise();free=!free;
    shell.classList.toggle("is-free",free);
    freeBtn.setAttribute("aria-pressed",String(free));
    freeBtn.textContent=free?"✓  MODE LIBRE":"◌  MODE LIBRE";
    releaseStick();releaseLookStick();
    toast(free?"GAUCHE POUR REGARDER · DROITE POUR MARCHER":"MODE GUIDÉ · ŒUVRE SUIVANTE");
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
    // Apply a circular dead-zone: avoid accidental diagonals and joystick drift.
    const live=m>=.15;
    stick=live?{x,y}:{x:0,y:0};
    const travel=b.width*.31;
    knob.style.transform="translate("+Math.round(stick.x*travel)+"px,"+Math.round(stick.y*travel)+"px)";
    if(live){
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
  // Each stick captures its own pointer: truly simultaneous walking and looking.
  function updateLookStick(event){
    const b=lookZone.getBoundingClientRect();
    let x=(event.clientX-b.left-b.width/2)/(b.width*.38);
    let y=(event.clientY-b.top-b.height/2)/(b.height*.38);
    const m=Math.hypot(x,y);
    if(m>1){x/=m;y/=m;}
    const live=m>=.13;
    lookStick=live?{x,y}:{x:0,y:0};
    const travel=b.width*.31;
    lookKnob.style.transform="translate("+Math.round(lookStick.x*travel)+"px,"+Math.round(lookStick.y*travel)+"px)";
    if(live){takeControl();lookJoystick.classList.add("active");}
  }
  function releaseLookStick(event){
    if(lookTouchId!==null && event && event.pointerId!==lookTouchId)return;
    lookTouchId=null;lookStick={x:0,y:0};
    lookKnob.style.transform="translate(0px,0px)";
    lookJoystick.classList.remove("active");
  }
  lookZone.addEventListener("pointerdown",event=>{
    if(lookTouchId!==null||!free)return;
    event.preventDefault();event.stopPropagation();
    lookTouchId=event.pointerId;lookZone.setPointerCapture(event.pointerId);updateLookStick(event);
  });
  lookZone.addEventListener("pointermove",event=>{
    if(event.pointerId===lookTouchId){event.preventDefault();updateLookStick(event);}
  });
  for(const evt of ["pointerup","pointercancel","lostpointercapture"])
    lookZone.addEventListener(evt,releaseLookStick);
  $("#museumZoomIn").addEventListener("click",()=>adjustZoom?.(-4));
  $("#museumZoomOut").addEventListener("click",()=>adjustZoom?.(4));
  window.addEventListener("blur",releaseInputs);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)releaseInputs()});
  window.addEventListener("keydown",event=>{
    if(!visible||document.querySelector("dialog[open]"))return;
    if(event.code==="KeyR"){finishTour();stopCruise();home();}
    if(event.code==="KeyG")setTour(!auto);
    if(event.code==="KeyV"){event.preventDefault();setViewMode(viewMode==="art"?"room":"art");}
    if(event.code==="Space" && mobile){event.preventDefault();toggleCruise();}
  });
  function update(dt){
    if(auto)elapsed+=dt;
    const resume=auto&&resumeRequested;
    resumeRequested=false;
    return {
      forward:mobile&&free?-stick.y:0,
      strafe:mobile&&free?stick.x:0,
      lookX:mobile&&free?lookStick.x:0,
      lookY:mobile&&free?lookStick.y:0,
      cruise:false,
      simple:mobile&&!free,
      auto,resume,t:elapsed
    };
  }
  function enter(){
    visible=true;finishTour();stopCruise();free=true;
    shell.classList.add("is-free");
    freeBtn.setAttribute("aria-pressed","true");
    freeBtn.textContent="✓  MODE LIBRE";
    releaseStick();releaseLookStick();
    setZoom?.(mobile?60:59);
    guide?.classList.remove("is-faded");
    clearTimeout(guideTimer);
    guideTimer=setTimeout(()=>guide?.classList.add("is-faded"),mobile?8000:6500);
    help.classList.add("show");
    clearTimeout(helpTimer);
    helpTimer=setTimeout(()=>help.classList.remove("show"),mobile?14000:7500);
  }
  function leave(){
    visible=false;finishTour();stopCruise();releaseStick();releaseLookStick();
    help.classList.remove("show");
    clearTimeout(guideTimer);
  }
  function setNear(flag){reticle.classList.toggle("is-near",Boolean(flag));}
  return {update,enter,leave,setTour,finishTour,setNear,toast,setResumeAvailable,setViewMode,getViewMode:()=>viewMode,isTour:()=>auto,
    manual,takeControl,releaseInputs,stopCruise,isCruising:()=>cruise};
}
