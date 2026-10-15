import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { APPROVED_BADGE_ASSETS, APPROVED_BADGE_STATES, approvedAssetPaths, type ApprovedAssetEntry } from './approvedBadgeFamilies';
import { firstsRasterizer } from './firstsRasterizer';
import { validateLegacyChallengeAssets } from './legacyChallengeAssets';

const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const normalize = (value: string) => value.replace(/[ \t]+$/gm, '').trim();
const geometryAttributes = ['d', 'points', 'transform', 'cx', 'cy', 'x', 'y', 'r', 'rx', 'ry', 'width', 'height', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'maskUnits'];
type RasterResult = { data: Buffer; info: { width: number; height: number } };
type RawRaster = {
  toBuffer(options: { resolveWithObject: true }): Promise<RasterResult>;
  toBuffer(): Promise<Buffer>;
};
type Rasterizer = (input: Buffer) => { ensureAlpha(): { raw(): RawRaster } };
function geometry(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('*')).filter(node => !['svg', 'defs', 'linearGradient', 'radialGradient', 'stop'].includes(node.tagName))
    .map(node => [node.tagName, ...geometryAttributes.map(key => node.getAttribute(key))]);
}
function validateSvg(svg: string, label: string): void {
  assert(svg.includes('viewBox="0 0 100 100"'), `${label}: wrong viewBox`);
  assert(!/<image\b|<script\b|(?:href|xlink:href)\s*=|https?:\/\/(?!www.w3.org\/2000\/svg)/i.test(svg), `${label}: external or embedded content`);
  assert(!/<text\b|font-family=|\{\{[^}]+\}\}/.test(svg), `${label}: uncompiled text/vector slots`);
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const ids = Array.from(document.getElementsByTagName('*')).map(node => node.getAttribute('id')).filter(Boolean);
  assert.equal(ids.length, new Set(ids).size, `${label}: duplicate SVG ids`);
  for (const ref of svg.matchAll(/url\(#([^()]+)\)/g)) assert(ids.includes(ref[1]), `${label}: broken namespace reference ${ref[1]}`);
}
function reference(entry: ApprovedAssetEntry, state: typeof APPROVED_BADGE_STATES[number]): string {
  if (entry.family !== 'streak') return entry.artwork.sources[state].path;
  const manifest = JSON.parse(readFileSync('docs/handoff/badge-review/streaks/individual-exports/manifest.json', 'utf8'));
  const file = manifest.entries.find((value: { group: string; id?: string; achievementId?: string; state: string }) => value.group === 'milestones' && (value.id === entry.id || value.achievementId === entry.id) && value.state === state);
  assert(file, `Missing approved milestone ${entry.id}/${state}`);
  assert.equal(sha(readFileSync(`docs/handoff/badge-review/streaks/individual-exports/${file.svg}`)), file.svgHash);
  return `docs/handoff/badge-review/streaks/individual-exports/${file.svg}`;
}

export async function validateApprovedBadges(family: string): Promise<void> {
  const sharp = firstsRasterizer() as unknown as Rasterizer;
  const entries = APPROVED_BADGE_ASSETS.filter(entry => entry.family === family);
  assert(entries.length, `Unknown approved family ${family}`);
  const expected = new Map<string, Set<string>>();
  const root = path.dirname(entries[0].definition.artworkPath);
  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
  assert.equal(manifest.version, 2);
  assert.equal(manifest.entries.length, entries.length);
  let checked = 0;
  for (const entry of entries) {
    for (const compact of [false, true]) {
      assert.equal(entry.render('share-opaque', undefined, compact), entry.render('unlocked', undefined, compact));
      assert.equal(entry.render('share-transparent', undefined, compact), entry.render('transparent', undefined, compact));
    }
    for (const state of APPROVED_BADGE_STATES) {
      const source = entry.artwork.sources[state];
      assert.equal(sha(readFileSync(source.path)), source.sha256, `Approved source drift: ${source.path}`);
      const files = approvedAssetPaths(entry, state);
      const manifestEntry = manifest.entries.find((value: { achievementId: string; units?: string }) => value.achievementId === entry.id && value.units === entry.units);
      assert(manifestEntry, `Missing manifest mapping ${entry.id}/${entry.units}`);
      assert.deepEqual(manifestEntry.states[state], { ...files, svgHash: sha(readFileSync(files.svg)), pngHash: sha(readFileSync(files.png)) });
      const dir = path.dirname(files.svg), names = expected.get(dir) ?? new Set<string>();
      names.add(path.basename(files.svg)); names.add(path.basename(files.png)); expected.set(dir, names);
      assert(statSync(files.svg).size > 0 && statSync(files.png).size > 0);
      const svg = readFileSync(files.svg, 'utf8');
      validateSvg(svg, files.svg);
      assert.equal(normalize(svg), normalize(entry.render(state)), `${files.svg}: app/export divergence`);
      const referencePath = reference(entry, state), referenceSvg = readFileSync(referencePath, 'utf8');
      assert.deepEqual(geometry(svg), geometry(referenceSvg), `${files.svg}: approved geometry drift`);
      const png = await sharp(readFileSync(files.png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const app = await sharp(Buffer.from(entry.render(state, 1024))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(png.info.width, 1024); assert.equal(png.info.height, 1024);
      assert(png.data.equals(app.data), `${files.png}: pixels differ from the app renderer`);
      const approved = await sharp(Buffer.from(referenceSvg.replace(/\bwidth="\d+" height="\d+"/, 'width="1024" height="1024"'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert(app.data.equals(approved.data), `${files.png}: approved reference pixel drift`);
      // Saved reference PNG proves the source SVG, independently of our compiler.
      const referencePng = await sharp(readFileSync(referencePath.replace(/\.svg$/, '.png'))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const atReferenceSize = await sharp(Buffer.from(entry.render(state, referencePng.info.width))).ensureAlpha().raw().toBuffer();
      assert(atReferenceSize.equals(referencePng.data), `${files.png}: approved PNG appearance drift`);
      for (const size of [48, 64, 96, 128, 256]) {
        const actual = await sharp(Buffer.from(entry.render(state, size))).ensureAlpha().raw().toBuffer();
        const expected = await sharp(Buffer.from(referenceSvg.replace(/\bwidth="\d+" height="\d+"/, `width="${size}" height="${size}"`))).ensureAlpha().raw().toBuffer();
        assert(actual.equals(expected), `${entry.id}/${state}/${size}px: small-size approved pixel drift`);
      }
      const at = (x: number, y: number) => app.data[(y * 1024 + x) * 4 + 3];
      for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023], [8, 8], [16, 16]]) assert.equal(at(x, y), 0, `${files.png}: opaque/checkerboard exterior`);
      if (state === 'transparent') {
        let emptyInterior = 0;
        for (let y = 180; y < 800; y++) for (let x = 350; x < 674; x++) if (at(x, y) === 0) emptyInterior++;
        assert(emptyInterior > 1000, `${files.png}: opaque empty interior`);
      }
      if (state === 'locked') for (let i = 0; i < app.data.length; i += 4) if (app.data[i + 3]) assert(app.data[i] === app.data[i + 1] && app.data[i + 1] === app.data[i + 2], `${files.png}: colored locked pixel`);
      validateSvg(entry.render(state, undefined, true), `${entry.id}/compact`);
      checked += 2;
    }
  }
  if (family === 'challenges') {
    const legacy = await validateLegacyChallengeAssets(manifest.legacy);
    for (const file of legacy) expected.get(path.dirname(file))!.add(path.basename(file));
  }
  for (const [dir, names] of expected) {
    for (const name of readdirSync(dir)) {
      if (name === 'manifest.json' || (name === 'metric' && dir === root && entries.some(entry => entry.units === 'metric'))) continue;
      assert(names.has(name), `Unexpected ${family} export ${dir}/${name}`);
    }
  }
  console.log(`Validated ${checked} approved ${family} assets and ${entries.length * 15} small-size pixel comparisons: app/export/reference geometry, pixels, aliases, namespaces, grayscale and alpha PASS.`);
}
