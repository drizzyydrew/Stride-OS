import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity, ActivityType, PowerSample } from '../../src/types/activity';
import { analyzeSnowSegments, buildOutdoorSplits, buildRouteObservations, buildRouteReviewObservations, pausedSeconds, routeObservationAtFraction, sampleAtTime, weightedSensorMean } from '../../src/utils/outdoorAnalysis';
import { buildActivitySummary } from '../../src/utils/activitySummary';
import { calculateActivityLoad } from '../../src/utils/activityLoad';
import { devicePowerSummary, estimateActivityPower, estimateClimbingWork, estimateCyclingWatts, estimateRunningMetabolicWatts, powerModelExclusionReason, powerSampleLabel, routePowerSample, sharePowerMetric } from '../../src/utils/outdoorPower';

const startTime = 1_760_000_000_000;
function fixture(type: ActivityType = 'running', count = 700): Activity {
  return {
    id: 'fixture', activityType: type, subtype: 'outdoor', startTime, endTime: startTime + (count - 1) * 1000,
    metrics: { durationSeconds: count - 1, activeTimeSeconds: count - 1,
      routeCoordinates: Array.from({ length: count }, (_, index) => ({ latitude: index * 3 / 111195, longitude: 0, altitudeMeters: 100, timestamp: startTime + index * 1000 })) },
  } as Activity;
}

test('all supported outdoor sports have route observations and unit-correct splits', () => {
  const types: ActivityType[] = ['running', 'walking', 'hiking', 'cycling', 'downhill_skiing', 'cross_country_skiing', 'snowboarding', 'ski_touring', 'snowboard_touring'];
  for (const type of types) {
    const activity = fixture(type);
    assert.equal(buildRouteObservations(activity).length, 700);
    assert.equal(buildOutdoorSplits(activity, 'metric').filter(split => split.complete).length, 2);
    assert.equal(buildOutdoorSplits(activity, 'imperial').filter(split => split.complete).length, 1);
  }
  assert.equal(buildRouteObservations(fixture('indoor_cycling')).length, 0);
});

test('gaps, pauses and impossible jumps are not interpolated into distance or pace', () => {
  const activity = fixture('running', 40);
  activity.metrics.routeCoordinates![20]!.latitude += 1;
  const observations = buildRouteObservations(activity);
  assert.equal(observations[20]!.continuous, false);
  assert.equal(observations[21]!.continuous, false);
  assert.ok(observations.at(-1)!.distanceMeters < 120);
  const paused = fixture('running', 700);
  paused.metrics.recordingPauses = [{ startTime: startTime + 200_000, endTime: startTime + 250_000 }];
  assert.equal(buildRouteObservations(paused)[220]!.continuous, false);
  assert.equal(buildOutdoorSplits(paused, 'metric')[0]!.reliable, false);
});

test('pause union never double-counts overlapping intervals', () => {
  const activity = fixture();
  activity.metrics.recordingPauses = [{ startTime: 1000, endTime: 3000 }, { startTime: 2000, endTime: 4000 }];
  assert.equal(pausedSeconds(activity, 0, 5000), 3);
});

test('route review excludes samples outside the recording and invalid GPS accuracy', () => {
  const activity = fixture('hiking', 40);
  const first = activity.metrics.routeCoordinates![0]!;
  activity.metrics.routeCoordinates!.push({ ...first, timestamp: startTime - 1000 },
    { ...first, timestamp: activity.endTime! + 1000 },
    { ...first, timestamp: startTime + 500, horizontalAccuracyMeters: -1 });
  assert.equal(buildRouteObservations(activity).length, 40);
});

