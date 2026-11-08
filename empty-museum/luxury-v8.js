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
      const v=246+grain*.95;
      a.data[p]=Math.round(v);
      a.data[p+1]=Math.round(v-.4);
      a.data[p+2]=Math.round(v-1.2);
      a.data[p+3]=255;
      const n=Math.round(132+grain*3.5);
      b.data[p]=n;b.data[p+1]=n;b.data[p+2]=n;b.data[p+3]=255;
    }
    g.putImageData(a,0,0);h.putImageData(b,0,0);
    return {
      map:texture(color,{x:1,y:length/5}),
      bump:texture(height,{x:1,y:length/5,isColor:false})
    };
  }
  function mineralStone() {
    const color=document.createElement("canvas"),height=document.createElement("canvas"),roughness=document.createElement("canvas");
    color.width=height.width=roughness.width=size;color.height=height.height=roughness.height=size;
    const g=color.getContext("2d"),h=height.getContext("2d"),r=roughness.getContext("2d");
    const a=g.createImageData(size,size),b=h.createImageData(size,size),c=r.createImageData(size,size);
    const rand=seeded(20261030);
    // One continuous stone surface per physically-modelled slab. Never draw
    // counterfeit grout inside the albedo: the instanced geometry owns joints.
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const swirl=Math.sin(x*.029+y*.013+Math.sin(y*.010)*1.9)*1.5
          +Math.sin(x*.009-y*.022)*2.35
          +Math.sin(x*.047+y*.035)*.9;
        const crystalline=(rand()-.5)*4.1;
        const vein=(Math.sin(x*.031+y*.024+Math.sin(y*.008)*2.0)>.989)?-2.0:0;
        const cloud=(Math.sin(x*.006+y*.009)+.7*Math.sin(x*.012-y*.007))*1.5;
        const grain=swirl*.62+crystalline*.45+cloud+vein;
        const p=(y*size+x)*4;
        const value=235+grain*.85;
        a.data[p]=Math.round(value+.6);
        a.data[p+1]=Math.round(value-.1);
        a.data[p+2]=Math.round(value-2.4);
        a.data[p+3]=255;
        const v=Math.round(132+grain*1.3+(rand()-.5)*4.4);
        b.data[p]=v;b.data[p+1]=v;b.data[p+2]=v;b.data[p+3]=255;
        const q=Math.round(230+grain*.7+(rand()-.5)*9);
        c.data[p]=q;c.data[p+1]=q;c.data[p+2]=q;c.data[p+3]=255;
      }
    }
    g.putImageData(a,0,0);h.putImageData(b,0,0);r.putImageData(c,0,0);
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
      bump:texture(height,{x:1.5,y:length/6.15,isColor:false}),
      roughness:texture(roughness,{x:1.5,y:length/6.15,isColor:false})
    };
  }
  const plaster=plasterPair(),stone=mineralStone();
  const wall=new THREE.MeshStandardMaterial({
    map:plaster.map,bumpMap:plaster.bump,bumpScale:.0024,
    color:0xf8f7f4,roughness:.93,metalness:0
  });
  const wallAlt=new THREE.MeshStandardMaterial({
    map:plaster.map,bumpMap:plaster.bump,bumpScale:.0024,
    color:0xf4f3ef,roughness:.93,metalness:0
  });
  const floor=new THREE.MeshPhysicalMaterial({
    map:stone.map,bumpMap:stone.bump,bumpScale:.0035,
    roughnessMap:stone.roughness,
    color:0xf5f3ef,roughness:.83,metalness:0,
    clearcoat:.025,clearcoatRoughness:.85
  });
  const whiteStone=new THREE.MeshStandardMaterial({
    color:0xf8f8f5,roughness:.63,metalness:0
  });
  const matteGold=new THREE.MeshStandardMaterial({
    color:0x9e8e6f,roughness:.48,metalness:.60
  });
  return {floor,wall,wallAlt,whiteStone,matteGold};
}
