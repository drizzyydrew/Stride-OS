import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { STRENGTH_ACHIEVEMENT_DEFINITIONS } from '../src/achievements/strength/strengthDefinitions';
import { STRENGTH_COLORS } from '../src/achievements/strength/strengthTokens';
import { strengthSessionDumbbellFragment } from '../src/achievements/strength/strengthArtwork';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/strength');
const EXPECTED_VIEWBOX = '0 0 100 100';
const EXPECTED_PNG_SIZE = 1024;
const SESSION_IDS = new Set([
  'first_strength_session',
  'strength_10_sessions',
  'strength_25_sessions',
  'strength_50_sessions',
  'strength_100_sessions',
]);

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

function assertTransparentInterior(png: PNG, label: string): void {
  const points = [
    [512, 185],
    [512, 235],
    [428, 575],
    [596, 575],
    [512, 610],
  ];
  assert(points.some(([x, y]) => alphaAt(png, x, y) === 0), `${label} does not expose true alpha in open interior space`);
}

function validateSvg(assetPath: string): string {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/padlock|chain|trophy|medal|flex|skull|lower-body|single-leg|race prep/i.test(svg), `${assetPath} contains prohibited badge content`);
  assert(svg.includes('STRIDEOS'), `${assetPath} is missing the STRIDEOS wordmark`);
  return svg;
}

function normalizeOpaqueSvg(svg: string): string {
  return svg.replace(/strength-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-'));
}

const strengthHexes = Object.values(STRENGTH_COLORS).map(value => value.toLowerCase());
let checked = 0;
let sessionDumbbellReference: string | null = null;

for (const definition of STRENGTH_ACHIEVEMENT_DEFINITIONS) {
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
  assert(transparentSvg.includes('fill="transparent" fill-opacity="0"'), `${definition.shareTransparentSvgPath} does not clear the hexagon interior`);
  assert(normalizeOpaqueSvg(opaqueSvg) === unlockedSvg, `${definition.shareOpaqueSvgPath} does not match unlocked SVG artwork`);
  for (const hex of strengthHexes) {
    assert(!lockedSvg.toLowerCase().includes(hex), `${definition.lockedArtworkPath} contains warm Strength hue ${hex}`);
  }

  if (SESSION_IDS.has(definition.id)) {
    const fragment = strengthSessionDumbbellFragment(unlockedSvg);
    assert(fragment, `${definition.id} is missing the canonical dumbbell fragment`);
    if (!sessionDumbbellReference) {
      sessionDumbbellReference = fragment;
    } else {
      assert(fragment === sessionDumbbellReference, `${definition.id} dumbbell differs from the canonical session dumbbell`);
    }
  }

  if (definition.id === 'strength_100_sessions') {
    const matches = unlockedSvg.match(/canonical-strength-dumbbell/g) ?? [];
    assert(matches.length === 1, '100 Strength Sessions must use exactly one canonical dumbbell and no added plates');
  }
  if (definition.id === 'strength_6_weeks_consistent' || definition.id === 'strength_12_weeks_consistent') {
    assert(unlockedSvg.includes('M73.1 22.5 L75.1 27'), `${definition.id} is missing the shared milestone star`);
  }
  if (definition.id === 'prehab_resilience_block') {
    assert(unlockedSvg.includes('M42.1 35.1 L50 39.9'), 'Prehab & Resilience glyph is missing internal structural chevrons');
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
  const transparentPng = readPng(definition.shareTransparentPngPath);
  assertAlphaVariation(transparentPng, definition.shareTransparentPngPath);
  assertTransparentInterior(transparentPng, definition.shareTransparentPngPath);
}

const expectedNames = new Set([
  'manifest.json',
  ...STRENGTH_ACHIEVEMENT_DEFINITIONS.flatMap(definition => [
    `strength-${definition.slug}-unlocked.svg`,
    `strength-${definition.slug}-unlocked.png`,
    `strength-${definition.slug}-locked.svg`,
    `strength-${definition.slug}-locked.png`,
    `strength-${definition.slug}-transparent.svg`,
    `strength-${definition.slug}-transparent.png`,
    `strength-${definition.slug}-opaque.svg`,
    `strength-${definition.slug}-opaque.png`,
  ]),
]);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from strength asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic Strength asset filename`);

console.log(`Validated ${checked} Strength assets across ${STRENGTH_ACHIEVEMENT_DEFINITIONS.length} achievements.`);
