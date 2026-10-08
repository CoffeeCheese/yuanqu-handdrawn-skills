import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, readdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import { renderScene, PALETTE } from '../scripts/engine.mjs';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const example = async mode => JSON.parse(await readFile(join(root, 'references/examples', `${mode}.json`), 'utf8'));
const raster = svg => new Resvg(svg, { font: { loadSystemFonts: false } }).render();
const pixel = (image, x, y) => [...image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
const canonicalPixel = (image, report, x, y) => pixel(image, Math.round((report.layout.x + report.layout.scale * x) * image.width / 1000), Math.round((report.layout.y + report.layout.scale * y) * image.height / 1000));

for (const mode of ['portrait', 'anime', 'object', 'travel', 'landscape']) {
  test(`${mode}: native PNG is square, opaque and has white margins`, async () => {
    const { svg, report } = renderScene(await example(mode), { size: 512 });
    const image = raster(svg), data = image.pixels;
    assert.equal(image.width, 512); assert.equal(image.height, 512);
    const margin = Math.floor(image.width * .105);
    let colored = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      assert.equal(data[i + 3], 255);
      const white = data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255;
      if (x < margin || x >= image.width - margin || y < margin || y >= image.height - margin) assert.ok(white, `ink outside margin at ${x},${y}`);
      if (!white) colored++;
    }
    assert.ok(colored > 1000);
    assert.equal(report.status, 'pending-source-review');
    assert.equal(report.geometry, 'passed');
  });
}

test('same saved data and seed reproduce SVG and PNG bytes', async () => {
  const input = await example('portrait');
  const a = renderScene(input), b = renderScene(a.scene);
  assert.equal(a.svg, b.svg);
  assert.equal(a.report.sceneSha256, b.report.sceneSha256);
  assert.deepEqual(raster(a.svg).asPng(), raster(b.svg).asPng());
  input.seed++;
  const c = renderScene(input);
  assert.notEqual(c.svg, a.svg);
  assert.deepEqual(c.report.heads, a.report.heads);
  assert.deepEqual(c.report.eyes, a.report.eyes);
});

test('SVG paints only two pigments and paper, with no text, gradient or embedded resources', async () => {
  for (const mode of ['portrait', 'anime', 'object', 'travel', 'landscape']) {
    const { svg, report } = renderScene(await example(mode));
    const paints = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(m => m[1]);
    for (const paint of paints) assert.ok(Object.values(PALETTE).includes(paint));
    assert.doesNotMatch(svg, /<(?:text|image|script|linearGradient|radialGradient|foreignObject)\b/);
    assert.ok(report.textureDots <= 120);
  }
});

test('paper underpainting keeps a face pale even over dark rear hair', async () => {
  const input = await example('portrait');
  const { svg, report } = renderScene(input);
  const face = canonicalPixel(raster(svg), report, input.heads[0].x, input.heads[0].y);
  assert.ok(face[0] >= 250 && face[1] >= 235 && face[2] >= 230, `face became dark: ${face}`);
});

test('capsules keep their actual pixel ratio on front, three-quarter and profile faces', async () => {
  for (const view of ['front', 'three-quarter-left', 'profile-left']) {
    const input = await example('portrait');
    input.bodies = [];
    const h = input.heads[0];
    h.view = view; h.hairBack = []; h.hairFront = []; h.blush = false;
    h.eyes = { left: 'open', right: 'hidden' };
    const image = raster(renderScene(input).svg), data = image.pixels;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (data[i] === 53 && data[i + 1] === 75 && data[i + 2] === 96) {
        xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
      }
    }
    const ratio = (yMax - yMin + 1) / (xMax - xMin + 1);
    assert.ok(Math.abs(ratio - 2.7) < .07, `${view}: ${ratio}`);
  }
});

test('front eye centers and height follow the fixed face geometry', async () => {
  const { svg } = renderScene(await example('portrait'));
  const caps = [...svg.matchAll(/<rect x="([^"]+)" y="-2" width="([^"]+)" height="([^"]+)" rx="([^"]+)"[^>]+data-role="eye-open"/g)];
  assert.equal(caps.length, 2);
  const centers = caps.map(m => Number(m[1]) + Number(m[2]) / 2);
  assert.ok(Math.abs(centers[1] - centers[0] - 32) < .0001);
  for (const c of caps) {
    assert.equal(Number(c[3]), 20);
    assert.ok(Math.abs(Number(c[3]) / Number(c[2]) - 2.7) < .00001);
    assert.ok(Math.abs(Number(c[4]) * 2 - Number(c[2])) < .00001);
  }
});

