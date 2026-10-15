const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const artwork = require('./artwork.json');

const dir = __dirname;
const states = ['unlocked', 'locked', 'transparent'];
const sizes = [48, 64, 96, 128, 256];
const { render, flame, lettering, frame } = require('./frame.js')(artwork);

async function png(svg) { return sharp(Buffer.from(svg)).png().toBuffer(); }
async function raster(svg) { return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
function isolated(content, size) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${content}</svg>`; }

function geometry(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(doc.getElementsByTagName('path')).map(element => ['d', 'transform', 'stroke-width', 'data-lettering', 'data-glyph', 'data-frame', 'data-chevrons'].map(key => element.getAttribute(key)));
}

async function main() {
  const report = { scope: 'single three-day reference artwork preview; no achievement/production changes', states, sizes, centeredBounds: {}, checks: [] };
  for (const [name, value] of Object.entries(artwork)) {
    assert(Math.abs(value.bounds[0] - (100 - value.bounds[2])) < 1e-8, `${name} is off-center`);
    report.centeredBounds[name] = value.bounds;
  }
  assert(artwork.flame.bounds[3] + 3 < artwork.number.bounds[1]);
  assert(artwork.number.bounds[3] + 2 < artwork.title.bounds[1]);
  assert(artwork.title.bounds[3] + 5 < artwork.wordmark.bounds[1]);
  assert(artwork.wordmark.bounds[3] + 3 < 84.4);
  assert.equal(render('share-opaque'), render('unlocked'));
  assert.equal(render('share-transparent'), render('transparent'));
  for (const state of states) {
    const svg = render(state);
    assert.deepEqual(geometry(svg), geometry(render('unlocked')));
    assert(!/<text\b|<image\b|font-family=|<mask\b/.test(svg));
    fs.writeFileSync(path.join(dir, `three-day-${state}.svg`), svg);
    fs.writeFileSync(path.join(dir, `three-day-${state}.png`), await png(svg));
    for (const size of [...sizes, 800]) {
      const { data } = await raster(render(state, size));
      const alpha = (x, y) => data[(y * size + x) * 4 + 3];
      assert.equal(alpha(0, 0), 0);
      if (state === 'transparent') for (const [x, y] of [[.5, .14], [.32, .6], [.5, .46], [.4, .74]]) assert.equal(alpha(Math.floor(x * size), Math.floor(y * size)), 0, `Opaque transparent interior at ${x},${y}/${size}`);
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      const white = await raster(isolated(flame(), size));
      const frameRaster = await raster(isolated(`<path d="${frame}" fill="none" stroke="#FFFFFF" stroke-width=".9"/>`, size));
      let min = size, max = -1, overlap = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4 + 3;
        if (white.data[offset] > 16) {
          min = Math.min(min, x); max = Math.max(max, x);
          if (frameRaster.data[offset] > 16) overlap++;
        }
      }
      assert(min <= max && Math.abs(min - (size - 1 - max)) <= 1, 'Flame is not centered');
      assert.equal(overlap, 0, 'Flame touches frame');
      report.checks.push({ state, size, flameMargins: [min, size - 1 - max], flameFrameOverlap: overlap });
    }
  }
  const width = 1040, height = 435;
  const layers = [];
  for (const [index, state] of states.entries()) layers.push({ input: await png(render(state, 360)), left: index * 340, top: 50 });
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle">${states.map((state, index) => `<text x="${index * 340 + 180}" y="29">${state.toUpperCase()}</text>`).join('')}</g></svg>`;
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#151614' } }).composite(layers).png().toFile(path.join(dir, 'three-day-states.png'));
  let x = 20;
  const sizeLayers = [];
  let sizeLabels = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial" font-size="14" fill="#DDDDDD" text-anchor="middle">';
  for (const size of sizes) {
    sizeLayers.push({ input: await png(render('unlocked', size)), left: x, top: 26 + Math.round((256 - size) / 2) });
    sizeLabels += `<text x="${x + size / 2}" y="309">${size}px</text>`;
    x += size + 30;
  }
  sizeLayers.push({ input: Buffer.from(sizeLabels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width: 800, height: 330, channels: 3, background: '#070807' } }).composite(sizeLayers).png().toFile(path.join(dir, 'three-day-sizes.png'));
  const reference = await sharp(path.join(dir, '../lifetime-running/reference-sheet.jpg')).extract({ left: 6, top: 469, width: 62, height: 96 }).resize(279, 432).png().toBuffer();
  const captions = '<svg xmlns="http://www.w3.org/2000/svg" width="850" height="500"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle"><text x="222" y="29">REFERENCE DETAIL</text><text x="645" y="29">THREE-DAY VECTOR PREVIEW</text></g></svg>';
  await sharp({ create: { width: 850, height: 500, channels: 3, background: '#070807' } }).composite([{ input: reference, left: 82, top: 50 }, { input: await png(render('unlocked', 440)), left: 405, top: 45 }, { input: Buffer.from(captions), left: 0, top: 0 }]).png().toFile(path.join(dir, 'three-day-comparison.png'));
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/streaks', 'assets/achievements/streaks', 'src/achievements/lifetimeDistanceRunning', 'src/achievements/lifetimeDistanceCycling', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: path.resolve(dir, '../../../..'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ variants: 3, checks: report.checks.length, changedProductionFiles: report.changedProductionFiles }));
}

module.exports = { render };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
