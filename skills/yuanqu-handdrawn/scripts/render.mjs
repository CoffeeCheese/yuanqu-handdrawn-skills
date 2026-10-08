#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, access, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { renderScene } from './engine.mjs';

const usage = 'node scripts/render.mjs SCENE.json [--out-dir OUTPUT_ROOT] [--name NAME] [--size 512|1024|2048] [--svg-only|--check]\nOutput root defaults to ./output; images/ holds PNG, source/ holds scene and SVG, records/ holds reports.';
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); return; }
  const file = args.shift();
  if (!file || file.startsWith('--')) throw new Error(usage);
  const options = { outDir: 'output', size: 1024, svgOnly: false, check: false };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--svg-only') options.svgOnly = true;
    else if (flag === '--check') options.check = true;
    else if (['--out-dir', '--name', '--size'].includes(flag)) {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      if (flag === '--out-dir') options.outDir = value;
      else if (flag === '--name') options.name = value;
      else options.size = Number(value);
    } else throw new Error(`Unknown argument ${flag}`);
  }
  const input = JSON.parse(await readFile(resolve(file), 'utf8'));
  let result;
  if (input.version === 2) {
    const { describePaintScene, renderPaintScene } = await import('./paint.mjs');
    result = options.check ? describePaintScene(input, { size: options.size }) : await renderPaintScene(input, { size: options.size });
  } else result = renderScene(input, { size: options.size });
  const { scene, svg, report } = result;
  if (options.check) { console.log(JSON.stringify(report, null, 2)); return; }
  let png = options.svgOnly ? undefined : result.png;
  if (!options.svgOnly && !png) {
    let Resvg;
    try { ({ Resvg } = await import('@resvg/resvg-js')); }
    catch { throw new Error('PNG renderer is missing. Run npm ci in this skill directory; --svg-only explicitly saves editable files without a PNG.'); }
    const raster = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
    png = raster.asPng();
    report.rasterizer = '@resvg/resvg-js@2.6.2';
    report.runtime = { node: process.version, platform: process.platform, arch: process.arch };
  } else if (!png && input.version !== 2) report.rasterizer = null;
  const dir = resolve(options.outDir);
  const base = options.name ?? `${basename(file, extname(file)).replace(/\.scene$/, '')}-yuanqu`;
  const stem = base.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+/, '').slice(0, 120) || 'yuanqu';
  const pathsFor = name => ({
    scene: join(dir, 'source', `${name}.scene.json`),
    svg: join(dir, 'source', `${name}.svg`),
    report: join(dir, 'records', `${name}.report.json`),
    ...(png ? { png: join(dir, 'images', `${name}.png`) } : {})
  });
  await Promise.all([...new Set(Object.values(pathsFor(stem)).map(dirname))].map(path => mkdir(path, { recursive: true })));
  const existing = (await Promise.all(['images', 'records', 'source'].map(async folder => {
    try { return await readdir(join(dir, folder)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }))).flat();
  let files;
  // Reserve each artifact with exclusive creation, so concurrent runs never overwrite.
  for (let version = 1; version <= 10000; version++) {
    const name = version === 1 ? stem : `${stem}-${version}`;
    if (existing.some(file => file.startsWith(`${name}.`))) continue;
    const candidate = pathsFor(name);
    const reserved = [];
    try {
      // Reserve the PNG name even in SVG-only mode to keep a future export clear.
      try { await access(join(dir, 'images', `${name}.png`)); continue; } catch (e) { if (e.code !== 'ENOENT') throw e; }
      for (const path of Object.values(candidate)) {
        await writeFile(path, '', { flag: 'wx' }); reserved.push(path);
      }
      files = candidate; break;
    } catch (error) {
      await Promise.all(reserved.map(path => unlink(path)));
      if (error.code !== 'EEXIST') throw error;
    }
  }
  if (!files) throw new Error('Could not reserve an output name');
  report.files = files;
  try {
    await writeFile(files.scene, JSON.stringify(scene, null, 2) + '\n');
    await writeFile(files.svg, svg);
    if (png) await writeFile(files.png, png);
    await writeFile(files.report, JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    await Promise.all(Object.values(files).map(path => unlink(path).catch(() => {})));
    throw error;
  }
  console.log(JSON.stringify({ status: report.status, files }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
