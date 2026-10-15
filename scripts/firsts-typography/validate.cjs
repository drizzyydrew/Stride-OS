#!/usr/bin/env node
// Typography-only raster validation; all QA images stay outside production assets.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const bundledSharp = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const sharp = require(process.env.FIRSTS_SHARP_MODULE || bundledSharp);
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const output = process.env.FIRSTS_TYPOGRAPHY_QA || path.join(os.tmpdir(), 'strideos-firsts-typography-qa');
const sizes = [48, 64, 96, 128, 256, 800];
const ts = require(path.join(root, 'node_modules/typescript'));
const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const wrap = (markup, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" color="white">${markup}</svg>`;
const originalText = (entry) => `<text ${Object.entries({ ...entry.attributes, fill: 'white' }).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>${escape(entry.text)}</text>`;
const outlinedText = (entry) => entry.markup;

async function raster(svg) {
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function bounds(buffer, info, channel = 3) {
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (buffer[(y * info.width + x) * 4 + channel] >= 16) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  return right === -1 ? null : [left, top, right, bottom];
}

function compare(reference, outline) {
  let delta = 0, mass = 0, intersection = 0, union = 0;
  for (let i = 3; i < reference.data.length; i += 4) {
    const a = reference.data[i], b = outline.data[i];
    delta += Math.abs(a - b); mass += a;
    intersection += Math.min(a, b); union += Math.max(a, b);
  }
  const referenceBounds = bounds(reference.data, reference.info);
  const outlineBounds = bounds(outline.data, outline.info);
  if (!referenceBounds || !outlineBounds) throw new Error('Blank typography raster');
  const boundsDelta = Math.max(...referenceBounds.map((value, index) => Math.abs(value - outlineBounds[index])));
  return { referenceBounds, outlineBounds, boundsDelta, alphaError: delta / mass, alphaIoU: intersection / union };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const moduleText = fs.readFileSync(path.join(root, 'src/achievements/firsts/firstsTypography.ts'), 'utf8');
  if (/<text\b/.test(moduleText)) throw new Error('Runtime typography still contains text');
  const definitionsPath = path.join(root, 'src/achievements/firsts/firstsDefinitions.ts');
  const definitions = ts.createSourceFile(definitionsPath, fs.readFileSync(definitionsPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const idDeclaration = definitions.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'FirstAchievementId');
  if (!idDeclaration) throw new Error('Missing canonical achievement ID type');
  const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, skipLibCheck: true, types: [] };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile;
  // Check the generated contract against the real ID union without compiling the app.
  host.readFile = (filename) => path.resolve(filename) === definitionsPath ? idDeclaration.getText(definitions) : readFile(filename);
  const program = ts.createProgram([path.join(root, 'src/achievements/firsts/firstsTypography.ts')], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: (f) => f, getNewLine: () => '\n' }));
  const results = [], clipping = [], snapshots = [], sourceRows = [], seen = new Set(), badgeComposite = [];
  for (const entry of manifest.entries) {
    if (!moduleText.includes(JSON.stringify(entry.markup).slice(1, -1))) throw new Error(`Missing runtime path: ${entry.text}`);
    const key = JSON.stringify([entry.text, entry.attributes]);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const size of sizes) {
      const reference = await raster(wrap(originalText(entry), size));
      const outline = await raster(wrap(outlinedText(entry), size));
      const comparison = compare(reference, outline);
      results.push({ id: entry.id, role: entry.role, text: entry.text, size, ...comparison });
      if (size === 800) {
        const source = manifest.sources.find((source) => source.path === entry.source);
        const container = await raster(wrap(`<path fill="white" d="${entry.containerPath || source.containerPath}"/>`, size));
        let outside = 0;
        for (let i = 3; i < outline.data.length; i += 4) {
          if (outline.data[i] >= 16 && container.data[i] < 250) outside++;
        }
        clipping.push({ id: entry.id, role: entry.role, text: entry.text, outsidePixels: outside });
      }
      if (size === 800) {
        const crop = { left: 100, top: entry.role === 'shield' ? 200 : 430, width: 600, height: entry.role === 'shield' ? 160 : 210 };
        sourceRows.push({ text: entry.text, image: await sharp(reference.data, { raw: reference.info }).extract(crop).png().toBuffer(), outline: await sharp(outline.data, { raw: outline.info }).extract(crop).png().toBuffer(), crop });
      }
    }
  }
  for (const source of manifest.sources) {
    const filename = path.join(root, source.path);
    const svg = fs.readFileSync(filename, 'utf8');
    if (crypto.createHash('sha256').update(svg).digest('hex') !== source.sha256) throw new Error(`Source changed: ${source.path}`);
    const entries = manifest.entries.filter((entry) => entry.source === source.path);
    let count = 0;
    const outlined = svg.replace(/<text\b[^>]*>[^<]*<\/text>/g, () => {
      const entry = entries[count++];
      return entry.markup.replace('currentColor', entry.attributes.fill);
    });
    if (count !== entries.length || /<text\b/.test(outlined)) throw new Error(`Unreplaced text: ${source.path}`);
    const saved = await sharp(filename.replace(/\.svg$/, '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rendered = await raster(svg);
    const outlinedRaster = await raster(outlined);
    let currentVsSaved = 0, outlineVsSaved = 0;
    for (let i = 0; i < saved.data.length; i++) {
      currentVsSaved += Math.abs(saved.data[i] - rendered.data[i]);
      outlineVsSaved += Math.abs(saved.data[i] - outlinedRaster.data[i]);
    }
    snapshots.push({ source: source.path, currentVsSavedMean: currentVsSaved / saved.data.length, outlineVsSavedMean: outlineVsSaved / saved.data.length });
    const stem = path.basename(filename, '.svg');
    await sharp(Buffer.from(outlined)).png().toFile(path.join(output, `${stem}-outlined.png`));
    const pair = snapshots.length - 1;
    badgeComposite.push({ input: await sharp(filename.replace(/\.svg$/, '.png')).resize(256, 256).png().toBuffer(), left: (pair % 4) * 512, top: Math.floor(pair / 4) * 256 });
    badgeComposite.push({ input: await sharp(Buffer.from(outlined)).resize(256, 256).png().toBuffer(), left: (pair % 4) * 512 + 256, top: Math.floor(pair / 4) * 256 });
  }
  const rowHeight = 220;
  const composite = [];
  for (let index = 0; index < sourceRows.length; index++) {
    const row = sourceRows[index];
    composite.push({ input: row.image, left: 0, top: index * rowHeight });
    composite.push({ input: row.outline, left: 620, top: index * rowHeight });
  }
  await sharp({ create: { width: 1220, height: sourceRows.length * rowHeight, channels: 4, background: '#090A07' } }).composite(composite).png().toFile(path.join(output, 'comparison.png'));
  await sharp({ create: { width: 2048, height: Math.ceil(snapshots.length / 4) * 256, channels: 4, background: '#090A07' } }).composite(badgeComposite).png().toFile(path.join(output, 'badge-comparison.png'));
  for (let start = 0; start < sourceRows.length; start += 8) {
    await sharp(path.join(output, 'comparison.png')).extract({ left: 0, top: start * rowHeight, width: 1220, height: Math.min(8, sourceRows.length - start) * rowHeight }).png().toFile(path.join(output, `comparison-${start / 8 + 1}.png`));
  }
  const failures = results.filter((row) => row.boundsDelta > 1 || row.alphaError > (row.size === 800 ? 0.02 : 0.10));
  const clipped = clipping.filter((entry) => entry.outsidePixels > 0);
  const drift = snapshots.filter((entry) => entry.currentVsSavedMean !== 0);
  const report = { versions: sharp.versions, output, sizes, typecheck: 'pass (typography module and canonical ID union)', rows: sourceRows.map((row) => row.text), results, clipping, snapshots, failures, clipped, drift };
  fs.writeFileSync(path.join(output, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ typecheck: 'pass', comparisons: results.length, snapshots: snapshots.length, maxBoundsDelta: Math.max(...results.map((r) => r.boundsDelta)), maxAlphaError800: Math.max(...results.filter((r) => r.size === 800).map((r) => r.alphaError)), maxSnapshotDifference: Math.max(...snapshots.map((r) => r.currentVsSavedMean)), failures: failures.map(({ text, size, boundsDelta, alphaError }) => ({ text, size, boundsDelta, alphaError })), clipped, drift, report: path.join(output, 'validation.json') }, null, 2));
  if (failures.length || clipped.length || drift.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
