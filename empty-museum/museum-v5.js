// The Empty Museum — V5 photographic walk, touch navigation and cinema tour.
// The Three.js renderer owns the camera; this module only manages visitor input/UI.
export function createMuseumV5Navigation({overlay, canvas, mobile, home, setZoom}) {
  const shell=document.createElement("div");
  shell.className="museum-v5-shell";
  shell.innerHTML=`
    <div class="museum-v5-reticle" aria-hidden="true"></div>
    <div class="museum-v5-help" aria-live="polite">GLISSEZ POUR REGARDER AUTOUR DE VOUS &nbsp;·&nbsp; TOUCHEZ UNE ŒUVRE</div>
    <div class="museum-v5-notice" aria-live="polite"></div>
    <div class="museum-v5-joystick" aria-label="Joystick virtuel de déplacement">
      <div class="joystick-ring" role="group" aria-label="Faire glisser pour avancer, reculer ou se déplacer latéralement">
        <div class="joystick-knob"></div>
      </div>
      <small>SE DÉPLACER</small>
    </div>
    <div class="museum-v5-dock">
      <button type="button" id="museumTour" aria-pressed="false">▶ &nbsp; VISITE CINÉMATIQUE</button>
      <button type="button" id="museumHome" aria-label="Revenir au hall d'entrée">⌖ &nbsp; ACCUEIL</button>
      <button type="button" id="museumFull" aria-label="Activer ou désactiver le plein écran">⛶ &nbsp; PLEIN ÉCRAN</button>
    </div>`;
  overlay.appendChild(shell);
  const $=sel=>shell.querySelector(sel);
  const tourBtn=$("#museumTour"),reticle=$(".museum-v5-reticle"),notice=$(".museum-v5-notice"),help=$(".museum-v5-help"),guide=overlay.querySelector(".walk-guide");
  const zone=$(".joystick-ring"),knob=$(".joystick-knob"),joystick=$(".museum-v5-joystick");
  let stick={x:0,y:0},touchId=null,auto=false,elapsed=0,visible=false;
  let toastTimer=0,helpTimer=0,guideTimer=0;
  function toast(message){
    notice.textContent=message;
    notice.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>notice.classList.remove("show"),2400);
  }
  function setTour(next,silent=false){
    auto=!!next;
    elapsed=0;
    tourBtn.setAttribute("aria-pressed",String(auto));
    tourBtn.classList.toggle("is-playing",auto);
    tourBtn.textContent=auto?"Ⅱ  ·  PAUSE VISITE":"▶  ·  VISITE CINÉMATIQUE";
    overlay.classList.toggle("museum-v5-tour",auto);
    if(!silent)toast(auto?"VISITE GUIDÉE · LAISSEZ-VOUS PORTER":"VISITE LIBRE · À VOUS D’EXPLORER");
  }
  tourBtn.addEventListener("click",()=>setTour(!auto));
  $("#museumHome").addEventListener("click",()=>{
    setTour(false,true);
    home();
    toast("RETOUR AU HALL D'ENTRÉE");
  });
  $("#museumFull").addEventListener("click",async ()=>{
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else await overlay.requestFullscreen?.();
    }catch { toast("LE PLEIN ÉCRAN N'EST PAS DISPONIBLE"); }
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
      if(auto)setTour(false,true);
      joystick.classList.add("active");
    }
  }
  function releaseStick(event){
    if(touchId===null || (event && event.pointerId!==touchId))return;
    touchId=null;stick={x:0,y:0};knob.style.transform="translate(0px,0px)";
    joystick.classList.remove("active");
  }
  zone.addEventListener("pointerdown",event=>{
    if(touchId!==null)return;
    event.preventDefault();event.stopPropagation();
    touchId=event.pointerId;
    zone.setPointerCapture(event.pointerId);
    updateStick(event);
  });
  zone.addEventListener("pointermove",event=>{
    if(event.pointerId===touchId){event.preventDefault();updateStick(event);}
  });
  for(const evt of ["pointerup","pointercancel","lostpointercapture"])zone.addEventListener(evt,releaseStick);
  window.addEventListener("blur",()=>releaseStick());
  window.addEventListener("keydown",event=>{
    if(!visible)return;
    if(event.code==="KeyR" && !document.querySelector("dialog[open]"))home();
    if(event.code==="KeyG" && !document.querySelector("dialog[open]"))setTour(!auto);
  });
  function update(dt){
    if(auto)elapsed+=dt;
    return {forward:mobile?-stick.y:0,strafe:mobile?stick.x:0,auto,t:elapsed};
  }
  function enter(){
    visible=true;
    setTour(false,true);
    setZoom?.(mobile?69:64);
    guide?.classList.remove("is-faded");
    clearTimeout(guideTimer);
    guideTimer=setTimeout(()=>guide?.classList.add("is-faded"),mobile?5500:6500);
    help.classList.add("show");
    clearTimeout(helpTimer);
    helpTimer=setTimeout(()=>help.classList.remove("show"),mobile?7500:5300);
  }
  function leave(){visible=false;setTour(false,true);releaseStick();help.classList.remove("show");clearTimeout(guideTimer);}
  function setNear(flag){reticle.classList.toggle("is-near",!!flag);}
  return {update,enter,leave,setTour,setNear,toast,isTour:()=>auto,manual:()=>{if(auto)setTour(false,true);}};
}