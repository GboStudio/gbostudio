/**
 * Museum preview geometry only.
 * This client-side function MUST NOT be used to approve a purchase or lock a bay.
 * The database's unique active slot claim is the reservation authority.
 */
export const PARTNER_BAYS=Object.freeze([0,1,2,3]);
export const BAYS_PER_SECTION=6;
export const BAY_STEP_METRES=3.5;

/**
 * Mur Total: a side of a 6-bay gallery section = 3 bay centres spaced 7 m.
 * Modules 0..5 contain six alternating left/right bays.
 * A full wall excludes any booked, held or partner-reserved bay.
 */
export function availableWholeWalls(bayCount,occupied=[],reserved=PARTNER_BAYS){
  if(!Number.isInteger(bayCount)||bayCount<0||bayCount>1000)throw new RangeError('Invalid bay count');
  const unavailable=new Set([...occupied,...reserved].map(Number));
  const result=[];
  for(let base=0;base+BAYS_PER_SECTION-1<bayCount;base+=BAYS_PER_SECTION){
    for(const side of [-1,1]){
      const slots=side===-1?[base,base+2,base+4]:[base+1,base+3,base+5];
      if(slots.every(id=>!unavailable.has(id)))result.push({base,side,slots});
    }
  }
  return result;
}
export function isSlotInsideWall(slot,wall){
  return Number.isInteger(slot)&&Array.isArray(wall?.slots)&&wall.slots.includes(slot);
}
