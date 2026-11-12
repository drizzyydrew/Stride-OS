import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity } from '../../types/activity';
import type { RacePR } from '../../types/athlete';
import type { CustomWorkoutLog } from '../../types/customWorkout';
import type { GoalArchive } from '../../types/goalArchive';
import { createDefaultProfile, runCalibration, vdotFromRacePR } from '../calibrationEngine';
import { mergeManualActivityEdit } from '../manualActivityEdit';
import {
  activityRacePerformance, bestRacePRsByDistance, buildActivityRaceResult, calibrationHistorySignals, completedActivityRaceResult,
  isValidRacePerformance, parseRaceElapsedTime, reconcileRacePerformances,
} from '../racePerformance';

const NOW = new Date('2026-11-05T12:00:00').getTime();
const race = (patch: Partial<RacePR> = {}): RacePR => ({
  id: 'manual', distanceKey: '5k', distanceLabel: '5K', distanceMeters: 5000,
  timeSeconds: 1500, date: '2026-10-01', official: true, ...patch,
});
const archive = (patch: Partial<GoalArchive> = {}): GoalArchive => ({
  schemaVersion: 1, id: 'rome', sourceKey: 'race:rome', ownerUserId: 'owner', athleteId: 'athlete_default',
  title: 'Race', kind: 'race', goalType: 'race_prep', startDate: '2026-09-01', endDate: '2026-10-18', archivedAt: NOW,
  race: { id: 'rome', name: 'Rome Half Marathon', date: '2026-10-18', distance: 'half_marathon', priority: 'A' },
  summary: { completedActivities: 0, partialActivities: 0, activeDays: 0, distanceMeters: null,
    durationSeconds: null, elevationGainMeters: null, trainingLoad: null, activityIds: [], weeks: [],
    coverage: { distanceActivities: 0, durationActivities: 0 } },
  result: { status: 'finished', timeSeconds: 7200, source: 'user' }, ...patch,
});
const activity = (patch: Partial<Activity> = {}): Activity => ({
  id: 'run', activityType: 'running', source: 'tracked', status: 'completed', scheduled: false,
  startTime: new Date('2026-11-04T12:00:00').getTime(), indoor: false,
  metrics: { durationSeconds: 1200, activeTimeSeconds: 1200, elapsedTimeSeconds: 1800, distanceMeters: 5100 },
  trainingLoad: { method: 'estimated', wholeBody: 0, running: 0, walking: 0, strength: 0, crossTraining: 0,
    impactBearing: 0, nonImpactAerobic: 0, confidence: 'low' }, createdAt: 1, updatedAt: 1, ...patch,
});
const log = (patch: Partial<CustomWorkoutLog> = {}): CustomWorkoutLog => ({
  id: 'custom-race', category: 'running', runType: 'race', date: '2026-10-18', completedAt: NOW,
  source: 'backdated', durationMinutes: 120, distanceMiles: 13.1, estimatedLoad: 100, fatigueImpact: 10, ...patch,
});

test('elapsed race parser accepts precise finish time and rejects clock rollover, signs, decimal minutes and empty fields', () => {
  assert.equal(parseRaceElapsedTime('22:30'), 1350);
  assert.equal(parseRaceElapsedTime(' 1:59:59 '), 7199);
  assert.equal(parseRaceElapsedTime('139:25'), 8365);
  for (const value of ['', '0:00', '1:99', '1:60:00', '-1:30', '1.5:00', ':30', '1:', '1:2', 'Infinity:00']) {
    assert.equal(parseRaceElapsedTime(value), null, value);
  }
});

test('first valid result becomes per-distance PR; slower later results remain history and a faster result becomes the new best', () => {
  const first = race();
  assert.deepEqual(bestRacePRsByDistance([first], NOW), [first]);
  const slower = race({ id: 'slower', timeSeconds: 1600, date: '2026-11-01' });
  assert.deepEqual(bestRacePRsByDistance([first, slower], NOW), [first]);
  const faster = race({ id: 'faster', timeSeconds: 1400, date: '2026-11-04' });
  const other = race({ id: 'ten', distanceKey: '10k', distanceLabel: '10K', distanceMeters: 10000, timeSeconds: 3200 });
  assert.deepEqual(bestRacePRsByDistance([first, slower, faster, other], NOW), [faster, other]);
});

