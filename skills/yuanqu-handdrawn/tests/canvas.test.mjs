import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir, readdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import { renderCanvasScene, describeCanvasScene } from '../scripts/canvas.mjs';

const run = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const fixture = () => ({ version: 3, renderer: 'canvas', mode: 'object', seed: 73, texture: .9,
  source: { image: 'synthetic:material-patches', summary: 'Material test, no photo reconstruction.', people: 0 },
  layers: ['cloth', 'skin', 'eye'].map((material, i) => ({ id: material, type: 'rect', x: 60 + 320 * i, y: 120, width: 240, height: 760, radius: 30, material, fill: 'blue' })),
});
async function pixels(png) {
  const image = await loadImage(png), canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0); return { size: image.width, data: ctx.getImageData(0, 0, image.width, image.height).data };
}
const pixel = (img, x, y) => [...img.data.slice((y * img.size + x) * 4, (y * img.size + x) * 4 + 4)];

test('Canvas exports a real square opaque PNG and reproduces it from saved data', async () => {
  const a = await renderCanvasScene(fixture(), { size: 512 });
  const b = await renderCanvasScene(a.scene, { size: 512 });
  assert.deepEqual(a.png, b.png); assert.equal(a.report.sceneSha256, b.report.sceneSha256);
  const img = await pixels(a.png);
  assert.equal(img.size, 512);
  for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255);
  assert.equal(a.report.backend, 'js-canvas'); assert.equal(a.report.geometry, 'not-fixed');
  assert.equal(a.svg, undefined); assert.equal(a.report.styleReview.status, 'pending');
});

