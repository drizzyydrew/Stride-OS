import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { RUN_LEVEL_DEFINITIONS } from '../src/achievements/runLevels/runLevelDefinitions';

const ASSET_DIR = path.resolve(process.cwd(), 'assets/achievements/system/run-levels');
const EXPECTED_VIEWBOX = '0 0 256 256';
const EXPECTED_PNG_SIZE = 1024;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readPng(assetPath: string): PNG {
  const buffer = readFileSync(path.resolve(process.cwd(), assetPath));
  return PNG.sync.read(buffer);
}

function hasTransparentCorner(png: PNG): boolean {
  const points = [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ];
  return points.every(([x, y]) => png.data[(png.width * y + x) * 4 + 3] === 0);
}

function hasAlphaVariation(png: PNG): boolean {
  let transparent = 0;
  let opaque = 0;
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] === 0) transparent += 1;
    if (png.data[index] === 255) opaque += 1;
    if (transparent > 500 && opaque > 500) return true;
  }
  return false;
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

function validateSvg(assetPath: string): void {
  const svg = readFileSync(path.resolve(process.cwd(), assetPath), 'utf8');
  assert(svg.includes(`viewBox="${EXPECTED_VIEWBOX}"`), `${assetPath} has inconsistent viewBox`);
  assert(/<path d="M\d+\.\d{2} \d+\.\d{2}.* Q\d+\.\d{2}/.test(svg), `${assetPath} does not use softened rounded hex path geometry`);
  assert(!/<image\b/i.test(svg), `${assetPath} embeds an external image`);
  assert(!/nike|strava|apple|garmin/i.test(svg), `${assetPath} contains prohibited third-party brand text`);
  assert(!/padlock|chains?|star|medal|runner silhouette/i.test(svg), `${assetPath} contains prohibited badge motif text`);
}

let checked = 0;
for (const level of RUN_LEVEL_DEFINITIONS) {
  const svgPaths = [
    level.artworkPath,
    level.lockedArtworkPath,
    level.shareTransparentSvgPath,
    level.shareOpaqueSvgPath,
  ];
  const pngPaths = [
    level.shareTransparentPngPath,
    level.shareOpaquePngPath,
  ];

  for (const assetPath of [...svgPaths, ...pngPaths]) {
    const absolute = path.resolve(process.cwd(), assetPath);
    assert(existsSync(absolute), `${assetPath} is missing`);
    assert(statSync(absolute).size > 0, `${assetPath} is empty`);
    checked += 1;
  }

  svgPaths.forEach(validateSvg);

  const transparent = readPng(level.shareTransparentPngPath);
  const opaque = readPng(level.shareOpaquePngPath);
  assert(transparent.width === EXPECTED_PNG_SIZE && transparent.height === EXPECTED_PNG_SIZE, `${level.shareTransparentPngPath} has inconsistent dimensions`);
  assert(opaque.width === EXPECTED_PNG_SIZE && opaque.height === EXPECTED_PNG_SIZE, `${level.shareOpaquePngPath} has inconsistent dimensions`);
  assert(hasTransparentCorner(transparent), `${level.shareTransparentPngPath} does not have transparent background corners`);
  assert(hasAlphaVariation(transparent), `${level.shareTransparentPngPath} does not contain usable alpha transparency`);
  assertNoCheckerboard(transparent, level.shareTransparentPngPath);
}

const expectedNames = new Set(
  RUN_LEVEL_DEFINITIONS.flatMap(level => [
    `run-level-${level.slug}-unlocked.svg`,
    `run-level-${level.slug}-locked.svg`,
    `run-level-${level.slug}-share-transparent.svg`,
    `run-level-${level.slug}-share-transparent.png`,
    `run-level-${level.slug}-share-opaque.svg`,
    `run-level-${level.slug}-share-opaque.png`,
  ]),
);
const actualNames = new Set(readdirSync(ASSET_DIR));
for (const name of expectedNames) assert(actualNames.has(name), `${name} missing from run-level asset directory`);
for (const name of actualNames) assert(expectedNames.has(name), `${name} is not a deterministic run-level asset filename`);

console.log(`Validated ${checked} run-level assets across ${RUN_LEVEL_DEFINITIONS.length} levels.`);
