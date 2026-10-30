// The Empty Museum — progressive WebGL enhancement.
// Keep the legacy canvas renderer as a robust fallback for unsupported browsers and offline/CDN errors.
(async () => {
  function legacy(reason) {
    console.warn("[The Empty Museum] 3D engine unavailable; switching to canvas fallback.",reason);
    const script=document.createElement("script");
    script.src="walk.js?v=20261030fallback1";
    script.onerror=()=>console.error("[The Empty Museum] Canvas fallback could not be loaded.");
    document.body.appendChild(script);
  }
  try{
    const canvas=document.getElementById("walkCanvas");
    if(!canvas)throw new Error("Museum canvas missing");
    if(!window.WebGLRenderingContext)throw new Error("WebGL not supported");
    await import("./engine3d.js?v=20261030engine1");
  }catch(error){legacy(error);}
})();