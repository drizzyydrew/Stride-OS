import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  CONCENTRATION_UNIT,
  DISTANCE_STEP_MI,
  DURATION_STEP_MIN,
  FUELING_REMINDER_INTERVALS,
  PER_HOUR_UNIT,
} from '../../src/constants/hydrationConfig';

test('hydration increments, intervals, and unit meanings stay canonical', () => {
  assert.equal(DISTANCE_STEP_MI, 0.01);
  assert.equal(DURATION_STEP_MIN, 1);
  assert.deepEqual([...FUELING_REMINDER_INTERVALS], [15, 20, 30, 40]);
  assert.equal(PER_HOUR_UNIT, '/hr');
  assert.equal(CONCENTRATION_UNIT, 'mg/L');
});

test('hydration UI does not use abbreviated /h rate units or swap sodium meanings', () => {
  const source = [
    'app/(tabs)/training/hydration.tsx',
    'src/constants/hydrationConfig.ts',
    'src/utils/hydrationEngine.ts',
  ].map(path => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
  assert.doesNotMatch(source, /\b(?:oz|L|ml|g|mg)\/h(?!r)/);
  assert.match(source, /mg\/L describes sodium concentration/);
  assert.match(source, /mg\/hr describes the total sodium consumed/);
});
