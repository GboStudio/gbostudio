// The Empty Museum — progressive WebGL enhancement.
// Keep the legacy canvas renderer as a robust fallback for unsupported browsers and offline/CDN errors.
(async () => {
  let fallbackStarted=false;
  function legacy(reason) {
    if(fallbackStarted)return;
    fallbackStarted=true;
    console.warn("[The Empty Museum] 3D engine unavailable; switching to canvas fallback.",reason);
    // Browsers cannot reuse a WebGL canvas for a 2D rendering context.
    const oldCanvas=document.getElementById("walkCanvas");
    if(oldCanvas){
      const fresh=document.createElement("canvas");
      fresh.id=oldCanvas.id;
      fresh.setAttribute("aria-label",oldCanvas.getAttribute("aria-label")||"Visite du musée");
      oldCanvas.replaceWith(fresh);
    }
    const script=document.createElement("script");
    script.src="walk.js?v=20261030whiteceiling4";
    script.onerror=()=>console.error("[The Empty Museum] Canvas fallback could not be loaded.");
    document.body.appendChild(script);
  }
  try{
    const canvas=document.getElementById("walkCanvas");
    if(!canvas)throw new Error("Museum canvas missing");
    if(!window.WebGLRenderingContext)throw new Error("WebGL not supported");
    await import("./engine3d.js?v=20261030visual5");
  }catch(error){legacy(error);}
})();