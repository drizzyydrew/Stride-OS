const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const art = require('./family-artwork.cjs');
const root = path.resolve(__dirname, '../../../..');
const states = art.master.states, sizes = [48, 64, 96, 128, 256, 800];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const isolated = (content, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">${content}</svg>`;
const pixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
function write(file, data) {
  const target = path.join(__dirname, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(data);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(buffer)) fs.writeFileSync(target, buffer);
}
function geometry(svg) {
  const errors = [];
  const document = new DOMParser({ onError: (level, message) => errors.push(message) }).parseFromString(svg, 'image/svg+xml');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(document.documentElement.getAttribute('viewBox'), '0 0 100 100');
  return Array.from(document.getElementsByTagName('*')).filter(node => ['path', 'circle', 'rect', 'g', 'mask'].includes(node.tagName)).map(node =>
    [node.tagName, ...['d', 'transform', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'stroke-width', 'fill-opacity', 'opacity', 'data-text', 'data-part'].map(key => node.getAttribute(key))],
  );
}
function preserve() {
  for (const [file, expected] of Object.entries(art.sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, file);
  for (const [file, expected] of Object.entries(require('./approved-august-hashes.json'))) assert.equal(hash(fs.readFileSync(path.join(__dirname, file))), expected, file);
  for (const [file, expected] of Object.entries(require('./distance-change-baseline.json').preserved)) assert.equal(hash(fs.readFileSync(path.join(__dirname, file))), expected, file);
  for (const family of ['strength', 'recovery']) for (const file of require(`../${family}/individual-exports/manifest.json`).files) {
    assert.equal(hash(fs.readFileSync(path.join(__dirname, '..', family, file.svg))), file.svgHash);
    assert.equal(hash(fs.readFileSync(path.join(__dirname, '..', family, file.png))), file.pngHash);
  }
}
function bounds(data, size) {
  let min = size, max = -1, top = size, bottom = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3] > 16) {
    min = Math.min(min, x); max = Math.max(max, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert(max >= min, 'Empty artwork part');
  return { margins: [min, size - 1 - max], top, bottom };
}
async function board(state) {
  const layers = [], tile = 250, width = 1060, height = 70 + Math.ceil(art.definitions.length / 4) * 260;
  for (const [i, definition] of art.definitions.entries()) layers.push({ input: await png(art.render(definition.id, state, tile)), left: 15 + i % 4 * 260, top: 55 + Math.floor(i / 4) * 260 });
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="530" y="31" fill="#DEDEDE" font-size="19" font-family="Arial" text-anchor="middle">CHALLENGES${state === 'unlocked' ? '' : ` / ${state.toUpperCase()}`}</text></svg>`;
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#293B40' : '#070807' } }).composite(layers).png().toFile(path.join(__dirname, `challenges-${state}.png`));
}
async function sizeBoard(state) {
  const width = 1590, height = 50 + art.definitions.length * 275, layers = [];
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="#CCCCCC" font-family="Arial" font-size="12">`;
  for (const [column, size] of sizes.slice(0, -1).entries()) labels += `<text x="${210 + column * 275 + 128}" y="25" text-anchor="middle">${size}px</text>`;
  for (const [row, definition] of art.definitions.entries()) {
    labels += `<text x="10" y="${50 + row * 275 + 128}">${definition.slug}</text>`;
    for (const [column, size] of sizes.slice(0, -1).entries()) layers.push({ input: await png(art.render(definition.id, state, size)), left: 210 + column * 275 + Math.round((256 - size) / 2), top: 50 + row * 275 + Math.round((256 - size) / 2) });
  }
  layers.push({ input: Buffer.from(labels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#293B40' : '#070807' } }).composite(layers).png().toFile(path.join(__dirname, `challenges-${state}-sizes.png`));
}
async function main() {
  assert.equal(process.cwd(), root);
  preserve();
  assert.equal(art.sourceDefinitions.length, 12, 'App definitions stay unchanged.');
  assert.equal(art.definitions.length, 13);
  assert.equal(new Set(art.definitions.map(value => value.id)).size, 13);
  assert.equal(art.definitions.filter(value => value.includeInGlobalRegistry).length, 6);
  assert(!art.definitions.some(value => value.id === 'challenge_5k_month'));
  for (const km of [150, 200]) {
    const value = art.definitions.find(value => value.id === `monthly_run_${km}k`);
    assert(value && !value.includeInGlobalRegistry && value.thresholdMeters === km * 1000);
  }
  const retiredFiles = Object.entries(require('./distance-change-baseline.json').retired);
  for (const [file, expected] of retiredFiles) {
    assert(/^individual-exports\/(unlocked|locked|transparent)\/challenges-5k-month-(unlocked|locked|transparent)\.(svg|png)$/.test(file));
    const target = path.join(__dirname, file);
    if (fs.existsSync(target)) {
      assert.equal(hash(fs.readFileSync(target)), expected, 'Do not remove unexpectedly edited artwork.');
      fs.unlinkSync(target);
    }
  }
  const report = { scope: 'Thirteen Challenges review presentations; 5K removed, 150K/200K reuse existing Monthly IDs, no app integration', result: 'PASS', states, sizes, files: [], rasterChecks: [], interiorChecks: [], grayscaleChecks: 0, transparentChecks: 0, sourceHashes: art.sources, retiredExports: retiredFiles.map(([file]) => file) };
  for (const definition of art.definitions) {
    const geometryBaseline = geometry(art.render(definition.id));
    assert.equal(art.render(definition.id, 'share-opaque'), art.render(definition.id, 'unlocked'));
    assert.equal(art.render(definition.id, 'share-transparent'), art.render(definition.id, 'transparent'));
    for (const state of states) {
      const svg = art.render(definition.id, state), bytes = await png(svg);
      assert.deepEqual(geometry(svg), geometryBaseline);
      assert(!/<(?:text|image)\b|font-family=|href=/.test(svg), 'Canonical vectors and outlined fonts only');
      const data = await pixels(svg);
      assert.equal(data[3], 0);
      if (state === 'locked') {
        for (let offset = 0; offset < data.length; offset += 4) if (data[offset + 3]) assert(data[offset] === data[offset + 1] && data[offset + 1] === data[offset + 2]);
        report.grayscaleChecks++;
      }
      for (const [x, y] of [[400, 96], [400, 680]]) assert.equal(data[(y * 800 + x) * 4 + 3], state === 'transparent' ? 0 : 255);
      if (state === 'transparent') report.transparentChecks++;
      const stem = `individual-exports/${state}/challenges-${definition.slug}-${state}`;
      write(`${stem}.svg`, svg); write(`${stem}.png`, bytes);
      assert.deepEqual(await sharp(path.join(__dirname, `${stem}.png`)).ensureAlpha().raw().toBuffer(), data);
      report.files.push({ id: definition.id, state, svg: `${stem}.svg`, png: `${stem}.png`, svgHash: hash(svg), pngHash: hash(bytes) });
      const p = state === 'locked' ? art.master.colors.locked : art.palette(definition);
      for (const size of sizes) {
        const frame = await pixels(isolated(`<path d="${art.master.frame}" stroke="white" stroke-width="1"/>`, size));
        const glyphPixels = await pixels(isolated(art.glyph(definition, p), size));
        for (const [key, content] of Object.entries({ glyph: art.glyph(definition, p), ...Object.fromEntries(Object.entries(art.typography[definition.id].copy).map(([key, value]) => [key, `<path d="${value.path}" transform="translate(${value.translateX} 0)" fill="white"/>`])) })) {
          const ink = await pixels(isolated(content, size)), b = bounds(ink, size);
          assert(Math.abs(b.margins[0] - b.margins[1]) <= 1, `${definition.slug}/${key}/${size}: unequal margins ${b.margins}`);
          assert(b.margins[0] > 0 && b.margins[1] > 0 && b.top > 0 && b.bottom < size - 1, `${definition.slug}: clipped ${key}`);
          let frameOverlap = 0, glyphOverlap = 0;
          for (let i = 3; i < ink.length; i += 4) if (ink[i] > 16) {
            if (frame[i] > 16) frameOverlap++;
            if (key !== 'glyph' && glyphPixels[i] > 16) glyphOverlap++;
          }
          assert.equal(frameOverlap, 0, `${definition.slug}/${key}/${size}: frame collision`);
          assert.equal(glyphOverlap, 0, `${definition.slug}/${key}/${size}: glyph/copy collision`);
          report.rasterChecks.push({ id: definition.id, state, key, size, ...b, frameOverlap, glyphOverlap });
        }
        if (state === 'transparent' && definition.id === 'challenge_august_base_builder') {
          const body = await pixels(art.render(definition.id, state, size));
          const offset = (Math.floor(.375 * size) * size + Math.floor(.55 * size)) * 4 + 3;
          if (size >= 256) assert.equal(body[offset], 0, 'Runner must retain transparent hollow body.');
          report.interiorChecks.push({ size, hollowRunner: size >= 256 ? body[offset] === 0 : 'visual small-size check' });
        }
      }
    }
  }
  for (const state of states) { await board(state); await sizeBoard(state); }
  const exported = states.flatMap(state => fs.readdirSync(path.join(__dirname, 'individual-exports', state)).map(file => `individual-exports/${state}/${file}`)).sort();
  assert.deepEqual(exported, report.files.flatMap(file => [file.svg, file.png]).sort());
  assert.equal(exported.length, 78);
  preserve();
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/challenges', 'assets/achievements/challenges', 'src/achievements/elevation', 'assets/achievements/elevation', 'src/achievements/strength', 'assets/achievements/strength', 'src/achievements/recovery', 'assets/achievements/recovery', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual(report.changedProductionFiles, []);
  write('family-validation.json', `${JSON.stringify(report, null, 2)}\n`);
  write('individual-exports/manifest.json', `${JSON.stringify({ family: 'challenges', canonicalStates: states, aliases: { 'share-opaque': 'unlocked', 'share-transparent': 'transparent' }, definitions: art.definitions, files: report.files }, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, pairs: report.files.length, artFiles: exported.length, rasterChecks: report.rasterChecks.length, grayscaleChecks: report.grayscaleChecks, transparentChecks: report.transparentChecks, changedProductionFiles: report.changedProductionFiles }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
