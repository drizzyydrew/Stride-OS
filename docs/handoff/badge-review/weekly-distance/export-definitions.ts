import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEKLY_DISTANCE_DEFINITIONS } from '../../../../src/achievements/weeklyDistance/weeklyDistanceDefinitions';
import { formatWeeklyDistanceBadgeText } from '../../../../src/achievements/weeklyDistance/weeklyDistanceUtils';

const root = path.resolve(__dirname, '../../../..');
assert.equal(path.resolve(process.cwd()), root, 'Run from the canonical repository root.');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sources = Object.fromEntries([
  'src/achievements/weeklyDistance/weeklyDistanceDefinitions.ts',
  'src/achievements/weeklyDistance/weeklyDistanceThresholds.ts',
  'src/achievements/weeklyDistance/weeklyDistanceTokens.ts',
  'src/achievements/weeklyDistance/weeklyDistanceUtils.ts',
].map(file => [file, sha256(readFileSync(path.join(root, file)))]));
const definitions = WEEKLY_DISTANCE_DEFINITIONS.map(definition => ({
  id: definition.id,
  slug: definition.slug,
  kilometers: definition.thresholdKm,
  thresholdMeters: definition.thresholdMeters,
  label: formatWeeklyDistanceBadgeText(definition.thresholdKm),
}));
assert.deepEqual(definitions.map(value => value.kilometers), [5, 10, 15, 25, 30, 50, 75, 100]);
assert.equal(new Set(definitions.map(value => value.id)).size, 8);
for (const value of definitions) {
  assert.equal(value.thresholdMeters, value.kilometers * 1000);
  assert.equal(value.label, `${value.kilometers}K`);
}
const baseline = Object.fromEntries(['unlocked', 'locked', 'transparent'].flatMap(state =>
  ['svg', 'png'].map(extension => {
    const file = `five-k-${state}.${extension}`;
    return [file, sha256(readFileSync(path.join(__dirname, file)))];
  }),
));
const baselinePath = path.join(__dirname, 'approved-five-k-hashes.json');
if (existsSync(baselinePath)) assert.deepEqual(JSON.parse(readFileSync(baselinePath, 'utf8')), baseline, 'Approved 5K changed.');
else writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({ definitions, sources }, null, 2)}\n`);
console.log('Exported eight existing Weekly Distance definitions; approved 5K hashes retained.');
