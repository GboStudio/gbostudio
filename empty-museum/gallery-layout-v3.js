/**
 * THE UNREAL MUSEUM — physically scaled architectural layout (V3).
 * Deterministic, dependency-free planning functions shared by WebGL and tests.
 * Dimensions are metres. Deliberately keep exhibit bays and walking clearance intact.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function hash(i,j){
  let x=(Math.imul(i+197,0x45d9f3b)^Math.imul(j+1709,0x119de1f3))>>>0;
  x^=x>>>16;x=Math.imul(x,0x45d9f3b);x^=x>>>16;
  return (x>>>0)/4294967295;
}
export function planLimestoneSlabs({half=4.6,length=142,columns=4,targetLength=2.35,gap=.012}={}){
  if(!Number.isFinite(half)||!Number.isFinite(length)||half<=0||length<=0)return [];
  const width=half*2;
  const cols=clamp(Math.floor(columns),2,8);
  const rows=clamp(Math.ceil(length/Math.max(1,targetLength)),1,512);
  const cellWidth=width/cols,cellLength=length/rows;
  const joint=clamp(gap,.003,.03);
  const slabs=[];
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const grain=hash(row,col);
      slabs.push({
        row,col,
        x:-half+(col+.5)*cellWidth,
        z:(row+.5)*cellLength,
        width:cellWidth-joint,
        depth:cellLength-joint,
        // Stone is never identically white; keep variation subtle enough for museum lighting.
        tint: .966+grain*.048,
        rotation:hash(col,row)>.5?Math.PI:0
      });
    }
  }
  return slabs;
}
export function wallIrradianceProfile(u,v){
  const x=clamp(u,0,1),y=clamp(v,0,1);
  // Physically plausible shadowed edges: shallow relief catches less indirect light.
  const edge=Math.pow(1-Math.min(x,1-x)*2,5)*.14;
  const floor=Math.pow(1-y,9)*.15;
  const crown=Math.pow(y,12)*.11;
  // Gentle second bounce under the wall's middle, never a dark vignette.
  const middle=Math.exp(-Math.pow((y-.56)/.32,2))*.015;
  return clamp(edge+floor+crown+middle,0,.31);
}
export function stoneSlabStats(slabs){
  if(!slabs?.length)return {count:0,rows:0,columns:0};
  return {count:slabs.length,rows:slabs.at(-1).row+1,columns:slabs.at(-1).col+1};
}
