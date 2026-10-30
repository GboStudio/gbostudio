import * as THREE from "three";

/**
 * THE EMPTY MUSEUM — V8 / WHITE LUXURY
 * Procedural, locally generated mineral materials. No third-party images,
 * no extra network requests and no texture files required.
 */
export function makeWhiteLuxuryMaterials({mobile,length}) {
  const size=mobile?512:768;
  function seeded(seed) {
    let s=seed>>>0;
    return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  }
  function texture(canvas,{x=1,y=1,isColor=true}={}) {
    const t=new THREE.CanvasTexture(canvas);
    t.wrapS=THREE.RepeatWrapping;
    t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(x,y);
    t.anisotropy=mobile?2:8;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    t.magFilter=THREE.LinearFilter;
    if(isColor)t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }
  function plasterPair() {
    const N=mobile?256:384;
    const color=document.createElement("canvas"),height=document.createElement("canvas");
    color.width=height.width=N;color.height=height.height=N;
    const g=color.getContext("2d"),h=height.getContext("2d");
    const a=g.createImageData(N,N),b=h.createImageData(N,N);
    const rand=seeded(314159);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const p=(y*N+x)*4;
      const long=Math.sin(x*.028+y*.011)*.82+Math.sin(y*.046-x*.020)*.53;
      const grain=(rand()-.5)*2.1+long;
      const v=248+grain*.72;
      a.data[p]=Math.round(v);
      a.data[p+1]=Math.round(v-.4);
      a.data[p+2]=Math.round(v-1.2);
      a.data[p+3]=255;
      const n=Math.round(132+grain*3.0);
      b.data[p]=n;b.data[p+1]=n;b.data[p+2]=n;b.data[p+3]=255;
    }
    g.putImageData(a,0,0);h.putImageData(b,0,0);
    return {
      map:texture(color,{x:1,y:length/5}),
      bump:texture(height,{x:1,y:length/5,isColor:false})
    };
  }
  function mineralStone() {
    const color=document.createElement("canvas"),height=document.createElement("canvas");
    color.width=height.width=size;color.height=height.height=size;
    const g=color.getContext("2d"),h=height.getContext("2d");
    const a=g.createImageData(size,size),b=h.createImageData(size,size);
    const rand=seeded(20261030),slab=size/4;
    for(let y=0;y<size;y++){
      const row=Math.floor(y/slab),yy=y%slab;
      for(let x=0;x<size;x++){
        const xx=(x+(row%2)*slab*.5)%size;
        const cell=Math.floor(xx/slab)+row*5;
        const joint=yy<1.1||xx%slab<1.1;
        const swirl=Math.sin(x*.029+y*.013+Math.sin(y*.010)*1.9)*1.5
          +Math.sin(x*.009-y*.022)*2.35
          +Math.sin(x*.047+y*.035)*.9;
        const crystalline=(rand()-.5)*4.1;
        const tileBias=(((cell*97+11)%17)-8)*.43;
        const vein=(Math.sin(x*.031+y*.024+Math.sin(y*.008)*2.0)> .986)?-3.2:0;
        const grain=swirl+crystalline+tileBias+vein;
        const p=(y*size+x)*4;
        const value=joint?210:234+grain;
        a.data[p]=Math.round(value+.6);
        a.data[p+1]=Math.round(value-.1);
        a.data[p+2]=Math.round(value-2.4);
        a.data[p+3]=255;
        const v=joint?106:Math.round(133+grain*1.9+(rand()-.5)*7);
        b.data[p]=v;b.data[p+1]=v;b.data[p+2]=v;b.data[p+3]=255;
      }
    }
    g.putImageData(a,0,0);h.putImageData(b,0,0);
    // Extremely fine diffuse mineral veining; deliberately low contrast.
    const veinRand=seeded(1414);
    g.lineCap="round";
    for(let i=0;i<(mobile?12:22);i++){
      const sx=veinRand()*size,sy=veinRand()*size;
      g.beginPath();g.moveTo(sx,sy);
      let px=sx,py=sy;
      const slope=(veinRand()-.5)*1.8;
      for(let j=0;j<10;j++){
        px+=(veinRand()-.1)*size/25;
        py+=slope*size/28+(veinRand()-.5)*size/39;
        g.lineTo(px,py);
      }
      g.lineWidth=.25+veinRand()*.75;
      g.strokeStyle="rgba(120,119,111,.11)";
      g.stroke();
    }
    return {
      map:texture(color,{x:1.5,y:length/6.15}),
      bump:texture(height,{x:1.5,y:length/6.15,isColor:false})
    };
  }
  const plaster=plasterPair(),stone=mineralStone();
  const wall=new THREE.MeshStandardMaterial({
    map:plaster.map,bumpMap:plaster.bump,bumpScale:.0024,
    color:0xffffff,roughness:.93,metalness:0
  });
  const wallAlt=new THREE.MeshStandardMaterial({
    map:plaster.map,bumpMap:plaster.bump,bumpScale:.0024,
    color:0xf7f7f5,roughness:.93,metalness:0
  });
  const floor=new THREE.MeshPhysicalMaterial({
    map:stone.map,bumpMap:stone.bump,bumpScale:.005,
    color:0xffffff,roughness:.52,metalness:0,
    clearcoat:.13,clearcoatRoughness:.48
  });
  const whiteStone=new THREE.MeshStandardMaterial({
    color:0xf8f8f5,roughness:.63,metalness:0
  });
  const matteGold=new THREE.MeshStandardMaterial({
    color:0x9e8e6f,roughness:.44,metalness:.64
  });
  return {floor,wall,wallAlt,whiteStone,matteGold};
}
