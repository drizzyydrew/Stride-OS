import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CHALLENGE_ACHIEVEMENT_DEFINITIONS, type ChallengeBadgeState } from '../src/achievements/challenges/challengesDefinitions';
import { renderChallengeBadgeSvg } from '../src/achievements/challenges/challengesArtwork';

const PNG_SIZE = 1024;

type Variant = {
  state: ChallengeBadgeState;
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

function renderPng(sourceSvgPath: string, targetPngPath: string): void {
  const source = path.resolve(process.cwd(), sourceSvgPath);
  const target = path.resolve(process.cwd(), targetPngPath);
  mkdirSync(path.dirname(target), { recursive: true });

  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(PNG_SIZE), String(PNG_SIZE), source, '--out', target], {
    encoding: 'utf8',
  });
  if (result.error) {
    throw new Error(`sips is required to render Challenges PNG assets: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sips failed for ${sourceSvgPath}: ${result.stderr || result.stdout}`);
  }
}

let svgCount = 0;
let pngCount = 0;

for (const definition of CHALLENGE_ACHIEVEMENT_DEFINITIONS) {
  for (const variant of VARIANTS) {
    writeAsset(
      definition[variant.svgPathKey],
      renderChallengeBadgeSvg(definition.id, variant.state),
    );
    svgCount += 1;
  }

  for (const variant of VARIANTS) {
    renderPng(definition[variant.svgPathKey], definition[variant.pngPathKey]);
    pngCount += 1;
  }
}

const manifest = CHALLENGE_ACHIEVEMENT_DEFINITIONS.map(definition => ({
  id: definition.id,
  slug: definition.slug,
  title: definition.title,
  glyph: definition.glyph,
  includeInGlobalRegistry: definition.includeInGlobalRegistry,
  artworkPath: definition.artworkPath,
  lockedArtworkPath: definition.lockedArtworkPath,
  shareTransparentSvgPath: definition.shareTransparentSvgPath,
  shareTransparentPngPath: definition.shareTransparentPngPath,
}));
writeAsset('assets/achievements/challenges/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${svgCount} Challenges SVG assets and ${pngCount} PNG assets.`);
