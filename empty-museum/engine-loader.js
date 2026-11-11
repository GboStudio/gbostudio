// The Unreal Museum — progressive WebGL enhancement.
// Keep the legacy canvas renderer as a robust fallback for unsupported browsers and offline/CDN errors.
(async () => {
  // Isolated test room. The public immersive visit never reaches this branch,
  // and the landing page does not download the test-room bake.
  if(new URLSearchParams(location.search).get("visit")==="salle-temoin"){
    location.replace(new URL("./salle-temoin.html", location.href).href);
    return;
  }
  // Lighting sample. Same isolation rule: the public immersive visit never loads it.
  if(new URLSearchParams(location.search).get("visit")==="salle-echantillon"){
    location.replace(new URL("./salle-echantillon.html", location.href).href);
    return;
  }
  let fallbackStarted=false;
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
    await import("./engine3d.js?v=20261109wallmix2");
    // The 3D engine mounts the joystick and dock asynchronously during import.
    fitMobile();
  }catch(error){legacy(error);}
})();