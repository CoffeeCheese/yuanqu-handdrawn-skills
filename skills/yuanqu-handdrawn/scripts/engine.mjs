import { createHash } from 'node:crypto';

export const ENGINE_VERSION = '1.0.0';
export const PALETTE = Object.freeze({ paper: '#FFFFFF', blue: '#354B60', peach: '#EDB29A', none: 'none' });
const MODES = ['portrait', 'anime', 'object', 'travel', 'landscape'];
const VIEWS = ['front', 'three-quarter-left', 'three-quarter-right', 'profile-left', 'profile-right', 'back', 'hidden'];
const WIDTH = { front: 1, 'three-quarter-left': .82, 'three-quarter-right': .82, 'profile-left': .65, 'profile-right': .65, back: 1, hidden: 1 };
const ACCESSORIES = ['glasses', 'earring', 'hat', 'prop', 'beard', 'occluder'];
const EYES = ['open', 'closed', 'hidden'];
const fail = (path, reason) => { throw new Error(`${path}: ${reason}`); };
const own = (o, k) => Object.hasOwn(o, k);
function object(v, path, keys) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(path, 'expected an object');
  for (const k of Object.keys(v)) if (!keys.includes(k)) fail(`${path}.${k}`, 'unsupported field');
}
function number(v, path, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path, `expected a finite number in [${min}, ${max}]`);
  return v;
}
function string(v, path, max = 1000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(path, `expected nonempty text of at most ${max} characters`);
  return v;
}
function array(v, path, max) {
  if (!Array.isArray(v) || v.length > max) fail(path, `expected an array of at most ${max} items`);
}
function choice(v, path, values) {
  if (!values.includes(v)) fail(path, `expected one of: ${values.join(', ')}`);
}
const n = v => Number(v.toFixed(5));
function shape(v, path, local = false) {
  const bounds = local ? [-110, 110] : [0, 1000];
  const scalar = (value, key) => number(value, `${path}.${key}`, ...bounds);
  const allowed = ['type', 'fill', 'opacity', 'stroke', 'strokeWidth'];
  if (v?.type === 'path') allowed.push('segments');
  else if (v?.type === 'ellipse') allowed.push('cx', 'cy', 'rx', 'ry');
  else if (v?.type === 'rect') allowed.push('x', 'y', 'width', 'height', 'radius');
  object(v, path, allowed);
  choice(v.type, `${path}.type`, ['path', 'ellipse', 'rect']);
  const out = { ...v, fill: v.fill ?? 'blue', opacity: v.opacity ?? 1 };
  choice(out.fill, `${path}.fill`, Object.keys(PALETTE));
  number(out.opacity, `${path}.opacity`, .04, 1);
  if (own(v, 'stroke')) {
    choice(v.stroke, `${path}.stroke`, ['blue', 'peach', 'paper']);
    number(v.strokeWidth, `${path}.strokeWidth`, .1, local ? 6 : 24);
  } else if (own(v, 'strokeWidth')) fail(path, 'strokeWidth needs stroke');
  if (out.fill === 'none' && !out.stroke) fail(path, 'a shape needs visible fill or stroke');
  if (v.type === 'path') {
    array(v.segments, `${path}.segments`, 40);
    if (!v.segments.length || v.segments[0]?.[0] !== 'M') fail(path, 'path must start with M');
    const counts = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
    v.segments.forEach((s, i) => {
      if (!Array.isArray(s) || !own(counts, s[0]) || s.length !== counts[s[0]] + 1) fail(`${path}.segments[${i}]`, 'use numeric M/L/Q/C/Z segments');
      s.slice(1).forEach((value, j) => scalar(value, `segments[${i}][${j + 1}]`));
    });
    if (out.fill !== 'none' && v.segments.at(-1)[0] !== 'Z') fail(path, 'filled paths must end with Z');
  } else if (v.type === 'ellipse') {
    scalar(v.cx, 'cx'); scalar(v.cy, 'cy');
    number(v.rx, `${path}.rx`, .2, local ? 110 : 500);
    number(v.ry, `${path}.ry`, .2, local ? 110 : 500);
  } else {
    scalar(v.x, 'x'); scalar(v.y, 'y');
    number(v.width, `${path}.width`, .2, local ? 220 : 1000);
    number(v.height, `${path}.height`, .2, local ? 220 : 1000);
    number(v.radius, `${path}.radius`, .1, Math.min(v.width, v.height) / 2);
  }
  return out;
}
function shapes(v, path, max, local = false) {
  array(v, path, max);
  return v.map((s, i) => shape(s, `${path}[${i}]`, local));
}

