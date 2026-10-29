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
    design: ["#8dc4cb", "#1b3f54"],
    "3d": ["#d9caba", "#8b7b74"],
    build: ["#879c82", "#d6c7a7"],
    words: ["#f0e6d5", "#b9a7a0"],
    weird: ["#d2d96c", "#c288a5"]
  };
  let active = false, raf = 0, lastTime = 0, W = 1, H = 1, F = 1, length = 30;
  let hits = [], pointer = null, lastFocus = null;
  const imageCache = new Map();

  function list() { return window.TEM.getPieces(); }
  function galleryLength() { return Math.max(25, 9 + list().length * step); }
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
  function paint(f) {
    path(f.points);
    if (f.kind === "art") {
      ctx.fillStyle = "#fffdfa"; ctx.fill();
      ctx.lineWidth = Math.max(2, Math.min(9, F / (f.depth + 1) * .065));
      ctx.strokeStyle = "#ddd5c5"; ctx.stroke();
      drawArt(f.piece, f.points);
      path(f.points); ctx.strokeStyle = "#c5bbae"; ctx.stroke();
      hits.push({ points: f.points, depth: f.depth, piece: f.piece });
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
    function add(vertices, fill, stroke, kind, piece) {
      const f = face(vertices, fill, stroke, kind, piece);
      if (f && f.depth > -step && f.depth < 160) faces.push(f);
    }
    for (let i = 0; i < n; i++) {
      const z0 = i * step, z1 = Math.min(length, (i + 1) * step);
      add([[-half, 0, z0], [half, 0, z0], [half, 0, z1], [-half, 0, z1]], i % 2 ? "#d9d4c9" : "#dfd9ce", "#c5beb1", "floor");
      add([[-half, height, z0], [half, height, z0], [half, height, z1], [-half, height, z1]], "#f8f7f2", "#e4e0d6", "ceiling");
      add([[-half, 0, z0], [-half, height, z0], [-half, height, z1], [-half, 0, z1]], i % 2 ? "#edeae3" : "#f2f0ea", "#dad7ce", "wall");
      add([[half, 0, z0], [half, height, z0], [half, height, z1], [half, 0, z1]], i % 2 ? "#e8e5dd" : "#efede7", "#d7d3c8", "wall");
      add([[-half + .025, 0, z0], [-half + .025, .17, z0], [-half + .025, .17, z1], [-half + .025, 0, z1]], "#bdb6aa", null, "baseboard");
      add([[half - .025, 0, z0], [half - .025, .17, z0], [half - .025, .17, z1], [half - .025, 0, z1]], "#bdb6aa", null, "baseboard");
    }
    add([[-half, 0, length], [half, 0, length], [half, height, length], [-half, height, length]], "#e5e0d5", "#cac3b6", "end");

    const all = list();
    all.forEach((piece, i) => {
      const z = 5.7 + i * step, side = i % 2 ? 1 : -1;
      const x = side * (half - .075);
      const pw = ({mini: 1.5, standard: 1.95, large: 2.45, xl: 2.95}[piece.size] || 1.95);
      const ph = ({mini: 1.25, standard: 1.7, large: 1.95, xl: 2.15}[piece.size] || 1.7);
      const low = (height - ph) / 2, high = low + ph;
      add([[x, low, z - pw / 2], [x, low, z + pw / 2], [x, high, z + pw / 2], [x, high, z - pw / 2]], "#e6dfd3", "#b8a994", "art", piece);
    });
    const structure = faces.filter(f => f.kind !== "art").sort((a,b) => b.depth - a.depth);
    const artworks = faces.filter(f => f.kind === "art").sort((a,b) => b.depth - a.depth);
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
    document.getElementById("walkProgress").textContent =
      "ORIGINAL WALL 2026  ·  " + Math.floor(view.z) + " / " + Math.floor(length) + " M  ·  " + all.length + " PIÈCES";
    document.getElementById("walkMeter").style.width = (100 * view.z / length) + "%";
  }
  function tick(time) {
    if (!active) return;
    const dt = Math.min(.05, (time - (lastTime || time)) / 1000);
    lastTime = time;
    function pressed(...codes) { return codes.some(c => keys.has(c) || held.has(c)); }
    const turn = (pressed("ArrowRight", "turn-right") ? 1 : 0) - (pressed("ArrowLeft", "turn-left") ? 1 : 0);
    const forward = (pressed("ArrowUp", "KeyW", "KeyZ", "forward") ? 1 : 0) - (pressed("ArrowDown", "KeyS", "back") ? 1 : 0);
    const strafe = (pressed("KeyD") ? 1 : 0) - (pressed("KeyA", "KeyQ") ? 1 : 0);
    view.yaw = limit(view.yaw + turn * dt * 1.28, -.93, .93);
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
    active = true; view.x = 0; view.z = .8; view.yaw = 0;
    overlay.hidden = false;
    document.body.classList.add("walk-is-open");
    resize(); lastTime = 0;
    raf = requestAnimationFrame(tick);
    overlay.querySelector(".walk-close").focus();
  }
  function close() {
    if (!active) return;
    active = false; cancelAnimationFrame(raf);
    held.clear(); keys.clear(); pointer = null;
    overlay.hidden = true; document.body.classList.remove("walk-is-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll("[data-walk-open]").forEach(b => b.addEventListener("click", open));
  overlay.querySelectorAll("[data-walk-close]").forEach(b => b.addEventListener("click", close));
  overlay.querySelectorAll("[data-walk-hold]").forEach(b => {
    const action = b.dataset.walkHold;
    b.addEventListener("pointerdown", e => { e.preventDefault(); held.add(action); b.setPointerCapture(e.pointerId); });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(name, () => held.delete(action));
  });
  window.addEventListener("keydown", e => {
    if (!active || document.getElementById("piece").open) return;
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
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x;
    if (Math.abs(e.clientX - pointer.originalX) > 7 || Math.abs(e.clientY - pointer.originalY) > 7) pointer.dragged = true;
    if (pointer.dragged) view.yaw = limit(view.yaw + dx * .005, -.93, .93);
    pointer.x = e.clientX; pointer.y = e.clientY;
  });
  canvas.addEventListener("pointerup", e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!pointer.dragged) {
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      const selected = hits.filter(h => inside(h.points, x, y)).sort((a,b) => a.depth - b.depth)[0];
      if (selected) window.TEM.openPiece(selected.piece);
    }
    pointer = null;
  });
  canvas.addEventListener("pointercancel", () => pointer = null);
})();