test('peak altitude uses recording bounds, finite valid coordinates and nonnegative finite accuracy', () => {
  const activity = fixture('hiking', 40);
  activity.trainingLoad = calculateActivityLoad({ activityType: 'hiking', durationMinutes: 39 / 60 });
  const first = activity.metrics.routeCoordinates![0]!;
  const invalid = [
    { timestamp: startTime - 1000 }, { timestamp: activity.endTime! + 1000 },
    { timestamp: NaN }, { latitude: NaN }, { longitude: Infinity },
    { latitude: 91 }, { longitude: -181 },
    { horizontalAccuracyMeters: -1 }, { horizontalAccuracyMeters: Infinity },
    { horizontalAccuracyMeters: NaN }, { horizontalAccuracyMeters: 66 },
  ];
  activity.metrics.routeCoordinates!.push(...invalid.map(patch => ({ ...first, altitudeMeters: 9999, ...patch })));
  activity.metrics.routeCoordinates![39] = { ...activity.metrics.routeCoordinates![39]!, altitudeMeters: 123, horizontalAccuracyMeters: 65 };
  const original = structuredClone(activity);
  const peak = (units: 'metric' | 'imperial') => buildActivitySummary(activity, units)
    .sections.flatMap(section => section.metrics).find(metric => metric.label === 'Peak recorded altitude')?.value;
  assert.equal(peak('metric'), '123 m');
  assert.equal(peak('imperial'), '404 ft');
  assert.deepEqual(activity, original);
  activity.metrics.routeCoordinates = invalid.map(patch => ({ ...first, altitudeMeters: 9999, ...patch }));
  assert.equal(peak('metric'), undefined);
});

test('peak altitude excludes isolated impossible fixes but preserves higher terrain after a genuine gap', () => {
  const peak = (activity: Activity, units: 'metric' | 'imperial') => buildActivitySummary(activity, units)
    .sections.flatMap(section => section.metrics).find(metric => metric.label === 'Peak recorded altitude')?.value;
  for (const spike of [0, 50, 100]) {
    const activity = fixture('hiking', 101);
    activity.trainingLoad = calculateActivityLoad({ activityType: 'hiking', durationMinutes: 100 / 60 });
    activity.metrics.routeCoordinates![25]!.altitudeMeters = 123;
    activity.metrics.routeCoordinates![spike] = { ...activity.metrics.routeCoordinates![spike]!,
      latitude: 1, altitudeMeters: 9999, horizontalAccuracyMeters: 5,
    };
    const original = structuredClone(activity);
    assert.equal(peak(activity, 'metric'), '123 m');
    assert.equal(peak(activity, 'imperial'), '404 ft');
    assert.deepEqual(activity, original);
  }
  const relocated = fixture('hiking', 101);
  relocated.trainingLoad = calculateActivityLoad({ activityType: 'hiking', durationMinutes: 160 / 60 });
  relocated.metrics.routeCoordinates = relocated.metrics.routeCoordinates!.map((point, index) => index < 50 ? point
    : { ...point, latitude: point.latitude + 1, altitudeMeters: 1500, timestamp: point.timestamp + 60_000 });
  relocated.endTime! += 60_000;
  const original = structuredClone(relocated);
  assert.equal(peak(relocated, 'metric'), '1500 m');
  assert.equal(peak(relocated, 'imperial'), '4921 ft');
  assert.deepEqual(relocated, original);
});

test('review framing and scrubbing exclude isolated impossible spikes without bridging rejected edges', () => {
  for (const spike of [0, 50, 100]) {
    const activity = fixture('hiking', 101);
    activity.metrics.routeCoordinates![spike]!.latitude += 1;
    const original = structuredClone(activity);
    const raw = buildRouteObservations(activity);
    const review = buildRouteReviewObservations(activity);
    assert.equal(review.length, 100);
    assert.equal(review.some(point => point.point.timestamp === startTime + spike * 1000), false);
    assert.ok(Math.max(...review.map(point => point.point.latitude)) - Math.min(...review.map(point => point.point.latitude)) < 0.003);
    if (spike < 100) assert.equal(review.find(point => point.point.timestamp === startTime + (spike + 1) * 1000)!.continuous, false);
    assert.equal(review.at(-1)!.distanceMeters, raw.at(-1)!.distanceMeters);
    for (const fraction of [0, 0.49, 0.5, 0.51, 1]) assert.notEqual(routeObservationAtFraction(review, fraction)?.point.timestamp, startTime + spike * 1000);
    assert.deepEqual(activity, original);
  }
});