export function validateScene(input) {
  object(input, 'scene', ['version', 'mode', 'seed', 'source', 'background', 'objects', 'bodies', 'heads']);
  if (input.version !== 1) fail('scene.version', 'expected 1');
  choice(input.mode, 'scene.mode', MODES);
  const scene = { ...input, seed: input.seed ?? 1, background: input.background ?? [], objects: input.objects ?? [], bodies: input.bodies ?? [], heads: input.heads ?? [] };
  number(scene.seed, 'scene.seed', 0, 4294967295);
  if (!Number.isInteger(scene.seed)) fail('scene.seed', 'seed must be an integer');
  object(scene.source, 'scene.source', ['image', 'summary', 'people', 'landmark']);
  string(scene.source.image, 'scene.source.image'); string(scene.source.summary, 'scene.source.summary', 4000);
  number(scene.source.people, 'scene.source.people', 0, 16);
  if (!Number.isInteger(scene.source.people)) fail('scene.source.people', 'people must be an integer');
  if (own(scene.source, 'landmark')) string(scene.source.landmark, 'scene.source.landmark');
  scene.background = shapes(scene.background, 'scene.background', 7);
  scene.objects = shapes(scene.objects, 'scene.objects', 48);
  scene.bodies = shapes(scene.bodies, 'scene.bodies', 48);
  array(scene.heads, 'scene.heads', 16);
  const ids = new Set();
  scene.heads = scene.heads.map((h, i) => {
    const p = `scene.heads[${i}]`;
    object(h, p, ['id', 'x', 'y', 'size', 'tilt', 'view', 'eyes', 'ears', 'features', 'hairBack', 'hairFront', 'accessories', 'blush']);
    string(h.id, `${p}.id`, 40);
    if (!/^[a-zA-Z0-9_-]+$/.test(h.id) || ids.has(h.id)) fail(`${p}.id`, 'use a unique alphanumeric ID');
    ids.add(h.id);
    number(h.x, `${p}.x`, 0, 1000); number(h.y, `${p}.y`, 0, 1000);
    number(h.size, `${p}.size`, 80, 700); number(h.tilt, `${p}.tilt`, -180, 180);
    choice(h.view, `${p}.view`, VIEWS);
    object(h.eyes, `${p}.eyes`, ['left', 'right']);
    for (const side of ['left', 'right']) choice(h.eyes[side], `${p}.eyes.${side}`, EYES);
    const visible = Object.values(h.eyes).filter(v => v !== 'hidden').length;
    if (['back', 'hidden'].includes(h.view) && visible) fail(p, 'back/hidden heads must have hidden eyes');
    if (h.view.startsWith('profile') && visible > 1) fail(p, 'profile heads can show at most one eye');
    array(h.features, `${p}.features`, 3); h.features.forEach((v, j) => string(v, `${p}.features[${j}]`, 200));
    const out = { ...h, ears: h.ears ?? [], blush: h.blush ?? true };
    array(out.ears, `${p}.ears`, 2);
    out.ears.forEach((s, j) => choice(s, `${p}.ears[${j}]`, ['left', 'right']));
    if (new Set(out.ears).size !== out.ears.length) fail(p, 'duplicate ears');
    if (h.view === 'hidden' && out.ears.length) fail(p, 'hidden heads cannot add ears');
    if (typeof out.blush !== 'boolean') fail(`${p}.blush`, 'expected boolean');
    out.hairBack = shapes(h.hairBack ?? [], `${p}.hairBack`, 6, true);
    out.hairFront = shapes(h.hairFront ?? [], `${p}.hairFront`, 6, true);
    const hairCount = out.hairBack.length + out.hairFront.length;
    if (hairCount !== 0 && (hairCount < 3 || hairCount > 6)) fail(p, 'use 3–6 hair blocks, or 0 for bald/fully covered heads');
    for (const s of [...out.hairBack, ...out.hairFront]) {
      if (s.fill === 'none') fail(p, 'hair blocks need solid fill');
      if (s.type === 'path' && s.segments.some(c => c[0] === 'L')) fail(p, 'hair outlines use rounded Q/C curves instead of straight L corners');
    }
    array(h.accessories ?? [], `${p}.accessories`, 3);
    out.accessories = (h.accessories ?? []).map((a, j) => {
      const ap = `${p}.accessories[${j}]`;
      object(a, ap, ['kind', 'shapes']); choice(a.kind, `${ap}.kind`, ACCESSORIES);
      const result = { ...a, shapes: shapes(a.shapes, `${ap}.shapes`, 8, true) };
      if (!result.shapes.length) fail(ap, 'accessory needs a shape');
      return result;
    });
    return out;
  });
  if (scene.heads.length !== scene.source.people) fail('scene.heads', 'head count must equal source.people, including back/hidden heads');
  if (['object', 'landscape'].includes(scene.mode) && (scene.heads.length || scene.bodies.length)) fail('scene.mode', 'object/landscape cannot contain people or bodies');
  if (['portrait', 'anime', 'travel'].includes(scene.mode) && !scene.heads.length) fail('scene.heads', 'this branch requires people');
  if (['portrait', 'anime', 'object'].includes(scene.mode) && scene.background.length) fail('scene.background', 'this branch uses blank paper');
  if (scene.mode === 'landscape' && (scene.background.length < 3 || scene.objects.length)) fail('scene.background', 'landscape uses 3–7 background blocks, no separate objects');
  if (scene.mode === 'object' && !scene.objects.length) fail('scene.objects', 'object branch needs a subject');
  if (scene.mode === 'travel' && (scene.background.length < 2 || scene.background.length > 5 || !scene.source.landmark)) fail('scene.background', 'travel needs one source landmark represented by 2–5 blocks');
  if (scene.mode === 'travel' && scene.background.some(s => s.opacity > .32)) fail('scene.background', 'travel background opacity must be at most 0.32');
  return scene;
}

