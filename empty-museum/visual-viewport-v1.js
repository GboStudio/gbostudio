/**
 * THE UNREAL MUSEUM — iOS-safe visual viewport.
 * The page's layout viewport may be wider/taller than the visible iPhone,
 * so room dimensions and all touch controls must share the visible viewport.
 */
export function fitMuseumVisualViewport(){
  const overlay=document.getElementById("walkOverlay"),viewport=window.visualViewport;
  if(!overlay||!viewport)return ()=>{};
  const controls=[
    ".walk-actions",".museum-v5-dock",".museum-v5-joystick",
    ".museum-v5-drive",".walk-progress",".tem-tour-story",
    ".tem-tour-arrival",".museum-v5-help"
  ];
  function apply(){
    const w=Math.round(viewport.width),h=Math.round(viewport.height);
    if(w<280||h<320)return;
    for(const [key,value] of [
      ["left",Math.round(viewport.offsetLeft)+"px"],
      ["top",Math.round(viewport.offsetTop)+"px"],
      ["right","auto"],["bottom","auto"],
      ["width",w+"px"],["height",h+"px"]
    ])overlay.style.setProperty(key,value,"important");
    // These children may be created after engine3d.js loads; a second apply()
    // in engine-loader is required once the navigation controls exist.
    for(const selector of controls){
      const el=overlay.querySelector(selector);
      if(el)el.style.setProperty("position","absolute","important");
    }
    window.dispatchEvent(new Event("resize"));
  }
  apply();
  viewport.addEventListener("resize",apply,{passive:true});
  viewport.addEventListener("scroll",apply,{passive:true});
  return apply;
}
