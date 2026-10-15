const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ranked = require('./render-system.cjs');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));

const dir = __dirname;
const repo = path.resolve(dir, '../../../..');
const root = path.join(dir, 'individual-exports');
const states = ['unlocked', 'locked', 'transparent'];
const size = 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function write(relative, bytes) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(bytes))) fs.writeFileSync(target, bytes);
}

async function main() {
  assert.equal(path.resolve(process.cwd()), repo, 'Run from the canonical Developer repository root.');
  for (const source of ranked.system.sources) {
    assert.equal(hash(fs.readFileSync(path.join(repo, source.path))), source.sha256, 'Streak source changed; refresh export-system.ts first.');
  }
  const frozen = JSON.parse(fs.readFileSync(path.join(dir, 'approved-reference-hashes.json'), 'utf8'));
  for (const [name, expected] of Object.entries(frozen)) assert.equal(hash(fs.readFileSync(path.join(dir, name))), expected, `Approved reference changed: ${name}`);

  const manifest = {
    version: 1,
    viewBox: '0 0 100 100',
    pngSize: size,
    dailyRange: { first: 1, last: 365 },
    states,
    sourceHashes: ranked.system.sources,
    entries: [],
  };

  async function exportEntry(group, days, state, definition) {
    const svg = ranked.render(days, state, size);
    assert.equal(ranked.render(days, 'share-opaque', size), ranked.render(days, 'unlocked', size));
    assert.equal(ranked.render(days, 'share-transparent', size), ranked.render(days, 'transparent', size));
    assert(!/<image\b|<text\b|font-family=/.test(svg));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const stem = group === 'daily'
      ? `daily/${state}/streak-day-${String(days).padStart(3, '0')}-${state}`
      : `milestones/${state}/streak-${definition.slug}-${state}`;
    write(`${stem}.svg`, svg);
    write(`${stem}.png`, png);
    manifest.entries.push({ group, days, state, ...(definition ? { id: definition.id } : {}), svg: `${stem}.svg`, png: `${stem}.png`, svgHash: hash(Buffer.from(svg)), pngHash: hash(png) });
  }

  for (let days = 1; days <= 365; days++) {
    for (const state of states) await exportEntry('daily', days, state);
    if (days % 50 === 0 || days === 365) console.log(`Daily badges: ${days}/365, all three states.`);
  }
  for (const definition of ranked.system.milestones) {
    for (const state of states) await exportEntry('milestones', definition.day, state, definition);
  }
  assert.equal(manifest.entries.length, 1125);
  assert.equal(new Set(manifest.entries.flatMap(entry => [entry.svg, entry.png])).size, 2250);
  write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log('Created 365 daily badges and 10 milestone awards: 1,125 SVG/PNG pairs at 1024px.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
