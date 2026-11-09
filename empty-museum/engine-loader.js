// The Unreal Museum — progressive WebGL enhancement.
// Keep the legacy canvas renderer as a robust fallback for unsupported browsers and offline/CDN errors.
(async () => {
  let fallbackStarted=false;
  // A one-off HTTP 503 during module import must not permanently strand a
  // WebGL-capable visitor in the 2D fallback. Never retry syntax/runtime bugs.
  const moduleRetryKey='tum-3d-module-retry:'+location.pathname;
  function looksLikeModuleNetworkFailure(error){
    const message=String(error?.message||error);
    return /failed to fetch dynamically imported module|importing a module script failed|failed to load module script|error loading dynamically imported module|load failed/i.test(message)
      && (error?.name==='TypeError'||/failed to fetch dynamically imported module/i.test(message));
  }
  function claimModuleReload(storage,key){
    try{
      if(storage.getItem(key)==='1')return false;
      storage.setItem(key,'1');
      return true;
    }catch{return false;}
  }
  function legacy(reason) {
    if(fallbackStarted)return;
    fallbackStarted=true;
    console.warn("[The Unreal Museum] 3D engine unavailable; switching to canvas fallback.",reason);
    // Browsers cannot reuse a WebGL canvas for a 2D rendering context.
    const oldCanvas=document.getElementById("walkCanvas");
    if(oldCanvas){
      const fresh=document.createElement("canvas");
      fresh.id=oldCanvas.id;
      fresh.setAttribute("aria-label",oldCanvas.getAttribute("aria-label")||"Visite du musée");
      oldCanvas.replaceWith(fresh);
    }
    const script=document.createElement("script");
    script.src="walk.js?v=20261104fallback";
    script.onerror=()=>console.error("[The Unreal Museum] Canvas fallback could not be loaded.");
    document.body.appendChild(script);
  }
  try{
    const canvas=document.getElementById("walkCanvas");
    if(!canvas)throw new Error("Museum canvas missing");
    if(!window.WebGLRenderingContext)throw new Error("WebGL not supported");
    // Fix iOS visual vs layout viewport before the WebGL renderer measures its canvas.
    let fitMobile=()=>{};
    if(matchMedia("(pointer:coarse)").matches){
      const {fitMuseumVisualViewport}=await import("./visual-viewport-v1.js?v=20261106v2");
      fitMobile=fitMuseumVisualViewport();
    }
    await import("./engine3d.js?v=20261109dualstick3baketimeout");
    // A successful import clears the one-time recovery guard.
    try{window.sessionStorage.removeItem(moduleRetryKey);}catch{}
    // The 3D engine mounts the joystick and dock asynchronously during import.
    fitMobile();
  }catch(error){
    let reloadOnce=false;
    try{
      reloadOnce=navigator.onLine!==false&&looksLikeModuleNetworkFailure(error)
        &&claimModuleReload(window.sessionStorage,moduleRetryKey);
    }catch{}
    if(reloadOnce){
      console.warn('[The Unreal Museum] Transient 3D module network failure; retrying the page once.',error);
      // Allow a short recovery interval for temporary CDN 503 responses.
      await new Promise(resolve=>setTimeout(resolve,1200));
      try{location.reload();return;}catch(reloadError){
        console.warn('[The Unreal Museum] Single reload was unavailable.',reloadError);
      }
    }
    // A second failed fetch, offline browser or code exception still surfaces
    // as a real failure and uses the existing accessible canvas fallback.
    legacy(error);
  }
})();