test('review retains valid relocated segments and isolated fixes after genuine recording gaps', () => {
  for (const extraGapMs of [0, 60_000]) {
    const activity = fixture('hiking', 101);
    activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map((point, index) => index < 50 ? point
      : { ...point, latitude: point.latitude + 1, timestamp: point.timestamp + extraGapMs });
    activity.endTime! += extraGapMs;
    const original = structuredClone(activity);
    const review = buildRouteReviewObservations(activity);
    assert.equal(review.length, 101);
    assert.equal(review[50]!.continuous, false);
    assert.equal(review[51]!.continuous, true);
    assert.ok(Math.max(...review.map(point => point.point.latitude)) - Math.min(...review.map(point => point.point.latitude)) > 1);
    assert.equal(review[50]!.distanceMeters, review[49]!.distanceMeters);
    assert.deepEqual(activity, original);
  }
  const isolated = fixture('hiking', 3);
  isolated.metrics.routeCoordinates![2] = { ...isolated.metrics.routeCoordinates![2]!, latitude: 1, timestamp: startTime + 120_000 };
  isolated.endTime = startTime + 120_000;
  assert.equal(buildRouteReviewObservations(isolated).length, 3);
});

test('stored power sharing rejects a wrong quantity, sport, negative watts or invalid coverage', () => {
  const activity = fixture('running');
  const estimate = estimateActivityPower(activity, 70)!;
  assert.ok(estimate);
  activity.metrics.powerEstimate = estimate;
  assert.ok(sharePowerMetric(activity));
  activity.metrics.powerEstimate = { ...estimate, averageWatts: -5 };
  assert.equal(sharePowerMetric(activity), null);
  activity.metrics.powerEstimate = { ...estimate, coverageRatio: 2 };
  assert.equal(sharePowerMetric(activity), null);
  activity.metrics.powerEstimate = { ...estimate, sport: 'cycling', quantity: 'cycling_mechanical_estimate' };
  assert.equal(sharePowerMetric(activity), null);
});

test('scrubbing selects real points and refuses future/stale biometric samples', () => {
  const points = buildRouteObservations(fixture());
  assert.equal(routeObservationAtFraction(points, 0), points[0]);
  assert.equal(routeObservationAtFraction(points, 1), points.at(-1));
  const samples = [{ timestamp: 1000, bpm: 110 }, { timestamp: 32_000, bpm: 160 }];
  assert.equal(sampleAtTime(samples, 33_000)?.bpm, 160);
  assert.equal(sampleAtTime(samples, 31_001), undefined);
  assert.equal(sampleAtTime(samples, 500), undefined);
});

test('sensor means are time-weighted and do not bridge recording gaps or pauses', () => {
  const samples = [{ timestamp: 0, bpm: 100 }, { timestamp: 1000, bpm: 200 }];
  const result = weightedSensorMean(samples, sample => sample.bpm, 0, 3000);
  assert.equal(result.mean, 500 / 3);
  const gap = weightedSensorMean([{ timestamp: 0, bpm: 100 }, { timestamp: 60_000, bpm: 200 }], sample => sample.bpm, 0, 61_000);
  assert.equal(gap.coverageSeconds, 11);
});