test('invalid, future and non-finite results cannot become a personal best', () => {
  for (const patch of [{ date: '2099-01-01' }, { date: '2026-02-30' }, { distanceMeters: NaN },
    { timeSeconds: Infinity }, { timeSeconds: 0 }, { distanceMeters: -1 }]) {
    assert.equal(isValidRacePerformance(race(patch), NOW), false);
    assert.equal(bestRacePRsByDistance([race(patch)], NOW).length, 0);
  }
});

test('explicit archived race result supplies event distance and elapsed time without rebuilding activities or frozen totals', () => {
  const snapshot = archive();
  const before = JSON.stringify(snapshot);
  const rows = reconcileRacePerformances([], [snapshot], [], 'owner', 'athlete_default', NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].distanceMeters, 21097.5);
  assert.equal(rows[0].timeSeconds, 7200);
  assert.deepEqual(rows[0].source, { kind: 'goal_archive', archiveId: 'rome', ownerUserId: 'owner', raceId: 'rome' });
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(reconcileRacePerformances(rows, [snapshot], [], 'owner', 'athlete_default', NOW), rows);
});

test('correction, DNF, DNS, cleared result and missing source recompute only the linked PR, preserving manual history', () => {
  const manual = race();
  const rows = reconcileRacePerformances([manual], [archive()], [], 'owner', 'athlete_default', NOW);
  const corrected = reconcileRacePerformances(rows, [archive({ result: { status: 'finished', timeSeconds: 7000 } })], [], 'owner', 'athlete_default', NOW);
  assert.equal(corrected.length, 2);
  assert.equal(corrected.find(pr => pr.source)?.timeSeconds, 7000);
  for (const result of [{ status: 'did_not_finish' }, { status: 'did_not_start' }, { status: 'unrecorded' }, { status: 'finished' }] as GoalArchive['result'][]) {
    assert.deepEqual(reconcileRacePerformances(rows, [archive({ result })], [], 'owner', 'athlete_default', NOW), [manual]);
  }
  assert.deepEqual(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW), [manual]);
  // Even malformed legacy duplicate IDs remain the owner's original records.
  assert.deepEqual(reconcileRacePerformances([manual, manual], [], [], 'owner', 'athlete_default', NOW), [manual, manual]);
});

test('archive identity and owner scope are required; a planned race or race-day workout total is never a finish result', () => {
  const candidates = [archive({ ownerUserId: 'other' }), archive({ athleteId: 'other' }),
    archive({ kind: 'goal' }), archive({ result: { status: 'unrecorded' } }),
    archive({ race: { ...archive().race!, date: '2099-01-01' } })];
  assert.deepEqual(reconcileRacePerformances([], candidates, [], 'owner', 'athlete_default', NOW), []);
  assert.equal(activityRacePerformance(activity(), 'owner', NOW), null);
});

test('explicit Activity race uses confirmed elapsed time and course distance, rather than paused active time or GPS total', () => {
  const result = buildActivityRaceResult('race', '5k', '30:00');
  assert.ok(result);
  const run = activity({ raceResult: result });
  const before = JSON.stringify(run);
  const pr = activityRacePerformance(run, 'owner', NOW)!;
  assert.equal(pr.timeSeconds, 1800);
  assert.equal(pr.distanceMeters, 5000);
  assert.deepEqual(pr.source, { kind: 'activity', activityId: 'run', ownerUserId: 'owner' });
  assert.equal(JSON.stringify(run), before);
  const rows = reconcileRacePerformances([], [], [], 'owner', 'athlete_default', NOW, [run]);
  assert.equal(rows.length, 1);
  assert.deepEqual(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, [activity()]), []);
});

test('Activity race edits, deletion, incomplete status and changed sport remove derived PR evidence', () => {
  const run = activity({ raceResult: buildActivityRaceResult('time_trial', '5k', '25:00')! });
  const rows = reconcileRacePerformances([], [], [], 'owner', 'athlete_default', NOW, [run]);
  const corrected = activity({ raceResult: buildActivityRaceResult('time_trial', '5k', '24:00')! });
  assert.equal(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, [corrected])[0].timeSeconds, 1440);
  for (const patch of [{ status: 'partial' as const }, { activityType: 'cycling' as const }, { raceResult: undefined }]) {
    assert.deepEqual(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, [{ ...run, ...patch }]), []);
  }
  assert.equal(activityRacePerformance({ ...run, completionClassification: 'stopped_early' }, 'owner', NOW), null);
  assert.equal(activityRacePerformance({ ...run, completionClassification: 'partial' }, 'owner', NOW), null);
  assert.deepEqual(reconcileRacePerformances(rows, [], [], 'owner', 'athlete_default', NOW, []), []);
});

