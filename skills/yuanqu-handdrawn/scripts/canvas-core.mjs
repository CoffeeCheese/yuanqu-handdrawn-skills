// Shared Canvas 2D painter: Node and the exported offline HTML use this same code.
export const CANVAS_VERSION = 'canvas-1.0.0';
export const CANVAS_PALETTE = Object.freeze({
  paper: '#FFFEFC', blue: '#405A78', blueLight: '#AFC4D9', hair: '#555664',
  hairLight: '#A78370', peach: '#F1B497', skin: '#FFE3CD', rose: '#F4BBA9',
  sage: '#8DAE9F', gold: '#D8B887', wood: '#C19377', none: 'none',
});
const materials = {
  paper: [0, 0], skin: [.055, .08], hair: [.85, .7], cloth: [.85, .7],
  background: [.55, .9], detail: [.25, .25], eye: [0, 0],
};
const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const fail = message => { throw new Error(message); };
const commands = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };

export function validateCanvasScene(input) {
  if (!input || input.version !== 3 || input.renderer !== 'canvas') fail('Use version: 3, renderer: canvas');
  if (!['portrait', 'anime', 'object', 'travel', 'landscape'].includes(input.mode)) fail('Invalid mode');
  if (!Number.isInteger(input.seed) || !finite(input.seed, 0, 4294967295)) fail('Invalid seed');
  if (!finite(input.texture ?? .8, 0, 1)) fail('Texture must be between 0 and 1');
  const source = input.source;
  if (!source || typeof source.image !== 'string' || !source.image.trim() || typeof source.summary !== 'string' || !source.summary.trim() || !Number.isInteger(source.people) || !finite(source.people, 0, 16)) fail('Source image, summary and people are required');
  if (source.styleReference !== undefined && (typeof source.styleReference !== 'string' || !source.styleReference.trim())) fail('Invalid styleReference');
  const palette = { ...CANVAS_PALETTE };
  if (input.palette !== undefined) {
    if (!input.palette || typeof input.palette !== 'object' || Array.isArray(input.palette) || Object.keys(input.palette).length > 36) fail('Use at most 36 pigments');
    for (const [key, value] of Object.entries(input.palette)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(key) || ['none', '__proto__', 'constructor', 'prototype'].includes(key) || typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail('Palette entries must be pigment names and six-digit hex colors');
      palette[key] = value;
    }
  }
  if (Object.keys(palette).length > 37) fail('Use at most 36 pigments');
  if (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > 500) fail('Use 1–500 ordered layers');
  const ids = new Set();
  const layers = input.layers.map((s, i) => {
    const at = `layers[${i}]`;
    if (!s || typeof s !== 'object') fail(`${at}: invalid shape`);
    const fields = s.type === 'path' ? ['segments'] : s.type === 'ellipse' ? ['cx', 'cy', 'rx', 'ry'] : s.type === 'rect' ? ['x', 'y', 'width', 'height', 'radius'] : [];
    const common = ['id', 'type', 'fill', 'opacity', 'stroke', 'strokeWidth', 'material', 'grain', 'edge', 'flow', 'underpaint'];
    if (!fields.length || Object.keys(s).some(k => ![...common, ...fields].includes(k))) fail(`${at}: unsupported shape or field`);
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(s.id) || ids.has(s.id)) fail(`${at}: unique alphanumeric ID required`);
    ids.add(s.id);
    const r = { ...s, fill: s.fill ?? 'blue', opacity: s.opacity ?? 1, material: s.material ?? 'detail', underpaint: s.underpaint ?? true, flow: s.flow ?? 25 };
    if (!Object.hasOwn(palette, r.fill) || !Object.hasOwn(materials, r.material)) fail(`${at}: invalid pigment or material`);
    if (!finite(r.opacity, .01, 1) || !finite(r.flow, -180, 180) || typeof r.underpaint !== 'boolean') fail(`${at}: invalid opacity, flow or underpaint`);
    for (const k of ['grain', 'edge']) if (s[k] !== undefined && !finite(s[k], 0, 1)) fail(`${at}: invalid ${k}`);
    if (s.stroke !== undefined && (!Object.hasOwn(palette, s.stroke) || s.stroke === 'none' || !finite(s.strokeWidth, .1, 40))) fail(`${at}: invalid stroke`);
    if (s.stroke === undefined && s.strokeWidth !== undefined) fail(`${at}: strokeWidth needs stroke`);
    if (r.fill === 'none' && !s.stroke) fail(`${at}: empty shape`);
    if (s.type === 'path') {
      if (!Array.isArray(s.segments) || !s.segments.length || s.segments.length > 240 || s.segments[0]?.[0] !== 'M') fail(`${at}: invalid path`);
      for (const c of s.segments) if (!Array.isArray(c) || !Object.hasOwn(commands, c[0]) || c.length !== commands[c[0]] + 1 || c.slice(1).some(v => !finite(v, 0, 1000))) fail(`${at}: use numeric M/L/Q/C/Z segments in 0–1000`);
      if (r.fill !== 'none' && s.segments.at(-1)[0] !== 'Z') fail(`${at}: filled path must close`);
    } else {
      for (const k of fields) if (!finite(s[k], 0, 1000)) fail(`${at}: invalid ${k}`);
      if (s.type === 'ellipse' && (!s.rx || !s.ry || s.cx - s.rx < 0 || s.cy - s.ry < 0 || s.cx + s.rx > 1000 || s.cy + s.ry > 1000)) fail(`${at}: ellipse outside canvas`);
      if (s.type === 'rect' && (!s.width || !s.height || s.x + s.width > 1000 || s.y + s.height > 1000 || s.radius > Math.min(s.width, s.height) / 2)) fail(`${at}: invalid rectangle`);
    }
    return r;
  });
  const { none, ...pigments } = palette;
  return { version: 3, renderer: 'canvas', mode: input.mode, seed: input.seed, texture: input.texture ?? .8, source: { image: source.image, summary: source.summary, people: source.people, ...(source.styleReference ? { styleReference: source.styleReference } : {}) }, palette: pigments, layers };
}

