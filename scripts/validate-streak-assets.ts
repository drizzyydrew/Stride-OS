import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { STREAK_MILESTONE_DEFINITIONS } from '../src/achievements/streaks/streakDefinitions';
import { STREAK_HEAT_COLORS, STREAK_LOCKED_GRAY } from '../src/achievements/streaks/streakTokens';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/streaks');
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

function validateSvg(assetPath: string): string {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/nike|strava|apple|garmin/i.test(svg), `${assetPath} contains prohibited third-party brand text`);
  assert(!/padlock|chains?|star|medal|runner|shoe|trophy|emoji/i.test(svg), `${assetPath} contains prohibited badge motif text`);
  assert(svg.includes('DAY STREAK'), `${assetPath} is missing DAY STREAK`);
  assert(svg.includes('STRIDEOS'), `${assetPath} is missing STRIDEOS`);
  return svg;
}

function normalizeOpaqueSvg(svg: string): string {
  return svg.replace(/streak-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-'));
}

let checked = 0;
const neutralLockedHexes = new Set([
  STREAK_LOCKED_GRAY.toLowerCase(),
  '#d0d2d2',
  '#444748',
  '#74787a',
  '#e8eaea',
  '#ffffff',
  '#f4f5f2',
  '#8e9294',
  '#d7e5ea',
]);
const tierHexes = Object.values(STREAK_HEAT_COLORS)
  .flatMap(colors => Object.values(colors).map(value => value.toLowerCase()))
  .filter(hex => !neutralLockedHexes.has(hex));

for (const definition of STREAK_MILESTONE_DEFINITIONS) {
  const allPaths = [
    definition.artworkPath,
    definition.lockedArtworkPath,
    definition.unlockedPngPath,
    definition.lockedPngPath,
    definition.shareAssetPaths.overlay,
    definition.shareTransparentPngPath,
    definition.shareAssetPaths.cleanDark,
    definition.shareOpaquePngPath,
  ];

  for (const assetPath of allPaths) {
    const absolute = path.resolve(process.cwd(), assetPath);
    assert(existsSync(absolute), `${assetPath} is missing`);
    assert(statSync(absolute).size > 0, `${assetPath} is empty`);
    checked += 1;
  }

  const unlockedSvg = validateSvg(definition.artworkPath);
  const lockedSvg = validateSvg(definition.lockedArtworkPath).toLowerCase();
  const transparentSvg = validateSvg(definition.shareAssetPaths.overlay);
  const opaqueSvg = validateSvg(definition.shareAssetPaths.cleanDark);
  assert(transparentSvg.includes('fill="transparent" fill-opacity="0"'), `${definition.shareAssetPaths.overlay} does not clear the hexagon interior`);
  assert(normalizeOpaqueSvg(opaqueSvg) === unlockedSvg, `${definition.shareAssetPaths.cleanDark} does not match unlocked SVG artwork`);
  for (const hex of tierHexes) {
    assert(!lockedSvg.includes(hex), `${definition.lockedArtworkPath} contains tier hue ${hex}`);
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
  assert(alphaAt(readPng(definition.shareTransparentPngPath), 256, 512) === 0, `${definition.shareTransparentPngPath} does not keep the empty badge interior transparent`);
}

const expectedNames = new Set([
  'manifest.json',
  ...STREAK_MILESTONE_DEFINITIONS.flatMap(definition => [
    `streak-${definition.slug}-unlocked.svg`,
    `streak-${definition.slug}-unlocked.png`,
    `streak-${definition.slug}-locked.svg`,
    `streak-${definition.slug}-locked.png`,
    `streak-${definition.slug}-transparent.svg`,
    `streak-${definition.slug}-transparent.png`,
    `streak-${definition.slug}-opaque.svg`,
    `streak-${definition.slug}-opaque.png`,
  ]),
]);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from streak asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic streak asset filename`);

console.log(`Validated ${checked} Streak assets across ${STREAK_MILESTONE_DEFINITIONS.length} milestones.`);
