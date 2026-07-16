import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateRunReminders } from '../../src/utils/runReminderScheduler';

const base = {
  lastHydrationCueSec: 0,
  lastFuelCueSec: 0,
  elapsedSeconds: 0,
  isActive: true,
  isPaused: false,
  hydrationEnabled: true,
  hydrationIntervalMin: 15,
  fuelEnabled: true,
  fuelIntervalMin: 20,
  fluidOzPerHour: 20,
  carbsGPerHour: 60,
};

test('hydration and fuel use separate one-minute interval schedules', () => {
  const hydration = evaluateRunReminders({ ...base, elapsedSeconds: 15 * 60 });
  assert.equal(hydration?.kind, 'hydration');
  assert.equal(hydration?.hydrationAmountOz, 5);
  assert.equal(hydration?.nextState.lastHydrationCueSec, 900);
  assert.equal(hydration?.nextState.lastFuelCueSec, 0);

  const fuel = evaluateRunReminders({
    ...base,
    ...hydration!.nextState,
    elapsedSeconds: 20 * 60,
  });
  assert.equal(fuel?.kind, 'fuel');
  assert.equal(fuel?.fuelAmountG, 20);
});

test('simultaneous reminders are merged and not repeated after pause or resume', () => {
  const combined = evaluateRunReminders({
    ...base,
    hydrationIntervalMin: 20,
    elapsedSeconds: 20 * 60,
  });
  assert.equal(combined?.kind, 'combined');
  assert.match(combined?.spokenText ?? '', /Hydration and fuel reminder/);

  assert.equal(evaluateRunReminders({
    ...base,
    ...combined!.nextState,
    hydrationIntervalMin: 20,
    elapsedSeconds: 20 * 60,
    isPaused: true,
  }), null);
  assert.equal(evaluateRunReminders({
    ...base,
    ...combined!.nextState,
    hydrationIntervalMin: 20,
    elapsedSeconds: 20 * 60,
  }), null);
});