function hash(x, y, seed) {
  let v = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
function layerSeed(seed, id) {
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619) >>> 0;
  return seed;
}
function trace(ctx, s) {
  ctx.beginPath();
  if (s.type === 'path') {
    for (const [op, ...args] of s.segments) {
      if (op === 'M') ctx.moveTo(...args);
      else if (op === 'L') ctx.lineTo(...args);
      else if (op === 'Q') ctx.quadraticCurveTo(...args);
      else if (op === 'C') ctx.bezierCurveTo(...args);
      else ctx.closePath();
    }
  } else if (s.type === 'ellipse') ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2);
  else ctx.roundRect(s.x, s.y, s.width, s.height, s.radius);
}
function bounds(s, size) {
  let xs = [], ys = [];
  if (s.type === 'path') for (const c of s.segments) for (let i = 1; i < c.length; i += 2) { xs.push(c[i]); ys.push(c[i + 1]); }
  else if (s.type === 'ellipse') { xs = [s.cx - s.rx, s.cx + s.rx]; ys = [s.cy - s.ry, s.cy + s.ry]; }
  else { xs = [s.x, s.x + s.width]; ys = [s.y, s.y + s.height]; }
  const pad = (s.strokeWidth ?? 0) / 2 + 3, unit = size / 1000;
  const x = Math.max(0, Math.floor((Math.min(...xs) - pad) * unit)), y = Math.max(0, Math.floor((Math.min(...ys) - pad) * unit));
  return { x, y, w: Math.min(size, Math.ceil((Math.max(...xs) + pad) * unit)) - x, h: Math.min(size, Math.ceil((Math.max(...ys) + pad) * unit)) - y };
}

