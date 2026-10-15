const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const art = require('./artwork.cjs');
const root = path.resolve(__dirname, '../../../..');
const sizes = [48, 64, 96, 128, 256, 800];
assert.equal(process.cwd(), root);
const hash = value => createHash('sha256').update(value).digest('hex');
const protectedFiles = Object.keys(art.source.sources);
for (const file of protectedFiles) assert.equal(hash(fs.readFileSync(path.join(root, file))), art.source.sources[file]);
assert.equal(art.render('share-opaque'), art.render('unlocked'));
assert.equal(art.render('share-transparent'), art.render('transparent'));
assert.throws(() => art.render('opaque'));

function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('*'))
    .filter(node => ['path', 'circle', 'rect', 'g', 'mask'].includes(node.tagName))
    .map(node => [node.tagName, ...['d', 'transform', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'stroke-width', 'data-part', 'data-lettering'].map(name => node.getAttribute(name))]);
}
async function raster(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer();
}
function bounds(data, size) {
  let x0 = size, x1 = -1, y0 = size, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (data[(y * size + x) * 4 + 3] > 8) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  assert(x1 >= x0, 'Raster must not be blank.');
  return { x0, x1, y0, y1 };
}
async function main() {
  const checks = [];
  const boards = [];
  for (const state of art.states) {
    const svg = art.render(state), stem = `august-base-builder-${state}`;
    assert(!/<(?:image|text)\b|href=/.test(svg), 'Vector paths only; no embedded raster or runtime fonts.');
    assert.deepEqual(geometry(svg), geometry(art.render('unlocked')), 'States must preserve all geometry.');
    fs.writeFileSync(path.join(__dirname, `${stem}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, `${stem}.png`));
    const filePixels = await sharp(path.join(__dirname, `${stem}.png`)).ensureAlpha().raw().toBuffer();
    assert.deepEqual(filePixels, await raster(svg, 800), 'PNG must match its SVG.');
    for (const size of sizes) {
      const pixels = await raster(svg, size), b = bounds(pixels, size);
      assert(Math.abs(b.x0 - (size - 1 - b.x1)) <= 1, 'Frame must have equal horizontal margins.');
      assert(b.x0 > 0 && b.y0 > 0 && b.x1 < size - 1 && b.y1 < size - 1, 'No clipping.');
      if (state === 'locked') for (let p = 0; p < pixels.length; p += 4) {
        assert.equal(pixels[p], pixels[p + 1]); assert.equal(pixels[p], pixels[p + 2]);
      }
      const alpha = (x, y) => pixels[(Math.floor(y * size) * size + Math.floor(x * size)) * 4 + 3];
      assert.equal(alpha(.02, .02), 0, 'Exterior alpha must be real.');
      assert.equal(alpha(.5, .58), state === 'transparent' ? 0 : 255, 'Empty interior alpha state.');
      const palette = art.colors[state === 'locked' ? 'locked' : 'unlocked'];
      const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" fill="none">${art.scene(palette)}${art.lettering(palette)}</svg>`;
      const border = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><path d="${art.frame}" fill="none" stroke="white" stroke-width="1"/></svg>`;
      const contentPixels = await raster(content, size), borderPixels = await raster(border, size);
      let collisions = 0;
      for (let p = 3; p < contentPixels.length; p += 4) if (contentPixels[p] > 8 && borderPixels[p] > 8) collisions++;
      assert.equal(collisions, 0, 'Art and lettering must not touch the border.');
      checks.push({ state, size, equalMargins: true, noClipping: true, frameCollisions: collisions, alpha: true, grayscale: state === 'locked' });
    }
    const panel = await sharp(Buffer.from(art.render(state, 340))).flatten({ background: state === 'transparent' ? '#273C43' : '#090A09' }).png().toBuffer();
    boards.push({ input: panel, left: 20 + boards.length * 360, top: 36 });
  }
  // The colored board panel demonstrates transparency; it is not an exported asset.
  await sharp({ create: { width: 1100, height: 400, channels: 4, background: '#090A09' } }).composite(boards).png().toFile(path.join(__dirname, 'august-three-states.png'));
  const small = [];
  let left = 18;
  for (const size of sizes.slice(0, -1)) {
    const input = await sharp(Buffer.from(art.render('unlocked', size))).png().toBuffer();
    small.push({ input, left, top: 280 - size }); left += size + 22;
  }
  await sharp({ create: { width: left, height: 300, channels: 4, background: '#090A09' } }).composite(small).png().toFile(path.join(__dirname, 'august-sizes.png'));
  const exports = Object.fromEntries(art.states.flatMap(state => ['svg', 'png'].map(extension => {
    const file = `august-base-builder-${state}.${extension}`;
    return [file, hash(fs.readFileSync(path.join(__dirname, file)))];
  })));
  const report = { scope: 'August Base Builder preview only; not app integration or native verification', result: 'PASS', canonicalId: art.source.definitions[0].id, states: art.states, checks, exports, sourceHashes: art.source.sources, userApproval: 'October 15, 2026: approved preview and requested family completion', independentCouncil: 'See FAMILY_REVIEW.md for the current family review; initial preview agents were rate-limited.' };
  fs.writeFileSync(path.join(__dirname, 'preview-validation.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('PASS: three SVG/PNG pairs, 18 state/size checks, grayscale, alpha, centered margins, border clearance and exact share aliases.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
