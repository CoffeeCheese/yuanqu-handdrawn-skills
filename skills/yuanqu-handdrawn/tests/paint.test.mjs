import test from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { describePaintScene, renderPaintScene, validatePaintScene } from '../scripts/paint.mjs';

const fixture = () => ({ version: 2, renderer: 'paint', mode: 'object', seed: 37, texture: .85,
  source: { image: 'synthetic:material-test', summary: 'Two equal blue patches test local grain, not image recognition.', people: 0 },
  layers: [
    { id: 'ink', type: 'rect', x: 100, y: 100, width: 300, height: 600, radius: 20, material: 'cloth', fill: 'blue' },
    { id: 'eye', type: 'rect', x: 600, y: 100, width: 300, height: 600, radius: 20, material: 'eye', fill: 'blue' },
  ],
});

test('same data, seed and runtime produce byte-identical PNG and SVG', async () => {
  const a = await renderPaintScene(fixture(), { size: 512 });
  const b = await renderPaintScene(fixture(), { size: 512 });
  assert.deepEqual(a.png, b.png);
  assert.equal(a.svg, b.svg);
  const changed = fixture(); changed.seed++;
  const c = await renderPaintScene(changed, { size: 512 });
  assert.notDeepEqual(a.png, c.png);
});

test('exported SVG reproduces the PNG and grain protects solid eye ink', async () => {
  const a = await renderPaintScene(fixture(), { size: 512 });
  const render = new Resvg(a.svg).render();
  assert.deepEqual(a.png, render.asPng());
  const pixels = render.pixels;
  const spread = (x0, x1) => {
    const values = [];
    for (let y = 80; y < 300; y++) for (let x = x0; x < x1; x++) values.push(pixels[(y * 512 + x) * 4]);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(spread(80, 180) > 35);
  assert.ok(spread(330, 430) < 4);
});

test('translucent pigment can overlay cloth without a white underpainting', () => {
  const s = fixture();
  s.layers.push({ id: 'wash', type: 'rect', x: 150, y: 200, width: 100, height: 200, radius: 5, fill: 'blueLight', opacity: .2, material: 'cloth', underpaint: false });
  const { svg } = describePaintScene(s, { size: 512 });
  const pixels = new Resvg(svg).render().pixels;
  const red = pixels[(150 * 512 + 100) * 4];
  assert.ok(red > 60 && red < 100, 'overlay stays blue instead of becoming near white');
});

test('reject nonnumeric geometry, raw SVG, invalid pigments and duplicate IDs', () => {
  for (const mutate of [
    s => { s.layers[0].x = NaN; },
    s => { s.layers[0].fill = '__proto__'; },
    s => { s.layers[0].svg = '<script/>'; },
    s => { s.layers[1].id = s.layers[0].id; },
  ]) {
    const s = fixture(); mutate(s);
    assert.throws(() => validatePaintScene(s));
  }
});
