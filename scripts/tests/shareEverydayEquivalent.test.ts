import test from 'node:test';
import assert from 'node:assert/strict';
import type { Activity } from '../../src/types/activity';
import { withAutomaticClimbingWork } from '../../src/utils/climbingWork';
import { availableStoryIllustration, selectAllStoryIllustration, shareEverydayEquivalent, type StoryIllustration } from '../../src/utils/shareEverydayEquivalent';

function activity(type: Activity['activityType'] = 'running'): Activity {
  return { id: 'synthetic-share', activityType: type, source: 'tracked', workoutInstanceId: 'saved-app-run',
    indoor: false, startTime: 1_000_000, metrics: { durationSeconds: 600, activeTimeSeconds: 600,
      distanceMeters: 1600, elevationGainMeters: 100, calories: 120 } } as Activity;
}

function metabolic(watts = 728): Activity {
  const run = activity();
  run.metrics.powerEstimate = { modelId: 'synthetic', version: '3', quantity: 'running_metabolic_estimate',
    sport: 'running', computedAt: 2, averageWatts: watts, coverageSeconds: 500, coverageRatio: 0.83,
    inputs: [], assumptions: ['Synthetic fixture'] };
  return run;
}

test('a metabolic comparison preserves quantity/provenance and never invents electrical energy or runtime', () => {
  const run = metabolic(); const original = structuredClone(run);
  const result = shareEverydayEquivalent(run, 'imperial')!;
  assert.equal(result.quantity, 'metabolic');
  assert.match(result.sourceLabel, /Metabolic power estimate/);
  assert.match(result.comparison, /×/);
  assert.match(result.caveat, /not electrical output/);
  assert.doesNotMatch(result.comparison, /minute|hour|kJ|kWh|calorie/);
  assert.deepEqual(run, original);
});

test('reference choice is stable across clones, unit changes and preview/export invocations', () => {
  const run = metabolic();
  const result = shareEverydayEquivalent(run, 'imperial');
  assert.deepEqual(shareEverydayEquivalent(structuredClone(run), 'imperial'), result);
  assert.deepEqual(shareEverydayEquivalent(run, 'metric'), result);
  assert.deepEqual(shareEverydayEquivalent(run, 'imperial'), result);
});

test('calories-only, unsupported, invalid, zero and out-of-reference-range quantities stay unavailable', () => {
  assert.equal(shareEverydayEquivalent(undefined, 'metric'), null);
  for (const type of ['running', 'hiking', 'walking', 'strength', 'snowboarding'] as const) {
    assert.equal(shareEverydayEquivalent(activity(type), 'metric'), null, type);
  }
  for (const watts of [0, -1, NaN, Infinity, 2000.001]) assert.equal(shareEverydayEquivalent(metabolic(watts), 'metric'), null);
  const tooLittleCoverage = metabolic(); tooLittleCoverage.metrics.powerEstimate!.coverageRatio = 0.69;
  assert.equal(shareEverydayEquivalent(tooLittleCoverage, 'metric'), null);
  const wrongQuantity = metabolic(); wrongQuantity.metrics.powerEstimate!.quantity = 'cycling_mechanical_estimate';
  assert.equal(shareEverydayEquivalent(wrongQuantity, 'metric'), null);
});

test('saved validated uphill work yields an energy runtime, without requiring or guessing a new profile weight', () => {
  const hike = activity('hiking');
  hike.metrics = withAutomaticClimbingWork(hike, { athleteId: 'synthetic', weightKg: 70,
    weightProvenance: { source: 'user_entered', weightKg: 70, savedAt: 1 } }, 2);
  const result = shareEverydayEquivalent(hike, 'metric')!;
  assert.equal(result.quantity, 'climbing');
  assert.match(result.sourceLabel, /Estimated uphill work/);
  assert.match(result.comparison, /seconds|minute|hour/);
  assert.doesNotMatch(result.comparison, /×/);
  assert.match(result.accessibilityLabel, /Energy equivalent of running .* for about/);
  assert.match(result.caveat, /Uphill energy only.*No electricity generated/);
  hike.metrics.elevationGainMeters = 200;
  assert.equal(shareEverydayEquivalent(hike, 'metric'), null, 'an edited ascent invalidates the saved quantity');
});

test('entered cycling power is labeled entered, not measured; zero does not become a comparison', () => {
  const ride = activity('indoor_cycling'); ride.indoor = true;
  ride.metrics.cyclingPowerWatts = 200; ride.metrics.metricSources = { power: 'manual_entry' };
  const result = shareEverydayEquivalent(ride, 'metric')!;
  assert.equal(result.sourceLabel, 'Entered average power');
  assert.equal(result.quantity, 'power');
  assert.match(result.comparison, /×/);
  ride.metrics.cyclingPowerWatts = 0;
  assert.equal(shareEverydayEquivalent(ride, 'metric'), null);
});

test('all supported positive watt bands retain concise single-appliance labels for uniform typography', () => {
  for (let watts = 100; watts <= 2000; watts += 100) {
    for (let id = 0; id < 24; id += 1) {
      const run = metabolic(watts); run.id = `synthetic-${id}`;
      const result = shareEverydayEquivalent(run, 'metric')!;
      const reference = result.comparison.split('\n')[1]!;
      assert.ok(reference.length <= 26, reference);
      assert.doesNotMatch(reference, /\+/);
    }
  }
});

test('Story illustrations are a single choice with availability and format guards', () => {
  for (const value of ['none', 'route', 'everyday'] as StoryIllustration[]) {
    assert.equal(availableStoryIllustration(value, false, true, true), 'none');
    assert.equal(availableStoryIllustration(value, true, false, false), 'none');
    assert.equal(availableStoryIllustration(value, true, true, true), value);
  }
  assert.equal(availableStoryIllustration('route', true, false, true), 'none');
  assert.equal(availableStoryIllustration('everyday', true, true, false), 'none');
});

test('Select All preserves a chosen illustration or prefers the non-location equivalent', () => {
  assert.equal(selectAllStoryIllustration('none', true, true), 'everyday');
  assert.equal(selectAllStoryIllustration('route', true, true), 'route');
  assert.equal(selectAllStoryIllustration('everyday', true, true), 'everyday');
  assert.equal(selectAllStoryIllustration('everyday', true, false), 'route');
  assert.equal(selectAllStoryIllustration('route', false, true), 'everyday');
  assert.equal(selectAllStoryIllustration('none', false, false), 'none');
});
