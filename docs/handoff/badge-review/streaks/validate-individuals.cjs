// Run only after export-individuals.cjs has completed its manifest.
// node docs/handoff/badge-review/streaks/validate-individuals.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));

const dir = __dirname;
const repoRoot = path.resolve(dir, '../../../..');
const exportRoot = path.join(dir, 'individual-exports');
const reportPath = path.join(dir, 'individual-validation.json');
const states = ['unlocked', 'locked', 'transparent'];
const sizes = [48, 64, 96, 128, 256];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const report = {
  status: 'running',
  scope: 'individual review exports only; no app integration or writes',
  expectedPairs: 1125,
  pngSize: 1024,
  sizes,
  inventory: {},
  checks: { svgFresh: 0, pngPixelFresh: 0, palette: 0, labels: 0, stateGeometry: 0, aliases: 0, transparent: 0, lockedGray: 0, approvedHashes: 0 },
  numeralChecks: [],
};

function parseSVG(svg) {
  const problems = [];
  const document = new DOMParser({ errorHandler: {
    warning: message => problems.push(message),
    error: message => problems.push(message),
    fatalError: message => problems.push(message),
  } }).parseFromString(svg, 'image/svg+xml');
  assert.equal(problems.length, 0, problems.join('\n'));
  assert.equal(document.documentElement.tagName, 'svg');
  const allowed = new Set(['svg', 'defs', 'linearGradient', 'radialGradient', 'stop', 'path', 'g', 'ellipse']);
  for (const element of Array.from(document.getElementsByTagName('*'))) assert(allowed.has(element.tagName), `Unexpected SVG element: ${element.tagName}`);
  return document;
}

function geometry(document) {
  return Array.from(document.getElementsByTagName('*')).filter(element => ['path', 'g'].includes(element.tagName)).map(element =>
    Object.fromEntries(['d', 'transform', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'data-frame', 'data-glyph', 'data-lettering', 'data-text', 'data-chevrons'].map(key => [key, element.getAttribute(key)])),
  );
}

function paths(document) { return Array.from(document.getElementsByTagName('path')); }
function labelled(document, name) {
  const found = Array.from(document.getElementsByTagName('*')).filter(element => element.getAttribute('data-lettering') === name);
  assert.equal(found.length, 1, `Expected exactly one ${name}`);
  return found[0];
}
function serialized(element) { return new XMLSerializer().serializeToString(element); }
function isolated(markup, size) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">${markup}</svg>`; }
async function raster(input) {
  return sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function walk(relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(exportRoot, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    assert(!entry.isSymbolicLink(), `Export symlink is not allowed: ${name}`);
    if (entry.isDirectory()) files.push(...walk(name));
    else { assert(entry.isFile(), `Unexpected export entry: ${name}`); files.push(name); }
  }
  return files;
}

function assertHash(value, expected, label) {
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.equal(sha(value), expected, `${label}: SHA-256 mismatch`);
}

function palette(document, days, state, ranked, liveDefinitions, liveTokens) {
  const tier = liveDefinitions.streakHeatTierForDays(days);
  const source = liveTokens.STREAK_HEAT_COLORS[tier.token];
  const tokens = state === 'locked' ? ranked.common.colors.locked : {
    ...source, text: source.primary, flameTop: source.center, flameBottom: source.primary, background: liveTokens.STREAK_NEAR_BLACK,
  };
  const gradients = Array.from(document.getElementsByTagName('linearGradient'));
  const edge = gradients.find(element => element.getAttribute('id') === `streak-${days}-ranked-${state}-edge`);
  const flame = gradients.find(element => element.getAttribute('id') === `streak-${days}-ranked-${state}-flame`);
  assert(edge && flame, 'Missing palette gradients');
  const stops = element => Array.from(element.getElementsByTagName('stop')).map(stop => stop.getAttribute('stop-color'));
  assert.deepEqual(stops(edge), [tokens.highlight, tokens.primary, tokens.shadow]);
  assert.deepEqual(stops(flame), [tokens.flameTop, tokens.flameBottom]);
  assert.equal(labelled(document, 'number').getAttribute('fill'), tokens.text);
  assert.equal(labelled(document, 'title').getAttribute('fill'), tokens.text);
  assert.equal(labelled(document, 'wordmark').getAttribute('fill'), tokens.primary);
  const frame = paths(document).find(element => element.hasAttribute('data-frame'));
  assert(frame);
  assert.equal(frame.getAttribute('fill'), state === 'transparent' ? 'none' : tokens.background);
  if (state === 'transparent') assert.equal(document.getElementsByTagName('ellipse').length, 0);
}

async function validateNumerals(ranked, artwork) {
  for (let days = 1; days <= 365; days++) {
    const document = parseSVG(ranked.render(days, 'unlocked', 1024));
    const number = labelled(document, 'number').cloneNode(true);
    number.setAttribute('fill', '#FFFFFF');
    const layout = ranked.numberLayout(days);
    assert.equal(layout.text, String(days));
    assert(Math.abs(layout.bounds[0] + layout.bounds[2] - 100) < 1e-7, `Off-center model: ${days}`);
    assert(layout.bounds[2] - layout.bounds[0] <= 34.000001, `Too-wide model: ${days}`);
    assert(layout.bounds[1] > artwork.flame.bounds[3] + 2, `Flame/number model collision: ${days}`);
    assert(layout.bounds[3] + 2 < artwork.title.bounds[1], `Number/title model collision: ${days}`);
    const frame = paths(document).find(element => element.hasAttribute('data-frame')).cloneNode(true);
    frame.setAttribute('fill', 'none'); frame.setAttribute('stroke', '#FFFFFF');
    const flame = paths(document).find(element => element.hasAttribute('data-glyph')).cloneNode(true);
    flame.setAttribute('fill', '#FFFFFF');
    const title = labelled(document, 'title').cloneNode(true); title.setAttribute('fill', '#FFFFFF');
    for (const size of sizes) {
      const ink = await raster(Buffer.from(isolated(serialized(number), size)));
      const obstacles = await raster(Buffer.from(isolated(serialized(frame) + serialized(flame) + serialized(title), size)));
      let left = size, right = -1, top = size, bottom = -1, overlap = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4 + 3;
        if (ink.data[i] > 16) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          if (obstacles.data[i] > 16) overlap++;
        }
      }
      assert(left <= right, `Blank numeral: ${days}/${size}`);
      assert(Math.abs(left - (size - 1 - right)) <= 1, `Numeral margin mismatch: ${days}/${size}`);
      assert(left > 0 && right < size - 1 && top > 0 && bottom < size - 1, `Clipped numeral: ${days}/${size}`);
      assert.equal(overlap, 0, `Numeral/frame/flame/title overlap: ${days}/${size}`);
      report.numeralChecks.push({ days, size, bounds: [left, top, right, bottom], margins: [left, size - 1 - right], overlap });
    }
    if (days % 25 === 0 || days === 365) console.log(`Numerals ${days}/365: ${report.numeralChecks.length}/1825 size checks passed`);
  }
}