test('standard course distance must match the explicit event; custom distance remains exact', () => {
  assert.equal(activityRacePerformance(activity({ raceResult: { kind: 'race', distanceKey: '5k', distanceMeters: 4900, elapsedTimeSeconds: 1400 } }), 'owner', NOW), null);
  const custom = buildActivityRaceResult('race', 'custom', '30:00', 5123.4)!;
  assert.equal(activityRacePerformance(activity({ raceResult: custom }), 'owner', NOW)?.distanceMeters, 5123.4);
  for (const value of [undefined, 0, -1, NaN, Infinity]) assert.equal(buildActivityRaceResult('race', 'custom', '30:00', value), null);
});

test('marking or unmarking a recorded race preserves raw metrics, source, recording identity, dates and route', () => {
  const recorded = activity({ workoutInstanceId: 'instance', metrics: { ...activity().metrics,
    routeCoordinates: [{ latitude: 1, longitude: 2, timestamp: 3 }], rawHeartRateSamples: [{ timestamp: 4, bpm: 160, source: 'apple_watch' }], metricSources: {} } });
  const result = buildActivityRaceResult('race', '5k', '30:00')!;
  const marked = mergeManualActivityEdit(recorded, { ...recorded, raceResult: result }, new Set(['raceResultKind', 'raceFinishTime']));
  assert.deepEqual(marked.metrics, recorded.metrics);
  assert.deepEqual(marked.raceResult, result);
  assert.equal(marked.workoutInstanceId, recorded.workoutInstanceId);
  assert.equal(marked.startTime, recorded.startTime);
  assert.equal(marked.source, recorded.source);
  const removed = mergeManualActivityEdit({ ...recorded, raceResult: result }, { ...recorded, raceResult: undefined }, new Set(['raceResultKind']));
  assert.equal(removed.raceResult, undefined);
  assert.deepEqual(removed.metrics, recorded.metrics);
  const partial = mergeManualActivityEdit({ ...recorded, raceResult: result }, { ...recorded, status: 'partial' }, new Set(['completionState']));
  assert.equal(partial.raceResult, undefined);
  const otherSport = mergeManualActivityEdit({ ...recorded, source: 'manual', workoutInstanceId: undefined,
    metrics: { durationSeconds: 1200 }, raceResult: result }, { ...recorded, activityType: 'walking' }, new Set(['activityKey']));
  assert.equal(otherSport.raceResult, undefined);
});

test('legacy Race/Time Trial duration is not silently promoted to full elapsed race time or a personal best', () => {
  for (const patch of [{}, { runType: 'time_trial' as const }, { runType: 'easy' as const }, { distanceMiles: undefined }, { durationMinutes: undefined },
    { intervals: [{ reps: 3, workDurationSec: 600 }] }]) {
    assert.equal(reconcileRacePerformances([], [], [log(patch)], 'owner', 'athlete_default', NOW).length, 0);
  }
});

test('late completion-classification override clears race metadata for both new and edited activity save paths', () => {
  const completed = activity({ raceResult: buildActivityRaceResult('race', '5k', '25:00')! });
  assert.ok(completedActivityRaceResult(completed));
  for (const completionClassification of ['partial', 'stopped_early', 'skipped'] as const) {
    const overridden = { ...completed, completionClassification };
    assert.equal(completedActivityRaceResult(overridden), undefined);
    assert.equal(completedActivityRaceResult({ ...overridden, status: 'partial' }), undefined);
  }
});

test('calibration history refresh uses actual completed history, de-duplicates recording instances and ignores future/partial entries', () => {
  const run = activity({ workoutInstanceId: 'same' });
  const signals = calibrationHistorySignals([run, { ...run, id: 'health-copy' }, activity({ id: 'partial', status: 'partial' }),
    activity({ id: 'future', startTime: NOW + 1000 })], [log({ date: '2026-11-03' })], NOW);
  assert.deepEqual(signals, { recentWorkoutCount: 2, lastWorkoutDaysAgo: 1 });
});

