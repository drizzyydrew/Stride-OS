const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { render, glyph, copy, definitions, sources, typography, master } = require('./family-artwork.cjs');

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
function write(file, bytes) {
  const target = path.join(__dirname, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(bytes))) fs.writeFileSync(target, bytes);
}
function checkSources() {
  for (const [file, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, `Source changed: ${file}`);
  for (const [file, expected] of Object.entries(require('./approved-first-session-hashes.json'))) assert.equal(hash(fs.readFileSync(path.join(__dirname, file))), expected, `Approved First Session changed: ${file}`);
}

async function board(state) {
  const tile = 220, gap = 20, columns = 5, width = columns * (tile + gap) + gap, height = 60 + 2 * (tile + gap);
  const layers = [];
  for (const [i, definition] of definitions.entries()) layers.push({ input: await png(render(definition.id, state, tile)), left: gap + i % columns * (tile + gap), top: 50 + Math.floor(i / columns) * (tile + gap) });
  const title = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width / 2}" y="30" fill="#DDDDDD" font-family="Arial" font-size="21" text-anchor="middle">STRENGTH${state === 'unlocked' ? '' : ` / ${state.toUpperCase()}`}</text></svg>`;
  layers.push({ input: Buffer.from(title), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#343834' : '#060706' } }).composite(layers).png().toFile(path.join(__dirname, `strength-${state}.png`));
}
async function sizeBoard(state) {
  const width = 1590, height = 55 + definitions.length * 285;
  const layers = [];
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="#DDDDDD" font-family="Arial" font-size="12">`;
  for (const [i, size] of sizes.entries()) labels += `<text x="${205 + i * 275 + 128}" y="28" text-anchor="middle">${size}px</text>`;
  for (const [row, definition] of definitions.entries()) {
    labels += `<text x="12" y="${55 + row * 285 + 125}">${definition.slug}</text>`;
    for (const [column, size] of sizes.entries()) layers.push({ input: await png(render(definition.id, state, size)), left: 205 + column * 275 + Math.round((256 - size) / 2), top: 55 + row * 285 + Math.round((256 - size) / 2) });
  }
  layers.push({ input: Buffer.from(labels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#343834' : '#060706' } }).composite(layers).png().toFile(path.join(__dirname, `strength-${state}-sizes.png`));
}

async function main() {
  checkSources();
  const approved = require('./approved-first-session-hashes.json');
  const report = { scope: 'ten Strength family artwork exports; no app replacement', definitions, states: master.states, sizes, files: [], rasterChecks: [], grayscaleChecks: 0, transparentChecks: 0 };
  assert.equal(definitions.length, 10);
  assert.equal(new Set(definitions.map(value => value.id)).size, 10);
  assert.equal(definitions.find(value => value.id === 'first_structured_workout').includeInGlobalRegistry, false);
  for (const definition of definitions) {
    const baseline = geometry(render(definition.id));
    assert.deepEqual(baseline[0], geometry(master.render())[0]);
    assert.equal(render(definition.id, 'share-opaque'), render(definition.id, 'unlocked'));
    assert.equal(render(definition.id, 'share-transparent'), render(definition.id, 'transparent'));
    for (const state of master.states) {
      const svg = render(definition.id, state), bytes = await png(svg);
      assert.deepEqual(geometry(svg), baseline);
      assert(!/<text\b|<image\b|font-family=|<mask\b|currentColor/.test(svg));
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 800); assert.equal(info.height, 800); assert.equal(data[3], 0);
      if (state === 'transparent') {
        for (const [x, y] of [[400, 112], [160, 448], [640, 448]]) assert.equal(data[(y * 800 + x) * 4 + 3], 0);
        report.transparentChecks++;
      } else assert.equal(data[(112 * 800 + 400) * 4 + 3], 255);
      if (state === 'locked') {
        for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
        report.grayscaleChecks++;
      }
      if (definition.id === 'first_strength_session') {
        assert.equal(hash(Buffer.from(svg)), approved[`first-session-${state}.svg`]);
        assert.equal(hash(bytes), approved[`first-session-${state}.png`]);
      }
      const stem = `individual-exports/${state}/strength-${definition.slug}-${state}`;
      write(stem + '.svg', svg); write(stem + '.png', bytes);
      assert((await pixels(svg)).data.equals(await sharp(path.join(__dirname, stem + '.png')).ensureAlpha().raw().toBuffer()));
      report.files.push({ id: definition.id, state, svg: stem + '.svg', png: stem + '.png', svgHash: hash(Buffer.from(svg)), pngHash: hash(bytes) });
      for (const size of [...sizes, 800]) {
        const frame = await pixels(isolated(`<path d="${master.frame}" stroke="#FFFFFF" stroke-width="1"/>`, size));
        const elements = { glyph: glyph(definition), ...Object.fromEntries(Object.entries(typography[definition.id].copy).map(([key, value]) => [key, master.lettering(key, '#FFFFFF', value)])), wordmark: master.lettering('wordmark') };
        for (const [key, content] of Object.entries(elements)) {
          const ink = await pixels(isolated(content, size));
          let min = size, max = -1, overlap = 0;
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const offset = (y * size + x) * 4 + 3;
            if (ink.data[offset] > 16) { min = Math.min(min, x); max = Math.max(max, x); if (frame.data[offset] > 16) overlap++; }
          }
          assert(min <= max && Math.abs(min - (size - 1 - max)) <= 1, `${definition.id}/${key}/${size} unequal margins ${min}/${size - 1 - max}`);
          assert.equal(overlap, 0, `${definition.id}/${key}/${size} frame collision`);
          report.rasterChecks.push({ id: definition.id, state, key, size, margins: [min, size - 1 - max], overlap });
        }
      }
    }
  }
  for (const state of master.states) { await board(state); await sizeBoard(state); }
  const exported = master.states.flatMap(state => fs.readdirSync(path.join(__dirname, 'individual-exports', state)).map(file => `individual-exports/${state}/${file}`)).sort();
  assert.deepEqual(exported, report.files.flatMap(file => [file.svg, file.png]).sort());
  assert.equal(exported.length, 60);
  checkSources();
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/strength', 'assets/achievements/strength', 'src/achievements/recovery', 'assets/achievements/recovery', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  report.status = 'pass';
  write('family-validation.json', JSON.stringify(report, null, 2) + '\n');
  write('individual-exports/manifest.json', JSON.stringify({ family: 'strength', canonicalStates: master.states, aliases: { 'share-opaque': 'unlocked', 'share-transparent': 'transparent' }, definitions, files: report.files }, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, pairs: report.files.length, artFiles: exported.length, rasterChecks: report.rasterChecks.length, grayscaleChecks: report.grayscaleChecks, transparentChecks: report.transparentChecks, changedProductionFiles: report.changedProductionFiles }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
