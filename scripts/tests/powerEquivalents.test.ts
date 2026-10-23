import assert from 'node:assert/strict';
import test from 'node:test';
import { POWER_REFERENCE_APPLIANCES, POWER_REFERENCE_BANDS, POWER_REFERENCE_SOURCES, energyReferencePool,
  equivalentRuntimeSeconds, formatEquivalentTime, formatPowerRatio, pickPowerReference, powerReferencePool, referenceDetails } from '../../src/utils/powerEquivalents';
import { activityPowerPresentation, formatActivityPowerValue } from '../../src/utils/activityPowerPresentation';
import { withAutomaticClimbingWork } from '../../src/utils/climbingWork';
import type { Activity } from '../../src/types/activity';

const profile = { athleteId: 'synthetic', weightKg: 70, weightProvenance: { source: 'user_entered' as const, weightKg: 70, savedAt: 1 } };
function activity(type: Activity['activityType'] = 'hiking'): Activity {
  return { id: 'synthetic', activityType: type, source: 'manual', indoor: false, startTime: 1_000_000,
    metrics: { activeTimeSeconds: 20_040, durationSeconds: 20_040, elevationGainMeters: 767.69, metricSources: { elevation: 'manual_entry' } } } as Activity;
}

test('twenty 100W bands contain exactly 120 distinct sourced scenarios with the requested pool sizes', () => {
  assert.equal(POWER_REFERENCE_BANDS.length, 120);
  assert.equal(new Set(POWER_REFERENCE_BANDS.map(item => item.id)).size, 120);
  for (let band = 100; band <= 2000; band += 100) {
    const pool = powerReferencePool(band);
    assert.equal(pool.length, band <= 1000 ? 8 : 4, `${band} W`);
    assert.equal(new Set(pool.map(item => item.label)).size, pool.length);
    for (const item of pool) {
      assert.equal(item.bandWatts, band);
      assert.ok(item.watts > 0 && item.watts <= band);
      let sum = 0;
      for (const part of item.parts) {
        const appliance = POWER_REFERENCE_APPLIANCES.find(entry => entry.id === part.applianceId)!;
        assert.ok(appliance && part.count > 0 && Number.isInteger(part.count));
        assert.ok(appliance.mode && POWER_REFERENCE_SOURCES[appliance.source].url.startsWith('https://'));
        sum += appliance.watts * part.count;
      }
      assert.equal(sum, item.watts);
      assert.ok(referenceDetails(item).sources.length);
    }
  }
});

test('unrounded watts select floor bands without clamping out-of-range values', () => {
  for (const [watts, band] of [[100, 100], [199.999, 100], [200, 200], [999.999, 900], [1000, 1000], [1099.999, 1000], [1100, 1100], [1999.999, 1900], [2000, 2000]]) {
    assert.ok(powerReferencePool(watts).every(item => item.bandWatts === band));
  }
  for (const value of [-1, 0, NaN, Infinity, 2000.001, 5000]) assert.deepEqual(powerReferencePool(value), []);
});

test('below 100W uses small single items and never rounds a hike up to the 100W band', () => {
  const pool = powerReferencePool(26);
  assert.ok(pool.length > 0);
  assert.ok(pool.every(item => item.watts <= 26 && item.bandWatts === 0 && item.parts[0]!.count === 1));
  assert.equal(powerReferencePool(8)[0]!.watts, 9);
  assert.equal(formatPowerRatio(0.01, 9), 'less than 0.1');
  assert.equal(formatActivityPowerValue(0.343), '<1');
  assert.equal(formatActivityPowerValue(0), '0');
});

test('selection is reproducible for a retained random draw and can reach every scenario', () => {
  for (let band = 100; band <= 2000; band += 100) {
    const pool = powerReferencePool(band);
    assert.deepEqual(pool.map((item, index) => pickPowerReference(pool, (index + 0.5) / pool.length)?.id), pool.map(item => item.id));
    assert.equal(pickPowerReference(pool, 0), pool[0]);
    assert.equal(pickPowerReference(pool, 1), pool.at(-1));
    assert.equal(pickPowerReference(pool, NaN), undefined);
  }
  assert.equal(pickPowerReference([], 0.5), undefined);
});

test('climbing energy references are independent of watts and quantity bands', () => {
  const pool = energyReferencePool();
  assert.equal(pool.length, 8);
  assert.ok(pool.every(item => item.bandWatts === 0 && item.parts.length === 1 && item.parts[0]!.count === 1));
  const led = pool.find(item => item.parts[0]!.applianceId === 'led')!;
  assert.equal(equivalentRuntimeSeconds(527, led.watts), 527 / 9 * 1000);
  assert.equal(formatEquivalentTime(equivalentRuntimeSeconds(527, led.watts)!), '16 hours 16 minutes');
  assert.equal(equivalentRuntimeSeconds(3.6, 1), 3600);
});

test('invalid energy/draw cannot produce a runtime or overflow into a fabricated value', () => {
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(equivalentRuntimeSeconds(value, 9), null);
    assert.equal(equivalentRuntimeSeconds(527, value), null);
  }
  assert.equal(equivalentRuntimeSeconds(Number.MAX_VALUE, 0.01), null);
  assert.equal(formatEquivalentTime(0.5), 'less than 1 second');
  assert.equal(formatEquivalentTime(60), '1 minute');
  assert.equal(formatEquivalentTime(3600), '1 hour');
  assert.equal(formatEquivalentTime(NaN), 'unavailable');
});

