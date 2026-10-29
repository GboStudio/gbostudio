(() => {
  "use strict";
  const overlay = document.getElementById("walkOverlay");
  const canvas = document.getElementById("walkCanvas");
  if (!overlay || !canvas || !window.TEM) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const view = { x: 0, y: 1.72, z: 0.8, yaw: 0 };
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
    return {
      x: dx * Math.cos(view.yaw) - dz * Math.sin(view.yaw),
      y: p[1] - view.y,
      z: dx * Math.sin(view.yaw) + dz * Math.cos(view.yaw)
    };
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
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } else if (w > 22 && h > 25) {
      ctx.save(); path(points); ctx.clip();
      ctx.globalAlpha = .16; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + w * .68, y + h * .37, Math.max(6, w * .22), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (piece.category === "3d" || piece.category === "build") {
        ctx.strokeStyle = "rgba(30,35,30,.45)"; ctx.lineWidth = Math.max(1, w * .015);
        ctx.strokeRect(x + w * .28, y + h * .29, w * .44, h * .37);
      }
      ctx.restore();
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
  function drawEmpty(slot, pts) {
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ctx.save();path(pts);ctx.clip();
    const bg=ctx.createLinearGradient(x,y,x+w,y+h);
    bg.addColorStop(0,'#fdfcf8');bg.addColorStop(1,'#e5e1d4');
    ctx.fillStyle=bg;ctx.fill();
    ctx.fillStyle='rgba(130,143,104,.07)';
    for(let line=-h;line<w+h;line+=20){ctx.fillRect(x+line,y,1,Math.max(w,h));}
    if(w>30 && h>32){
      ctx.strokeStyle='#8f9c78';ctx.lineWidth=Math.max(1,Math.min(4,w*.014));
      ctx.setLineDash([Math.max(3,w*.04),Math.max(2,w*.025)]);
      ctx.strokeRect(x+w*.09,y+h*.09,w*.82,h*.82);ctx.setLineDash([]);
      const r=Math.min(w,h)*.1,cx=x+w*.5,cy=y+h*.38;
      ctx.strokeStyle='#69775a';ctx.lineWidth=Math.max(1,r*.17);
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-r*.5,cy);ctx.lineTo(cx+r*.5,cy);ctx.moveTo(cx,cy-r*.5);ctx.lineTo(cx,cy+r*.5);ctx.stroke();
      if(w>65&&h>52){
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='#263126';ctx.font='700 '+Math.max(9,Math.min(20,w*.09))+'px Arial';
        ctx.fillText('PLACE LIBRE',cx,y+h*.66,w*.84);
        ctx.fillStyle='#67765a';ctx.font='700 '+Math.max(9,Math.min(16,w*.073))+'px Arial';
        ctx.fillText(slot.price.toFixed(2).replace('.',',')+' € / 12 MOIS',cx,y+h*.80,w*.84);
      }
    }
    ctx.restore();
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
    if (f.kind === "art" || f.kind === "free") {
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

    const all = list(), allSlots = slots();
    allSlots.forEach((slot,i)=>{
      const z=5.7+i*step, side=i%2?1:-1;
      const x=side*(half-.075),s=slot.size;
      const pw=({mini:1.50,standard:1.95,large:2.45,xl:2.95}[s]||1.95);
      const ph=({mini:1.24,standard:1.7,large:1.95,xl:2.15}[s]||1.7);
      const low=(height-ph)/2,high=low+ph;
      add([[x,low,z-pw/2],[x,low,z+pw/2],[x,high,z+pw/2],[x,high,z-pw/2]],slot.piece?"#e6dfd3":"#f3f0e7",slot.piece?"#b8a994":"#829371",slot.piece?"art":"free",slot.piece,slot);
    });
    const structure = faces.filter(f => f.kind !== "art" && f.kind !== "free").sort((a,b) => b.depth - a.depth);
    const artworks = faces.filter(f => f.kind === "art" || f.kind === "free").sort((a,b) => b.depth - a.depth);
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
      Math.floor(view.z) + " / " + Math.floor(length) + " M  ·  " + all.length + " CRÉATIONS  ·  " + allSlots.filter(s=>!s.piece).length + " PLACES LIBRES";
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
    active = true; view.x = 0; view.z = .8; view.yaw = 0; autoWalk=null;
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
    const spot=slots().find(s=>!s.piece);
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
    const dx = e.clientX - pointer.x;
    if (Math.abs(e.clientX - pointer.originalX) > 7 || Math.abs(e.clientY - pointer.originalY) > 7) pointer.dragged = true;
    if (pointer.dragged) {view.yaw += dx * .005;autoWalk=null;}
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