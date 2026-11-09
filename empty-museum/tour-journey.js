/**
 * The Empty Museum — guided exhibition route.
 * No DOM, no Three.js dependency: deterministic stops for real exhibits only.
 * Testable from Node and usable on desktop / mobile.
 */
export function planExhibitionStops(slots,{step=3.5,half=4.6,start=5.7,floorSlots=[],ceilingSlots=[]}={}) {
  const wall=(slots||[]).filter(s=>s && s.piece && !s.reservedForAds && (Number.isInteger(s.id)||Boolean(s.isCommercial&&Number.isInteger(s.parentBayId))))
    .map(slot=>{
      const side=slot.isCommercial?slot.side:slot.id%2?1:-1;
      const z=slot.isCommercial?(slot.z+slot.xM+slot.widthM/2-1.5):start+slot.id*step;
      return {
        id:"wall-"+slot.id,kind:"wall",slot,piece:slot.piece,z,
        cameraX:side*1.15,cameraZ:z-.17,
        focusX:side*(half-.37),focusY:slot.isCommercial?slot.y:2.10,focusZ:z,
        label:"ŒUVRE SUR LE MUR",side:side<0?"GAUCHE":"DROITE"
      };
    });
  const floor=(floorSlots||[]).filter(s=>s&&s.piece)
    .map(slot=>({
      id:"floor-"+slot.id,kind:"floor",slot,piece:slot.piece,z:slot.z,
      cameraX:Math.max(-half+1.8,Math.min(half-1.8,slot.x+1.15)),cameraZ:slot.z-2.7,
      focusX:slot.x,focusY:1.15,focusZ:slot.z,
      label:"INSTALLATION",side:"SALLE"
    }));
  const ceiling=(ceilingSlots||[]).filter(s=>s&&s.piece)
    .map(slot=>({
      id:"ceiling-"+slot.id,kind:"ceiling",slot,piece:slot.piece,z:slot.z,
      cameraX:0,cameraZ:slot.z-1.7,focusX:0,focusY:4.20,focusZ:slot.z,
      label:"INSTALLATION AÉRIENNE",side:"PLAFOND"
    }));
  return [...wall,...floor,...ceiling].sort((a,b)=>a.z-b.z || a.id.localeCompare(b.id));
}
export function routeNextIndex(stops,currentIndex,currentZ) {
  if(!stops?.length)return -1;
  if(Number.isInteger(currentIndex)&&currentIndex>=0&&currentIndex<stops.length)
    return (currentIndex+1)%stops.length;
  const next=stops.findIndex(s=>s.z>currentZ+1);
  return next<0?0:next;
}
/**
 * Join the guided visit at the real exhibit nearest to the visitor.
 * Never blindly return to a previously saved itinerary index or jump to
 * the next numbered bay. Side of room matters (wall, floor, ceiling).
 * Nonexistent works / advert-only bays are excluded by planExhibitionStops.
 */
export function routeResumeIndex(stops,currentZ,{currentX=0}={}){
  if(!stops?.length)return -1;
  const z=Number.isFinite(currentZ)?currentZ:0;
  const x=Number.isFinite(currentX)?currentX:0;
  let best=-1,score=Infinity;
  for(let i=0;i<stops.length;i++){
    const stop=stops[i];
    if(!stop||!Number.isFinite(stop.z))continue;
    const artX=Number.isFinite(stop.focusX)?stop.focusX:(Number.isFinite(stop.cameraX)?stop.cameraX:0);
    const dx=artX-x,dz=stop.z-z;
    const distance=dx*dx+dz*dz;
    if(distance<score-1e-8){score=distance;best=i;}
    // On an exact tie, prefer the artwork in front of the visitor.
    else if(Math.abs(distance-score)<1e-8 && best>=0 && stop.z>=z && stops[best].z<z){best=i;}
  }
  return best;
}
export function approachDuration(distance,reducedMotion=false){
  if(reducedMotion)return .14;
  return Math.max(1.6,Math.min(3.15,1.3+distance/15));
}
export function smoothstep(t){
  const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);
}
