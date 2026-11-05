import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RACE_PR_DEFINITIONS, type RacePrBadgeState } from '../src/achievements/racePr/racePrDefinitions';
import { renderRacePrBadgeSvg } from '../src/achievements/racePr/racePrArtwork';
import { writeFirstsPng } from './lib/firstsRasterizer';

const variants = [
  ['unlocked', 'artworkPath', 'unlockedPngPath'],
  ['locked', 'lockedArtworkPath', 'lockedPngPath'],
  ['transparent', 'shareTransparentSvgPath', 'shareTransparentPngPath'],
] as const;
async function generate() {
  for (const definition of RACE_PR_DEFINITIONS) {
    for (const [state, svgKey, pngKey] of variants) {
      const svgPath = path.resolve(definition[svgKey]);
      mkdirSync(path.dirname(svgPath), { recursive: true });
      writeFileSync(svgPath, renderRacePrBadgeSvg(definition.id, state));
      await writeFirstsPng(renderRacePrBadgeSvg(definition.id, state, { size: 1024 }), path.resolve(definition[pngKey]));
    }
  }
  writeFileSync('assets/achievements/race-pr/manifest.json', JSON.stringify(RACE_PR_DEFINITIONS, null, 2) + '\n');
  console.log('Generated 18 canonical Race PR SVGs and 18 PNGs (six badges × three states).');
}
void generate().catch(error => { console.error(error); process.exitCode = 1; });