test('personal best and current fitness stay distinct: latest slower result calibrates, measured HRmax is unchanged', () => {
  const older = race({ id: 'old', date: '2026-10-01', timeSeconds: 1200 });
  const latest = race({ id: 'new', date: '2026-11-01', timeSeconds: 1500 });
  const profile = { ...createDefaultProfile({ athleteId: 'athlete_default', name: 'Tester', vo2Estimate: 40 }),
    racePRs: [older, latest], hrMax: 195, hrMaxManual: true };
  const output = runCalibration({ profile, weeklyMileage: 20, recentWorkoutCount: 10, lastWorkoutDaysAgo: 1,
    currentPhase: 'base', currentFatigueScore: 30, currentRecoveryScore: 75 });
  assert.equal(bestRacePRsByDistance(profile.racePRs, NOW)[0].id, 'old');
  assert.equal(output.vdot, vdotFromRacePR(5000, 1500));
  assert.equal(profile.hrMax, 195);
  assert.match(output.hrMaxSource, /Measured HRmax: 195 bpm/);
});

test('invalid and future stored race entries cannot inflate calibration VDOT, confidence or source', () => {
  const profile = createDefaultProfile({ athleteId: 'athlete_default', name: 'Tester', vo2Estimate: 40 });
  const input = { profile, weeklyMileage: 20, recentWorkoutCount: 2, lastWorkoutDaysAgo: 1,
    currentPhase: 'base' as const, currentFatigueScore: 30, currentRecoveryScore: 75 };
  const baseline = runCalibration(input);
  const output = runCalibration({ ...input, profile: { ...profile, racePRs: [
    race({ date: '2999-01-01', timeSeconds: 1000 }), race({ date: '2026-02-30' }),
    race({ timeSeconds: Infinity }), race({ distanceMeters: NaN }),
  ] } });
  assert.equal(output.vdot, baseline.vdot);
  assert.equal(output.confidenceScore, baseline.confidenceScore);
  assert.equal(output.primarySource, baseline.primarySource);
  assert.deepEqual(output.racePredictions, baseline.racePredictions);
});

test('PR notification provenance uses explicit result entry time, never arbitrary activity/archive update time', () => {
  const confirmed = { kind: 'race' as const, distanceKey: '5k' as const, distanceMeters: 5000, elapsedTimeSeconds: 1500, recordedAt: NOW - 100 };
  assert.equal(activityRacePerformance(activity({ raceResult: confirmed }), 'owner', NOW)?.recordedAt, NOW - 100);
  const { recordedAt: _unused, ...legacy } = confirmed;
  assert.equal(activityRacePerformance(activity({ raceResult: legacy, updatedAt: NOW }), 'owner', NOW)?.recordedAt, undefined);
  const explicit = archive({ result: { status: 'finished', timeSeconds: 7200, source: 'user', updatedAt: NOW - 200 } });
  assert.equal(reconcileRacePerformances([], [explicit], [], 'owner', 'athlete_default', NOW)[0].recordedAt, NOW - 200);
  const automatic = archive({ result: { status: 'finished', timeSeconds: 7200, source: 'race_record', updatedAt: NOW } });
  assert.equal(reconcileRacePerformances([], [automatic], [], 'owner', 'athlete_default', NOW)[0].recordedAt, undefined);
});

test('unrelated activity edits retain explicit result-entry time while result edits may replace it', () => {
  const raceResult = { kind: 'race' as const, distanceKey: '5k' as const, distanceMeters: 5000, elapsedTimeSeconds: 1500, recordedAt: NOW - 1000 };
  const saved = activity({ raceResult });
  const draft = { ...saved, notes: 'Updated notes', raceResult: { ...raceResult, recordedAt: NOW } };
  assert.equal(mergeManualActivityEdit(saved, draft, new Set(['notes'])).raceResult?.recordedAt, NOW - 1000);
  assert.equal(mergeManualActivityEdit(saved, draft, new Set(['raceFinishTime'])).raceResult?.recordedAt, NOW);
});
