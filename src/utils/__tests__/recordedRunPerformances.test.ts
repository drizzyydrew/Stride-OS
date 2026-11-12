import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity, ActivityCoordinate } from '../../types/activity';
import { STANDARD_DISTANCE_METERS } from '../../types/athlete';
import { recordedRunPerformances } from '../recordedRunPerformances';
import { reconcileRacePerformances } from '../racePerformance';
import { nextRacePrLedger } from '../racePrAwards';
import { createDefaultProfile, runCalibration } from '../calibrationEngine';

const START = new Date('2026-11-10T12:00:00Z').getTime();
const NOW = START + 86_400_000;
const fix = (meters: number, seconds: number): ActivityCoordinate => ({ latitude: 0,
  longitude: meters / 6371000 * 180 / Math.PI, timestamp: START + seconds * 1000, horizontalAccuracyMeters: 4 });
function run(meters = 5100, speed = 4): Activity {
  const route: ActivityCoordinate[] = [];
  for (let distance = 0; distance <= meters; distance += 10) route.push(fix(distance, distance / speed));
  return { id: 'run', activityType: 'running', source: 'tracked', status: 'completed', scheduled: false,
    startTime: START, endTime: START + meters / speed * 1000, indoor: false,
    metrics: { distanceMeters: meters, distanceSource: 'gps', elapsedTimeSeconds: meters / speed, elapsedTimeSource: 'recorded_wall_clock',
      activeTimeSeconds: 1, routeCoordinates: route }, createdAt: START, updatedAt: START,
    trainingLoad: { method: 'estimated', wholeBody: 0, running: 0, walking: 0, strength: 0,
      crossTraining: 0, impactBearing: 0, nonImpactAerobic: 0, confidence: 'low' } };
}
const best5k = (activity: Activity) => recordedRunPerformances(activity, 'owner', NOW).find(pr => pr.distanceKey === '5k');

test('automatic exact covered-distance windows use timestamps, not active time or total average pace', () => {
  const activity = run();
  const before = JSON.stringify(activity);
  assert.equal(best5k(activity)?.timeSeconds, 1250);
  assert.equal(best5k(activity)?.official, false);
  assert.equal(best5k(activity)?.source?.kind, 'recorded_effort');
  assert.equal(JSON.stringify(activity), before);
  assert.equal(recordedRunPerformances(run(4900), 'owner', NOW).some(pr => pr.distanceKey === '5k'), false);
});

test('both vertex-start and vertex-end windows find the faster actual portion of a variable-pace run', () => {
  const activity = run(7000);
  activity.metrics.routeCoordinates = Array.from({ length: 701 }, (_, i) => {
    const d = i * 10;
    return fix(d, d <= 1000 ? d / 2 : d <= 6000 ? 500 + (d - 1000) / 5 : 1500 + (d - 6000) / 2);
  });
  activity.endTime = START + 2000 * 1000;
  activity.metrics.elapsedTimeSeconds = 2000;
  assert.equal(best5k(activity)?.timeSeconds, 1000);
});

test('a sufficiently long measured route supports all six classes without projecting distance', () => {
  const records = recordedRunPerformances(run(42200), 'owner', NOW);
  assert.equal(records.length, 6);
  for (const record of records) {
    assert.equal(record.distanceMeters, STANDARD_DISTANCE_METERS[record.distanceKey]);
    assert.ok(Math.abs(record.timeSeconds - Math.ceil(record.distanceMeters / 4)) <= 1);
  }
});

test('a pause fully between valid fixes breaks windows rather than connecting their distances', () => {
  const activity = run(1000);
  activity.metrics.recordingPauses = [{ startTime: START + 124_000, endTime: START + 126_000 }];
  assert.deepEqual(recordedRunPerformances(activity, 'owner', NOW), []);
});

test('invalid quality, GPS gaps, teleports, backward timestamps and out-of-bounds points cannot bridge a PR', () => {
  for (const change of [
    (p: ActivityCoordinate) => ({ ...p, horizontalAccuracyMeters: undefined }),
    (p: ActivityCoordinate) => ({ ...p, horizontalAccuracyMeters: 66 }),
    (p: ActivityCoordinate) => ({ ...p, latitude: 91 }),
    (p: ActivityCoordinate) => ({ ...p, longitude: 150 }),
    (p: ActivityCoordinate) => ({ ...p, timestamp: START - 1 }),
    (p: ActivityCoordinate) => ({ ...p, timestamp: p.timestamp + 20_000 }),
  ]) {
    const activity = run(1000);
    activity.metrics.routeCoordinates![50] = change(activity.metrics.routeCoordinates![50]);
    assert.deepEqual(recordedRunPerformances(activity, 'owner', NOW), []);
  }
});

