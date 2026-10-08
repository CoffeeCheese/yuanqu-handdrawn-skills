import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const PAINT_VERSION = 'paint-0.1.0';
export const PAINT_PALETTE = Object.freeze({
  paper: '#FFFEFB', blue: '#3E536B', blueLight: '#8797AA', hair: '#767D89',
  hairLight: '#C1ABA0', peach: '#EEB799', skin: '#FFE2C9', rose: '#EAB2A5',
  sage: '#7DA899', gold: '#D4AA70', wood: '#B67C60', none: 'none',
});
const MATERIALS = { paper: 0, skin: .22, hair: .85, cloth: 1, background: .7, detail: .38, eye: 0 };
const fail = (message) => { throw new Error(message); };
const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const counts = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };

export function validatePaintScene(input) {
  if (!input || input.version !== 2 || input.renderer !== 'paint') fail('Use version: 2, renderer: paint');
  if (!['portrait', 'anime', 'object', 'travel', 'landscape'].includes(input.mode)) fail('Invalid mode');
  if (!Number.isInteger(input.seed) || !finite(input.seed, 0, 4294967295)) fail('Invalid seed');
  if (!input.source || typeof input.source.image !== 'string' || !input.source.image.trim() || typeof input.source.summary !== 'string' || !input.source.summary.trim()) fail('Source image and summary are required');
  if (!Number.isInteger(input.source.people) || !finite(input.source.people, 0, 16)) fail('Invalid source.people');
  if (!Array.isArray(input.layers) || !input.layers.length || input.layers.length > 500) fail('Use 1–500 ordered layers');
  if (!finite(input.texture ?? .75, 0, 1)) fail('Texture must be between 0 and 1');
  const ids = new Set();
  const layers = input.layers.map((s, i) => {
    const at = `layers[${i}]`;
    const common = ['id', 'type', 'fill', 'opacity', 'stroke', 'strokeWidth', 'material', 'grain', 'underpaint'];
    const specific = s.type === 'path' ? ['segments'] : s.type === 'ellipse' ? ['cx', 'cy', 'rx', 'ry'] : s.type === 'rect' ? ['x', 'y', 'width', 'height', 'radius'] : [];
    if (!specific.length || Object.keys(s).some(k => ![...common, ...specific].includes(k))) fail(`${at}: unsupported shape or field`);
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(s.id) || ids.has(s.id)) fail(`${at}: unique alphanumeric ID required`);
    ids.add(s.id);
    const result = { ...s, fill: s.fill ?? 'blue', opacity: s.opacity ?? 1, material: s.material ?? 'detail', underpaint: s.underpaint ?? true };
    if (!Object.hasOwn(PAINT_PALETTE, result.fill) || !Object.hasOwn(MATERIALS, result.material)) fail(`${at}: invalid pigment or material`);
    if (!finite(result.opacity, .01, 1)) fail(`${at}: invalid opacity`);
    if (typeof result.underpaint !== 'boolean') fail(`${at}: underpaint must be boolean`);
    if (s.grain !== undefined && !finite(s.grain, 0, 1)) fail(`${at}: invalid grain`);
    if (s.stroke !== undefined && (!Object.hasOwn(PAINT_PALETTE, s.stroke) || s.stroke === 'none' || !finite(s.strokeWidth, .1, 40))) fail(`${at}: invalid stroke`);
    if (s.stroke === undefined && s.strokeWidth !== undefined) fail(`${at}: strokeWidth needs stroke`);
    if (result.fill === 'none' && !s.stroke) fail(`${at}: empty shape`);
    if (s.type === 'path') {
      if (!Array.isArray(s.segments) || !s.segments.length || s.segments.length > 120 || s.segments[0]?.[0] !== 'M') fail(`${at}: invalid path`);
      for (const c of s.segments) if (!Array.isArray(c) || !Object.hasOwn(counts, c[0]) || c.length !== counts[c[0]] + 1 || c.slice(1).some(v => !finite(v, 0, 1000))) fail(`${at}: use numeric M/L/Q/C/Z segments in 0–1000`);
      if (result.fill !== 'none' && s.segments.at(-1)[0] !== 'Z') fail(`${at}: filled path must close`);
    } else {
      for (const k of specific) if (!finite(s[k], 0, 1000)) fail(`${at}: invalid ${k}`);
      if (s.type === 'ellipse' && (!s.rx || !s.ry || s.cx - s.rx < 0 || s.cy - s.ry < 0 || s.cx + s.rx > 1000 || s.cy + s.ry > 1000)) fail(`${at}: ellipse outside canvas`);
      if (s.type === 'rect' && (!s.width || !s.height || s.x + s.width > 1000 || s.y + s.height > 1000 || s.radius > Math.min(s.width, s.height) / 2)) fail(`${at}: invalid rectangle`);
    }
    return result;
  });
  return { version: 2, renderer: 'paint', mode: input.mode, seed: input.seed, source: input.source, texture: input.texture ?? .75, layers };
}

