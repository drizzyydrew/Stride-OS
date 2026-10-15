const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const art = require('./artwork.cjs');
const root = path.resolve(__dirname, '../../../..'), sizes = [48, 64, 96, 128, 256, 800];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const isolated = (content, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">${content}</svg>`;
function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('path')).filter(node => !node.hasAttribute('data-background')).map(node =>
    Object.fromEntries(['d', 'transform', 'stroke-width', 'data-part', 'data-text', 'data-ring'].map(key => [key, node.getAttribute(key)])),
  );
}
async function main() {
  assert.equal(process.cwd(), root);
  for (const [file, expected] of Object.entries(art.data.sources)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, file);
  assert.equal(art.data.rings.foundation.length, art.data.definitions[0].ringCount);
  assert.equal(art.data.rings.foundation.length, 5);
  assert.equal(art.render('share-opaque'), art.render('unlocked'));
  assert.equal(art.render('share-transparent'), art.render('transparent'));
  const checks = [], exports = {}, boards = [];
  for (const state of art.states) {
    const svg = art.render(state);
    assert(!/<(?:text|image)\b|font-family=|href=/.test(svg));
    assert.deepEqual(geometry(svg), geometry(art.render('unlocked')));
    const stem = `foundation-${state}`;
    fs.writeFileSync(path.join(__dirname, `${stem}.svg`), svg);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(__dirname, `${stem}.png`), png);
    exports[`${stem}.svg`] = hash(svg); exports[`${stem}.png`] = hash(png);
    assert.deepEqual(await pixels(svg), await sharp(path.join(__dirname, `${stem}.png`)).ensureAlpha().raw().toBuffer());
    for (const size of sizes) {
      const p = art.colors[state === 'locked' ? 'locked' : 'unlocked'];
      const data = await pixels(art.render(state, size));
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      const alpha = (x, y) => data[(Math.floor(y * size) * size + Math.floor(x * size)) * 4 + 3];
      assert.equal(alpha(.02, .02), 0);
      // Empty area between the mountain and title, below every open arch.
      assert.equal(alpha(.5, .59), state === 'transparent' ? 0 : 255);
      const border = await pixels(isolated(`<path d="${art.data.outer}" transform="scale(${art.scale})" stroke="white" stroke-width="2.8"/><path d="${art.data.bevel}" transform="scale(${art.scale})" stroke="white" stroke-width=".65"/>`, size));
      for (const [part, content] of Object.entries({ title: art.lettering('title', 'white'), wordmark: art.lettering('wordmark', 'white'), chevrons: art.chevrons(p) })) {
        const ink = await pixels(isolated(content, size));
        let left = size, right = -1, overlap = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4 + 3;
          if (ink[offset] > 16) { left = Math.min(left, x); right = Math.max(right, x); if (border[offset] > 16) overlap++; }
        }
        assert(right >= left && Math.abs(left - (size - 1 - right)) <= 1, `${part}/${size}: unequal horizontal margins`);
        assert.equal(overlap, 0, `${part}/${size}: outer border/bevel collision`);
        checks.push({ state, size, part, margins: [left, size - 1 - right], borderOverlap: overlap });
      }
    }
    boards.push({ input: await sharp(Buffer.from(art.render(state, 320))).png().toBuffer(), left: 15 + boards.length * 335, top: 25 });
  }
  await sharp({ create: { width: 1020, height: 370, channels: 3, background: '#151C1B' } }).composite(boards).png().toFile(path.join(__dirname, 'foundation-states.png'));
  for (const state of art.states) {
    const layers = []; let left = 18;
    for (const size of sizes.slice(0, -1)) {
      layers.push({ input: await sharp(Buffer.from(art.render(state, size))).png().toBuffer(), left, top: 278 - size });
      left += size + 22;
    }
    await sharp({ create: { width: left, height: 300, channels: 3, background: '#151C1B' } }).composite(layers).png().toFile(path.join(__dirname, `foundation-${state}-sizes.png`));
  }
  const changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/runLevels', 'assets/achievements/system/run-levels', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual(changedProductionFiles, []);
  fs.writeFileSync(path.join(__dirname, 'preview-validation.json'), `${JSON.stringify({ scope: 'User-approved Foundation baseline; no app integration. See FAMILY_REVIEW.md for full-family QA.', result: 'PASS', ringCount: 5, checks, states: art.states, sizes, exports, sourceHashes: art.data.sources, changedProductionFiles }, null, 2)}\n`);
  console.log(`PASS: six SVG/PNG exports, ${checks.length} centered copy/border checks, five canonical arches, grayscale/alpha and SVG/PNG parity.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