function shapeBounds(s) {
  let b;
  if (s.type === 'ellipse') b = [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
  else if (s.type === 'rect') b = [s.x, s.y, s.x + s.width, s.y + s.height];
  else {
    const pairs = s.segments.flatMap(c => Array.from({ length: (c.length - 1) / 2 }, (_, i) => [c[i * 2 + 1], c[i * 2 + 2]]));
    b = [Math.min(...pairs.map(p => p[0])), Math.min(...pairs.map(p => p[1])), Math.max(...pairs.map(p => p[0])), Math.max(...pairs.map(p => p[1]))];
  }
  const padding = (s.strokeWidth ?? 0) / 2;
  return [b[0] - padding, b[1] - padding, b[2] + padding, b[3] + padding];
}
const union = boxes => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
function headBox(h) {
  const boxes = [...h.hairBack, ...h.hairFront, ...h.accessories.flatMap(a => a.shapes)].map(shapeBounds);
  if (h.view !== 'hidden') boxes.push([-50, -50, 50, 50]);
  if (h.ears.includes('left')) boxes.push([-63, -11, -43, 22]);
  if (h.ears.includes('right')) boxes.push([43, -11, 63, 22]);
  if (!boxes.length) fail(`head ${h.id}`, 'hidden head needs a visible occluding shape');
  const b = union(boxes), theta = h.tilt * Math.PI / 180;
  const sx = h.size * WIDTH[h.view] / 100, sy = h.size / 100;
  const corners = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, y]) => [h.x + x * sx * Math.cos(theta) - y * sy * Math.sin(theta), h.y + x * sx * Math.sin(theta) + y * sy * Math.cos(theta)]);
  return [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])), Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))];
}
export function sceneLayout(scene) {
  const boxes = [...scene.background, ...scene.objects, ...scene.bodies].map(shapeBounds).concat(scene.heads.map(headBox));
  if (!boxes.length) fail('scene', 'nothing to draw');
  const b = union(boxes), width = b[2] - b[0], height = b[3] - b[1];
  if (width <= 0 || height <= 0) fail('scene', 'empty bounds');
  const scale = 780 / Math.max(width, height);
  return { bounds: b.map(n), scale: n(scale), x: n(500 - scale * (b[0] + b[2]) / 2), y: n(500 - scale * (b[1] + b[3]) / 2), exactScale: scale };
}

