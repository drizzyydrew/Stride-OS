import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { RECOVERY_ACHIEVEMENT_DEFINITIONS } from '../src/achievements/recovery/recoveryDefinitions';
import { RECOVERY_COLORS } from '../src/achievements/recovery/recoveryTokens';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/recovery');
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

function assertTransparentInterior(png: PNG, label: string): void {
  const points = [
    [512, 180],
    [512, 220],
    [420, 585],
    [604, 585],
    [512, 612],
  ];
  assert(points.some(([x, y]) => alphaAt(png, x, y) === 0), `${label} does not expose true alpha in open interior space`);
}

function validateSvg(assetPath: string): string {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/padlock|chain|trophy|medal|medical cross|emergency|stop sign|modified appropriately/i.test(svg), `${assetPath} contains prohibited recovery badge content`);
  assert(svg.includes('STRIDEOS'), `${assetPath} is missing the STRIDEOS wordmark`);
  return svg;
}

function normalizeOpaqueSvg(svg: string): string {
  return svg.replace(/recovery-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-'));
}

const recoveryHexes = Object.values(RECOVERY_COLORS).map(value => value.toLowerCase());
const glyphMarkers = new Set<string>();
let checked = 0;

for (const definition of RECOVERY_ACHIEVEMENT_DEFINITIONS) {
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
  for (const hex of recoveryHexes) {
    assert(!lockedSvg.toLowerCase().includes(hex), `${definition.lockedArtworkPath} contains Recovery hue ${hex}`);
  }
  glyphMarkers.add(definition.glyph);

  if (definition.id === 'recovery_week_completed') assert(unlockedSvg.includes('M36.7 40 Q50 17.8'), 'Recovery Week glyph is missing sunrise path icon');
  if (definition.id === 'recovery_sleep_consistency') assert(unlockedSvg.includes('M32.2 43.7 C31 31.8'), 'Sleep Consistency glyph is missing cycle icon');
  if (definition.id === 'recovery_smart_rest_day') assert(unlockedSvg.includes('M47 39.5 L50 43'), 'Smart Rest Day glyph is missing calm acknowledgment mark');
  if (definition.id === 'recovery_readiness_respected') assert(unlockedSvg.includes('M28.2 22.8 V59.4'), 'Readiness Respected glyph is missing hammock supports');
  if (definition.id === 'recovery_symptoms_reported_early') assert(unlockedSvg.includes('M55.3 20.6 H66.1'), 'Symptoms Reported Early glyph is missing early marker flag');
  if (definition.id === 'recovery_check_in_streak') assert(unlockedSvg.includes('rx="21.5" ry="8.4"'), 'Check-In Streak glyph is missing ripple rings');
  if (definition.id === 'recovery_returned_gradually') assert(unlockedSvg.includes('ellipse cx="35.1" cy="60.5"'), 'Returned Gradually glyph is missing stepping stones');

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

assert(glyphMarkers.size === RECOVERY_ACHIEVEMENT_DEFINITIONS.length, 'Recovery badges must use unique glyph concepts');

const expectedNames = new Set([
  'manifest.json',
  ...RECOVERY_ACHIEVEMENT_DEFINITIONS.flatMap(definition => [
    `recovery-${definition.slug}-unlocked.svg`,
    `recovery-${definition.slug}-unlocked.png`,
    `recovery-${definition.slug}-locked.svg`,
    `recovery-${definition.slug}-locked.png`,
    `recovery-${definition.slug}-transparent.svg`,
    `recovery-${definition.slug}-transparent.png`,
    `recovery-${definition.slug}-opaque.svg`,
    `recovery-${definition.slug}-opaque.png`,
  ]),
]);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from recovery asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic Recovery asset filename`);

console.log(`Validated ${checked} Recovery assets across ${RECOVERY_ACHIEVEMENT_DEFINITIONS.length} achievements.`);