function primitive(s, attrs) {
  if (s.type === 'path') return `<path d="${s.segments.map(c => c.join(' ')).join(' ')}" ${attrs}/>`;
  if (s.type === 'ellipse') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs}/>`;
  return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.radius}" ${attrs}/>`;
}

export function describePaintScene(input, { size = 1024 } = {}) {
  if (![512, 1024, 2048].includes(size)) fail('Supported sizes: 512, 1024, 2048');
  const scene = validatePaintScene(input);
  const parts = [], masks = [];
  for (const s of scene.layers) {
    const filled = s.fill !== 'none';
    if (filled && s.underpaint) parts.push(primitive(s, `fill="${PAINT_PALETTE.paper}"`));
    const stroke = s.stroke ? `stroke="${PAINT_PALETTE[s.stroke]}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : '';
    parts.push(primitive(s, `fill="${PAINT_PALETTE[s.fill]}" opacity="${s.opacity}" ${stroke}`));
    const weight = s.grain ?? MATERIALS[s.material];
    const gray = Math.round(weight * 255).toString(16).padStart(2, '0');
    const color = `#${gray}${gray}${gray}`;
    masks.push(primitive(s, `fill="${filled ? color : 'none'}" ${s.stroke ? `stroke="${color}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : ''}`));
  }
  const wrap = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="${bg}"/>${body}</svg>`;
  return { scene, svg: wrap(parts.join(''), PAINT_PALETTE.paper), mask: wrap(masks.join(''), '#000000'), report: {
    engine: PAINT_VERSION, status: 'pending-source-review', geometry: 'not-fixed', validation: 'passed',
    sceneSha256: createHash('sha256').update(JSON.stringify(scene)).digest('hex'),
    seed: scene.seed, size, mode: scene.mode, layers: scene.layers.length, palette: PAINT_PALETTE,
    externalModels: false, semanticReview: { status: 'pending', issues: [], note: 'Compare actual source and style reference; numeric validation does not establish identity or style similarity.' },
  } };
}

function noise(x, y, seed) {
  let v = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), payload = Buffer.concat([name, data]);
  let crc = 0xFFFFFFFF;
  for (const b of payload) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
function encodeRgba(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const stride = width * 4, scanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

export async function renderPaintScene(input, options = {}) {
  const result = describePaintScene(input, options);
  let Resvg;
  try { ({ Resvg } = await import('@resvg/resvg-js')); }
  catch { throw new Error('Paint renderer is missing. Run npm ci in this skill directory; V2 also needs Resvg for the SVG grain layer.'); }
  const opts = { font: { loadSystemFonts: false } };
  const base = new Resvg(result.svg, opts).render();
  const mask = new Resvg(result.mask, opts).render().pixels;
  const overlay = Buffer.alloc(base.width * base.height * 4);
  const texture = result.scene.texture, seed = result.scene.seed;
  // Grain is applied to the drawn pigments, not sampled from the user's photo.
  // The material mask protects capsule eyes and allows different pigment coverage.
  for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
    const i = (y * base.width + x) * 4, weight = mask[i] / 255;
    const u = noise(x, y, seed), coarse = noise(Math.floor(x / 4), Math.floor(y / 3), seed ^ 39281);
    const mottling = noise(Math.floor(x / 17), Math.floor(y / 13), seed ^ 948271);
    const fleck = u > .72 ? (u - .72) / .28 : 0;
    const alpha = texture * (weight * (.035 + fleck * .48 + (coarse > .75 ? .12 : 0) + (mottling > .82 ? .06 : 0)) + .009 * u);
    overlay[i] = 255; overlay[i + 1] = 253; overlay[i + 2] = 247;
    overlay[i + 3] = Math.round(alpha * 255);
  }
  const grain = encodeRgba(base.width, base.height, overlay);
  result.svg = result.svg.replace('</svg>', `<image width="1000" height="1000" href="data:image/png;base64,${grain.toString('base64')}"/></svg>`);
  result.png = new Resvg(result.svg, opts).render().asPng();
  delete result.mask;
  result.report.rasterizer = '@resvg/resvg-js@2.6.2';
  result.report.runtime = { node: process.version, platform: process.platform, arch: process.arch };
  result.report.texture = { seed, strength: texture, method: 'seeded-pigment-grain', embeddedRasterOverlay: true };
  return result;
}
