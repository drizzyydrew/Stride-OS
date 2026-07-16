import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateHydrationPlan, calculateMeasuredSweatRate } from '../../src/utils/hydrationEngine';

test('measured sweat rate accounts for body-mass loss, intake, urine, and duration', () => {
  assert.equal(calculateMeasuredSweatRate({
    preWeightKg: 70,
    postWeightKg: 69.5,
    fluidConsumedL: 0.5,
    urineOutputL: 0,
    durationMin: 60,
  }), 1);
  assert.equal(calculateMeasuredSweatRate({
    preWeightKg: null,
    postWeightKg: 69.5,
    durationMin: 60,
  }), null);
});

test('known carbohydrate tolerance is a ceiling, while sodium concentration remains mg/L', () => {
  const plan = calculateHydrationPlan({
    durationMin: 180,
    bodyWeightKg: 70,
    effort: 8,
    weatherBand: 'warm',
    sweatiness: 'high',
    saltiness: 'salty',
    sweatSodiumMgL: 1100,
    cramping: 'rarely',
    carbToleranceGh: 40,
    fluidComfort: 'moderate',
    goal: 'race_limit',
  });
  assert.ok(plan.hourly.carbsG <= 40);
  assert.equal(plan.physiology.sweatSodiumMgL, 1100);
  assert.ok(plan.hourly.sodiumMg >= 0);
  assert.ok(plan.warnings.some(warning => warning.includes('progression target')));
});
