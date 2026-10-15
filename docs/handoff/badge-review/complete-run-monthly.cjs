const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../../..');
const run = require('./run-levels/family-artwork.cjs');
const monthly = require('./monthly-distance/artwork.cjs');
const states = ['unlocked', 'locked', 'transparent'], sizes = [48, 64, 96, 128, 256, 800];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const serializer = new XMLSerializer();
const jobs = [
  { family: 'run-levels', prefix: 'run-level', title: 'RUN LEVELS', art: run, parts: ['rings', 'mountain', 'title', 'wordmark', 'chevrons'], backgrounds: [[.5, .59]], borderParts: ['frame', 'bevel'] },
  { family: 'monthly-distance', prefix: 'monthly-distance', title: 'MONTHLY DISTANCE', art: monthly, parts: ['number', 'period', 'wordmark', 'chevrons'], backgrounds: [[.5, .18], [.5, .70]], borderParts: ['frame'] },
];
const pixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
function write(file, bytes) {
  const buffer = Buffer.from(bytes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buffer)) fs.writeFileSync(file, buffer);
}
function parse(svg) {
  const errors = [];
  const document = new DOMParser({ onError: (level, message) => errors.push(message) }).parseFromString(svg, 'image/svg+xml');
  assert.deepEqual(errors, [], 'SVG must parse without errors.');
  assert.equal(document.documentElement.getAttribute('viewBox'), '0 0 100 100');
  return document;
}
function geometry(svg) {
  return Array.from(parse(svg).getElementsByTagName('*')).filter(node => ['path', 'g'].includes(node.tagName) && !node.hasAttribute('data-background')).map(node =>
    [node.tagName, ...['d', 'transform', 'stroke-width', 'data-part', 'data-lettering', 'data-text', 'data-ring'].map(key => node.getAttribute(key))],
  );
}
function isolated(document, keys, size) {
  const defs = serializer.serializeToString(document.getElementsByTagName('defs')[0]);
  const content = Array.from(document.getElementsByTagName('*')).filter(node => keys.includes(node.getAttribute('data-part')) || keys.includes(node.getAttribute('data-lettering'))).map(node => {
    const isolatedNode = node.cloneNode(true);
    if (isolatedNode.getAttribute('data-part') === 'frame') isolatedNode.setAttribute('fill', 'none');
    return serializer.serializeToString(isolatedNode);
  }).join('');
  assert(content.length > 0, `Missing drawing part: ${keys}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">${defs}${content}</svg>`;
}
function bounds(data, size) {
  let min = size, max = -1, top = size, bottom = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3] > 16) {
    min = Math.min(min, x); max = Math.max(max, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert(max >= min, 'Drawing part must not be blank.');
  return { margins: [min, size - 1 - max], top, bottom };
}
function preserve() {
  for (const [file, expected] of Object.entries(require('./run-levels/approved-foundation-hashes.json'))) assert.equal(hash(fs.readFileSync(path.join(__dirname, 'run-levels', file))), expected, file);
  for (const family of ['weekly-distance', 'challenges', 'strength', 'recovery']) for (const file of require(`./${family}/individual-exports/manifest.json`).files) {
    assert.equal(hash(fs.readFileSync(path.join(__dirname, family, file.svg))), file.svgHash, file.svg);
    assert.equal(hash(fs.readFileSync(path.join(__dirname, family, file.png))), file.pngHash, file.png);
  }
}
async function board(job, state) {
  const layers = [], width = 1120, height = 610, tile = 250;
  for (const [i, definition] of job.art.definitions.entries()) {
    const row = i < 4 ? 0 : 1, column = i < 4 ? i : i - 4;
    const offset = row === 1 ? 135 : 0;
    layers.push({ input: await png(job.art.render(definition.id, state, tile)), left: 20 + offset + column * 275, top: 55 + row * 275 });
  }
  layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="560" y="30" fill="#DDDDDD" font-family="Arial" font-size="20" text-anchor="middle">${job.title}${state === 'unlocked' ? '' : ` / ${state.toUpperCase()}`}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#293A40' : '#080A09' } }).composite(layers).png().toFile(path.join(__dirname, job.family, `${job.family}-${state}.png`));
}
async function sizeBoard(job, state) {
  const width = 1600, height = 50 + job.art.definitions.length * 275, layers = [];
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="#DDDDDD" font-family="Arial" font-size="12">`;
  for (const [column, size] of sizes.slice(0, -1).entries()) labels += `<text x="${210 + column * 275 + 128}" y="24" text-anchor="middle">${size}px</text>`;
  for (const [row, definition] of job.art.definitions.entries()) {
    labels += `<text x="10" y="${50 + row * 275 + 128}">${definition.slug}</text>`;
    for (const [column, size] of sizes.slice(0, -1).entries()) layers.push({ input: await png(job.art.render(definition.id, state, size)), left: 210 + column * 275 + Math.round((256 - size) / 2), top: 50 + row * 275 + Math.round((256 - size) / 2) });
  }
  layers.push({ input: Buffer.from(labels + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#293A40' : '#080A09' } }).composite(layers).png().toFile(path.join(__dirname, job.family, `${job.family}-${state}-sizes.png`));
}
async function main() {
  assert.equal(process.cwd(), root);
  preserve();
  for (const job of jobs) {
    const folder = path.join(__dirname, job.family), art = job.art;
    for (const [file, expected] of Object.entries(art.sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, file);
    assert.equal(art.definitions.length, 7);
    assert.equal(new Set(art.definitions.map(value => value.id)).size, 7);
    const report = { family: job.family, scope: 'Seven family artworks and review exports only; no app integration or release', result: 'PASS', states, sizes, files: [], rasterChecks: [], grayscaleChecks: 0, transparentChecks: 0, sourceHashes: art.sources };
    for (const definition of art.definitions) {
      const baseline = geometry(art.render(definition.id));
      assert.equal(art.render(definition.id, 'share-opaque'), art.render(definition.id, 'unlocked'));
      assert.equal(art.render(definition.id, 'share-transparent'), art.render(definition.id, 'transparent'));
      for (const state of states) {
        const svg = art.render(definition.id, state), document = parse(svg), bytes = await png(svg), data = await pixels(svg);
        assert.deepEqual(geometry(svg), baseline);
        assert(!/<(?:text|image)\b|font-family=|href=/.test(svg));
        const meta = await sharp(bytes).metadata();
        assert.equal(meta.width, 800); assert.equal(meta.height, 800);
        assert.equal(data[3], 0);
        if (job.family === 'run-levels') assert.equal(Array.from(document.getElementsByTagName('path')).filter(node => node.hasAttribute('data-ring')).length, definition.ringCount);
        if (state === 'locked') {
          for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
          report.grayscaleChecks++;
        }
        for (const [x, y] of job.backgrounds) assert.equal(data[(Math.floor(y * 800) * 800 + Math.floor(x * 800)) * 4 + 3], state === 'transparent' ? 0 : 255);
        if (state === 'transparent') report.transparentChecks++;
        const stem = `individual-exports/${state}/${job.prefix}-${definition.slug}-${state}`;
        write(path.join(folder, `${stem}.svg`), svg); write(path.join(folder, `${stem}.png`), bytes);
        assert.deepEqual(data, await sharp(path.join(folder, `${stem}.png`)).ensureAlpha().raw().toBuffer());
        report.files.push({ id: definition.id, state, svg: `${stem}.svg`, png: `${stem}.png`, svgHash: hash(svg), pngHash: hash(bytes) });
        for (const size of sizes) {
          const border = await pixels(isolated(document, job.borderParts, size));
          for (const part of job.parts) {
            const ink = await pixels(isolated(document, [part], size)), b = bounds(ink, size);
            assert(Math.abs(b.margins[0] - b.margins[1]) <= 1, `${job.family}/${definition.slug}/${part}/${state}/${size}: unequal margins ${b.margins}`);
            assert(b.margins[0] > 0 && b.margins[1] > 0 && b.top > 0 && b.bottom < size - 1, `${definition.slug}/${part}: clipping`);
            let overlap = 0;
            for (let i = 3; i < ink.length; i += 4) if (ink[i] > 16 && border[i] > 16) overlap++;
            assert.equal(overlap, 0, `${job.family}/${definition.slug}/${part}/${size}: border/bevel collision`);
            report.rasterChecks.push({ id: definition.id, state, size, part, ...b, borderOverlap: overlap });
          }
        }
      }
    }
    for (const state of states) { await board(job, state); await sizeBoard(job, state); }
    const actual = states.flatMap(state => fs.readdirSync(path.join(folder, 'individual-exports', state)).map(file => `individual-exports/${state}/${file}`)).sort();
    assert.deepEqual(actual, report.files.flatMap(file => [file.svg, file.png]).sort());
    assert.equal(actual.length, 42);
    write(path.join(folder, 'individual-exports/manifest.json'), `${JSON.stringify({ family: job.family, canonicalStates: states, aliases: { 'share-opaque': 'unlocked', 'share-transparent': 'transparent' }, definitions: art.definitions, files: report.files }, null, 2)}\n`);
    write(path.join(folder, 'family-validation.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ family: job.family, result: report.result, pairs: report.files.length, artFiles: actual.length, rasterChecks: report.rasterChecks.length, grayscaleChecks: report.grayscaleChecks, transparentChecks: report.transparentChecks }));
  }
  preserve();
  const changed = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/runLevels', 'src/achievements/monthlyDistance', 'assets/achievements/system/run-levels', 'assets/achievements/monthly-distance', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(changed, '', 'No scoped production files should change.');
  console.log('Preservation PASS: Foundation six hashes, preceding family exports and scoped app/watch files unchanged.');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
