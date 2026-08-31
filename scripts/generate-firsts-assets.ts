import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FIRST_ACHIEVEMENT_DEFINITIONS, type FirstAchievementBadgeState } from '../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';

const PNG_SIZE = 1024;

type Variant = {
  state: FirstAchievementBadgeState;
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
    throw new Error(`sips is required to render Firsts PNG assets: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sips failed for ${sourceSvgPath}: ${result.stderr || result.stdout}`);
  }
}

let svgCount = 0;
let pngCount = 0;

for (const definition of FIRST_ACHIEVEMENT_DEFINITIONS) {
  for (const variant of VARIANTS) {
    writeAsset(
      definition[variant.svgPathKey],
      renderFirstAchievementBadgeSvg(definition.id, variant.state, { unitSystem: 'imperial' }),
    );
    svgCount += 1;
  }

  for (const variant of VARIANTS) {
    renderPng(definition[variant.svgPathKey], definition[variant.pngPathKey]);
    pngCount += 1;
  }
}

const manifest = FIRST_ACHIEVEMENT_DEFINITIONS.map(definition => ({
  id: definition.id,
  slug: definition.slug,
  title: definition.title,
  glyph: definition.glyph,
  artworkPath: definition.artworkPath,
  lockedArtworkPath: definition.lockedArtworkPath,
  shareTransparentSvgPath: definition.shareTransparentSvgPath,
  shareTransparentPngPath: definition.shareTransparentPngPath,
  shareOpaqueSvgPath: definition.shareOpaqueSvgPath,
  shareOpaquePngPath: definition.shareOpaquePngPath,
}));
writeAsset('assets/achievements/firsts/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${svgCount} Firsts SVG assets and ${pngCount} PNG assets.`);
