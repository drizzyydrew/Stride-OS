// Run from the canonical repo root:
// TSX_DISABLE_CACHE=1 LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 node --import tsx docs/handoff/badge-review/lifetime-distance/export-definitions.ts
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  LIFETIME_DISTANCE_RUNNING_DEFINITIONS,
} from '../../../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningDefinitions';
import {
  formatLifetimeRunningMilestoneNumber,
  lifetimeRunningUnitLabel,
} from '../../../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningUtils';
import {
  LIFETIME_DISTANCE_CYCLING_DEFINITIONS,
} from '../../../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';
import {
  formatLifetimeCyclingMilestoneNumber,
  lifetimeCyclingUnitLabel,
} from '../../../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingUtils';

type SourceDefinition = {
  id: string;
  slug: string;
  thresholdMiles: number;
  thresholdMeters: number;
};
type Units = 'imperial' | 'metric';

const locale = new Intl.NumberFormat().resolvedOptions().locale;
assert.equal(locale, 'en-US', 'Rerun with LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 so the shared helpers format in en-US.');
assert.equal(path.resolve(process.cwd()), path.resolve(__dirname, '../../../..'), 'Run from the canonical repository root.');

function exportFamily(
  definitions: readonly SourceDefinition[],
  expectedCount: number,
  formatNumber: (miles: number, units: Units) => string,
  unitLabel: (units: Units) => 'MI' | 'KM',
) {
  assert.equal(definitions.length, expectedCount);
  assert.equal(new Set(definitions.map(definition => definition.id)).size, expectedCount);
  assert.equal(new Set(definitions.map(definition => definition.slug)).size, expectedCount);
  return definitions.map(definition => {
    assert.equal(typeof definition.id, 'string');
    assert.equal(typeof definition.slug, 'string');
    assert(definition.id.length > 0 && definition.slug.length > 0);
    assert(Number.isFinite(definition.thresholdMiles) && definition.thresholdMiles > 0);
    assert(Number.isFinite(definition.thresholdMeters) && definition.thresholdMeters > 0);
    const imperialNumber = formatNumber(definition.thresholdMiles, 'imperial');
    const metricNumber = formatNumber(definition.thresholdMiles, 'metric');
    assert.equal(typeof imperialNumber, 'string');
    assert.equal(typeof metricNumber, 'string');
    assert(imperialNumber.length > 0 && metricNumber.length > 0);
    assert.equal(unitLabel('imperial'), 'MI');
    assert.equal(unitLabel('metric'), 'KM');
    return {
      id: definition.id,
      slug: definition.slug,
      thresholdMiles: definition.thresholdMiles,
      thresholdMeters: definition.thresholdMeters,
      imperialNumber,
      metricNumber,
      imperialUnit: unitLabel('imperial'),
      metricUnit: unitLabel('metric'),
    };
  });
}

const running = exportFamily(
  LIFETIME_DISTANCE_RUNNING_DEFINITIONS, 10,
  formatLifetimeRunningMilestoneNumber, lifetimeRunningUnitLabel,
);
const cycling = exportFamily(
  LIFETIME_DISTANCE_CYCLING_DEFINITIONS, 9,
  formatLifetimeCyclingMilestoneNumber, lifetimeCyclingUnitLabel,
);
assert.equal(new Set([...running, ...cycling].map(definition => definition.id)).size, 19);
const marathon = running.find(definition => definition.thresholdMiles === 26.2);
assert(marathon, 'The canonical running 26.2 milestone must be retained.');
assert.equal(marathon.imperialNumber, '26.2');
assert.equal(marathon.metricNumber, formatLifetimeRunningMilestoneNumber(26.2, 'metric'));

const outputPath = path.join(__dirname, 'definitions.json');
const contents = `${JSON.stringify({ locale, running, cycling }, null, 2)}\n`;
writeFileSync(outputPath, contents, 'utf8');
assert.equal(readFileSync(outputPath, 'utf8'), contents);
console.log(`Exported ${running.length} running + ${cycling.length} cycling definitions (${locale}) to ${outputPath}`);
