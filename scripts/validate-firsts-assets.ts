import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { FIRST_ACHIEVEMENT_DEFINITIONS } from '../src/achievements/firsts/firstsDefinitions';
import { FIRSTS_COLORS } from '../src/achievements/firsts/firstsTokens';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/firsts');
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
    [512, 160],
    [512, 200],
    [420, 585],
    [585, 585],
    [512, 610],
  ];
  assert(points.some(([x, y]) => alphaAt(png, x, y) === 0), `${label} does not expose true alpha in open interior space`);
}

function validateSvg(assetPath: string): string {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/nike|strava|apple|garmin|vitruvian|pilates|yoga|trophy|medal|padlock|chain/i.test(svg), `${assetPath} contains prohibited badge text`);
  assert(svg.includes('STRIDEOS'), `${assetPath} is missing the STRIDEOS wordmark`);
  return svg;
}

function normalizeOpaqueSvg(svg: string): string {
  return svg.replace(/firsts-[^"]+-opaque-/g, match => match.replace('-opaque-', '-unlocked-'));
}

const warmHexes = Object.values(FIRSTS_COLORS).map(value => value.toLowerCase());
let checked = 0;

for (const definition of FIRST_ACHIEVEMENT_DEFINITIONS) {
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
  for (const hex of warmHexes) {
    assert(!lockedSvg.toLowerCase().includes(hex), `${definition.lockedArtworkPath} contains warm Firsts hue ${hex}`);
  }

  if (definition.id === 'first_run') assert(/H31\.7/.test(unlockedSvg), 'First Run glyph is missing horizontal speed lines');
  if (definition.id === 'first_walk') assert(!/H31\.7/.test(unlockedSvg), 'First Walk glyph incorrectly contains run speed lines');
  if (definition.id === 'first_movement_lab_analysis') {
    assert(/H36\.6/.test(unlockedSvg) && /L50 31/.test(unlockedSvg), 'Movement Lab glyph is missing capture brackets or landmark segments');
    assert(!/stroke-dasharray/.test(unlockedSvg), 'Movement Lab glyph must not use motion/speed lines');
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
  ...FIRST_ACHIEVEMENT_DEFINITIONS.flatMap(definition => [
    `firsts-${definition.slug}-unlocked.svg`,
    `firsts-${definition.slug}-unlocked.png`,
    `firsts-${definition.slug}-locked.svg`,
    `firsts-${definition.slug}-locked.png`,
    `firsts-${definition.slug}-transparent.svg`,
    `firsts-${definition.slug}-transparent.png`,
    `firsts-${definition.slug}-opaque.svg`,
    `firsts-${definition.slug}-opaque.png`,
  ]),
]);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from firsts asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic Firsts asset filename`);

console.log(`Validated ${checked} Firsts assets across ${FIRST_ACHIEVEMENT_DEFINITIONS.length} achievements.`);
