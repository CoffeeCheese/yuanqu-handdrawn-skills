#!/usr/bin/env node
import { readFile, mkdir, writeFile, access, unlink } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { renderScene } from './engine.mjs';

const usage = 'node scripts/render.mjs SCENE.json --out-dir DIR [--name NAME] [--size 512|1024|2048] [--svg-only|--check]';
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); return; }
  const file = args.shift();
  if (!file || file.startsWith('--')) throw new Error(usage);
  const options = { outDir: 'output/yuanqu-handdrawn', size: 1024, svgOnly: false, check: false };
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
  const { scene, svg, report } = renderScene(JSON.parse(await readFile(resolve(file), 'utf8')), { size: options.size });
  if (options.check) { console.log(JSON.stringify(report, null, 2)); return; }
  let png;
  if (!options.svgOnly) {
    let Resvg;
    try { ({ Resvg } = await import('@resvg/resvg-js')); }
    catch { throw new Error('PNG renderer is missing. Run npm ci in this skill directory; --svg-only explicitly saves editable files without a PNG.'); }
    const raster = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
    png = raster.asPng();
    report.rasterizer = '@resvg/resvg-js@2.6.2';
    report.runtime = { node: process.version, platform: process.platform, arch: process.arch };
  } else report.rasterizer = null;
  const dir = resolve(options.outDir);
  await mkdir(dir, { recursive: true });
  const base = options.name ?? `${basename(file, extname(file)).replace(/\.scene$/, '')}-yuanqu`;
  const stem = base.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+/, '').slice(0, 120) || 'yuanqu';
  const extensions = ['scene.json', 'svg', 'report.json', ...(png ? ['png'] : [])];
  let prefix;
  // Reserve each artifact with exclusive creation, so concurrent runs never overwrite.
  for (let version = 1; version <= 10000; version++) {
    const candidate = join(dir, version === 1 ? stem : `${stem}-${version}`);
    const reserved = [];
    try {
      // Reserve the PNG name even in SVG-only mode to keep a future export clear.
      try { await access(`${candidate}.png`); continue; } catch (e) { if (e.code !== 'ENOENT') throw e; }
      for (const extension of extensions) {
        const path = `${candidate}.${extension}`;
        await writeFile(path, '', { flag: 'wx' }); reserved.push(path);
      }
      prefix = candidate; break;
    } catch (error) {
      await Promise.all(reserved.map(path => unlink(path)));
      if (error.code !== 'EEXIST') throw error;
    }
  }
  if (!prefix) throw new Error('Could not reserve an output name');
  const files = {
    scene: `${prefix}.scene.json`, svg: `${prefix}.svg`, report: `${prefix}.report.json`, ...(png ? { png: `${prefix}.png` } : {})
  };
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
