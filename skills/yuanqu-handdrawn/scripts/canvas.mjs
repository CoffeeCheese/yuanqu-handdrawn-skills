import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CANVAS_VERSION, validateCanvasScene, drawCanvasScene } from './canvas-core.mjs';

export function describeCanvasScene(input, { size = 1024 } = {}) {
  if (!Number.isInteger(size) || size < 256 || size > 2048) throw new Error('Canvas size must be an integer between 256 and 2048');
  const scene = validateCanvasScene(input);
  return { scene, report: {
    engine: CANVAS_VERSION, backend: 'js-canvas', status: 'pending-source-review', validation: 'passed', geometry: 'not-fixed',
    sceneSha256: createHash('sha256').update(JSON.stringify(scene)).digest('hex'),
    seed: scene.seed, size, mode: scene.mode, layers: scene.layers.length, palette: scene.palette,
    externalModels: false, photoPixelsUsed: false,
    texture: { method: 'layer-local-directional-dry-pigment', strength: scene.texture, seed: scene.seed },
    semanticReview: { status: 'pending', issues: [] }, styleReview: { status: 'pending', issues: [] },
  } };
}

export async function renderCanvasScene(input, options = {}) {
  const result = describeCanvasScene(input, options);
  let createCanvas;
  try { ({ createCanvas } = await import('@napi-rs/canvas')); }
  catch { throw new Error('Canvas renderer is missing. Run npm ci --ignore-scripts --no-audit --no-fund in this skill directory.'); }
  const canvas = createCanvas(result.report.size, result.report.size);
  drawCanvasScene(result.scene, canvas, createCanvas);
  result.png = canvas.toBuffer('image/png');
  result.report.rasterizer = '@napi-rs/canvas@1.0.10';
  result.report.runtime = { node: process.version, platform: process.platform, arch: process.arch };
  const core = (await readFile(new URL('./canvas-core.mjs', import.meta.url), 'utf8')).replace(/^export /gm, '');
  const data = JSON.stringify(result.scene).replace(/</g, '\\u003c');
  result.html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>圆趣手绘 Canvas</title><style>body{margin:0;background:#eee;display:grid;place-items:center;min-height:100vh}canvas{max-width:95vw;max-height:95vh;width:auto;height:auto}button{position:fixed;right:20px;bottom:20px;padding:12px}</style><canvas id="art" width="${result.report.size}" height="${result.report.size}"></canvas><button id="save">保存 PNG</button><script>
${core}
const scene=${data};
const art=document.getElementById('art');
const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
drawCanvasScene(scene,art,make);
document.getElementById('save').onclick=()=>{const a=document.createElement('a');a.download='yuanqu-canvas.png';a.href=art.toDataURL('image/png');a.click();};
</script></html>`;
  return result;
}
