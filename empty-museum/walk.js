(() => {
  "use strict";
  const overlay = document.getElementById("walkOverlay");
  const canvas = document.getElementById("walkCanvas");
  if (!overlay || !canvas || !window.TEM) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const view = { x: 0, y: 1.72, z: 0.8, yaw: 0, pitch: 0 };
  const keys = new Set();
  const held = new Set();
  const half = 4.6, height = 4.5, step = 3.5, near = 0.15;
  const palette = {
    image: ["#c4cfdb", "#e3beb0"],
    drawing: ["#e6d9b7", "#c0bbdc"],
    design: ["#8dc4cb", "#1b3f54"],
    "3d": ["#d9caba", "#8b7b74"],
    build: ["#879c82", "#d6c7a7"],
    words: ["#f0e6d5", "#b9a7a0"],
    weird: ["#d2d96c", "#c288a5"]
  };
  let active = false, raf = 0, lastTime = 0, W = 1, H = 1, F = 1, length = 30;
  let hits = [], pointer = null, lastFocus = null, autoWalk = null, walking = 0;
  const imageCache = new Map();

  function list() { return window.TEM.getPieces(); }
  function slots() { return window.TEM.getSlots(); }
  function floorSlots() { return window.TEM.getFloorSlots(); }
  function galleryLength() { return Math.max(28, 9 + slots().length * step); }
  function limit(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.floor(W * pixelRatio);
    canvas.height = Math.floor(H * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    F = Math.min(W * 0.88, H * 1.05);
  }
  function camera(p) {
    const dx = p[0] - view.x, dz = p[2] - view.z;
    const sideways=dx*Math.cos(view.yaw)-dz*Math.sin(view.yaw);
    const forward=dx*Math.sin(view.yaw)+dz*Math.cos(view.yaw);
    const vertical=p[1]-view.y;
    return {x:sideways,y:vertical*Math.cos(view.pitch)-forward*Math.sin(view.pitch),z:vertical*Math.sin(view.pitch)+forward*Math.cos(view.pitch)};
  }
  function project(p) { return { x: W / 2 + p.x * F / p.z, y: H / 2 - p.y * F / p.z }; }
  function clip(points) {
    const output = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const ain = a.z >= near, bin = b.z >= near;
      if (ain) output.push(a);
      if (ain !== bin) {
        const t = (near - a.z) / (b.z - a.z);
        output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near });
      }
    }
    return output;
  }
  function face(vertices, color, stroke, kind, piece) {
    const cam = vertices.map(camera);
    const clipped = clip(cam);
    if (clipped.length < 3) return null;
    return {
      points: clipped.map(project),
      depth: cam.reduce((a, p) => a + p.z, 0) / cam.length,
      fill: color, stroke, kind, piece
    };
  }
  function path(points) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
  }
  function gradient(colors, pts) {
    const ys = pts.map(p => p.y), xs = pts.map(p => p.x);
    const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    return g;
  }
  function artImage(piece) {
    if (!piece.image || !piece.image.startsWith("data:image/")) return null;
    if (!imageCache.has(piece.id)) {
      const img = new Image();
      img.onload = () => { if (active) draw(); };
      img.src = piece.image;
      imageCache.set(piece.id, img);
    }
    const img = imageCache.get(piece.id);
    return img && img.complete && img.naturalWidth ? img : null;
  }
  function paintSample(piece,x,y,w,h,pts){
    ctx.save();path(pts);ctx.clip();
    const a=piece.id;
    if(piece.category==="words"){
      ctx.fillStyle="#f5ebd9";ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="rgba(76,57,43,.24)";ctx.lineWidth=Math.max(1,w*.008);ctx.strokeRect(x+w*.1,y+h*.1,w*.8,h*.8);
      ctx.fillStyle="#3c2e29";ctx.textAlign="center";
      ctx.font="italic "+Math.max(10,Math.min(24,w*.12))+"px Georgia";
      const words=String(piece.words||piece.title).split(" "),lines=[];let line="";
      for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>w*.71&&line){lines.push(line);line=word;}else line=test;}
      if(line)lines.push(line);
      lines.slice(0,4).forEach((line,i)=>ctx.fillText(line,x+w*.5,y+h*(.38+i*.12),w*.75));
    } else if(a===1){
      ctx.fillStyle="#718a95";ctx.fillRect(x,y,w,h*.60);
      ctx.fillStyle="#d0ad9e";ctx.beginPath();ctx.arc(x+w*.67,y+h*.28,w*.15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#435b65";ctx.beginPath();ctx.moveTo(x,y+h*.63);ctx.lineTo(x+w*.25,y+h*.35);ctx.lineTo(x+w*.48,y+h*.63);ctx.lineTo(x+w*.75,y+h*.49);ctx.lineTo(x+w,y+h*.7);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.fill();
      ctx.strokeStyle="rgba(249,245,230,.55)";ctx.lineWidth=Math.max(.7,w*.004);
      for(let i=0;i<21;i++){const rx=((i*41)%101)/100;ctx.beginPath();ctx.moveTo(x+w*rx,y);ctx.lineTo(x+w*Math.min(1,rx+.09),y+h*.9);ctx.stroke();}
    } else if(a===2){
      ctx.fillStyle="#d4c4af";ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="#463b34";ctx.lineWidth=Math.max(2,w*.04);ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(x+w*.33,y+h*.22);ctx.lineTo(x+w*.62,y+h*.17);ctx.lineTo(x+w*.68,y+h*.55);ctx.lineTo(x+w*.36,y+h*.59);ctx.closePath();ctx.stroke();
      ctx.fillStyle="#6e4d41";ctx.beginPath();ctx.moveTo(x+w*.33,y+h*.58);ctx.lineTo(x+w*.7,y+h*.53);ctx.lineTo(x+w*.76,y+h*.67);ctx.lineTo(x+w*.39,y+h*.72);ctx.fill();
      ctx.strokeStyle="#5b413b";ctx.lineWidth=Math.max(2,w*.025);
      ctx.beginPath();ctx.moveTo(x+w*.38,y+h*.70);ctx.lineTo(x+w*.34,y+h*.9);ctx.moveTo(x+w*.73,y+h*.66);ctx.lineTo(x+w*.76,y+h*.89);ctx.stroke();
    } else if(a===4){
      ctx.fillStyle="#102c39";ctx.fillRect(x,y,w,h);
      ctx.strokeStyle="rgba(153,225,225,.27)";ctx.lineWidth=1;
      for(let k=0;k<10;k++){const xx=x+k*w/9;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke();}
      for(let k=0;k<9;k++){const yy=y+k*h/8;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy);ctx.stroke();}
      ctx.strokeStyle="#8bd3ce";ctx.lineWidth=Math.max(2,w*.022);ctx.beginPath();
      for(let j=0;j<=36;j++){const xx=x+j*w/36,yy=y+h*(.53+.12*Math.sin(j*.36));j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();
      ctx.fillStyle="#c5ecdf";ctx.beginPath();ctx.arc(x+w*.73,y+h*.28,w*.065,0,Math.PI*2);ctx.fill();
    } else if(a===5){
      ctx.fillStyle="#272b24";ctx.fillRect(x,y,w,h);
      const glow=ctx.createRadialGradient(x+w*.5,y+h*.35,1,x+w*.5,y+h*.35,w*.54);
      glow.addColorStop(0,"rgba(255,248,186,1)");glow.addColorStop(.2,"rgba(245,216,143,.78)");glow.addColorStop(1,"rgba(240,192,124,0)");
      ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
      ctx.fillStyle="#e7d3aa";ctx.beginPath();ctx.moveTo(x+w*.24,y+h*.39);ctx.lineTo(x+w*.76,y+h*.39);ctx.lineTo(x+w*.61,y+h*.60);ctx.lineTo(x+w*.39,y+h*.60);ctx.fill();
      ctx.strokeStyle="#beb8a4";ctx.lineWidth=Math.max(2,w*.02);ctx.beginPath();ctx.moveTo(x+w*.5,y+h*.6);ctx.lineTo(x+w*.5,y+h*.86);ctx.moveTo(x+w*.33,y+h*.87);ctx.lineTo(x+w*.67,y+h*.87);ctx.stroke();
    } else if(a===6){
      ctx.fillStyle="#e6d4c3";ctx.fillRect(x,y,w,h);
      ctx.fillStyle="#ef744e";ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.57,w*.27,h*.3,-.28,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fbb36b";ctx.beginPath();ctx.ellipse(x+w*.41,y+h*.52,w*.07,h*.11,-.4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#4b8a70";ctx.beginPath();ctx.ellipse(x+w*.63,y+h*.29,w*.13,h*.07,-.6,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#354a3f";ctx.lineWidth=Math.max(2,w*.02);ctx.beginPath();ctx.moveTo(x+w*.52,y+h*.37);ctx.lineTo(x+w*.57,y+h*.26);ctx.stroke();
    } else {
      ctx.globalAlpha=.18;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x+w*.67,y+h*.37,w*.23,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  function drawArt(piece, points) {
    const colors = palette[piece.category] || palette.image;
    path(points);
    ctx.fillStyle = gradient(colors, points);
    ctx.fill();
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    const img = artImage(piece);
    if (img && w > 3 && h > 3) {
      ctx.save(); path(points); ctx.clip();
      const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
      const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
      ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
      ctx.restore();
    } else if (w > 22 && h > 25) {
      paintSample(piece,x,y,w,h,points);
    }
    if (w > 65 && h > 45) {
      ctx.save(); path(points); ctx.clip();
      ctx.fillStyle = piece.category === "design" ? "#f7faf7" : "#242725";
      ctx.font = "600 " + Math.max(10, Math.min(18, w * .115)) + "px Arial";
      const title = (piece.words || piece.title || "Création").slice(0, 27);
      ctx.fillText(title, x + w * .08, y + h * .82, w * .83);
      ctx.restore();
    }
  }
  // Espaces dédiés à la publicité : réservés, non cliquables, sans tarif de vente.
  function drawReservedAd(slot, pts) {
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ctx.save();path(pts);ctx.clip();
    const g=ctx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,'#29302e');g.addColorStop(.57,'#171e1d');g.addColorStop(1,'#394039');
    ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle='#c7bd9f';ctx.lineWidth=Math.max(1,Math.min(3,w*.012));
    ctx.strokeRect(x+w*.055,y+h*.07,w*.89,h*.86);
    if(w>28&&h>24){
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='#b9c6b7';
      ctx.font='700 '+Math.max(8,Math.min(13,w*.058))+'px Arial';
      ctx.fillText('THE EMPTY MUSEUM',x+w*.5,y+h*.23,w*.84);
      ctx.fillStyle='#f3ead5';
      ctx.font='700 '+Math.max(12,Math.min(26,w*.14))+'px Arial';
      ctx.fillText('PUBLICITÉ',x+w*.5,y+h*.49,w*.88);
      if(w>65&&h>45){
        ctx.fillStyle='#d1d6cc';
        ctx.font='600 '+Math.max(9,Math.min(14,w*.07))+'px Arial';
        ctx.fillText('ESPACE RÉSERVÉ',x+w*.5,y+h*.67,w*.88);
        ctx.font='500 '+Math.max(8,Math.min(12,w*.055))+'px Arial';
        ctx.fillText('NON DISPONIBLE À LA VENTE',x+w*.5,y+h*.79,w*.9);
      }
    }
    ctx.restore();
  }
  function drawEmpty(slot, pts) {
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ctx.save();path(pts);ctx.clip();
    const bg=ctx.createLinearGradient(x,y,x+w,y+h);
    bg.addColorStop(0,'#faf9f4');bg.addColorStop(1,'#eae8e0');
    ctx.fillStyle=bg;ctx.fill();
    if(w>30 && h>30){
      ctx.strokeStyle='#8c9b84';ctx.lineWidth=Math.max(1,Math.min(4,w*.013));
      ctx.setLineDash([Math.max(3,w*.035),Math.max(2,w*.018)]);
      ctx.strokeRect(x+w*.075,y+h*.07,w*.85,h*.86);ctx.setLineDash([]);
      const r=Math.min(w,h)*.085,cx=x+w*.5,cy=y+h*.34;
      ctx.strokeStyle='#697d65';ctx.lineWidth=Math.max(1,r*.17);
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-r*.5,cy);ctx.lineTo(cx+r*.5,cy);ctx.moveTo(cx,cy-r*.5);ctx.lineTo(cx,cy+r*.5);ctx.stroke();
      if(w>65&&h>48){
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='#263126';ctx.font='700 '+Math.max(9,Math.min(18,w*.092))+'px Arial';
        ctx.fillText('CADRE LIBRE',cx,y+h*.58,w*.86);
        ctx.fillStyle='#53694f';ctx.font='500 '+Math.max(9,Math.min(15,w*.064))+'px Arial';
        ctx.fillText((slot.format?.name||'Photo').toUpperCase(),cx,y+h*.72,w*.86);
        ctx.font='700 '+Math.max(9,Math.min(16,w*.08))+'px Arial';
        ctx.fillText(slot.price.toLocaleString('fr-FR',{maximumFractionDigits:2})+' € / 12 MOIS',cx,y+h*.83,w*.88);
      }
    }
    ctx.restore();
  }
  function drawFloorSpot(slot,pts,kind){
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ctx.save();path(pts);ctx.clip();
    ctx.fillStyle=slot.piece?'#d4c6aa':'#dee9da';ctx.fill();
    ctx.strokeStyle=slot.piece?'#9e8d72':'#879e84';ctx.lineWidth=Math.max(2,Math.min(6,w*.03));
    ctx.setLineDash(slot.piece?[]:[10,6]);path(pts);ctx.stroke();ctx.setLineDash([]);
    if(w>65&&h>15){
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#21352a';
      if(h<48){
        ctx.font='800 '+Math.max(10,Math.min(15,w*.065))+'px Arial';
        ctx.fillText(slot.piece?'INSTALLATION':'SOL · 499 € / MOIS',x+w*.5,y+h*.54,w*.9);
      }else{
        ctx.font='800 '+Math.max(11,Math.min(18,w*.095))+'px Arial';
        ctx.fillText(slot.piece?'INSTALLATION':'ESPACE AU SOL',x+w*.5,y+h*.40,w*.88);
        ctx.font='700 '+Math.max(11,Math.min(20,w*.10))+'px Arial';
        ctx.fillText(slot.piece?String(slot.piece.title).slice(0,25):'499 € / 1 MOIS',x+w*.5,y+h*.69,w*.9);
      }
    }
    ctx.restore();
  }

  // In-gallery display of actual floor installations: photo, sculpture, panel and 3D neon.
  function drawFloorWork(f) {
    const p=f.piece,pts=f.points;
    const xs=pts.map(q=>q.x),ys=pts.map(q=>q.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    const neon=p.floorType==='neon',billboard=p.floorType==='billboard',photo=p.floorType==='photo';
    ctx.save();path(pts);ctx.clip();
    ctx.fillStyle=neon?'#172421':billboard?'#2b332e':'#e1ded3';ctx.fill();
    const img=artImage(p);
    if(img&&!neon&&w>7&&h>7) {
      const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
      const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
      ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
    }
    if(neon||billboard||(!img&&photo)){
      ctx.textAlign='center';ctx.textBaseline='middle';
      const content=neon?String(p.floorText||p.title||'NÉON').slice(0,30):billboard?String(p.floorText||p.title||'ANNONCE').slice(0,46):'PHOTO';
      const words=content.split(' ');
      let line='',lines=[];
      const fs=Math.max(10,Math.min(23,w*.115));
      ctx.font='800 '+fs+'px Arial';
      for(const word of words){
        const test=line?line+' '+word:word;
        if(ctx.measureText(test).width>w*.81&&line){lines.push(line);line=word;} else line=test;
      }
      if(line)lines.push(line);
      const color=neon&&/^#[0-9a-f]{6}$/i.test(p.floorColor)?p.floorColor:neon?'#8fd6e8':'#f8f2e5';
      ctx.fillStyle=color;
      if(neon){ctx.shadowBlur=Math.max(8,w*.18);ctx.shadowColor=color;}
      lines.slice(0,3).forEach((text,i)=>ctx.fillText(text,x+w/2,y+h*(.5+(i-(Math.min(3,lines.length)-1)/2)*.18),w*.83));
      ctx.shadowBlur=0;
    }
    ctx.restore();
    path(pts);ctx.strokeStyle=neon?'#b5d8c8':'#b2ae9d';ctx.lineWidth=Math.max(2,Math.min(6,w*.025));ctx.stroke();
    hits.push({points:pts,depth:f.depth,piece:p,slot:f.slot});
  }
  function sculptureColor(piece,idx){
    const hex=/^#[0-9a-fA-F]{6}$/.test(piece.floorColor||'')?piece.floorColor:'#d8b68b';
    if(idx%3===0)return hex;
    return idx%3===1?'#c3c7bc':'#acaaa0';
  }

  function drawPerson(t){
    // A small third-person visitor, drawn after the gallery so it remains in view.
    const scale=Math.max(.72,Math.min(1.26,H/700));
    const px=W*.5,py=H+9;
    const sway=Math.sin(t*8)*Math.min(1,Math.abs(walking));
    ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);
    ctx.fillStyle='rgba(21,22,20,.20)';ctx.beginPath();ctx.ellipse(0,-3,53,13,0,0,Math.PI*2);ctx.fill();
    function limb(x1,y1,x2,y2,w,color){ctx.lineCap='round';ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
    const kick=Math.min(9,Math.abs(sway)*9);
    limb(-12,-65,-17+sway*9,-15,20,'#343834');
    limb(12,-65,17-sway*9,-15,20,'#292d2a');
    limb(-17+sway*9,-15,-20+sway*9,-5,17,'#1c211f');
    limb(17-sway*9,-15,20-sway*9,-5,17,'#1c211f');
    limb(-25,-111,-31-sway*5,-67,14,'#323b35');
    limb(25,-111,31+sway*5,-67,14,'#2b342e');
    const body=ctx.createLinearGradient(-32,-142,32,-58);
    body.addColorStop(0,'#515f51');body.addColorStop(.55,'#313c35');body.addColorStop(1,'#1f2723');
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-21,-144);ctx.lineTo(21,-144);ctx.quadraticCurveTo(32,-130,26,-110);ctx.lineTo(22,-69);ctx.quadraticCurveTo(0,-61,-22,-69);ctx.lineTo(-26,-110);ctx.quadraticCurveTo(-32,-130,-21,-144);ctx.fill();
    ctx.fillStyle='#202923';ctx.beginPath();ctx.roundRect(-17,-116,34,33,8);ctx.fill();
    ctx.strokeStyle='rgba(231,229,211,.24)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-139);ctx.lineTo(0,-83);ctx.stroke();
    ctx.fillStyle='#b98d72';ctx.fillRect(-8,-152,16,16);
    ctx.fillStyle='#d6b39a';ctx.beginPath();ctx.ellipse(0,-167,16,20,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#292921';ctx.beginPath();ctx.ellipse(0,-174,17,13,0,Math.PI,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function paint(f) {
    path(f.points);
    if(f.kind==='ad'){
      drawReservedAd(f.slot,f.points);
    } else if (f.kind==='floor-install') {
      drawFloorWork(f);
    } else if (f.kind==='floor-statue') {
      path(f.points);ctx.fillStyle=f.fill;ctx.fill();
      ctx.strokeStyle='rgba(72,72,60,.42)';ctx.lineWidth=1;ctx.stroke();
      hits.push({points:f.points,depth:f.depth,piece:f.piece,slot:f.slot});
    } else if(f.kind==='floor-spot'){
      drawFloorSpot(f.slot,f.points,f.kind);
      hits.push({points:f.points,depth:f.depth,piece:f.piece,slot:f.slot});
    } else if (f.kind === "art" || f.kind === "free") {
      ctx.fillStyle = "#fffdfa"; ctx.fill();
      ctx.lineWidth = Math.max(2, Math.min(9, F / (f.depth + 1) * .065));
      ctx.strokeStyle = "#ddd5c5"; ctx.stroke();
      if(f.kind==="art")drawArt(f.piece, f.points);
      else drawEmpty(f.slot,f.points);
      path(f.points); ctx.strokeStyle = f.kind==="free"?"#889276":"#c5bbae"; ctx.stroke();
      hits.push({ points: f.points, depth: f.depth, piece: f.piece, slot: f.slot });
    } else {
      ctx.fillStyle = f.fill; ctx.fill();
      if (f.stroke) { ctx.lineWidth = f.kind === "seam" ? 1 : .6; ctx.strokeStyle = f.stroke; ctx.stroke(); }
    }
  }
  function inside(poly, x, y) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }
  function draw() {
    if (!active) return;
    length = galleryLength();
    ctx.fillStyle = "#ebe7df"; ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#f6f4ee"); sky.addColorStop(.53, "#ebe8e0"); sky.addColorStop(1, "#b8aea0");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const faces = [], n = Math.ceil(length / step);
    function add(vertices, fill, stroke, kind, piece, slot) {
      const f = face(vertices, fill, stroke, kind, piece);
      if(f)f.slot=slot;
      if (f && f.depth > -step && f.depth < 160) faces.push(f);
    }
    for (let i = 0; i < n; i++) {
      const z0 = i * step, z1 = Math.min(length, (i + 1) * step);
      add([[-half, 0, z0], [half, 0, z0], [half, 0, z1], [-half, 0, z1]], i % 2 ? "#d9d4c9" : "#dfd9ce", "#c5beb1", "floor");
      add([[-1.65,.012,z0],[1.65,.012,z0],[1.65,.012,z1],[-1.65,.012,z1]], i%2?"#d0c9bc":"#d6cec1",null,"runner");
      add([[-half, height, z0], [half, height, z0], [half, height, z1], [-half, height, z1]], "#f8f7f2", "#e4e0d6", "ceiling");
      add([[-half, 0, z0], [-half, height, z0], [-half, height, z1], [-half, 0, z1]], i % 2 ? "#edeae3" : "#f2f0ea", "#dad7ce", "wall");
      add([[half, 0, z0], [half, height, z0], [half, height, z1], [half, 0, z1]], i % 2 ? "#e8e5dd" : "#efede7", "#d7d3c8", "wall");
      add([[-half + .025, 0, z0], [-half + .025, .17, z0], [-half + .025, .17, z1], [-half + .025, 0, z1]], "#bdb6aa", null, "baseboard");
      add([[half - .025, 0, z0], [half - .025, .17, z0], [half - .025, .17, z1], [half - .025, 0, z1]], "#bdb6aa", null, "baseboard");
    }
    add([[-half, 0, length], [half, 0, length], [half, height, length], [-half, height, length]], "#e5e0d5", "#cac3b6", "end");

    const all = list(), allSlots = slots(), floors=floorSlots();
    const shapes={
      mini:[1.30,1.95],portrait:[1.65,2.45],landscape:[2.55,1.70],
      tall:[1.85,2.75],wide:[3.15,2.10],panorama:[3.15,1.28],
      standard:[2.55,1.70],large:[3.15,2.10],xl:[3.15,1.28]
    };
    allSlots.forEach((slot,i)=>{
      const z=5.7+i*step,side=i%2?1:-1,x=side*(half-.075);
      const [pw,ph]=shapes[slot.size]||shapes.landscape;
      const low=(height-ph)/2,high=low+ph;
      add([[x,low,z-pw/2],[x,low,z+pw/2],[x,high,z+pw/2],[x,high,z-pw/2]],slot.reservedForAds?"#252c29":slot.piece?"#e6dfd3":"#f3f0e7",slot.reservedForAds?"#b6b09a":slot.piece?"#b8a994":"#829371",slot.reservedForAds?"ad":slot.piece?"art":"free",slot.piece,slot);
    });
    floors.forEach(slot=>{
      const x=slot.x,z=slot.z,r=.60;
      add([[x-r,.21,z-r],[x+r,.21,z-r],[x+r,.21,z+r],[x-r,.21,z+r]],slot.piece?'#ded0b9':'#e3ebdd',null,'floor-spot',slot.piece,slot);
      // The museum plinth makes floor spaces visible without blocking the aisle.
      add([[x-.55,.02,z+.52],[x+.55,.02,z+.52],[x+.55,.18,z+.52],[x-.55,.18,z+.52]],'#d1cbbf','#a9a396','plinth');
      add([[x-.55,.18,z-.52],[x+.55,.18,z-.52],[x+.55,.18,z+.52],[x-.55,.18,z+.52]],'#eeeae2','#b8b0a4','plinth');
      const p=slot.piece;
      if(!p)return;
      if(p.floorType==='statue'){
        const form=p.floorShape||'spire',segments=10;
        if(form==='orb'){
          for(let layer=0;layer<7;layer++){
            const t0=Math.PI*layer/7,t1=Math.PI*(layer+1)/7;
            for(let seg=0;seg<segments;seg++){
              const a=seg*2*Math.PI/segments,b=(seg+1)*2*Math.PI/segments;
              const v=(t,q)=>[x+.39*Math.sin(t)*Math.cos(q),1.07+.39*Math.cos(t),z+.39*Math.sin(t)*Math.sin(q)];
              add([v(t0,a),v(t0,b),v(t1,b),v(t1,a)],sculptureColor(p,seg+layer),null,'floor-statue',p,slot);
            }
          }
        }else if(form==='rings'){
          for(let ring=0;ring<3;ring++){
            const y=.70+ring*.32, radius=.34;
            for(let seg=0;seg<segments;seg++){
              const a=seg*2*Math.PI/segments,b=(seg+1)*2*Math.PI/segments;
              add([[x+radius*Math.cos(a),y,z+radius*Math.sin(a)],[x+radius*Math.cos(b),y,z+radius*Math.sin(b)],
                [x+.26*Math.cos(b),y+.09,z+.26*Math.sin(b)],[x+.26*Math.cos(a),y+.09,z+.26*Math.sin(a)]],
                sculptureColor(p,ring+seg),null,'floor-statue',p,slot);
            }
          }
        }else{
          for(let seg=0;seg<segments;seg++){
            const a=seg*2*Math.PI/segments,b=(seg+1)*2*Math.PI/segments;
            add([[x+.37*Math.cos(a),.55,z+.37*Math.sin(a)],[x+.37*Math.cos(b),.55,z+.37*Math.sin(b)],
              [x,1.69,z]],sculptureColor(p,seg),null,'floor-statue',p,slot);
          }
        }
      }else{
        // Floating digital sign on a slender support. Both remain within 1.20 x 1.20 m.
        const high=p.floorType==='photo'?1.65:1.80, low=.68;
        add([[x-.045,.18,z+.12],[x+.045,.18,z+.12],[x+.045,low,z+.12],[x-.045,low,z+.12]],'#62675e','#454a42','plinth');
        add([[x-.52,low,z],[x+.52,low,z],[x+.52,high,z],[x-.52,high,z]],'#23302a','#b6b2a2','floor-install',p,slot);
      }
    });
    const structure = faces.filter(f => !["art","free","floor-spot","ad","floor-install","floor-statue"].includes(f.kind)).sort((a,b) => b.depth - a.depth);
    const artworks = faces.filter(f => ["art","free","floor-spot","ad","floor-install","floor-statue"].includes(f.kind)).sort((a,b) => b.depth - a.depth);
    hits = [];
    structure.forEach(paint);
    artworks.forEach(paint);

    // Warm, unobtrusive ceiling lights emphasize the scale of the gallery.
    for (let z = 3; z < length; z += 7) {
      const p = camera([0, height - .07, z]);
      if (p.z > .2) {
        const q = project(p), rad = limit(35 / p.z, 2, 16);
        ctx.save(); ctx.shadowBlur = rad * 3; ctx.shadowColor = "rgba(255,252,218,.65)";
        ctx.fillStyle = "#fff8dd"; ctx.beginPath(); ctx.ellipse(q.x, q.y, rad * 1.9, rad * .55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    const fade = ctx.createLinearGradient(0, H * .6, 0, H);
    fade.addColorStop(0, "rgba(25,22,18,0)"); fade.addColorStop(1, "rgba(25,22,18,.13)");
    ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillRect(W / 2 - 9, H / 2, 18, 1);
    ctx.fillRect(W / 2, H / 2 - 9, 1, 18);
    drawPerson(performance.now()/1000);
    document.getElementById("walkProgress").textContent =
      Math.floor(view.z) + " / " + Math.floor(length) + " M  ·  " + all.length + " CRÉATIONS  ·  " + (allSlots.filter(s=>!s.piece&&!s.reservedForAds).length+floors.filter(s=>!s.piece).length) + " PLACES LIBRES";
    document.getElementById("walkMeter").style.width = (100 * view.z / length) + "%";
  }
  function tick(time) {
    if (!active) return;
    const dt = Math.min(.05, (time - (lastTime || time)) / 1000);
    lastTime = time;
    function pressed(...codes) { return codes.some(c => keys.has(c) || held.has(c)); }
    const turn = (pressed("ArrowRight", "turn-right") ? 1 : 0) - (pressed("ArrowLeft", "turn-left") ? 1 : 0);
    let forward = (pressed("ArrowUp", "KeyW", "KeyZ", "forward") ? 1 : 0) - (pressed("ArrowDown", "KeyS", "back") ? 1 : 0);
    if(autoWalk!==null){if(view.z<autoWalk-.2)forward=1;else autoWalk=null;}
    walking=walking*.85+Math.abs(forward)*.15;
    const strafe = (pressed("KeyD") ? 1 : 0) - (pressed("KeyA", "KeyQ") ? 1 : 0);
    view.yaw += turn * dt * 1.48;
    view.x += (Math.sin(view.yaw) * forward + Math.cos(view.yaw) * strafe) * 3.5 * dt;
    view.z += (Math.cos(view.yaw) * forward - Math.sin(view.yaw) * strafe) * 3.5 * dt;
    view.x = limit(view.x, -half + .7, half - .7);
    view.z = limit(view.z, .65, length - 2.7);
    draw();
    raf = requestAnimationFrame(tick);
  }
  function open() {
    if (active) return;
    lastFocus = document.activeElement;
    active = true; view.x = 0; view.z = .8; view.yaw = 0; view.pitch=0; autoWalk=null;
    overlay.hidden = false;
    document.body.classList.add("walk-is-open");
    resize(); lastTime = 0;
    raf = requestAnimationFrame(tick);
    overlay.querySelector(".walk-close").focus();
  }
  function close() {
    if (!active) return;
    active = false; cancelAnimationFrame(raf);
    held.clear(); keys.clear(); pointer = null; autoWalk=null;
    overlay.hidden = true; document.body.classList.remove("walk-is-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll("[data-walk-open]").forEach(b => b.addEventListener("click", open));
  overlay.querySelectorAll("[data-walk-close]").forEach(b => b.addEventListener("click", close));
  overlay.querySelectorAll("[data-walk-exhibit]").forEach(b=>b.addEventListener("click",()=>{
    const spot=slots().find(s=>!s.piece&&!s.reservedForAds);
    if(spot)window.TEM.openExhibit(spot.size,spot.price,spot.id);
  }));
  overlay.querySelectorAll("[data-walk-hold]").forEach(b => {
    const action = b.dataset.walkHold;
    b.addEventListener("pointerdown", e => { e.preventDefault(); held.add(action); b.setPointerCapture(e.pointerId); });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(name, () => held.delete(action));
  });
  window.addEventListener("keydown", e => {
    if (!active || [...document.querySelectorAll("dialog")].some(d=>d.open)) return;
    if (e.code === "Escape") { e.preventDefault(); close(); return; }
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyZ","KeyQ","KeyA","KeyS","KeyD"].includes(e.code)) {
      e.preventDefault(); keys.add(e.code);
    }
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  window.addEventListener("blur", () => { keys.clear(); held.clear(); });
  window.addEventListener("resize", () => { if (active) { resize(); draw(); } });

  canvas.addEventListener("pointerdown", e => {
    if (!active) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, originalX: e.clientX, originalY: e.clientY, dragged: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if(!pointer){const r=canvas.getBoundingClientRect(),hx=e.clientX-r.left,hy=e.clientY-r.top;canvas.style.cursor=hits.some(h=>inside(h.points,hx,hy))?'pointer':'grab';return;}
    if (pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x,dy=e.clientY-pointer.y;
    if (Math.abs(e.clientX - pointer.originalX) > 7 || Math.abs(e.clientY - pointer.originalY) > 7) pointer.dragged = true;
    if (pointer.dragged) {view.yaw += dx * .005;view.pitch=limit(view.pitch-dy*.0035,-.62,.62);autoWalk=null;}
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  canvas.addEventListener("pointerup", e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!pointer.dragged) {
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      const selected = hits.filter(h => inside(h.points, x, y)).sort((a,b) => a.depth - b.depth)[0];
      if (selected) {autoWalk=null;if(selected.piece)window.TEM.openPiece(selected.piece);else if(selected.slot)window.TEM.openExhibit(selected.slot.size,selected.slot.price,selected.slot.id);}
      else if(y>H*.49&&Math.cos(view.yaw)>.35){autoWalk=Math.min(length-2.7,view.z+7);}
    }
    pointer = null;
  });
  canvas.addEventListener("pointercancel", () => pointer = null);
  window.addEventListener('tem:exhibited',()=>{if(active)draw()});
  requestAnimationFrame(open);
})();