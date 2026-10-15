const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { render, lettering, artwork, frame, chevrons, states } = require('./artwork.cjs');

const sizes = [48, 64, 96, 128, 256];
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
const raster = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const isolated = (content, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${content}</svg>`;

function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('path')).map(element => ['d', 'transform', 'stroke-width', 'data-lettering', 'data-frame', 'data-chevrons'].map(key => element.getAttribute(key)));
}

async function main() {
  const report = { scope: 'first Weekly Distance 5K preview only; user approval pending; no app integration', states, sizes, centeredBounds: {}, checks: [] };
  for (const [key, value] of Object.entries(artwork)) {
    assert(Math.abs(value.bounds[0] - (100 - value.bounds[2])) < 1e-8);
    report.centeredBounds[key] = value.bounds;
  }
  assert(artwork.number.bounds[3] + 5 < artwork.period.bounds[1]);
  assert(artwork.period.bounds[3] + 5 < artwork.wordmark.bounds[1]);
  assert(artwork.wordmark.bounds[3] + 4 < 81.6);
  assert.equal(render('share-opaque'), render('unlocked'));
  assert.equal(render('share-transparent'), render('transparent'));
  for (const state of states) {
    const svg = render(state);
    assert.deepEqual(geometry(svg), geometry(render('unlocked')));
    assert(!/<text\b|<image\b|font-family=|<mask\b/.test(svg));
    fs.writeFileSync(path.join(__dirname, `five-k-${state}.svg`), svg);
    fs.writeFileSync(path.join(__dirname, `five-k-${state}.png`), await png(svg));
    for (const size of [...sizes, 800]) {
      const { data } = await raster(render(state, size));
      const alpha = (x, y) => data[(y * size + x) * 4 + 3];
      assert.equal(alpha(0, 0), 0);
      if (state === 'transparent') for (const [x, y] of [[.5, .18], [.3, .55], [.5, .69]]) assert.equal(alpha(Math.floor(x * size), Math.floor(y * size)), 0);
      else assert(alpha(Math.floor(size * .5), Math.floor(size * .18)) === 255);
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      const border = await raster(isolated(`<path d="${frame}" fill="none" stroke="#FFFFFF" stroke-width=".95"/>`, size));
      for (const key of Object.keys(artwork)) {
        const ink = await raster(isolated(lettering(key), size));
        let min = size, max = -1, overlap = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4 + 3;
          if (ink.data[offset] > 16) {
            min = Math.min(min, x); max = Math.max(max, x);
            if (border.data[offset] > 16) overlap++;
          }
        }
        assert(min <= max && Math.abs(min - (size - 1 - max)) <= 1, `${key} off-center at ${size}`);
        assert.equal(overlap, 0);
        report.checks.push({ state, size, key, margins: [min, size - 1 - max], overlap });
      }
      const motif = await raster(isolated(`<path d="${chevrons}" fill="none" stroke="#FFFFFF" stroke-width=".7"/>`, size));
      for (let i = 3; i < motif.data.length; i += 4) assert(!(motif.data[i] > 16 && border.data[i] > 16));
    }
  }
  const labels = '<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="435"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle">' + states.map((state, i) => `<text x="${i * 340 + 180}" y="29">${state.toUpperCase()}</text>`).join('') + '</g></svg>';
  const layers = [];
  for (const [i, state] of states.entries()) layers.push({ input: await png(render(state, 360)), left: i * 340, top: 50 });
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width: 1040, height: 435, channels: 3, background: '#151614' } }).composite(layers).png().toFile(path.join(__dirname, 'five-k-states.png'));
  let left = 20;
  const sizeLayers = [];
  let sizeLabels = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial" font-size="14" fill="#DDDDDD" text-anchor="middle">';
  for (const size of sizes) {
    sizeLayers.push({ input: await png(render('unlocked', size)), left, top: 26 + Math.round((256 - size) / 2) });
    sizeLabels += `<text x="${left + size / 2}" y="309">${size}px</text>`;
    left += size + 30;
  }
  sizeLayers.push({ input: Buffer.from(sizeLabels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width: 800, height: 330, channels: 3, background: '#070807' } }).composite(sizeLayers).png().toFile(path.join(__dirname, 'five-k-sizes.png'));
  const reference = await sharp(path.join(__dirname, '../lifetime-running/reference-sheet.jpg')).extract({ left: 436, top: 471, width: 67, height: 75 }).resize(402, 450).png().toBuffer();
  const captions = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle"><text x="225" y="29">REFERENCE DETAIL</text><text x="675" y="29">5K VECTOR PREVIEW</text></g></svg>';
  await sharp({ create: { width: 900, height: 500, channels: 3, background: '#070807' } }).composite([{ input: reference, left: 24, top: 45 }, { input: await png(render('unlocked', 450)), left: 450, top: 45 }, { input: Buffer.from(captions), left: 0, top: 0 }]).png().toFile(path.join(__dirname, 'five-k-comparison.png'));
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/weeklyDistance', 'assets/achievements/weekly-distance', 'src/achievements/streaks', 'assets/achievements/streaks', 'src/achievements/lifetimeDistanceRunning', 'src/achievements/lifetimeDistanceCycling', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: path.resolve(__dirname, '../../../..'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  report.status = 'pass';
  fs.writeFileSync(path.join(__dirname, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, variants: 3, centeredRasterChecks: report.checks.length, changedProductionFiles: report.changedProductionFiles }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
