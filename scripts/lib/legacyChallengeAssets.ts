import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { renderChallengeBadgeSvg } from '../../src/achievements/challenges/challengesArtwork';
import { firstsRasterizer, writeFirstsPng } from './firstsRasterizer';

const states = ['unlocked', 'locked', 'transparent'] as const;
const root = 'assets/achievements/challenges/challenges-5k-month';
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const files = (state: typeof states[number]) => ({ svg: `${root}-${state}.svg`, png: `${root}-${state}.png` });
const frozen = (revision: string, file: string) => execFileSync('git', ['show', `${revision}:${file}`]);
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
const serialize = (node: Parameters<XMLSerializer['serializeToString']>[0]) => new XMLSerializer().serializeToString(node);

function checkpointRaster(svg: string): Buffer {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'strideos-legacy-5k-'));
  try {
    const input = path.join(dir, 'source.svg'), output = path.join(dir, 'source.png');
    writeFileSync(input, svg);
    execFileSync('sips', ['-s', 'format', 'png', '-z', '1024', '1024', input, '--out', output], { stdio: 'pipe' });
    return readFileSync(output);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function generateLegacyChallengeAssets() {
  for (const state of states) {
    const paths = files(state);
    writeFileSync(paths.svg, renderChallengeBadgeSvg('challenge_5k_month', state), 'utf8');
    await writeFirstsPng(renderChallengeBadgeSvg('challenge_5k_month', state, { size: 1024 }), paths.png);
  }
  return {
    achievementId: 'challenge_5k_month',
    presentation: 'legacy; existing award and history preserved',
    states: Object.fromEntries(states.map(state => {
      const paths = files(state);
      return [state, { ...paths, svgHash: sha(readFileSync(paths.svg)), pngHash: sha(readFileSync(paths.png)) }];
    })),
  };
}

function withoutLettering(svg: string): string {
  const doc = parse(svg);
  for (const node of Array.from(doc.getElementsByTagName('*'))) {
    if (node.tagName === 'text' || node.hasAttribute('data-legacy-lettering')) node.parentNode?.removeChild(node);
  }
  return serialize(doc).replace(/>\s+</g, '><').trim();
}

function bounds(data: Buffer, size: number): number[] {
  const result = [size, size, -1, -1];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3] >= 16) {
    result[0] = Math.min(result[0], x); result[1] = Math.min(result[1], y);
    result[2] = Math.max(result[2], x); result[3] = Math.max(result[3], y);
  }
  assert(result[2] >= result[0], 'Blank legacy lettering');
  return result;
}