test('material zones keep eyes solid and faces much quieter than cloth', async () => {
  const img = await pixels((await renderCanvasScene(fixture(), { size: 512 })).png);
  const spread = x0 => {
    const values = [];
    for (let y = 100; y < 400; y++) for (let x = x0; x < x0 + 70; x++) values.push(pixel(img, x, y)[0]);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(spread(50) > 30); assert.ok(spread(210) < 10); assert.equal(spread(370), 0);
});

test('seed and brush direction change pigment while clean eye geometry stays unchanged', async () => {
  const scene = fixture(), a = await pixels((await renderCanvasScene(scene, { size: 512 })).png);
  scene.seed++;
  const b = await pixels((await renderCanvasScene(scene, { size: 512 })).png);
  scene.layers[0].flow = -60;
  const c = await pixels((await renderCanvasScene(scene, { size: 512 })).png);
  assert.notDeepEqual(a.data, b.data); assert.notDeepEqual(b.data, c.data);
  for (let y = 100; y < 400; y++) for (let x = 370; x < 430; x++) assert.deepEqual(pixel(a, x, y), pixel(c, x, y));
});

test('pale dry occluder hides underlying eyes and zero texture restores flat pigment', async () => {
  const s = fixture(); s.layers = [s.layers[2], { id: 'cover', type: 'rect', x: 680, y: 120, width: 240, height: 760, radius: 30, material: 'hair', fill: 'peach', opacity: .2 }];
  const a = await pixels((await renderCanvasScene(s, { size: 512 })).png);
  s.layers.shift();
  const b = await pixels((await renderCanvasScene(s, { size: 512 })).png);
  for (let y = 100; y < 400; y++) for (let x = 370; x < 430; x++) assert.deepEqual(pixel(a, x, y), pixel(b, x, y));
  const flat = fixture(); flat.texture = 0;
  const img = await pixels((await renderCanvasScene(flat, { size: 512 })).png);
  assert.deepEqual(pixel(img, 100, 200), pixel(img, 260, 200));
});

test('underpaint false adds a translucent light plane without covering the underlying cloth with paper', async () => {
  const s = fixture(); s.texture = 0;
  s.layers.push({ id: 'wash', type: 'rect', x: 100, y: 200, width: 120, height: 400, radius: 10, fill: 'blueLight', opacity: .2, underpaint: false });
  const img = await pixels((await renderCanvasScene(s, { size: 512 })).png);
  const p = pixel(img, 80, 160);
  assert.ok(p[0] > 65 && p[0] < 100); assert.ok(p[2] > p[0]);
});

test('offline HTML executes the shared painter without fetch, image assets or Node dependencies', async () => {
  const scene = fixture(); scene.source.summary = '</script><script>unsafe()</script>';
  const result = await renderCanvasScene(scene, { size: 512 });
  const scripts = [...result.html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const art = createCanvas(512, 512), button = {};
  runInNewContext(scripts[0][1], { document: {
    getElementById: id => id === 'art' ? art : button,
    createElement: () => createCanvas(1, 1),
  } });
  assert.deepEqual(art.toBuffer('image/png'), result.png);
  assert.equal(typeof button.onclick, 'function');
});

test('reject invalid data and allow custom pigments and actual 1254 output size', async () => {
  for (const mutate of [s => { s.layers[0].x = NaN; }, s => { s.layers[0].fill = '__proto__'; }, s => { s.layers[0].svg = '<script/>'; }, s => { s.layers[0].flow = 400; }, s => { s.layers[1].id = s.layers[0].id; }, s => { s.palette = { blue: 'red' }; }]) {
    const s = fixture(); mutate(s); assert.throws(() => describeCanvasScene(s));
  }
  assert.throws(() => describeCanvasScene(fixture(), { size: 4096 }));
  const s = fixture(); s.palette = { clothBlue: '#405878' }; s.layers[0].fill = 'clothBlue';
  assert.equal(describeCanvasScene(s, { size: 1254 }).report.size, 1254);
});

test('CLI reserves classified PNG, scene, HTML and report groups under concurrent collisions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuanqu-canvas-cli-'));
  try {
    const scene = join(dir, 'input.json'), out = join(dir, 'out');
    await writeFile(scene, JSON.stringify(fixture()));
    await mkdir(join(out, 'records'), { recursive: true }); await writeFile(join(out, 'records', '试验.generation.md'), '已有记录');
    const args = [join(root, 'scripts/render.mjs'), scene, '--out-dir', out, '--name', '试验', '--size', '512'];
    const results = await Promise.all([run(process.execPath, args), run(process.execPath, args)]);
    const outputs = results.map(r => JSON.parse(r.stdout));
    assert.notEqual(outputs[0].files.png, outputs[1].files.png);
    assert.deepEqual(await readFile(outputs[0].files.png), await readFile(outputs[1].files.png));
    for (const { files } of outputs) {
      assert.equal(dirname(files.png), join(out, 'images')); assert.equal(dirname(files.html), join(out, 'source'));
      assert.equal(files.svg, undefined);
      assert.deepEqual(JSON.parse(await readFile(files.report)).files, files);
    }
    assert.deepEqual((await readdir(out)).sort(), ['images', 'records', 'source']);
    assert.equal(await readFile(join(out, 'records', '试验.generation.md'), 'utf8'), '已有记录');
    await assert.rejects(run(process.execPath, [...args, '--svg-only']), e => /Canvas V3 produces PNG and HTML/.test(e.stderr));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Canvas check works without native modules and missing dependencies leave no fake output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuanqu-canvas-no-deps-'));
  try {
    for (const f of ['render.mjs', 'engine.mjs', 'canvas.mjs', 'canvas-core.mjs']) await cp(join(root, 'scripts', f), join(dir, f));
    const scene = join(dir, 'scene.json'), out = join(dir, 'out'); await writeFile(scene, JSON.stringify(fixture()));
    const args = [join(dir, 'render.mjs'), scene, '--out-dir', out];
    assert.equal(JSON.parse((await run(process.execPath, [...args, '--check'])).stdout).backend, 'js-canvas');
    await assert.rejects(run(process.execPath, args), e => /Canvas renderer is missing/.test(e.stderr));
    await assert.rejects(readdir(out), e => e.code === 'ENOENT');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
