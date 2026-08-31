import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderRunLevelBadgeSvg, type RunLevelBadgeState } from '../src/achievements/runLevels/runLevelArtwork';
import { RUN_LEVEL_DEFINITIONS } from '../src/achievements/runLevels/runLevelDefinitions';

const PNG_SIZE = 1024;

type SvgVariant = {
  state: RunLevelBadgeState;
  pathKey: 'artworkPath' | 'lockedArtworkPath' | 'shareTransparentSvgPath' | 'shareOpaqueSvgPath';
};

const SVG_VARIANTS: SvgVariant[] = [
  { state: 'unlocked', pathKey: 'artworkPath' },
  { state: 'locked', pathKey: 'lockedArtworkPath' },
  { state: 'share-transparent', pathKey: 'shareTransparentSvgPath' },
  { state: 'share-opaque', pathKey: 'shareOpaqueSvgPath' },
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
    throw new Error(`sips is required to render run-level PNG share assets: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sips failed for ${sourceSvgPath}: ${result.stderr || result.stdout}`);
  }
}

let svgCount = 0;
let pngCount = 0;

for (const level of RUN_LEVEL_DEFINITIONS) {
  for (const variant of SVG_VARIANTS) {
    writeAsset(level[variant.pathKey], renderRunLevelBadgeSvg(level.slug, variant.state));
    svgCount += 1;
  }

  renderPng(level.shareTransparentSvgPath, level.shareTransparentPngPath);
  renderPng(level.shareOpaqueSvgPath, level.shareOpaquePngPath);
  pngCount += 2;
}

console.log(`Generated ${svgCount} run-level SVG assets and ${pngCount} PNG share assets.`);