async function main() {
  assert.equal(path.resolve(process.cwd()), repoRoot, 'Run from the canonical repository root.');
  const manifestPath = path.join(exportRoot, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'Manifest is not ready. Run only after the exporter completes.');
  const manifest = readJSON(manifestPath);
  assert.equal(manifest.version, 1); assert.equal(manifest.viewBox, '0 0 100 100'); assert.equal(manifest.pngSize, 1024);
  assert.deepEqual(manifest.dailyRange, { first: 1, last: 365 }); assert.deepEqual(manifest.states, states);
  assert(Array.isArray(manifest.entries)); assert.equal(manifest.entries.length, 1125);
  const inputNames = ['individual-exports/manifest.json', 'system.json', 'artwork.json', 'digits.json', 'frame.js', 'ranked-artwork.js', 'render-system.cjs', 'approved-reference-hashes.json'];
  const stableInputs = inputNames.map(name => ({ path: name, sha256: sha(fs.readFileSync(path.join(dir, name))) }));

  // tsx is already installed; disable its disk cache before loading source TS.
  process.env.TSX_DISABLE_CACHE = '1';
  require('tsx/cjs');
  const liveDefinitions = require(path.join(repoRoot, 'src/achievements/streaks/streakDefinitions.ts'));
  const liveTokens = require(path.join(repoRoot, 'src/achievements/streaks/streakTokens.ts'));
  const ranked = require('./render-system.cjs');
  const artwork = readJSON(path.join(dir, 'artwork.json'));
  const system = readJSON(path.join(dir, 'system.json'));
  assert.deepEqual(system.tiers, liveDefinitions.STREAK_HEAT_TIERS.map(tier => ({ ...tier, maxDays: tier.maxDays ?? null, colors: liveTokens.STREAK_HEAT_COLORS[tier.token] })));
  assert.equal(system.tiers.length, 9); assert.equal(system.background, liveTokens.STREAK_NEAR_BLACK);
  const milestones = liveDefinitions.STREAK_MILESTONE_DEFINITIONS.map(definition => ({ id: definition.id, slug: definition.slug, day: definition.thresholdDays, title: definition.displayName, subtitle: definition.subtitle }));
  assert.deepEqual(system.milestones, milestones); assert.equal(milestones.length, 10); assert.equal(milestones[0].day, 7);
  for (const sample of system.boundarySamples) assert.equal(sample.token, liveDefinitions.streakHeatTierForDays(sample.days).token);
  assert.deepEqual(manifest.sourceHashes, system.sources); assert.equal(manifest.sourceHashes.length, 2);
  for (const source of manifest.sourceHashes) assertHash(fs.readFileSync(path.join(repoRoot, source.path)), source.sha256, source.path);
  report.sourceHashes = manifest.sourceHashes;
  report.inputHashes = stableInputs;

  const expected = new Map();
  for (let days = 1; days <= 365; days++) for (const state of states) {
    const stem = `daily/${state}/streak-day-${String(days).padStart(3, '0')}-${state}`;
    expected.set(stem + '.svg', { group: 'daily', days, state, svg: stem + '.svg', png: stem + '.png' });
  }
  for (const milestone of milestones) for (const state of states) {
    const stem = `milestones/${state}/streak-${milestone.slug}-${state}`;
    expected.set(stem + '.svg', { group: 'milestones', days: milestone.day, state, id: milestone.id, svg: stem + '.svg', png: stem + '.png' });
  }
  assert.equal(expected.size, 1125);
  const seen = new Set();
  for (const entry of manifest.entries) {
    const wanted = expected.get(entry.svg); assert(wanted, `Unexpected manifest path: ${entry.svg}`);
    assert(!seen.has(entry.svg), `Duplicate manifest path: ${entry.svg}`); seen.add(entry.svg);
    for (const key of ['group', 'days', 'state', 'svg', 'png', 'id']) assert.equal(entry[key], wanted[key], `${entry.svg}: ${key} mismatch`);
    assert.match(entry.svgHash, /^[0-9a-f]{64}$/); assert.match(entry.pngHash, /^[0-9a-f]{64}$/);
  }
  assert.equal(seen.size, 1125);
  const actualFiles = walk().sort();
  const expectedFiles = ['manifest.json', ...Array.from(expected.values()).flatMap(entry => [entry.svg, entry.png])].sort();
  assert.deepEqual(actualFiles, expectedFiles, 'Missing or extra export files');
  report.inventory = { pairs: expected.size, svg: 1125, png: 1125, dailyPairs: 1095, milestonePairs: 30, totalFilesIncludingManifest: actualFiles.length };

  const approved = readJSON(path.join(dir, 'approved-reference-hashes.json'));
  assert.equal(Object.keys(approved).length, 6);
  for (const state of states) {
    const originalSVG = fs.readFileSync(path.join(dir, `three-day-${state}.svg`));
    const originalPNG = fs.readFileSync(path.join(dir, `three-day-${state}.png`));
    assertHash(originalSVG, approved[`three-day-${state}.svg`], `Approved ${state} SVG`);
    assertHash(originalPNG, approved[`three-day-${state}.png`], `Approved ${state} PNG`);
    assert.equal(ranked.common.render(state), originalSVG.toString('utf8'));
    const freshPNG = await sharp(Buffer.from(ranked.common.render(state))).png().toBuffer();
    assertHash(freshPNG, approved[`three-day-${state}.png`], `Fresh champagne ${state} PNG`);
    report.checks.approvedHashes += 2;
    stableInputs.push({ path: `three-day-${state}.svg`, sha256: sha(originalSVG) }, { path: `three-day-${state}.png`, sha256: sha(originalPNG) });
  }

  const geometryByDay = new Map();
  const frozenFrame = geometry(parseSVG(ranked.common.render('unlocked', 1024))).filter(element => element['data-frame'] || element['data-glyph'] || element['data-chevrons']);
  let completed = 0, lastProgress = Date.now();
  for (const entry of manifest.entries) {
    const context = `${entry.group}/${entry.days}/${entry.state}`;
    const svgBytes = fs.readFileSync(path.join(exportRoot, entry.svg));
    const pngBytes = fs.readFileSync(path.join(exportRoot, entry.png));
    assertHash(svgBytes, entry.svgHash, entry.svg); assertHash(pngBytes, entry.pngHash, entry.png);
    const svg = svgBytes.toString('utf8');
    const freshSVG = entry.group === 'daily' ? ranked.render(entry.days, entry.state, 1024) : ranked.renderMilestone(entry.id, entry.state, 1024);
    assert.equal(svg, freshSVG, `Stale SVG: ${context}`); report.checks.svgFresh++;
    assert.equal(svg, ranked.render(entry.days, entry.state, 1024), `Milestone/daily divergence: ${context}`);
    const document = parseSVG(svg), root = document.documentElement;
    assert.equal(root.getAttribute('viewBox'), '0 0 100 100'); assert.equal(root.getAttribute('width'), '1024'); assert.equal(root.getAttribute('height'), '1024');
    assert.equal(labelled(document, 'number').getAttribute('data-text'), String(entry.days));
    assert.equal(labelled(document, 'title').getAttribute('data-text'), artwork.title.text);
    assert.equal(labelled(document, 'wordmark').getAttribute('data-text'), artwork.wordmark.text);
    assert(root.getAttribute('aria-label').includes(liveDefinitions.streakHeatTierForDays(entry.days).label)); report.checks.labels++;
    palette(document, entry.days, entry.state, ranked, liveDefinitions, liveTokens); report.checks.palette++;
    const signature = geometry(document);
    assert.deepEqual(signature.filter(element => element['data-frame'] || element['data-glyph'] || element['data-chevrons']), frozenFrame, `Approved frame/glyph drift: ${context}`);
    if (!geometryByDay.has(entry.days)) geometryByDay.set(entry.days, signature);
    assert.deepEqual(signature, geometryByDay.get(entry.days), `State geometry drift: ${context}`); report.checks.stateGeometry++;
    assert.equal(ranked.render(entry.days, 'share-opaque', 1024), ranked.render(entry.days, 'unlocked', 1024));
    assert.equal(ranked.render(entry.days, 'share-transparent', 1024), ranked.render(entry.days, 'transparent', 1024)); report.checks.aliases += 2;

    const metadata = await sharp(pngBytes).metadata();
    assert.equal(metadata.format, 'png'); assert(metadata.hasAlpha, `Missing PNG alpha: ${context}`);
    const saved = await raster(pngBytes), fresh = await raster(svgBytes);
    for (const image of [saved, fresh]) { assert.equal(image.info.width, 1024); assert.equal(image.info.height, 1024); assert.equal(image.info.channels, 4); }
    assert(saved.data.equals(fresh.data), `PNG pixels differ from fresh SVG: ${context}`); report.checks.pngPixelFresh++;
    const data = saved.data;
    for (let pixel = 0; pixel < 1024; pixel++) for (const [x, y] of [[pixel, 0], [pixel, 1023], [0, pixel], [1023, pixel]]) assert.equal(data[(y * 1024 + x) * 4 + 3], 0, `Canvas-edge clipping: ${context}`);
    assert.equal(data[3], 0, `Opaque exterior: ${context}`);
    if (entry.state === 'transparent') {
      for (const [x, y] of [[512, 140], [512, 471], [327, 614], [410, 758]]) assert.equal(data[(y * 1024 + x) * 4 + 3], 0, `Opaque interior or flame center: ${context}/${x},${y}`);
      report.checks.transparent++;
    }
    if (entry.state === 'locked') {
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2], `Colored locked pixel: ${context}`);
      report.checks.lockedGray++;
    }
    completed++;
    if (completed % 25 === 0 || Date.now() - lastProgress >= 10000 || completed === 1125) {
      console.log(`Individuals ${completed}/1125: fresh SVG/PNG pixels, geometry, labels and state checks passed`);
      lastProgress = Date.now();
    }
  }
  assert.equal(report.checks.svgFresh, 1125); assert.equal(report.checks.pngPixelFresh, 1125);
  assert.equal(report.checks.transparent, 375); assert.equal(report.checks.lockedGray, 375);
  await validateNumerals(ranked, artwork);
  assert.equal(report.numeralChecks.length, 1825);
  for (const input of stableInputs) assertHash(fs.readFileSync(path.join(dir, input.path)), input.sha256, `Input changed during validation: ${input.path}`);
  for (const source of manifest.sourceHashes) assertHash(fs.readFileSync(path.join(repoRoot, source.path)), source.sha256, `Source changed during validation: ${source.path}`);
  const productionPaths = ['src/achievements/streaks', 'assets/achievements/streaks', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'];
  const gitLines = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  report.productionChanges = {
    tracked: gitLines(['diff', 'HEAD', '--name-only', '--', ...productionPaths]),
    untracked: gitLines(['ls-files', '--others', '--exclude-standard', '--', ...productionPaths]),
  };
  assert.equal(report.productionChanges.tracked.length, 0); assert.equal(report.productionChanges.untracked.length, 0);
  report.status = 'pass';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, inventory: report.inventory, checks: report.checks, numeralChecks: report.numeralChecks.length, report: reportPath }));
}

if (require.main === module) main().catch(error => {
  report.status = 'failed'; report.error = String(error.stack || error);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.error(report.error); process.exitCode = 1;
});