test('hike presentation has one primary kJ unit with human-readable provenance and secondary time', () => {
  const original = activity();
  original.metrics = withAutomaticClimbingWork(original, profile, 2);
  const before = structuredClone(original);
  const result = activityPowerPresentation(original, 'imperial', profile)!;
  assert.equal(result.unit, 'kJ'); assert.equal(result.quantity, 'climbing');
  assert.ok(result.value! > 0);
  assert.match(result.context, /not total workout energy or calories/);
  assert.match(result.details.join(' '), /Entered ascent/);
  assert.match(result.details.join(' '), /5:34:00 active time/);
  assert.match(result.details.join(' '), /Average climbing-component power/);
  assert.match(result.details.join(' '), /lb/);
  assert.doesNotMatch(result.details.join(' '), /manual_entry|20040 active seconds/);
  assert.deepEqual(original, before);
  assert.equal(activityPowerPresentation(original, 'metric', profile)!.value, result.value);
});

test('unknown ascent source is not silently presented as verified', () => {
  const original = activity(); delete original.metrics.metricSources;
  original.metrics = withAutomaticClimbingWork(original, profile, 2);
  assert.match(activityPowerPresentation(original, 'metric', profile)!.details.join(' '), /Ascent source unknown/);
});

test('redundant saved ascent metadata never overrides the activity inputs in details', () => {
  const original = activity();
  const metrics = withAutomaticClimbingWork(original, profile, 2);
  metrics.climbingWorkEstimate!.elevationGainMeters = 999999;
  metrics.climbingWorkEstimate!.elevationSource = 'barometer' as any;
  original.metrics = metrics;
  const result = activityPowerPresentation(original, 'metric', profile)!;
  assert.match(result.details.join(' '), /Entered ascent: 768 m/);
  assert.doesNotMatch(result.details.join(' '), /999999|Barometer/);
});

test('overflowing secondary climbing watts remain unavailable', () => {
  const original = activity(); original.metrics.activeTimeSeconds = Number.MIN_VALUE;
  original.metrics = withAutomaticClimbingWork(original, profile, 2);
  const result = activityPowerPresentation(original, 'metric', profile)!;
  assert.ok(result.value! > 0);
  assert.doesNotMatch(result.details.join(' '), /Infinity/);
  assert.match(result.details.join(' '), /finite result/);
});

test('valid climbing work without a duration still has energy but no invented average watts', () => {
  const original = activity(); delete original.metrics.activeTimeSeconds; delete original.metrics.durationSeconds;
  original.metrics = withAutomaticClimbingWork(original, profile, 2);
  const result = activityPowerPresentation(original, 'metric', profile)!;
  assert.ok(result.value! > 0);
  assert.match(result.details.join(' '), /unavailable without a valid positive duration/);
  assert.ok(equivalentRuntimeSeconds(result.value!, 9)! > 0);
});

test('missing models stay unavailable; an entered zero is valid power rather than missing', () => {
  const missing = activityPowerPresentation(activity('running'), 'metric', profile)!;
  assert.equal(missing.value, null);
  assert.match(missing.label, /unavailable/);
  const entered = activity('indoor_cycling'); entered.metrics.cyclingPowerWatts = 0;
  entered.metrics.metricSources = { power: 'manual_entry' };
  const result = activityPowerPresentation(entered, 'metric', profile)!;
  assert.equal(result.value, 0); assert.equal(result.unit, 'W');
  assert.equal(result.label, 'Entered average power');
});

test('metabolic estimates keep their quantity and coverage without deriving whole-activity energy', () => {
  const run = activity('running'); run.source = 'tracked'; run.workoutInstanceId = 'synthetic';
  run.metrics.powerEstimate = { modelId: 'synthetic', version: '3', quantity: 'running_metabolic_estimate', sport: 'running',
    computedAt: 2, averageWatts: 728.4, coverageSeconds: 14028, coverageRatio: 0.7, inputs: [], assumptions: ['Synthetic estimate'] };
  const result = activityPowerPresentation(run, 'metric', profile)!;
  assert.equal(result.value, 728.4); assert.equal(result.quantity, 'metabolic');
  assert.equal(result.context, '70% usable GPS coverage');
  assert.match(result.label, /Metabolic/);
  assert.equal(result.unit, 'W');
  assert.equal('kilojoules' in result, false);
  assert.match(result.help.read, /not necessarily the whole activity/);
});

test('unsupported activities do not gain a new power result', () => {
  assert.equal(activityPowerPresentation(activity('snowboarding'), 'metric', profile), null);
});

test('every supported section uses the activity name followed by Work without changing its quantity', () => {
  for (const [type, title, unit] of [
    ['hiking', 'Hiking Work', 'kJ'], ['walking', 'Walking Work', 'kJ'],
    ['running', 'Running Work', 'W'], ['cycling', 'Cycling Work', 'W'], ['indoor_cycling', 'Indoor Cycling Work', 'W'],
  ] as const) {
    const item = activity(type);
    if (type === 'indoor_cycling') item.metrics.cyclingPowerWatts = 100;
    const view = activityPowerPresentation(item, 'metric', profile)!;
    assert.equal(view.title, title); assert.equal(view.unit, unit);
  }
});