test('cycling road-load math converts grade to angle and rejects invalid assumptions', () => {
  const flat = estimateCyclingWatts({ bodyMassKg: 70, bikeMassKg: 10, speedMps: 5, grade: 0 })!;
  const uphill = estimateCyclingWatts({ bodyMassKg: 70, bikeMassKg: 10, speedMps: 5, grade: 0.05 })!;
  const pathSpeed = 5 * Math.hypot(1, 0.05);
  const expected = (0.005 * 80 * 9.80665 * Math.cos(Math.atan(0.05)) + 80 * 9.80665 * Math.sin(Math.atan(0.05)) + 0.5 * 1.225 * 0.32 * pathSpeed ** 2) * pathSpeed / 0.97;
  assert.ok(Math.abs(uphill - expected) < 0.000001);
  assert.ok(uphill > flat + 150);
  assert.equal(estimateCyclingWatts({ bodyMassKg: NaN, speedMps: 5, grade: 0 }), null);
  assert.equal(estimateCyclingWatts({ bodyMassKg: 70, speedMps: 5, grade: 0.5 }), null);
  assert.equal(estimateCyclingWatts({ bodyMassKg: 70, speedMps: 0, grade: 0 }), 0);
});

test('running cost model is explicitly metabolic and never extrapolates outside its domain', () => {
  assert.equal(estimateRunningMetabolicWatts(70, 3, 0), 756);
  assert.equal(estimateRunningMetabolicWatts(70, 3, 0.46), null);
  assert.equal(estimateRunningMetabolicWatts(70, 1, 0), null);
  const estimate = estimateActivityPower(fixture(), 70)!;
  assert.equal(estimate.quantity, 'running_metabolic_estimate');
  assert.match(estimate.assumptions[0]!, /NOT mechanical/);
  const mixed = fixture(); mixed.subtype = 'run_walk';
  assert.equal(estimateActivityPower(mixed, 70), null);
  assert.equal(estimateActivityPower(fixture('ski_touring'), 70), null);
});

test('post-workout estimates require altitude and adequate valid coverage', () => {
  const activity = fixture('cycling');
  assert.ok(estimateActivityPower(activity, 70));
  activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map(({ altitudeMeters, ...point }) => point);
  assert.equal(estimateActivityPower(activity, 70), null);
});

test('device power takes share precedence and scalar power never invents sensor coverage', () => {
  const activity = fixture('cycling', 101);
  activity.metrics.powerEstimate = estimateActivityPower(activity, 70)!;
  activity.metrics.powerSamples = Array.from({ length: 101 }, (_, index) => ({ timestamp: startTime + index * 1000, sport: 'cycling', watts: 200, source: 'cycling_power_meter', kind: 'measured' }));
  assert.equal(sharePowerMetric(activity)?.label, 'Measured power');
  assert.equal(devicePowerSummary(activity)?.watts, 200);
  activity.metrics.powerSamples = undefined;
  activity.metrics.cyclingPowerWatts = 180;
  activity.metrics.metricSources = { power: 'cycling_power_meter' };
  assert.equal(devicePowerSummary(activity)?.coverageRatio, null);
});

test('snow segmentation excludes flat noise and does not inflate descents for a small uphill bump', () => {
  assert.deepEqual(analyzeSnowSegments(fixture('snowboarding', 200)), []);
  const activity = fixture('snowboarding', 200);
  activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map((point, index) => ({ ...point, altitudeMeters: 1000 - index * 0.3 + (index > 90 && index < 95 ? 1 : 0) }));
  assert.equal(analyzeSnowSegments(activity).filter(segment => segment.kind === 'descent').length, 1);
});

