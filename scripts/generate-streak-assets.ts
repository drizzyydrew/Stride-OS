import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STREAK_MILESTONE_DEFINITIONS } from '../src/achievements/streaks/streakDefinitions';
import {
  renderStreakBadgeSvg,
  type StreakBadgeState,
} from '../src/achievements/streaks/streakArtwork';

const PNG_SIZE = 1024;

type Variant = {
  state: StreakBadgeState;
  svgPath: (typeof STREAK_MILESTONE_DEFINITIONS)[number]['artworkPath'];
  pngPath: string;
};

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
    throw new Error(`sips is required to render Streak PNG assets: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sips failed for ${sourceSvgPath}: ${result.stderr || result.stdout}`);
  }
}

let svgCount = 0;
let pngCount = 0;

for (const definition of STREAK_MILESTONE_DEFINITIONS) {
  const variants: Variant[] = [
    { state: 'unlocked', svgPath: definition.artworkPath, pngPath: definition.unlockedPngPath },
    { state: 'locked', svgPath: definition.lockedArtworkPath, pngPath: definition.lockedPngPath },
    { state: 'share-transparent', svgPath: definition.shareAssetPaths.overlay, pngPath: definition.shareTransparentPngPath },
    { state: 'share-opaque', svgPath: definition.shareAssetPaths.cleanDark, pngPath: definition.shareOpaquePngPath },
  ];

  for (const variant of variants) {
    writeAsset(
      variant.svgPath,
      renderStreakBadgeSvg(definition.thresholdDays, variant.state),
    );
    svgCount += 1;
  }

  for (const variant of variants) {
    renderPng(variant.svgPath, variant.pngPath);
    pngCount += 1;
  }
}

const manifestPath = 'assets/achievements/streaks/manifest.json';
writeAsset(
  manifestPath,
  `${JSON.stringify(
    STREAK_MILESTONE_DEFINITIONS.map(definition => ({
      achievementId: definition.id,
      days: definition.thresholdDays,
      heatToken: definition.heatToken,
      artworkPath: definition.artworkPath,
      lockedArtworkPath: definition.lockedArtworkPath,
      shareOverlayPath: definition.shareAssetPaths.overlay,
      shareOpaquePath: definition.shareAssetPaths.cleanDark,
    })),
    null,
    2,
  )}\n`,
);

console.log(`Generated ${svgCount} Streak SVG assets and ${pngCount} PNG assets.`);
