const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const { render, definitions, typography } = require('./artwork.cjs');

const root = __dirname;
const states = ['unlocked', 'locked', 'transparent'];
const unitSystems = ['imperial', 'metric'];
const sizes = [48, 64, 96, 128, 256];
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('path')).filter(element =>
    element.hasAttribute('data-frame') || element.hasAttribute('data-lettering') || element.hasAttribute('data-chevrons'),
  ).map(element => Object.fromEntries(['data-frame', 'data-lettering', 'data-text', 'data-chevrons', 'd', 'transform', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'].map(key => [key, element.getAttribute(key)])));
}

async function png(svg) { return sharp(Buffer.from(svg)).png().toBuffer(); }
async function pixels(svg) { return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }

function isolated(number, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><path d="${number.path}" transform="translate(${number.translateX} 0)" fill="#FFFFFF"/></svg>`;
}

function pixelBounds(data, width) {
  let minX = width, maxX = -1;
  let minY = width, maxY = -1;
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 16) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  assert(maxX >= minX && maxY >= minY, 'Blank outlined lettering');
  return { bounds: [minX, minY, maxX, maxY], margins: [minX, width - 1 - maxX] };
}

async function write(name, content) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(content))) fs.writeFileSync(target, content);
}

async function familyBoard(family, state, units = 'imperial') {
  const tile = 210, gap = 22, columns = 5, top = 70;
  const width = columns * (tile + gap) + gap;
  const height = Math.ceil(definitions[family].length / columns) * (tile + gap) + top + gap;
  const layers = [];
  for (const [index, definition] of definitions[family].entries()) {
    layers.push({ input: await png(render(family, definition.id, state, units, tile)), left: gap + index % columns * (tile + gap), top: top + Math.floor(index / columns) * (tile + gap) });
  }
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width / 2}" y="36" font-family="Arial" text-anchor="middle" font-size="21" fill="#DDDDDD">LIFETIME DISTANCE - ${family.toUpperCase()}${units === 'metric' ? ' / KM' : ''}${state === 'unlocked' ? '' : ` / ${state.toUpperCase()}`}</text></svg>`;
  layers.push({ input: Buffer.from(label), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#343834' : '#060706' } }).composite(layers).png().toFile(path.join(root, `${family}-${state}${units === 'metric' ? '-metric' : ''}.png`));
}

async function sizeBoard(family, state, units) {
  const width = 1570, height = 55 + definitions[family].length * 290;
  const layers = [];
  let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial" fill="#DDDDDD" font-size="14">`;
  for (const [index, size] of sizes.entries()) labels += `<text x="${190 + index * 275 + 128}" y="28" text-anchor="middle">${size}px</text>`;
  for (const [row, definition] of definitions[family].entries()) {
    labels += `<text x="14" y="${55 + row * 290 + 125}">${units === 'metric' ? definition.metricNumber + ' KM' : definition.imperialNumber + ' MI'}</text>`;
    for (const [column, size] of sizes.entries()) layers.push({ input: await png(render(family, definition.id, state, units, size)), left: 190 + column * 275 + Math.round((256 - size) / 2), top: 55 + row * 290 + Math.round((256 - size) / 2) });
  }
  labels += '</g></svg>';
  layers.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#343834' : '#060706' } }).composite(layers).png().toFile(path.join(root, `${family}-${state}-${units}-sizes.png`));
}

async function main() {
  const lockedHashes = path.join(root, 'approved-one-mile-hashes.json');
  const expectedApproved = {};
  for (const state of states) for (const extension of ['svg', 'png']) {
    const name = `one-mile-${state}.${extension}`;
    expectedApproved[name] = hash(fs.readFileSync(path.join(root, '../lifetime-running', name)));
  }
  if (fs.existsSync(lockedHashes)) assert.deepEqual(JSON.parse(fs.readFileSync(lockedHashes, 'utf8')), expectedApproved, 'Approved one-mile snapshot was changed');
  else await write('approved-one-mile-hashes.json', JSON.stringify(expectedApproved, null, 2) + '\n');
  const report = { scope: 'complete review artwork; no production replacement', families: {}, canonicalPairs: 0, metricPairs: 0, numeralChecks: [], alphaChecks: 0, grayscaleChecks: 0, files: [] };
  assert.equal(definitions.running.length, 10);
  assert.equal(definitions.cycling.length, 9);
  const ids = Object.values(definitions).filter(Array.isArray).flat().map(definition => definition.id);
  assert.equal(new Set(ids).size, 19);

  for (const [number, value] of Object.entries(typography.numbers)) {
    assert(Math.abs(value.bounds[0] - (100 - value.bounds[2])) < 1e-8, `${number} unequal SVG margins`);
    assert(value.bounds[3] <= 51.000001, `${number} descender collides with units`);
    for (const size of [...sizes, 800]) {
      const raster = await pixels(isolated(value, size));
      const measured = pixelBounds(raster.data, size);
      assert(Math.abs(measured.margins[0] - measured.margins[1]) <= 1, `${number} unequal raster margins at ${size}`);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (raster.data[(y * size + x) * 4 + 3] > 16) assert(Math.abs((x + .5) / size * 100 - 50) + Math.abs((y + .5) / size * 100 - 50) < 40.5, `${number} lacks diamond clearance at ${size}px`);
      }
      report.numeralChecks.push({ number, size, ...measured });
    }
  }

  for (const family of ['running', 'cycling']) {
    report.families[family] = definitions[family].map(({ id, thresholdMiles, thresholdMeters, imperialNumber, metricNumber }) => ({ id, thresholdMiles, thresholdMeters, imperialNumber, metricNumber }));
    for (const definition of definitions[family]) for (const units of unitSystems) {
      const baseline = geometry(render(family, definition.id, 'unlocked', units));
      assert.equal(render(family, definition.id, 'share-opaque', units), render(family, definition.id, 'unlocked', units));
      assert.equal(render(family, definition.id, 'share-transparent', units), render(family, definition.id, 'transparent', units));
      for (const state of states) {
        const svg = render(family, definition.id, state, units);
        assert.deepEqual(geometry(svg), baseline, `${definition.id}: state geometry changed`);
        assert(svg.includes('viewBox="0 0 100 100"') && svg.includes('data-chevrons="2"'));
        assert(!/<image\b|<text\b|font-family=|currentColor|\{\{/.test(svg));
        const bytes = await png(svg);
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, 800); assert.equal(info.height, 800);
        assert.equal(data[3], 0, 'Exterior must remain transparent');
        if (state === 'transparent') {
          for (const [x, y] of [[400, 150], [250, 440], [550, 440], [400, 750]]) assert.equal(data[(y * 800 + x) * 4 + 3], 0);
          report.alphaChecks++;
        }
        if (state === 'locked') {
          for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2], 'Colored locked pixel');
          report.grayscaleChecks++;
        }
        if (family === 'running' && definition.thresholdMiles === 1 && units === 'imperial') {
          assert.equal(hash(Buffer.from(svg)), expectedApproved[`one-mile-${state}.svg`], 'Approved SVG drift');
          assert.equal(hash(bytes), expectedApproved[`one-mile-${state}.png`], 'Approved PNG drift');
        }
        const stem = `exports/${family}/${units}/${definition.id}-${state}`;
        await write(stem + '.svg', svg); await write(stem + '.png', bytes);
        report.files.push({ id: definition.id, family, units, state, svg: stem + '.svg', png: stem + '.png', svgHash: hash(Buffer.from(svg)), pngHash: hash(bytes) });
        units === 'imperial' ? report.canonicalPairs++ : report.metricPairs++;
      }
    }
    for (const state of states) for (const units of unitSystems) {
      await familyBoard(family, state, units);
      await sizeBoard(family, state, units);
    }
  }
  assert.equal(report.canonicalPairs, 57);
  assert.equal(report.metricPairs, 57);
  const expectedFiles = report.files.flatMap(file => [file.svg, file.png]).sort();
  function exportedFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? exportedFiles(target) : [path.relative(root, target).split(path.sep).join('/')];
    });
  }
  assert.deepEqual(exportedFiles(path.join(root, 'exports')).sort(), expectedFiles, 'Unexpected or missing badge export');
  for (const file of report.files) {
    assert.equal(hash(fs.readFileSync(path.join(root, file.svg))), file.svgHash);
    assert.equal(hash(fs.readFileSync(path.join(root, file.png))), file.pngHash);
  }
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/lifetimeDistanceRunning', 'src/achievements/lifetimeDistanceCycling', 'assets/achievements/lifetime-distance-running', 'assets/achievements/lifetime-distance-cycling', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: path.resolve(root, '../../../..'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0, 'Preview scope has unexpected production changes');
  await write('validation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ running: 10, cycling: 9, canonicalPairs: report.canonicalPairs, metricPairs: report.metricPairs, numeralChecks: report.numeralChecks.length, alphaChecks: report.alphaChecks, grayscaleChecks: report.grayscaleChecks, changedProductionFiles: report.changedProductionFiles }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