test('route power rejects other sports, invalid watts, stale and future samples and names every kind', () => {
  const activity = fixture('cycling', 101);
  const timestamp = startTime + 20_000;
  const modeled: PowerSample = { timestamp, watts: 210, sport: 'cycling', source: 'model_estimate', kind: 'model_estimated', modelVersion: 'stride-road-load/1' };
  activity.metrics.powerSamples = [
    modeled,
    { timestamp: timestamp + 1, watts: 700, sport: 'cycling', source: 'cycling_power_meter', kind: 'measured' },
    { timestamp, watts: 800, sport: 'running', source: 'apple_watch', kind: 'device_estimated' },
    { timestamp, watts: NaN, sport: 'cycling', source: 'cycling_power_meter', kind: 'measured' },
    { timestamp, watts: -1, sport: 'cycling', source: 'cycling_power_meter', kind: 'measured' },
  ];
  assert.equal(routePowerSample(activity, timestamp), modeled);
  assert.equal(powerSampleLabel(modeled), 'Estimated cycling power');
  assert.equal(powerSampleLabel({ ...modeled, kind: 'measured' }), 'Measured power');
  assert.equal(powerSampleLabel({ ...modeled, kind: 'device_estimated' }), 'Device-estimated cycling power');
  assert.equal(powerSampleLabel({ ...modeled, sport: 'running', kind: 'device_estimated' }), 'Device running power');
  assert.equal(powerSampleLabel({ ...modeled, sport: 'running' }), 'Model-estimated running power');
  activity.metrics.powerSamples = [modeled];
  assert.equal(routePowerSample(activity, timestamp + 10_001), undefined);
  activity.metrics.powerSamples.push({ ...modeled, timestamp: timestamp - 1000, watts: 0, source: 'cycling_power_meter', kind: 'measured' });
  assert.equal(routePowerSample(activity, timestamp)?.watts, 0);
  assert.equal(routePowerSample(fixture('hiking'), timestamp), undefined);
});

test('each device kind must qualify independently before measured precedence applies', () => {
  for (const sport of ['running', 'cycling'] as const) {
    const activity = fixture(sport, 101);
    const deviceSamples: PowerSample[] = Array.from({ length: 101 }, (_, index) => ({
      timestamp: startTime + index * 1000, sport, watts: 175, source: 'healthkit', kind: 'device_estimated',
    }));
    activity.metrics.powerSamples = [...deviceSamples, { timestamp: startTime, sport, watts: 900, source: 'healthkit', kind: 'measured' }];
    assert.equal(devicePowerSummary(activity)?.watts, 175);
    assert.equal(devicePowerSummary(activity)?.kind, 'device_estimated');
    assert.equal(devicePowerSummary(activity)?.coverageRatio, 1);
    assert.equal(sharePowerMetric(activity)?.label, sport === 'running' ? 'Device running power' : 'Device-estimated cycling power');
    activity.metrics.powerSamples = [...deviceSamples, { timestamp: startTime, sport, watts: NaN, source: 'healthkit', kind: 'measured' }];
    assert.equal(devicePowerSummary(activity)?.watts, 175);
    activity.metrics.powerSamples = [...deviceSamples, ...deviceSamples.map(sample => ({ ...sample, watts: 250, kind: 'measured' as const }))];
    assert.equal(devicePowerSummary(activity)?.watts, 250);
    assert.equal(devicePowerSummary(activity)?.kind, 'measured');
  }
});

test('a measured scalar retains precedence without inventing sample coverage', () => {
  const activity = fixture('cycling', 101);
  activity.metrics.powerSamples = Array.from({ length: 101 }, (_, index) => ({ timestamp: startTime + index * 1000, sport: 'cycling', watts: 200, source: 'smart_trainer', kind: 'device_estimated' }));
  activity.metrics.cyclingPowerWatts = 180;
  activity.metrics.metricSources = { power: 'cycling_power_meter' };
  assert.deepEqual(devicePowerSummary(activity), { watts: 180, label: 'Measured power', coverageRatio: null, kind: 'measured' });
});

