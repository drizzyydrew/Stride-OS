import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { LIFETIME_DISTANCE_CYCLING_DEFINITIONS } from '../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';
import {
  renderLifetimeDistanceCyclingBadgeSvg,
  type LifetimeDistanceCyclingBadgeState,
} from '../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingArtwork';

const PNG_SIZE = 1024;

type Variant = {
  state: LifetimeDistanceCyclingBadgeState;
  svgPathKey: 'artworkPath' | 'lockedArtworkPath' | 'shareTransparentSvgPath' | 'shareOpaqueSvgPath';
  pngPathKey: 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentPngPath' | 'shareOpaquePngPath';
};

const VARIANTS: Variant[] = [
  { state: 'unlocked', svgPathKey: 'artworkPath', pngPathKey: 'unlockedPngPath' },
  { state: 'locked', svgPathKey: 'lockedArtworkPath', pngPathKey: 'lockedPngPath' },
  { state: 'share-transparent', svgPathKey: 'shareTransparentSvgPath', pngPathKey: 'shareTransparentPngPath' },
  { state: 'share-opaque', svgPathKey: 'shareOpaqueSvgPath', pngPathKey: 'shareOpaquePngPath' },
];

function writeAsset(assetPath: string, contents: string): void {
  const target = path.resolve(process.cwd(), assetPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

function renderPng(sourceSvgPath: string, targetPngPath: string): void {
  const source = path.resolve(process.cwd(), sourceSvgPath);
  const target = path.resolve(process.cwd(), targetPngPath);
  mkdirSync(path.dirname(target), { recursive: true });

  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(PNG_SIZE), String(PNG_SIZE), source, '--out', target], {
    encoding: 'utf8',
  });
  if (result.error) {
    throw new Error(`sips is required to render Lifetime Distance - Cycling PNG assets: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sips failed for ${sourceSvgPath}: ${result.stderr || result.stdout}`);
  }
}

let svgCount = 0;
let pngCount = 0;

for (const definition of LIFETIME_DISTANCE_CYCLING_DEFINITIONS) {
  for (const variant of VARIANTS) {
    writeAsset(
      definition[variant.svgPathKey],
      renderLifetimeDistanceCyclingBadgeSvg(definition.thresholdMiles, variant.state),
    );
    svgCount += 1;
  }

  for (const variant of VARIANTS) {
    renderPng(definition[variant.svgPathKey], definition[variant.pngPathKey]);
    pngCount += 1;
  }
}

console.log(`Generated ${svgCount} Lifetime Distance - Cycling SVG assets and ${pngCount} PNG assets.`);
