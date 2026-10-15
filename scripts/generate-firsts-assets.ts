import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FIRST_ACHIEVEMENT_DEFINITIONS, type FirstAchievementBadgeState } from '../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';
import { writeFirstsPng } from './lib/firstsRasterizer';

const PNG_SIZE = 1024;

type Variant = {
  state: FirstAchievementBadgeState;
  svgPathKey: 'artworkPath' | 'lockedArtworkPath' | 'shareTransparentSvgPath';
  pngPathKey: 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentPngPath';
};

const VARIANTS: Variant[] = [
  { state: 'unlocked', svgPathKey: 'artworkPath', pngPathKey: 'unlockedPngPath' },
  { state: 'locked', svgPathKey: 'lockedArtworkPath', pngPathKey: 'lockedPngPath' },
  { state: 'transparent', svgPathKey: 'shareTransparentSvgPath', pngPathKey: 'shareTransparentPngPath' },
];

function writeAsset(assetPath: string, contents: string): void {
  const target = path.resolve(process.cwd(), assetPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${contents.replace(/[ \t]+$/gm, '').trimEnd()}\n`, 'utf8');
}

async function renderPng(svg: string, targetPngPath: string): Promise<void> {
  const target = path.resolve(process.cwd(), targetPngPath);
  mkdirSync(path.dirname(target), { recursive: true });

  await writeFirstsPng(svg, target);
}

async function generate(): Promise<void> {
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
    await renderPng(renderFirstAchievementBadgeSvg(definition.id, variant.state, { size: PNG_SIZE, unitSystem: 'imperial' }), definition[variant.pngPathKey]);
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
}));
writeAsset('assets/achievements/firsts/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${svgCount} Firsts SVG assets and ${pngCount} PNG assets.`);
}

generate().catch(error => { console.error(error); process.exitCode = 1; });
