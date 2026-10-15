import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CHALLENGE_ACHIEVEMENT_DEFINITIONS } from '../../../../src/achievements/challenges/challengesDefinitions';
import { FIRSTS_GLYPH_ARTWORK } from '../../../../src/achievements/firsts/firstsGlyphs';
import { MONTHLY_DISTANCE_DEFINITIONS } from '../../../../src/achievements/monthlyDistance/monthlyDistanceDefinitions';

const root = path.resolve(__dirname, '../../../..');
assert.equal(process.cwd(), root, 'Use the canonical Developer checkout.');
const definitions = CHALLENGE_ACHIEVEMENT_DEFINITIONS;
assert.equal(definitions.length, 12);
assert.equal(definitions.filter(value => value.includeInGlobalRegistry).length, 7);
assert.equal(definitions[0].id, 'challenge_august_base_builder');
assert.deepEqual(definitions[0].titleLines, ['AUGUST', 'BASE BUILDER']);
const sources = Object.fromEntries([
  'src/achievements/challenges/challengesDefinitions.ts',
  'src/achievements/challenges/challengesUtils.ts',
  'src/achievements/challenges/challengesArtwork.ts',
  'src/achievements/challenges/challengesTokens.ts',
  'src/achievements/firsts/firstsGlyphs.ts',
  'src/achievements/strength/strengthArtwork.ts',
  'src/utils/achievementSystem.ts',
  'src/utils/achievements.ts',
  'src/achievements/monthlyDistance/monthlyDistanceDefinitions.ts',
  'src/achievements/monthlyDistance/monthlyDistanceThresholds.ts',
].map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
const added = [150, 200].map(km => {
  const monthly = MONTHLY_DISTANCE_DEFINITIONS.find(value => value.thresholdKm === km);
  assert(monthly, `Reuse an existing Monthly Distance achievement for ${km}K.`);
  return {
    id: monthly.id, slug: `${km}k-month`, title: `${monthly.milestoneLabel} Month`,
    compactTitle: `${monthly.milestoneLabel} Month`, titleLines: [monthly.milestoneLabel, 'MONTH'],
    badgeNumber: monthly.milestoneLabel, badgeUnit: 'MONTH', glyph: 'numericBadge',
    colorToken: `challenge${km}kMonth`, includeInGlobalRegistry: false,
    presentationOnly: true, canonicalFamily: 'monthlyDistance',
    thresholdKm: monthly.thresholdKm, thresholdMeters: monthly.thresholdMeters,
    criteria: `Same criteria as the existing Monthly Distance ${monthly.milestoneLabel} achievement; review presentation only.`,
  };
});
const presentations = definitions.filter(value => value.id !== 'challenge_5k_month').flatMap(value =>
  value.id === 'monthly_run_100k' ? [value, ...added] : [value],
);
assert.equal(presentations.length, 13);
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({ definitions, presentations, sources, runner: FIRSTS_GLYPH_ARTWORK.first_run }, null, 2)}\n`);
console.log('Read unchanged source definitions; review set replaces 5K Month with existing Monthly 150K/200K IDs.');