test('pause boundaries expire held samples and require fresh data at or after resume', () => {
  const pauses = [{ startTime: 1000, endTime: 5000 }, { startTime: 2000, endTime: 6000 }];
  const samples = [{ timestamp: 0, bpm: 100 }, { timestamp: 3000, bpm: 900 }, { timestamp: 8000, bpm: 200 }];
  assert.deepEqual(weightedSensorMean(samples, sample => sample.bpm, 0, 10_000, pauses), { mean: 500 / 3, coverageSeconds: 3 });
  assert.equal(sampleAtTime(samples, 1000, 10_000, pauses), undefined);
  assert.equal(sampleAtTime(samples, 7000, 10_000, pauses), undefined);
  assert.equal(sampleAtTime(samples, 8000, 10_000, pauses)?.bpm, 200);
  assert.equal(sampleAtTime([{ timestamp: 6000, bpm: 150 }], 6000, 10_000, pauses)?.bpm, 150);
  const activity = fixture('cycling', 11);
  activity.metrics.recordingPauses = pauses.map(pause => ({ startTime: startTime + pause.startTime, endTime: startTime + pause.endTime }));
  activity.metrics.powerSamples = [{ timestamp: startTime, sport: 'cycling', watts: 200, kind: 'measured', source: 'cycling_power_meter' }];
  assert.equal(routePowerSample(activity, startTime + 7000), undefined);
});

test('device means retain interval weights without mixing a second kind', () => {
  const activity = fixture('running', 11);
  activity.metrics.powerSamples = [
    { timestamp: startTime, watts: 100, sport: 'running', source: 'apple_watch', kind: 'device_estimated' },
    { timestamp: startTime + 2000, watts: 300, sport: 'running', source: 'apple_watch', kind: 'device_estimated' },
    { timestamp: startTime, watts: 900, sport: 'running', source: 'model_estimate', kind: 'model_estimated', modelVersion: 'test' },
  ];
  assert.equal(devicePowerSummary(activity)?.watts, 260);
});

test('both post-workout models convert horizontal distance to path distance on slopes', () => {
  const horizontalStep = 3;
  const grade = 0.3;
  const latitudeMeters = 6_371_000 * Math.PI / 180;
  const pathSpeed = horizontalStep * Math.hypot(1, grade);
  for (const sport of ['running', 'cycling'] as const) {
    const activity = fixture(sport, 101);
    activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map((point, index) => ({ ...point,
      latitude: index * horizontalStep / latitudeMeters, altitudeMeters: 100 + index * horizontalStep * grade,
    }));
    const estimate = estimateActivityPower(activity, 70)!;
    const expected = sport === 'running' ? 12.579282 * 70 * pathSpeed
      : (0.005 * 80 * 9.80665 / Math.hypot(1, grade) + 80 * 9.80665 * grade / Math.hypot(1, grade) + 0.5 * 1.225 * 0.32 * pathSpeed ** 2) * pathSpeed / 0.97;
    assert.ok(Math.abs(estimate.averageWatts! - expected) < 0.000001);
    assert.equal(estimate.version, '2');
  }
});

test('a minority of out-of-domain running grades excludes the whole activity with a reason', () => {
  for (const grade of [-1, -0.6, 0.6, 1]) {
    const activity = fixture('running', 401);
    activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map((point, index) => ({ ...point,
      altitudeMeters: 1000 + Math.max(0, index - 340) * 3 * grade,
    }));
    assert.ok(buildRouteObservations(activity).filter(point => point.grade === 0).length > 300);
    assert.match(powerModelExclusionReason(activity)!, /entire activity/);
    assert.equal(estimateActivityPower(activity, 70), null);
  }
  const mixed = fixture();
  mixed.metrics.runWalkIntervals = [{ kind: 'walk', durationSeconds: 30 }];
  assert.match(powerModelExclusionReason(mixed)!, /Mixed run\/walk/);
  assert.equal(estimateActivityPower(mixed, 70), null);
});

function snowWithFlat(flatPoints: number, metersPerSecond = 3): Activity {
  const activity = fixture('snowboarding', 320 + flatPoints);
  activity.metrics.routeCoordinates = activity.metrics.routeCoordinates!.map((point, index) => ({ ...point,
    latitude: index * metersPerSecond / 111195,
    altitudeMeters: 1000 - Math.min(index, 159) * 0.6 - Math.max(0, index - (159 + flatPoints)) * 0.6,
  }));
  return activity;
}