test('opaque eye cover does not invent hidden eyes', async () => {
  const input = await example('portrait'), h = input.heads[0];
  h.eyes = { left: 'hidden', right: 'hidden' };
  h.accessories = [{ kind: 'occluder', shapes: [{ type: 'rect', x: -50, y: -12, width: 100, height: 36, radius: 12, fill: 'blue' }] }];
  const { svg, report } = renderScene(input);
  assert.doesNotMatch(svg, /data-role="eye-/);
  assert.equal(report.eyes.length, 0);
  assert.deepEqual(canonicalPixel(raster(svg), report, h.x, h.y), [53, 75, 96, 255]);
});

test('closed eye stays a short arc; head tilt applies to it and the capsule together', async () => {
  const { svg, report } = renderScene(await example('anime'));
  assert.equal(report.eyes.filter(e => e.state === 'closed').length, 1);
  assert.equal(report.eyes.filter(e => e.state === 'open').length, 1);
  assert.match(svg, /<path[^>]+data-role="eye-closed"/);
  assert.match(svg, /rotate\(-9\)/);
});

test('foreground accessory really masks the underlying capsule in the PNG', async () => {
  const input = await example('portrait'), h = input.heads[0];
  h.accessories = [{ kind: 'prop', shapes: [{ type: 'rect', x: -23, y: -5, width: 15, height: 15, radius: 2, fill: 'paper' }] }];
  const { svg, report } = renderScene(input), image = raster(svg), unit = h.size / 100;
  assert.deepEqual(canonicalPixel(image, report, h.x - 16 * unit, h.y + 4 * unit), [255, 255, 255, 255]);
  assert.deepEqual(canonicalPixel(image, report, h.x - 16 * unit, h.y + 14 * unit), [53, 75, 96, 255]);
});

test('back-facing traveler retains hair and has no face or eyes', async () => {
  const input = await example('travel'), { svg, report } = renderScene(input);
  assert.equal(report.heads.length, 2);
  assert.equal(report.eyes.filter(e => e.head === 'p2').length, 0);
  const h = input.heads[1];
  assert.deepEqual(canonicalPixel(raster(svg), report, h.x, h.y), [53, 75, 96, 255]);
});

test('a pale filled occluder stays opaque and does not leak the eye behind it', async () => {
  const input = await example('portrait'), h = input.heads[0];
  h.accessories = [{ kind: 'prop', shapes: [{ type: 'rect', x: -23, y: -5, width: 15, height: 15, radius: 2, fill: 'blue', opacity: .2 }] }];
  const { svg, report } = renderScene(input), image = raster(svg), unit = h.size / 100;
  const covered = canonicalPixel(image, report, h.x - 16 * unit, h.y + 4 * unit);
  assert.ok(covered[0] > 210 && covered[1] > 215 && covered[2] > 220, `hidden dark eye leaked: ${covered}`);
  assert.deepEqual(canonicalPixel(image, report, h.x - 16 * unit, h.y + 14 * unit), [53, 75, 96, 255]);
});

test('invalid observations, colors and unsupported drawing fields fail before rendering', async () => {
  const baseline = await example('portrait');
  const cases = [
    s => { s.heads[0].nose = {}; },
    s => { s.bodies[0].fill = '#00ff00'; },
    s => { s.bodies[0].svg = '<script/>'; },
    s => { s.heads[0].size = NaN; },
    s => { s.source.people = 2; },
    s => { s.heads[0].view = 'profile-left'; },
    s => { s.heads[0].hairFront = []; },
    s => { s.heads[0].view = 'back'; },
    s => { s.seed = 1.5; }
  ];
  for (const mutate of cases) {
    const scene = structuredClone(baseline); mutate(scene);
    assert.throws(() => renderScene(scene));
  }
  const invalidLand = await example('landscape'); invalidLand.heads = baseline.heads;
  assert.throws(() => renderScene(invalidLand));
  const invalidTravel = await example('travel'); invalidTravel.background[0].opacity = 1;
  assert.throws(() => renderScene(invalidTravel), /opacity/);
  const invalidHair = structuredClone(baseline); invalidHair.heads[0].hairFront[0].segments = [['M', -50, -50], ['L', 0, -80], ['L', 50, -50], ['Z']];
  assert.throws(() => renderScene(invalidHair), /rounded/);
});

test('a layout that makes the portrait head too small is rejected', async () => {
  const input = await example('portrait');
  input.heads[0].size = 80;
  input.objects.push({ type: 'rect', x: 0, y: 0, width: 1000, height: 1000, radius: 200 });
  assert.throws(() => renderScene(input), /too small/);
});

test('CLI creates all replay artifacts and reserves unique names for concurrent runs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuanqu-cli-'));
  try {
    const args = [join(root, 'scripts/render.mjs'), join(root, 'references/examples/portrait.json'), '--out-dir', dir, '--name', '头像', '--size', '512'];
    const results = await Promise.all([run(process.execPath, args), run(process.execPath, args)]);
    const outputs = results.map(r => JSON.parse(r.stdout));
    assert.notEqual(outputs[0].files.png, outputs[1].files.png);
    assert.deepEqual((await readdir(dir)).sort(), ['images', 'records', 'source']);
    assert.equal((await readdir(join(dir, 'images'))).length, 2);
    assert.equal((await readdir(join(dir, 'records'))).length, 2);
    assert.equal((await readdir(join(dir, 'source'))).length, 4);
    for (const output of outputs) {
      assert.equal(output.status, 'pending-source-review');
      assert.equal(dirname(output.files.png), join(dir, 'images'));
      assert.equal(dirname(output.files.report), join(dir, 'records'));
      assert.equal(dirname(output.files.scene), join(dir, 'source'));
      assert.equal(dirname(output.files.svg), join(dir, 'source'));
      const report = JSON.parse(await readFile(output.files.report, 'utf8'));
      assert.equal(report.rasterizer, '@resvg/resvg-js@2.6.2');
      assert.deepEqual(report.files, output.files);
    }
    assert.deepEqual(await readFile(outputs[0].files.png), await readFile(outputs[1].files.png));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI treats a record-only collision as an occupied group and keeps every artifact linked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuanqu-record-collision-'));
  try {
    await mkdir(join(dir, 'records'));
    const existing = join(dir, 'records', '头像.analysis.md');
    await writeFile(existing, '已有识别记录');
    const args = [join(root, 'scripts/render.mjs'), join(root, 'references/examples/object.json'), '--out-dir', dir, '--name', '头像', '--size', '512'];
    const output = JSON.parse((await run(process.execPath, args)).stdout);
    assert.equal(basename(output.files.png), '头像-2.png');
    assert.equal(basename(output.files.report), '头像-2.report.json');
    assert.equal(basename(output.files.scene), '头像-2.scene.json');
    assert.equal(basename(output.files.svg), '头像-2.svg');
    assert.equal(await readFile(existing, 'utf8'), '已有识别记录');
    assert.deepEqual((await readdir(join(dir, 'source'))).sort(), ['头像-2.scene.json', '头像-2.svg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('missing native dependency is explicit, while check and SVG-only work without it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yuanqu-no-deps-'));
  try {
    for (const file of ['engine.mjs', 'render.mjs']) await cp(join(root, 'scripts', file), join(dir, file));
    const scene = join(root, 'references/examples/object.json'), out = join(dir, 'out');
    const check = await run(process.execPath, [join(dir, 'render.mjs'), scene, '--check']);
    assert.equal(JSON.parse(check.stdout).geometry, 'passed');
    await assert.rejects(run(process.execPath, [join(dir, 'render.mjs'), scene, '--out-dir', out]), error => /PNG renderer is missing/.test(error.stderr));
    const result = await run(process.execPath, [join(dir, 'render.mjs'), scene, '--out-dir', out, '--svg-only']);
    assert.equal(JSON.parse(result.stdout).files.png, undefined);
    assert.deepEqual((await readdir(out)).sort(), ['records', 'source']);
    assert.equal((await readdir(join(out, 'source'))).length, 2);
    assert.equal((await readdir(join(out, 'records'))).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
