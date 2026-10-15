const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const master = require('./artwork.cjs');
const { sources } = require('./definitions.json');

const root = path.resolve(__dirname, '../../../..');
const sizes = [48, 64, 96, 128, 256];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
const pixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const isolated = (content, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">${content}</svg>`;

function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('*')).filter(element => ['path', 'rect', 'g'].includes(element.tagName)).map(element =>
    Object.fromEntries(['data-frame', 'data-lettering', 'data-text', 'data-glyph', 'data-source-sha256', 'data-chevrons', 'd', 'transform', 'x', 'y', 'width', 'height', 'rx', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map(key => [key, element.getAttribute(key)])),
  );
}

async function main() {
  const report = { scope: 'one First Strength Session preview only; awaiting approval; no app integration', states: master.states, sizes, canonicalEquipmentHash: master.sourceHash, sources, rasterChecks: [] };
  for (const [file, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected);
  for (const [index, plate] of master.plates.entries()) {
    const opposite = master.plates[master.plates.length - 1 - index];
    assert(Math.abs(plate.x + opposite.x - 100) < 1e-8);
    assert.equal(plate.top, opposite.top); assert.equal(plate.bottom, opposite.bottom);
  }
  const values = Object.values(master.typography);
  assert(values[0].bounds[1] > Math.max(...master.plates.map(plate => plate.bottom)) + 5);
  assert(values[0].bounds[3] + 1 < values[1].bounds[1]);
  assert(values[1].bounds[3] + 3 < values[2].bounds[1]);
  assert(values[2].bounds[3] + 3 < 83);
  assert.equal(master.render('share-opaque'), master.render('unlocked'));
  assert.equal(master.render('share-transparent'), master.render('transparent'));
  for (const state of master.states) {
    const svg = master.render(state);
    assert.deepEqual(geometry(svg), geometry(master.render('unlocked')));
    assert(!/<text\b|<image\b|font-family=|<mask\b|currentColor/.test(svg));
    fs.writeFileSync(path.join(__dirname, `first-session-${state}.svg`), svg);
    fs.writeFileSync(path.join(__dirname, `first-session-${state}.png`), await png(svg));
    for (const size of [...sizes, 800]) {
      const { data } = await pixels(master.render(state, size));
      const alpha = (x, y) => data[(y * size + x) * 4 + 3];
      assert.equal(alpha(0, 0), 0);
      if (state === 'transparent') for (const [x, y] of [[.5, .16], [.2, .5], [.8, .5], [.5, .26]]) assert.equal(alpha(Math.floor(x * size), Math.floor(y * size)), 0, `Unexpected background alpha at ${x},${y}/${size}`);
      else assert.equal(alpha(Math.floor(size * .5), Math.floor(size * .16)), 255);
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      const border = await pixels(isolated(`<path d="${master.frame}" stroke="#FFFFFF" stroke-width="1"/>`, size));
      for (const key of ['glyph', ...Object.keys(master.typography)]) {
        const content = key === 'glyph' ? master.glyph() : master.lettering(key);
        const ink = await pixels(isolated(content, size));
        let min = size, max = -1, overlap = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4 + 3;
          if (ink.data[offset] > 16) {
            min = Math.min(min, x); max = Math.max(max, x);
            if (border.data[offset] > 16) overlap++;
          }
        }
        assert(min <= max && Math.abs(min - (size - 1 - max)) <= 1, `${key} unequal margins at ${size}`);
        assert.equal(overlap, 0);
        report.rasterChecks.push({ state, size, key, margins: [min, size - 1 - max], overlap });
      }
      const motif = await pixels(isolated(`<path d="${master.chevrons}" stroke="#FFFFFF" stroke-width=".7"/>`, size));
      for (let i = 3; i < motif.data.length; i += 4) assert(!(motif.data[i] > 16 && border.data[i] > 16));
    }
    const svgPixels = await pixels(svg);
    const pngPixels = await sharp(path.join(__dirname, `first-session-${state}.png`)).ensureAlpha().raw().toBuffer();
    assert(svgPixels.data.equals(pngPixels));
  }
  const layers = [];
  for (const [i, state] of master.states.entries()) layers.push({ input: await png(master.render(state, 360)), left: i * 340, top: 50 });
  const labels = '<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="435"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle">' + master.states.map((state, i) => `<text x="${i * 340 + 180}" y="29">${state.toUpperCase()}</text>`).join('') + '</g></svg>';
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width: 1040, height: 435, channels: 3, background: '#151614' } }).composite(layers).png().toFile(path.join(__dirname, 'first-session-states.png'));
  let left = 20;
  const sizeLayers = [];
  let sizeLabels = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial" font-size="14" fill="#DDDDDD" text-anchor="middle">';
  for (const size of sizes) {
    sizeLayers.push({ input: await png(master.render('unlocked', size)), left, top: 26 + Math.round((256 - size) / 2) });
    sizeLabels += `<text x="${left + size / 2}" y="309">${size}px</text>`;
    left += size + 30;
  }
  sizeLayers.push({ input: Buffer.from(sizeLabels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width: 800, height: 330, channels: 3, background: '#070807' } }).composite(sizeLayers).png().toFile(path.join(__dirname, 'first-session-sizes.png'));
  const reference = await sharp(path.join(__dirname, '../lifetime-running/reference-sheet.jpg')).extract({ left: 841, top: 286, width: 83, height: 88 }).resize(415, 440).png().toBuffer();
  const captions = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle"><text x="225" y="29">REFERENCE DETAIL</text><text x="675" y="29">FIRST STRENGTH SESSION PREVIEW</text></g></svg>';
  await sharp({ create: { width: 900, height: 500, channels: 3, background: '#070807' } }).composite([{ input: reference, left: 17, top: 45 }, { input: await png(master.render('unlocked', 450)), left: 450, top: 45 }, { input: Buffer.from(captions), left: 0, top: 0 }]).png().toFile(path.join(__dirname, 'first-session-comparison.png'));
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/strength', 'assets/achievements/strength', 'src/achievements/weeklyDistance', 'assets/achievements/weekly-distance', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  report.status = 'pass';
  fs.writeFileSync(path.join(__dirname, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, states: master.states.length, rasterChecks: report.rasterChecks.length, changedProductionFiles: report.changedProductionFiles }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
