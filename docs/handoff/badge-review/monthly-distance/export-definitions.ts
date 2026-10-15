import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MONTHLY_DISTANCE_DEFINITIONS } from '../../../../src/achievements/monthlyDistance/monthlyDistanceDefinitions';
import { formatMonthlyDistanceBadgeText } from '../../../../src/achievements/monthlyDistance/monthlyDistanceUtils';

const root = path.resolve(__dirname, '../../../..');
assert.equal(process.cwd(), root);
assert.deepEqual(MONTHLY_DISTANCE_DEFINITIONS.map(value => value.thresholdKm), [25, 50, 100, 150, 200, 250, 300]);
const definitions = MONTHLY_DISTANCE_DEFINITIONS.map(value => ({ ...value, label: formatMonthlyDistanceBadgeText(value.thresholdKm) }));
const sources = Object.fromEntries([
  'src/achievements/monthlyDistance/monthlyDistanceDefinitions.ts',
  'src/achievements/monthlyDistance/monthlyDistanceThresholds.ts',
  'src/achievements/monthlyDistance/monthlyDistanceTokens.ts',
  'src/achievements/monthlyDistance/monthlyDistanceUtils.ts',
  'src/achievements/monthlyDistance/monthlyDistanceArtwork.ts',
  'src/utils/achievements.ts',
].map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({ definitions, sources }, null, 2)}\n`);
console.log('Read seven existing Monthly Distance milestones, fixed-K labels and source hashes.');
