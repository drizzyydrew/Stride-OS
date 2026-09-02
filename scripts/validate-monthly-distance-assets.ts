import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { MONTHLY_DISTANCE_DEFINITIONS } from '../src/achievements/monthlyDistance/monthlyDistanceDefinitions';
import { MONTHLY_DISTANCE_TIER_COLORS } from '../src/achievements/monthlyDistance/monthlyDistanceTokens';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/monthly-distance');
const EXPECTED_VIEWBOX = '0 0 100 100';
const EXPECTED_PNG_SIZE = 1024;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readPng(assetPath: string): PNG {
  const buffer = readFileSync(path.resolve(process.cwd(), assetPath));
  return PNG.sync.read(buffer);
}

function alphaAt(png: PNG, x: number, y: number): number {
  return png.data[(png.width * y + x) * 4 + 3];
}

function assertTransparentCorners(png: PNG, label: string): void {
  const points = [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ];
  assert(points.every(([x, y]) => alphaAt(png, x, y) === 0), `${label} does not have transparent background corners`);
}

function assertNoCheckerboard(png: PNG, label: string): void {
  const sample = [
    [8, 8],
    [16, 8],
    [8, 16],
    [16, 16],
  ];
  const colors = sample.map(([x, y]) => {
    const offset = (png.width * y + x) * 4;
    return `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]},${png.data[offset + 3]}`;
  });
  assert(new Set(colors).size === 1 && colors[0]?.endsWith(',0'), `${label} appears to have an opaque or baked checkerboard corner`);
}

function assertAlphaVariation(png: PNG, label: string): void {
  let transparent = 0;
  let opaque = 0;
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] === 0) transparent += 1;
    if (png.data[index] === 255) opaque += 1;
    if (transparent > 500 && opaque > 500) return;
  }
  throw new Error(`${label} does not contain usable alpha transparency`);
}

function validateSvg(assetPath: string): string {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/nike|strava|apple|garmin/i.test(svg), `${assetPath} contains prohibited third-party brand text`);
  assert(!/padlock|chains?|star|medal|runner|shoe|trophy|calendar|clock/i.test(svg), `${assetPath} contains prohibited badge motif text`);
  assert(!/\bMI\b|\bKM\b/.test(svg), `${assetPath} contains converted unit text inside fixed-K badge artwork`);
  return svg;
}

function normalizeOpaqueSvg(svg: string): string {
  return svg.replace(/monthly-distance-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-'));
}

let checked = 0;
const tierHexes = Object.values(MONTHLY_DISTANCE_TIER_COLORS).flatMap(colors => Object.values(colors).map(value => value.toLowerCase()));

for (const definition of MONTHLY_DISTANCE_DEFINITIONS) {
  const allPaths = [
    definition.artworkPath,
    definition.lockedArtworkPath,
    definition.unlockedPngPath,
    definition.lockedPngPath,
    definition.shareTransparentSvgPath,
    definition.shareTransparentPngPath,
    definition.shareOpaqueSvgPath,
    definition.shareOpaquePngPath,
  ];

  for (const assetPath of allPaths) {
    const absolute = path.resolve(process.cwd(), assetPath);
    assert(existsSync(absolute), `${assetPath} is missing`);
    assert(statSync(absolute).size > 0, `${assetPath} is empty`);
    checked += 1;
  }

  const unlockedSvg = validateSvg(definition.artworkPath);
  const lockedSvg = validateSvg(definition.lockedArtworkPath);
  const transparentSvg = validateSvg(definition.shareTransparentSvgPath);
  const opaqueSvg = validateSvg(definition.shareOpaqueSvgPath);
  assert(unlockedSvg.includes('MONTH'), `${definition.artworkPath} is missing MONTH`);
  assert(unlockedSvg.includes('STRIDEOS'), `${definition.artworkPath} is missing STRIDEOS`);
  assert(transparentSvg.includes('fill="transparent" fill-opacity="0"'), `${definition.shareTransparentSvgPath} does not clear the hexagon interior`);
  assert(normalizeOpaqueSvg(opaqueSvg) === unlockedSvg, `${definition.shareOpaqueSvgPath} does not match unlocked SVG artwork`);
  for (const hex of tierHexes) {
    assert(!lockedSvg.toLowerCase().includes(hex), `${definition.lockedArtworkPath} contains tier hue ${hex}`);
  }

  for (const pngPath of [
    definition.unlockedPngPath,
    definition.lockedPngPath,
    definition.shareTransparentPngPath,
    definition.shareOpaquePngPath,
  ]) {
    const png = readPng(pngPath);
    assert(png.width === EXPECTED_PNG_SIZE && png.height === EXPECTED_PNG_SIZE, `${pngPath} has inconsistent dimensions`);
    assertTransparentCorners(png, pngPath);
    assertNoCheckerboard(png, pngPath);
  }
  assertAlphaVariation(readPng(definition.shareTransparentPngPath), definition.shareTransparentPngPath);
}

const expectedNames = new Set(
  MONTHLY_DISTANCE_DEFINITIONS.flatMap(definition => [
    `monthly-distance-${definition.slug}-unlocked.svg`,
    `monthly-distance-${definition.slug}-unlocked.png`,
    `monthly-distance-${definition.slug}-locked.svg`,
    `monthly-distance-${definition.slug}-locked.png`,
    `monthly-distance-${definition.slug}-transparent.svg`,
    `monthly-distance-${definition.slug}-transparent.png`,
    `monthly-distance-${definition.slug}-opaque.svg`,
    `monthly-distance-${definition.slug}-opaque.png`,
  ]),
);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from monthly-distance asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic monthly-distance asset filename`);

console.log(`Validated ${checked} Monthly Distance assets across ${MONTHLY_DISTANCE_DEFINITIONS.length} milestones.`);