test('snow segments expire long flat transitions by time or distance', () => {
  for (const activity of [snowWithFlat(60, 0.8), snowWithFlat(15, 6)]) {
    const descents = analyzeSnowSegments(activity).filter(segment => segment.kind === 'descent');
    assert.equal(descents.length, 2);
    assert.ok(descents[0]!.endTime < descents[1]!.startTime);
  }
});

test('short flat transitions include both their distance and their time when bridged', () => {
  const activity = snowWithFlat(10);
  const [segment, ...others] = analyzeSnowSegments(activity);
  assert.equal(others.length, 0);
  assert.ok(segment);
  const observations = buildRouteObservations(activity);
  const included = observations.filter(point => point.point.timestamp > segment.startTime && point.point.timestamp <= segment.endTime);
  assert.ok(Math.abs(segment.distanceMeters - included.reduce((sum, point) => sum + point.segmentMeters, 0)) < 0.000001);
  assert.equal(segment.endTime - segment.startTime, included.reduce((sum, point) => sum + point.segmentSeconds * 1000, 0));
});

test('model inputs preserve HealthKit, watch and unknown route provenance without claiming phone GPS', () => {
  const activity = fixture('cycling', 101);
  const routeSource = () => estimateActivityPower(activity, 70)!.inputs.find(input => input.name.startsWith('Recorded route'))!;
  activity.source = 'healthkit';
  activity.metrics.metricSources = { distance: 'apple_watch' };
  assert.equal(routeSource().source, 'healthkit');
  activity.source = 'tracked';
  assert.equal(routeSource().source, 'apple_watch');
  activity.metrics.metricSources.distance = 'phone_gps';
  assert.equal(routeSource().source, 'phone_gps');
  activity.source = 'strava';
  activity.metrics.metricSources = undefined;
  assert.equal(routeSource().source, 'unavailable');
  assert.match(routeSource().name, /source unknown/);
});

test('climbing work is body-mass potential energy and discloses unknown assisted ascent', () => {
  const activity = fixture('hiking');
  activity.metrics.elevationGainMeters = 100;
  const result = estimateClimbingWork(activity, 70)!;
  assert.ok(Math.abs(result.kilojoules - 68.64655) < 0.000001);
  assert.match(result.note, /Assisted ascent cannot be distinguished and may be included/);
  assert.match(result.note, /not total human power or calories/);
  assert.equal(estimateClimbingWork(activity, NaN), null);
  activity.indoor = true;
  assert.equal(estimateClimbingWork(activity, 70), null);
  assert.deepEqual(buildRouteObservations(activity), []);
  assert.equal(estimateClimbingWork(fixture('ski_touring'), 70), null);
});

test('analysis and estimate helpers preserve recorded sources, routes, samples and pause ordering', () => {
  const activity = fixture('cycling', 101);
  activity.source = 'healthkit';
  activity.metrics.powerSamples = [
    { timestamp: startTime + 9000, watts: 190, sport: 'cycling', source: 'healthkit', kind: 'measured' },
    { timestamp: startTime, watts: 200, sport: 'cycling', source: 'cycling_power_meter', kind: 'measured' },
  ];
  activity.metrics.recordingPauses = [{ startTime: startTime + 70_000, endTime: startTime + 72_000 }, { startTime: startTime + 40_000, endTime: startTime + 42_000 }];
  const original = structuredClone(activity);
  buildRouteObservations(activity);
  buildOutdoorSplits(activity, 'metric');
  estimateActivityPower(activity, 70);
  devicePowerSummary(activity);
  routePowerSample(activity, startTime + 10_000);
  assert.deepEqual(activity, original);
});
