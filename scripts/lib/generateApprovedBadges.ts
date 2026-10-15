import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { APPROVED_BADGE_ASSETS, APPROVED_BADGE_STATES, approvedAssetPaths } from './approvedBadgeFamilies';
import { writeFirstsPng } from './firstsRasterizer';
import { generateLegacyChallengeAssets } from './legacyChallengeAssets';

export async function generateApprovedBadges(family: string): Promise<void> {
  const entries = APPROVED_BADGE_ASSETS.filter(entry => entry.family === family);
  if (!entries.length) throw new Error(`Unknown approved family ${family}`);
  for (const entry of entries) for (const state of APPROVED_BADGE_STATES) {
    const files = approvedAssetPaths(entry, state);
    mkdirSync(path.dirname(files.svg), { recursive: true });
    writeFileSync(files.svg, `${entry.render(state).trim()}\n`, 'utf8');
    await writeFirstsPng(entry.render(state, 1024), files.png);
  }
  const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  const manifestEntries = entries.map(entry => ({
    achievementId: entry.id,
    units: entry.units,
    states: Object.fromEntries(APPROVED_BADGE_STATES.map(state => {
      const files = approvedAssetPaths(entry, state);
      return [state, { ...files, svgHash: hash(files.svg), pngHash: hash(files.png) }];
    })),
  }));
  const dir = path.dirname(entries[0].definition.artworkPath);
  const legacy = family === 'challenges' ? await generateLegacyChallengeAssets() : undefined;
  writeFileSync(`${dir}/manifest.json`, `${JSON.stringify({
    version: 2, family, canonicalStates: APPROVED_BADGE_STATES,
    aliases: { 'share-opaque': 'unlocked', 'share-transparent': 'transparent' },
    entries: manifestEntries, legacy,
    ...(family === 'streak' ? { dailyCounts: 'positive integers rendered at runtime; no additional achievement IDs' } : {}),
  }, null, 2)}\n`);
  console.log(`Generated ${entries.length * 6} approved ${family} SVG/PNG assets from the app renderer.`);
}