test('invalid present GPS trace never falls back to a whole-run total; corrected distance is respected', () => {
  const activity = run(5000);
  activity.metrics.routeCoordinates = [fix(0, 0), fix(5000, 2)];
  assert.equal(best5k(activity), undefined);
  assert.equal(best5k({ ...run(5000), metrics: { ...run(5000).metrics, distanceSource: 'manual_entry' } }), undefined);
  assert.equal(best5k({ ...run(5000), metrics: { ...run(5000).metrics, distanceMeters: 1000 } }), undefined);
});

test('whole measured exact-distance fallback includes pauses and requires real elapsed evidence', () => {
  const activity = run(5000);
  delete activity.metrics.routeCoordinates;
  activity.metrics.distanceSource = 'treadmill_reported';
  assert.equal(best5k(activity)?.timeSeconds, 1250);
  assert.equal(best5k({ ...activity, endTime: undefined, metrics: { ...activity.metrics, elapsedTimeSeconds: undefined } }), undefined);
  assert.equal(best5k({ ...activity, metrics: { ...activity.metrics, distanceMeters: 4999.9 } }), undefined);
  assert.equal(best5k({ ...activity, metrics: { ...activity.metrics, elapsedTimeSeconds: 10 } }), undefined);
  assert.equal(best5k({ ...activity, metrics: { ...activity.metrics, elapsedTimeSource: undefined } }), undefined);
});

test('incomplete, future, non-running, imported and estimated records are ineligible', () => {
  for (const activity of [ { ...run(), status: 'partial' as const }, { ...run(), activityType: 'walking' as const },
    { ...run(), completionClassification: 'stopped_early' as const }, { ...run(), source: 'legacy_import' as const },
    { ...run(), startTime: NOW + 1 }, { ...run(), endTime: NOW + 1 } ]) {
    assert.deepEqual(recordedRunPerformances(activity, 'owner', NOW), []);
  }
});

test('explicit race wins its class; correction, deletion, secondary scope and hydration caller preserve source custody', () => {
  const activity = { ...run(), raceResult: { kind: 'race' as const, distanceKey: '5k' as const,
    distanceMeters: 5000, elapsedTimeSeconds: 1300 } };
  let rows = reconcileRacePerformances([], [], [], 'owner', 'athlete_default', NOW, [activity]);
  assert.equal(rows.filter(pr => pr.distanceKey === '5k').length, 1);
  assert.equal(rows.find(pr => pr.distanceKey === '5k')?.source?.kind, 'activity');
  rows = reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, [run()]);
  assert.equal(rows.find(pr => pr.distanceKey === '5k')?.source?.kind, 'recorded_effort');
  assert.deepEqual(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, []), []);
  assert.deepEqual(reconcileRacePerformances([], [], [], 'owner', 'secondary', NOW, [run()]), []);
});

test('faster new recordings repeat PRs; historical restore, source corrections and reimports stay quiet', () => {
  const first = recordedRunPerformances(run(), 'owner', NOW);
  const seed = nextRacePrLedger(null, first, 'owner', NOW).ledger;
  assert.equal(nextRacePrLedger(seed, first, 'owner', NOW).notifications.length, 0);
  const nextRun = run(5100, 5);
  nextRun.id = 'next'; nextRun.startTime += 86_000_000; nextRun.endTime! += 86_000_000;
  nextRun.metrics.routeCoordinates = nextRun.metrics.routeCoordinates!.map(p => ({ ...p, timestamp: p.timestamp + 86_000_000 }));
  const later = NOW + 86_400_000;
  const second = recordedRunPerformances(nextRun, 'owner', later);
  const updated = nextRacePrLedger(seed, [...first, ...second], 'owner', later);
  assert.equal(updated.notifications.length, 3); // 800m, mile and 5K, once each.
  assert.equal(nextRacePrLedger(updated.ledger, [...first, ...second], 'owner', later).notifications.length, 0);
  const correction = second.map(pr => ({ ...pr, timeSeconds: pr.timeSeconds - 10 }));
  assert.equal(nextRacePrLedger(updated.ledger, [...first, ...correction], 'owner', later).notifications.length, 0);
});

test('unconfirmed training bests do not replace confirmed fitness calibration or inflate its confidence', () => {
  const profile = createDefaultProfile({ athleteId: 'athlete_default', name: 'Tester', vo2Estimate: 40 });
  const input = { profile, weeklyMileage: 20, currentPhase: 'base' as const, currentFatigueScore: 20,
    currentRecoveryScore: 70, recentWorkoutCount: 4, lastWorkoutDaysAgo: 1 };
  const baseline = runCalibration(input);
  const result = runCalibration({ ...input, profile: { ...profile, racePRs: recordedRunPerformances(run(), 'owner', NOW) } });
  assert.deepEqual({ ...result, lastCalibratedAt: 0 }, { ...baseline, lastCalibratedAt: 0 });
});