export function drawCanvasScene(input, canvas, createCanvas) {
  const scene = validateCanvasScene(input), size = canvas.width;
  if (canvas.height !== size || !Number.isInteger(size) || size < 256 || size > 2048) fail('Use a square canvas, integer size 256–2048');
  const ctx = canvas.getContext('2d'), palette = scene.palette, unit = size / 1000;
  ctx.fillStyle = palette.paper; ctx.fillRect(0, 0, size, size);
  // Paper is painted first; no global noise overlay can dirty the capsule eyes.
  const paper = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, shade = Math.round(scene.texture * hash(x, y, scene.seed) * 1.4);
    for (let c = 0; c < 3; c++) paper.data[i + c] -= shade;
  }
  ctx.putImageData(paper, 0, 0);
  for (const s of scene.layers) {
    const b = bounds(s, size), layer = createCanvas(b.w, b.h), lctx = layer.getContext('2d');
    const draw = (target, paperOnly = false) => {
      target.save(); target.scale(unit, unit); trace(target, s);
      target.lineJoin = 'round'; target.lineCap = 'round'; target.lineWidth = s.strokeWidth ?? 0;
      target.globalAlpha = paperOnly ? 1 : s.opacity;
      if (s.fill !== 'none') { target.fillStyle = paperOnly ? palette.paper : palette[s.fill]; target.fill(); }
      if (s.stroke) { target.strokeStyle = paperOnly ? palette.paper : palette[s.stroke]; target.stroke(); }
      target.restore();
    };
    lctx.translate(-b.x, -b.y); draw(lctx);
    const pixels = lctx.getImageData(0, 0, b.w, b.h), data = pixels.data;
    const strength = (s.grain ?? materials[s.material][0]) * scene.texture;
    const edge = (s.edge ?? materials[s.material][1]) * scene.texture;
    const seed = layerSeed(scene.seed, s.id);
    if (edge) {
      const original = new Uint8ClampedArray(data);
      // Local contour displacement roughens the actual painted edge, not a final-image overlay.
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const gx = (b.x + x) / unit, gy = (b.y + y) / unit;
        const dx = (smoothNoise(gx / 6, gy / 6, seed ^ 112) - .5) * edge * 3.4 * unit;
        const dy = (smoothNoise(gx / 6, gy / 6, seed ^ 171) - .5) * edge * 3.4 * unit;
        const sx = x + dx, sy = y + dy, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        const sample = (xx, yy, c) => xx < 0 || yy < 0 || xx >= b.w || yy >= b.h ? 0 : original[(yy * b.w + xx) * 4 + c];
        const i = (y * b.w + x) * 4;
        // Interpolate premultiplied pigment so white/pale edges cannot acquire black fringes.
        let totalAlpha = 0; const rgb = [0, 0, 0];
        for (const [xx, yy, w] of [[ix, iy, (1-fx)*(1-fy)], [ix+1, iy, fx*(1-fy)], [ix, iy+1, (1-fx)*fy], [ix+1, iy+1, fx*fy]]) {
          const a = sample(xx, yy, 3) * w; totalAlpha += a;
          for (let c = 0; c < 3; c++) rgb[c] += sample(xx, yy, c) * a;
        }
        data[i + 3] = Math.round(totalAlpha);
        for (let c = 0; c < 3; c++) data[i + c] = totalAlpha ? Math.round(rgb[c] / totalAlpha) : 0;
      }
    }
    // Underpaint follows the same rough contour and stays opaque behind the dry pigment gaps.
    if (s.underpaint) {
      const undercoat = lctx.createImageData(b.w, b.h), rgb = palette.paper.slice(1).match(/../g).map(v => parseInt(v, 16));
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) undercoat.data[i + c] = rgb[c];
        undercoat.data[i + 3] = Math.min(255, Math.round(data[i + 3] / s.opacity));
      }
      lctx.putImageData(undercoat, 0, 0); ctx.drawImage(layer, b.x, b.y);
    }
    if (strength || edge) {
      const rad = s.flow * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      const alpha = new Uint8Array(b.w * b.h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      const step = Math.max(1, Math.round(1.6 * unit));
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const at = y * b.w + x, i = at * 4;
        if (!alpha[at]) continue;
        const gx = (b.x + x) / unit, gy = (b.y + y) / unit;
        const u = gx * cos + gy * sin, v = -gx * sin + gy * cos;
        const patch = smoothNoise(gx / 23, gy / 19, seed);
        const fibre = smoothNoise(u / 15, v / .75, seed ^ 93817);
        const micro = smoothNoise(gx / .6, gy / .45, seed ^ 4817);
        // Correlated dry pigment: broad coverage, directional fibres, sparse local paper gaps.
        const holes = micro > .6 ? (micro - .6) / .4 * (.35 + patch * .5) : 0;
        let coverage = 1 - strength * (.025 + patch * .045 + fibre * .045 + holes);
        const nearEdge = x < step || y < step || x + step >= b.w || y + step >= b.h ||
          Math.min(alpha[at - step], alpha[at + step], alpha[at - step * b.w], alpha[at + step * b.w]) < s.opacity * 100;
        if (nearEdge) coverage *= 1 - edge * smoothNoise(gx / 1.7, gy / 1.7, seed ^ 899) * .8;
        data[i + 3] = Math.round(alpha[at] * coverage);
        // Paper-white suit planes retain their clean tone; structure comes from authored planes.
        if (Math.min(data[i], data[i + 1], data[i + 2]) < 205) {
          const tone = 1 + strength * (patch - .5) * .025;
          for (let c = 0; c < 3; c++) data[i + c] = Math.round(Math.min(255, data[i + c] * tone));
        }
      }
    }
    lctx.putImageData(pixels, 0, 0);
    ctx.drawImage(layer, b.x, b.y);
  }
  return scene;
}