function primitive(s, attributes = '') {
  if (s.type === 'path') return `<path d="${s.segments.map(c => c.map(v => typeof v === 'number' ? n(v) : v).join(' ')).join(' ')}" ${attributes}/>`;
  if (s.type === 'ellipse') return `<ellipse cx="${n(s.cx)}" cy="${n(s.cy)}" rx="${n(s.rx)}" ry="${n(s.ry)}" ${attributes}/>`;
  return `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.width)}" height="${n(s.height)}" rx="${n(s.radius)}" ${attributes}/>`;
}
function random(seed) {
  let v = seed >>> 0;
  return () => { v += 0x6D2B79F5; let t = Math.imul(v ^ v >>> 15, 1 | v); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const FACE = [['M', 0, -50], ['C', 34, -50, 50, -30, 50, 0], ['C', 50, 34, 30, 50, 0, 50], ['C', -30, 50, -50, 34, -50, 0], ['C', -50, -30, -34, -50, 0, -50], ['Z']];

export function renderScene(input, { size = 1024 } = {}) {
  if (![512, 1024, 2048].includes(size)) fail('size', 'supported sizes: 512, 1024, 2048');
  const scene = validateScene(input), layout = sceneLayout(scene);
  const minimumHead = scene.mode === 'travel' ? 95 : (scene.heads.length > 1 ? 150 : 260);
  for (const h of scene.heads) if (h.size * layout.exactScale < minimumHead) fail(`head ${h.id}`, `face too small after layout; require >= ${minimumHead} viewBox units`);
  let textureBudget = 120, counter = 0;
  const definitions = [], parts = [], eyes = [], heads = [];
  function draw(s, local = false, role = 'shape') {
    const style = `fill="${PALETTE[s.fill]}" opacity="${n(s.opacity)}"${s.stroke ? ` stroke="${PALETTE[s.stroke]}" stroke-width="${n(s.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"` : ''} data-role="${role}"`;
    // Opacity is pigment strength on paper; filled foreground blocks remain opaque.
    // This prevents a pale hair/hand/hat shape from leaking an occluded eye.
    const underpainting = !['paper', 'none'].includes(s.fill) ? primitive(s, `fill="${PALETTE.paper}"`) : '';
    let markup = underpainting + primitive(s, style);
    if (!['paper', 'none'].includes(s.fill) && textureBudget > 0) {
      const b = shapeBounds(s), w = b[2] - b[0], h = b[3] - b[1];
      if (w > (local ? 12 : 45) && h > (local ? 12 : 45)) {
        const id = `grain-${counter++}`, hash = createHash('sha256').update(JSON.stringify(s)).digest().readUInt32LE(0);
        const rng = random(scene.seed ^ hash), count = Math.min(8, textureBudget);
        textureBudget -= count;
        definitions.push(`<clipPath id="${id}">${primitive(s)}</clipPath>`);
        const dots = Array.from({ length: count }, () => {
          const edge = Math.floor(rng() * 4), a = rng(), inset = .035 + rng() * .025;
          const x = b[0] + w * (edge === 0 ? inset : edge === 1 ? 1 - inset : a);
          const y = b[1] + h * (edge === 2 ? inset : edge === 3 ? 1 - inset : a);
          const r = (local ? .24 : 1.25) * (.7 + rng() * .6);
          return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${PALETTE.paper}" opacity="0.16"/>`;
        }).join('');
        markup += `<g clip-path="url(#${id})">${dots}</g>`;
      }
    }
    return markup;
  }
  parts.push(...scene.background.map(s => draw(s, false, 'background')));
  parts.push(...scene.bodies.map(s => draw(s, false, 'body')));
  parts.push(...scene.objects.map(s => draw(s, false, 'object')));
  for (const h of scene.heads) {
    const content = [], sx = h.size * WIDTH[h.view] / 100, sy = h.size / 100;
    const skin = () => {
      content.push(primitive({ type: 'path', segments: FACE }, `fill="${PALETTE.paper}" data-role="skin-base"`));
      content.push(primitive({ type: 'path', segments: FACE }, `fill="${PALETTE.peach}" opacity="0.18" data-role="${h.view === 'back' ? 'head-back' : 'face'}"`));
    };
    if (h.view === 'back') skin();
    content.push(...h.hairBack.map(s => draw(s, true, 'hair-back')));
    for (const side of h.ears) {
      const geometry = `cx="${side === 'left' ? -53 : 53}" cy="5" rx="10" ry="16"`;
      content.push(`<ellipse ${geometry} fill="${PALETTE.paper}"/><ellipse ${geometry} fill="${PALETTE.peach}" opacity="0.28" data-role="ear-${side}"/>`);
    }
    if (!['hidden', 'back'].includes(h.view)) skin();
    const isFace = !['back', 'hidden'].includes(h.view);
    if (isFace) {
      // Scaling in X corrects perspective without changing each capsule's ratio.
      const faceWidth = 100 * WIDTH[h.view], eyeHeight = 20, eyeWidth = eyeHeight / 2.7;
      for (const side of ['left', 'right']) {
        const state = h.eyes[side];
        if (state === 'hidden') continue;
        let cx = side === 'left' ? -faceWidth * .16 : faceWidth * .16;
        if (h.view.startsWith('profile')) cx = h.view.endsWith('left') ? -faceWidth * .1 : faceWidth * .1;
        const extra = `data-role="eye-${state}" data-side="${side}"`;
        if (state === 'open') content.push(`<g transform="scale(${n(1 / WIDTH[h.view])} 1)"><rect x="${n(cx - eyeWidth / 2)}" y="-2" width="${n(eyeWidth)}" height="20" rx="${n(eyeWidth / 2)}" fill="${PALETTE.blue}" ${extra}/></g>`);
        else content.push(`<g transform="scale(${n(1 / WIDTH[h.view])} 1)"><path d="M ${n(cx - 3.5)} 8 Q ${n(cx)} 11 ${n(cx + 3.5)} 8" fill="none" stroke="${PALETTE.blue}" stroke-width="1.8" stroke-linecap="round" ${extra}/></g>`);
        eyes.push({ head: h.id, side, state, height: state === 'open' ? 20 : null, ratio: state === 'open' ? 2.7 : null });
      }
      if (h.blush) {
        const centers = h.view.startsWith('profile') ? [h.view.endsWith('left') ? -26 : 26] : [-30, 30];
        content.push(...centers.map(cx => `<ellipse cx="${cx}" cy="26" rx="10" ry="6" fill="${PALETTE.peach}" opacity="0.16" data-role="blush"/>`));
      }
    }
    // Front hair and accessories are painted after the eyes, preserving masks.
    content.push(...h.hairFront.map(s => draw(s, true, 'hair-front')));
    for (const a of h.accessories) content.push(...a.shapes.map(s => draw(s, true, `accessory-${a.kind}`)));
    parts.push(`<g data-head="${h.id}" transform="translate(${n(h.x)} ${n(h.y)}) rotate(${n(h.tilt)}) scale(${n(sx)} ${n(sy)})">${content.join('')}</g>`);
    heads.push({ id: h.id, view: h.view, tilt: h.tilt, faceHeight: n(h.size * layout.exactScale), hairBlocks: h.hairBack.length + h.hairFront.length });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000"><defs>${definitions.join('')}</defs><rect width="1000" height="1000" fill="${PALETTE.paper}"/><g transform="translate(${layout.x} ${layout.y}) scale(${layout.scale})">${parts.join('')}</g></svg>\n`;
  const report = {
    engine: ENGINE_VERSION, status: 'pending-source-review', geometry: 'passed',
    sceneSha256: createHash('sha256').update(JSON.stringify(scene)).digest('hex'),
    size, mode: scene.mode, seed: scene.seed, palette: PALETTE,
    rules: { faceAspectFront: 1, openEyeAspect: 2.7, eyeHeightToFaceHeight: .2, frontEyeCenterDistanceToFaceWidth: .32, paperMarginMinimum: .11, hairBlocks: '0 or 3–6', textureDotsMaximum: 120 },
    layout: { bounds: layout.bounds, scale: layout.scale, x: layout.x, y: layout.y },
    heads, eyes, textureDots: 120 - textureBudget,
    semanticReview: { status: 'pending', issues: [], note: 'Compare source identity, count, pose, occlusion, landmark and recognizability; geometry checks do not verify perception.' }
  };
  return { scene, svg, report };
}
