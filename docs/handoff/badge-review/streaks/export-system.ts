// Run from the canonical repo root:
// TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/streaks/export-system.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  STREAK_HEAT_TIERS,
  STREAK_MILESTONE_DEFINITIONS,
  STREAK_SPECIALTY_DAYS,
  streakHeatTierForDays,
} from '../../../../src/achievements/streaks/streakDefinitions';
import { STREAK_HEAT_COLORS, STREAK_NEAR_BLACK } from '../../../../src/achievements/streaks/streakTokens';

const repoRoot = path.resolve(__dirname, '../../../..');
assert.equal(path.resolve(process.cwd()), repoRoot, 'Run from the canonical repository root.');
assert.equal(STREAK_HEAT_TIERS.length, 9);
assert.equal(Object.keys(STREAK_HEAT_COLORS).length, 9);
assert.equal(new Set(STREAK_HEAT_TIERS.map(tier => tier.token)).size, 9);
assert.equal(STREAK_MILESTONE_DEFINITIONS.length, 10);
assert.equal(new Set(STREAK_MILESTONE_DEFINITIONS.map(definition => definition.id)).size, 10);
assert.equal(new Set(STREAK_MILESTONE_DEFINITIONS.map(definition => definition.slug)).size, 10);
assert.deepEqual(STREAK_MILESTONE_DEFINITIONS.map(definition => definition.thresholdDays), [...STREAK_SPECIALTY_DAYS]);
assert.equal(STREAK_MILESTONE_DEFINITIONS[0]?.thresholdDays, 7);
assert(!STREAK_MILESTONE_DEFINITIONS.some(definition => Number(definition.thresholdDays) === 3));

const tiers = STREAK_HEAT_TIERS.map(tier => {
  const colors = STREAK_HEAT_COLORS[tier.token];
  assert(colors, `Missing source colors for ${tier.token}`);
  assert.deepEqual(Object.keys(colors).sort(), ['center', 'glow', 'highlight', 'primary', 'shadow']);
  assert(Object.values(colors).every(color => /^#[0-9a-f]{6}$/i.test(color)));
  return {
    minDays: tier.minDays,
    // null preserves the source's undefined upper bound as an explicit JSON field.
    maxDays: tier.maxDays ?? null,
    token: tier.token,
    label: tier.label,
    rangeLabel: tier.rangeLabel,
    colors: { ...colors },
  };
});

const milestones = STREAK_MILESTONE_DEFINITIONS.map(definition => ({
  id: definition.id,
  slug: definition.slug,
  day: definition.thresholdDays,
  title: definition.displayName,
  subtitle: definition.subtitle,
}));

const boundaryDays = [1, 10, 11, 50, 51, 100, 101, 150, 151, 200, 201, 250, 251, 300, 301, 364, 365, 366];
const boundarySamples = boundaryDays.map(days => {
  assert(Number.isInteger(days) && days >= 1);
  // The source selector owns safeDays normalization; these positive integer inputs are unchanged.
  const tier = streakHeatTierForDays(days);
  assert(STREAK_HEAT_TIERS.includes(tier));
  return { days, token: tier.token };
});

const sources = [
  'src/achievements/streaks/streakDefinitions.ts',
  'src/achievements/streaks/streakTokens.ts',
].map(sourcePath => ({
  path: sourcePath,
  sha256: createHash('sha256').update(readFileSync(path.join(repoRoot, sourcePath))).digest('hex'),
}));

const contents = `${JSON.stringify({ background: STREAK_NEAR_BLACK, tiers, milestones, boundarySamples, sources }, null, 2)}\n`;
const outputPath = path.join(__dirname, 'system.json');
writeFileSync(outputPath, contents, 'utf8');
assert.equal(readFileSync(outputPath, 'utf8'), contents);
console.log(`Exported ${tiers.length} heat tiers, ${milestones.length} milestones and ${boundarySamples.length} source-selected boundaries to ${outputPath}`);