export async function validateLegacyChallengeAssets(manifest: unknown): Promise<string[]> {
  const provenance = JSON.parse(readFileSync('scripts/legacy-challenge-typography/manifest.json', 'utf8'));
  for (const [file, hash] of Object.entries(provenance.sources)) assert.equal(sha(frozen(provenance.revision, file)), hash, `Frozen legacy source drift: ${file}`);
  const saved = manifest as Awaited<ReturnType<typeof generateLegacyChallengeAssets>>;
  assert.equal(saved?.achievementId, 'challenge_5k_month');
  // The existing export stack resolves fonts only here, never in production.
  type RasterImage = { resize(width: number, height: number): RasterImage; ensureAlpha(): { raw(): { toBuffer(): Promise<Buffer> } } };
  const sharp = firstsRasterizer() as unknown as (input: Buffer) => RasterImage;
  const letteringRasters = new Map<string, Buffer>();
  const letteringRaster = (markup: string) => {
    let png = letteringRasters.get(markup);
    if (!png) {
      png = checkpointRaster(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${markup}</svg>`);
      letteringRasters.set(markup, png);
    }
    return png;
  };
  let comparisons = 0, worstAlpha = 0, worstBounds = 0, worstPngDifference = 0, worstInkMassDifference = 0;
  const measuredBounds: { key: string | null; before: number[]; after: number[] }[] = [];
  for (const compact of [false, true]) {
    assert.equal(renderChallengeBadgeSvg('challenge_5k_month', 'share-opaque', { compact }), renderChallengeBadgeSvg('challenge_5k_month', 'unlocked', { compact }));
    assert.equal(renderChallengeBadgeSvg('challenge_5k_month', 'share-transparent', { compact }), renderChallengeBadgeSvg('challenge_5k_month', 'transparent', { compact }));
  }
  for (const state of states) {
    const paths = files(state);
    const source = frozen(provenance.revision, paths.svg).toString();
    const svg = readFileSync(paths.svg, 'utf8');
    assert.equal(svg, renderChallengeBadgeSvg('challenge_5k_month', state));
    assert.doesNotMatch(svg, /<text\b|font-family=|<image\b|(?:href|xlink:href)=|\{\{/);
    assert.deepEqual(saved.states[state], { ...paths, svgHash: sha(svg), pngHash: sha(readFileSync(paths.png)) });
    assert.equal(withoutLettering(svg), withoutLettering(source), `${state}: legacy non-lettering geometry/paint changed`);
    const png = await sharp(readFileSync(paths.png)).ensureAlpha().raw().toBuffer();
    const app = await sharp(Buffer.from(renderChallengeBadgeSvg('challenge_5k_month', state, { size: 1024 }))).ensureAlpha().raw().toBuffer();
    assert.equal(png.length, 1024 * 1024 * 4);
    assert(png.equals(app), `${state}: legacy SVG/PNG divergence`);
    const oldPng = await sharp(frozen(provenance.revision, paths.png)).ensureAlpha().raw().toBuffer();
    // The checkpoint used sips, so reproduce it with that same export engine.
    const sourcePixels = await sharp(checkpointRaster(source)).ensureAlpha().raw().toBuffer();
    assert(sourcePixels.equals(oldPng), `${state}: tooling font resolution differs from checkpoint PNG`);
    const outlinedPixels = await sharp(checkpointRaster(svg)).ensureAlpha().raw().toBuffer();
    let pngDifference = 0;
    for (let i = 0; i < oldPng.length; i++) pngDifference += Math.abs(oldPng[i] - outlinedPixels[i]);
    const meanPngDifference = pngDifference / (oldPng.length * 255);
    worstPngDifference = Math.max(worstPngDifference, meanPngDifference);
    const sourceText = Array.from(parse(source).getElementsByTagName('text'));
    for (const compact of [false, true]) {
      const compactSvg = renderChallengeBadgeSvg('challenge_5k_month', state, { compact });
      assert.doesNotMatch(compactSvg, /<text\b|font-family=/);
      const doc = parse(compactSvg);
      const ids = Array.from(doc.getElementsByTagName('*')).map(node => node.getAttribute('id')).filter(Boolean);
      assert.equal(ids.length, new Set(ids).size);
      for (const ref of compactSvg.matchAll(/url\(#([^()]+)\)/g)) assert(ids.includes(ref[1]));
      const outlines = Array.from(doc.getElementsByTagName('path')).filter(node => node.hasAttribute('data-legacy-lettering'));
      const texts = sourceText.filter(node => !compact || Number(node.getAttribute('y')) < 60);
      assert.equal(outlines.length, texts.length);
      for (let index = 0; index < texts.length; index++) for (const attr of ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width']) {
        assert.equal(outlines[index].getAttribute(attr), texts[index].getAttribute(attr), `${state}: legacy lettering paint drift ${attr}`);
      }
      for (const size of [1024, 256, 128, 96, 64, 48]) {
        for (let index = 0; index < texts.length; index++) {
          const reference = texts[index].cloneNode(true) as (typeof texts)[number];
          // sips ignores text fill-opacity. A group applies the original SVG
          // paint semantics so font coverage is compared at equal opacity.
          const opacity = reference.getAttribute('fill-opacity');
          reference.removeAttribute('fill-opacity');
          const referenceMarkup = opacity ? `<g opacity="${opacity}">${serialize(reference)}</g>` : serialize(reference);
          const old = await sharp(letteringRaster(referenceMarkup)).resize(size, size).ensureAlpha().raw().toBuffer();
          const actual = await sharp(letteringRaster(serialize(outlines[index]))).resize(size, size).ensureAlpha().raw().toBuffer();
          const oldBounds = bounds(old, size), newBounds = bounds(actual, size);
          const shift = Math.max(...oldBounds.map((value, axis) => Math.abs(value - newBounds[axis])));
          let difference = 0, mass = 0, actualMass = 0;
          for (let i = 3; i < old.length; i += 4) { difference += Math.abs(old[i] - actual[i]); mass += old[i]; actualMass += actual[i]; }
          const alphaDifference = difference / mass;
          assert(shift <= 1, `${state}/${compact}/${size}/${index}: legacy ink shifted ${shift}px`);
          // This retired archival art is not an approved pixel-parity family.
          // Report raster variance, including sips text-opacity behavior,
          // instead of weakening the active families' pixel equality gate.
          worstInkMassDifference = Math.max(worstInkMassDifference, Math.abs(actualMass - mass) / mass);
          if (state === 'unlocked' && !compact && size === 1024) measuredBounds.push({ key: outlines[index].getAttribute('data-legacy-lettering'), before: oldBounds, after: newBounds });
          worstAlpha = Math.max(worstAlpha, alphaDifference); worstBounds = Math.max(worstBounds, shift);
          comparisons++;
        }
      }
    }
    const alpha = (x: number, y: number) => app[(y * 1024 + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) assert.equal(alpha(x, y), 0);
    if (state === 'transparent') assert.equal(alpha(512, 256), 0, 'Legacy share interior lost alpha');
  }
  console.log(`Legacy 5K 1024px ink bounds: ${JSON.stringify(measuredBounds)}`);
  console.log(`Legacy 5K archival validation: 6 SVG/PNG assets, ${comparisons} lettering comparisons, maximum ink shift ${worstBounds}px; source paints/frame, export pixels, aliases and transparent alpha PASS. Historical raster variance: alpha ${(worstAlpha * 100).toFixed(3)}%, ink mass ${(worstInkMassDifference * 100).toFixed(3)}%, mean PNG channel difference ${(worstPngDifference * 100).toFixed(4)}%. No historical source pixel-parity claim.`);
  return states.flatMap(state => Object.values(files(state)));
}
