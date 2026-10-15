const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { render, glyph, bounds, master } = require('./artwork.cjs');
const { sources } = require('../definitions.json');
const root = path.resolve(__dirname, '../../../../..');
const sizes = [48, 64, 96, 128, 256];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
const pixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const isolated = (content, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('*')).filter(element => ['path', 'g'].includes(element.tagName)).map(element =>
    ['data-frame', 'data-lettering', 'data-text', 'data-glyph', 'data-part', 'data-vine', 'd', 'transform', 'stroke-width', 'fill-opacity', 'stroke-linecap', 'stroke-linejoin'].map(key => element.getAttribute(key)),
  );
}
function checkPreservation() {
  for (const [file, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected);
  const baseline = Object.fromEntries(master.states.flatMap(state => ['svg', 'png'].map(extension => {
    const file = `week-completed-${state}.${extension}`;
    return [file, hash(fs.readFileSync(path.join(__dirname, '..', file)))];
  })));
  const target = path.join(__dirname, 'preserved-v1-hashes.json');
  if (fs.existsSync(target)) assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), baseline);
  else fs.writeFileSync(target, JSON.stringify(baseline, null, 2) + '\n');
  const strength = path.resolve(__dirname, '../../strength');
  const manifest = JSON.parse(fs.readFileSync(path.join(strength, 'individual-exports/manifest.json'), 'utf8'));
  for (const file of manifest.files) {
    assert.equal(hash(fs.readFileSync(path.join(strength, file.svg))), file.svgHash);
    assert.equal(hash(fs.readFileSync(path.join(strength, file.png))), file.pngHash);
  }
}
async function main() {
  checkPreservation();
  const report = { scope: 'Recovery Week vine/hammock v2 preview, awaiting approval; no app changes', states: master.states, sizes, glyphBounds: bounds, rasterChecks: [], preservedStrengthArtFiles: 60, preservedV1Files: 6 };
  assert(bounds[3] + 4 < master.artwork.title1.bounds[1]);
  assert.equal(render('share-opaque'), render('unlocked'));
  assert.equal(render('share-transparent'), render('transparent'));
  const document = new DOMParser().parseFromString(isolated(glyph(), 100), 'image/svg+xml');
  const groups = Array.from(document.getElementsByTagName('g'));
  const serializer = new XMLSerializer();
  const vines = groups.filter(element => element.hasAttribute('data-vine')).map(element => serializer.serializeToString(element)).join('');
  const hammock = serializer.serializeToString(groups.find(element => element.getAttribute('data-part') === 'central-hammock'));
  for (const state of master.states) {
    const svg = render(state);
    assert.equal(master.render(state), fs.readFileSync(path.join(__dirname, `../week-completed-${state}.svg`), 'utf8'));
    assert((await pixels(master.render(state))).data.equals(await sharp(path.join(__dirname, `../week-completed-${state}.png`)).ensureAlpha().raw().toBuffer()));
    assert.deepEqual(geometry(svg), geometry(render('unlocked')));
    assert(!/<text\b|<image\b|font-family=|<mask\b|currentColor/.test(svg));
    fs.writeFileSync(path.join(__dirname, `recovery-week-vines-${state}.svg`), svg);
    fs.writeFileSync(path.join(__dirname, `recovery-week-vines-${state}.png`), await png(svg));
    assert((await pixels(svg)).data.equals(await sharp(path.join(__dirname, `recovery-week-vines-${state}.png`)).ensureAlpha().raw().toBuffer()));
    for (const size of [...sizes, 800]) {
      const { data } = await pixels(render(state, size));
      const alpha = (x, y) => data[(y * size + x) * 4 + 3];
      assert.equal(alpha(0, 0), 0);
      if (state === 'transparent') for (const [x, y] of [[.5, .12], [.5, .28], [.5, .38], [.5, .85]]) assert.equal(alpha(Math.floor(x * size), Math.floor(y * size)), 0, `Opaque background at ${x},${y}/${size}`);
      else assert.equal(alpha(Math.floor(size * .5), Math.floor(size * .12)), 255);
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      const frame = await pixels(isolated(`<path d="${master.frame}" stroke="#FFFFFF" stroke-width="1"/>`, size));
      const parts = { glyph: glyph(), vines, hammock, title1: master.lettering('title1'), title2: master.lettering('title2') };
      for (const [key, content] of Object.entries(parts)) {
        const ink = await pixels(isolated(content, size));
        let min = size, max = -1, overlap = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4 + 3;
          if (ink.data[offset] > 16) { min = Math.min(min, x); max = Math.max(max, x); if (frame.data[offset] > 16) overlap++; }
        }
        assert(min <= max && Math.abs(min - (size - 1 - max)) <= 1, `${key}/${size} unequal margins`);
        assert.equal(overlap, 0, `${key}/${size} frame collision`);
        report.rasterChecks.push({ state, size, key, margins: [min, size - 1 - max], overlap });
      }
    }
  }
  const layers = [];
  for (const [i, state] of master.states.entries()) layers.push({ input: await png(render(state, 360)), left: i * 340, top: 50 });
  const labels = '<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="435"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle">' + master.states.map((state, i) => `<text x="${i * 340 + 180}" y="29">${state.toUpperCase()}</text>`).join('') + '</g></svg>';
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width: 1040, height: 435, channels: 3, background: '#151614' } }).composite(layers).png().toFile(path.join(__dirname, 'states.png'));
  let left = 20;
  const sizeLayers = [];
  let sizeLabels = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial" font-size="14" fill="#DDDDDD" text-anchor="middle">';
  for (const size of sizes) {
    sizeLayers.push({ input: await png(render('unlocked', size)), left, top: 26 + Math.round((256 - size) / 2) });
    sizeLabels += `<text x="${left + size / 2}" y="309">${size}px</text>`;
    left += size + 30;
  }
  sizeLayers.push({ input: Buffer.from(sizeLabels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width: 800, height: 330, channels: 3, background: '#070807' } }).composite(sizeLayers).png().toFile(path.join(__dirname, 'sizes.png'));
  const captions = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><g font-family="Arial" font-size="16" fill="#DDDDDD" text-anchor="middle"><text x="225" y="29">PREVIOUS LEAF CYCLE</text><text x="675" y="29">VINES + RELAXATION PREVIEW</text></g></svg>';
  await sharp({ create: { width: 900, height: 500, channels: 3, background: '#070807' } }).composite([{ input: await sharp(path.join(__dirname, '../week-completed-unlocked.png')).resize(450, 450).png().toBuffer(), left: 0, top: 45 }, { input: await png(render('unlocked', 450)), left: 450, top: 45 }, { input: Buffer.from(captions), left: 0, top: 0 }]).png().toFile(path.join(__dirname, 'comparison.png'));
  checkPreservation();
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/recovery', 'assets/achievements/recovery', 'src/achievements/strength', 'assets/achievements/strength', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  report.status = 'pass';
  fs.writeFileSync(path.join(__dirname, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, states: 3, checks: report.rasterChecks.length, changedProductionFiles: report.changedProductionFiles }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
