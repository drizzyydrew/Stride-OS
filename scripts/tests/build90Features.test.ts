import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  evaluateSegmentPaceCue,
  parseDurationTarget,
  segmentFeedbackCue,
  segmentTarget,
} from '../../src/utils/workoutSegmentCoaching';
import { customRunToRichWorkout } from '../../src/utils/customRunWorkout';
import { initialAutoPauseState, reduceAutoPause } from '../../src/utils/autoPause';
import { appendTrackingPoint } from '../../src/utils/activityTracking';
import { isGpsSignalWeak, WEAK_GPS_AFTER_MS } from '../../src/utils/gpsSignal';
import {
  createSavedRouteTurnGuidancePlan,
  guidanceAlertCue,
  INITIAL_GUIDANCE_ALERT_STATE,
  GUIDANCE_ALERT_REPEAT_MS,
  updateRouteGuidanceProgress,
  type GuidancePoint,
  type RouteGuidanceProgress,
} from '../../src/lib/routeGuidance';
import type { CustomRunDefinition } from '../../src/types/customWorkout';

const read = (path: string) => readFileSync(path, 'utf8');

// Offsets in meters from a local origin -> lat/lng (small-area approximation).
const ORIGIN = { latitude: 44.05, longitude: -121.31 };
function at(northMeters: number, eastMeters: number): GuidancePoint {
  return {
    latitude: ORIGIN.latitude + northMeters / 111_320,
    longitude: ORIGIN.longitude + eastMeters / (111_320 * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
  };
}
function line(from: [number, number], to: [number, number], stepMeters = 10): GuidancePoint[] {
  const [n0, e0] = from;
  const [n1, e1] = to;
  const length = Math.hypot(n1 - n0, e1 - e0);
  const steps = Math.max(1, Math.round(length / stepMeters));
  return Array.from({ length: steps + 1 }, (_, i) => at(n0 + ((n1 - n0) * i) / steps, e0 + ((e1 - e0) * i) / steps));
}
function path(...legs: GuidancePoint[][]): GuidancePoint[] {
  return legs.flatMap((leg, index) => (index === 0 ? leg : leg.slice(1)));
}

// ─── Workout builder: segment targets ────────────────────────────────────────

test('segment durations: "min" is time, never miles', () => {
  assert.deepEqual(parseDurationTarget('10 min'), { kind: 'time', seconds: 600 });
  assert.deepEqual(parseDurationTarget('2 mins'), { kind: 'time', seconds: 120 });
  assert.deepEqual(parseDurationTarget('90 sec'), { kind: 'time', seconds: 90 });
  assert.deepEqual(parseDurationTarget('1:30 min'), { kind: 'time', seconds: 90 });
  assert.deepEqual(parseDurationTarget('1 hr'), { kind: 'time', seconds: 3600 });
  assert.deepEqual(parseDurationTarget('0.25 mi'), { kind: 'distance', miles: 0.25 });
  assert.deepEqual(parseDurationTarget('.25 mi'), { kind: 'distance', miles: 0.25 });
  assert.deepEqual(parseDurationTarget('2 miles'), { kind: 'distance', miles: 2 });
  const meters = parseDurationTarget('400m');
  assert.equal(meters?.kind, 'distance');
  assert.ok(meters?.kind === 'distance' && Math.abs(meters.miles - 400 / 1609.344) < 1e-9);
  const km = parseDurationTarget('1.5 km');
  assert.ok(km?.kind === 'distance' && Math.abs(km.miles - 1.5 / 1.609344) < 1e-9);
  assert.equal(parseDurationTarget(''), null);
});

function customRun(segments: CustomRunDefinition['structuredSegments']): CustomRunDefinition {
  return {
    id: 'run-1',
    name: 'Test',
    runType: 'custom_segments',
    durationMinutes: 40,
    distanceMiles: 5,
    segmentSummary: 'test',
    parameters: {} as CustomRunDefinition['parameters'],
    structuredSegments: segments,
    createdAt: 0,
    updatedAt: 0,
  } as CustomRunDefinition;
}

test('custom workouts keep exact order and numeric targets (no dropped or doubled segments)', () => {
  const workout = customRunToRichWorkout(customRun([
    { id: 'a', label: 'Warmup', kind: 'warmup', target: 'time', durationMinutes: 10 },
    { id: 'b', label: 'Strides', kind: 'warmup', target: 'time', durationMinutes: 0.5 },
    { id: 'c', label: 'Rep', kind: 'run', target: 'distance', distanceMiles: 1.25, distanceUnit: 'mi', targetPaceSecPerMile: 420 },
    { id: 'd', label: 'Float', kind: 'recovery', target: 'distance', distanceMiles: 400 / 1609.344, distanceUnit: 'm' },
    { id: 'e', label: 'Cooldown', kind: 'cooldown', target: 'time', durationMinutes: 10 },
  ]));
  const all = [workout.warmup, ...workout.mainSet, workout.cooldown];
  assert.deepEqual(all.map(segment => segment.label), ['Warmup', 'Strides', 'Rep', 'Float', 'Cooldown']);
  assert.equal(workout.mainSet[0]?.duration, '30 sec');
  assert.equal(workout.mainSet[1]?.duration, '1.25 mi');
  assert.equal(workout.mainSet[2]?.duration, '400 m');
  assert.deepEqual(segmentTarget(workout.warmup), { kind: 'time', seconds: 600 });
  assert.deepEqual(segmentTarget(workout.mainSet[0]!), { kind: 'time', seconds: 30 });
  assert.deepEqual(segmentTarget(workout.mainSet[1]!), { kind: 'distance', miles: 1.25 });
  assert.equal(workout.mainSet[1]?.targetPaceSecPerMile, 420);
});

test('custom workout without warmup/cooldown runs each segment exactly once', () => {
  const workout = customRunToRichWorkout(customRun([
    { id: 'a', label: 'Rep 1', kind: 'run', target: 'time', durationMinutes: 3 },
    { id: 'b', label: 'Rep 2', kind: 'run', target: 'time', durationMinutes: 3 },
  ]));
  const runnable = [workout.warmup, ...workout.mainSet, workout.cooldown].filter(segment => segment.duration.trim());
  assert.deepEqual(runnable.map(segment => segment.label), ['Rep 1', 'Rep 2']);
});

test('pace cues: speed up / ease off after a grace period, with a cooldown', () => {
  const base = { targetPaceSecPerMile: 480, segmentElapsedSeconds: 45, secondsSinceLastPaceCue: null, imperial: true };
  assert.equal(evaluateSegmentPaceCue({ ...base, currentPaceSecPerMile: 482 }), null, 'within tolerance');
  assert.match(evaluateSegmentPaceCue({ ...base, currentPaceSecPerMile: 520 })?.text ?? '', /^Speed up\. Target 8:00 per mile\./);
  assert.match(evaluateSegmentPaceCue({ ...base, currentPaceSecPerMile: 440 })?.text ?? '', /^Ease off\. Target 8:00 per mile\./);
  assert.equal(evaluateSegmentPaceCue({ ...base, currentPaceSecPerMile: 520, segmentElapsedSeconds: 10 }), null, 'grace period');
  assert.equal(evaluateSegmentPaceCue({ ...base, currentPaceSecPerMile: 520, secondsSinceLastPaceCue: 20 }), null, 'cooldown');
  assert.equal(evaluateSegmentPaceCue({ ...base, targetPaceSecPerMile: undefined, currentPaceSecPerMile: 520 }), null, 'no target');
  assert.match(evaluateSegmentPaceCue({ ...base, imperial: false, currentPaceSecPerMile: 520 })?.text ?? '', /per kilometer/);
});

test('end-of-segment feedback states actual pace and too fast / too slow', () => {
  assert.match(segmentFeedbackCue({ index: 1, segmentSeconds: 492, segmentMiles: 1, targetPaceSecPerMile: 480, imperial: true }),
    /Segment 2 complete\. You averaged 8:12 per mile, 12 seconds slower than target\. Too slow\./);
  assert.match(segmentFeedbackCue({ index: 0, segmentSeconds: 460, segmentMiles: 1, targetPaceSecPerMile: 480, imperial: true }),
    /20 seconds faster than target\. Too fast\./);
  assert.match(segmentFeedbackCue({ index: 0, segmentSeconds: 482, segmentMiles: 1, targetPaceSecPerMile: 480, imperial: true }),
    /right on target/);
});

test('builder: presets can be expanded into the full segment editor; Start Run naming', () => {
  const creator = read('app/(tabs)/training/run-creator.tsx');
  assert.match(creator, /function customizePresetSegments\(\)/);
  assert.match(creator, /Customize every segment/);
  assert.match(creator, /Save & Go to Start Run/);
  assert.doesNotMatch(creator, /handleStartGPS/);
  const runScreen = read('app/(tabs)/training/index.tsx');
  assert.match(runScreen, /if \(selectedCustomWorkout\?\.id && !isActive\) setPendingMode\('workout'\)/);
  assert.match(runScreen, /Build Custom Workout Instead/);
  assert.doesNotMatch(read('app/(tabs)/training/[dayIndex].tsx'), /run-tracking\?dayIndex/);
});

// ─── Offline recording / auto-pause ──────────────────────────────────────────

test('location updates are not distance-gated (auto-pause gets samples while stopped)', () => {
  assert.match(read('src/lib/gpsTracking.ts'), /distanceInterval: 0,/);
  assert.match(read('src/lib/activityGpsTracking.ts'), /distanceInterval: 0,/);
});

test('auto-pause: poor accuracy never pauses, but Doppler speed can resume', () => {
  let state = initialAutoPauseState('running', 'running_and_cycling');
  // Stationary with poor accuracy: never pauses.
  for (let t = 0; t <= 5000; t += 1000) {
    const decision = reduceAutoPause(state, { atMs: t, speedMps: 0, displacementMeters: 0, horizontalAccuracyMeters: 80 });
    assert.notEqual(decision.action, 'auto_pause');
    state = decision.state;
  }
  // Good accuracy stationary: pauses after 2 s.
  let paused = false;
  for (let t = 10_000; t <= 13_000; t += 1000) {
    const decision = reduceAutoPause(state, { atMs: t, speedMps: 0, displacementMeters: 0, horizontalAccuracyMeters: 8 });
    state = decision.state;
    if (decision.action === 'auto_pause') paused = true;
  }
  assert.equal(paused, true);
  // Moving again under poor accuracy: resumes from Doppler speed after 2 s.
  let resumed = false;
  for (let t = 20_000; t <= 23_000; t += 1000) {
    const decision = reduceAutoPause(state, { atMs: t, speedMps: 2.8, displacementMeters: 40, horizontalAccuracyMeters: 90 });
    state = decision.state;
    if (decision.action === 'auto_resume') resumed = true;
  }
  assert.equal(resumed, true);
});

test('stationary fixes do not grow the stored track', () => {
  const start = { points: [], distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0, currentMetersPerSecond: 0, averageMetersPerSecond: 0, maximumMetersPerSecond: 0 };
  let aggregate = appendTrackingPoint(start as never, { ...at(0, 0), timestamp: 1000, accuracyMeters: 5 }, 'hiking', 1);
  for (let t = 2000; t <= 30_000; t += 1000) {
    aggregate = appendTrackingPoint(aggregate, { ...at(0.5, 0.5), timestamp: t, accuracyMeters: 5 }, 'hiking', t / 1000);
  }
  assert.equal(aggregate.points.length, 1);
  aggregate = appendTrackingPoint(aggregate, { ...at(20, 0), timestamp: 40_000, accuracyMeters: 5 }, 'hiking', 40);
  assert.equal(aggregate.points.length, 2);
  assert.ok(aggregate.distanceMeters > 19 && aggregate.distanceMeters < 21);
});

test('weak GPS indicator only when active, not paused, and no good fix for 20 s', () => {
  const now = 100_000;
  assert.equal(isGpsSignalWeak({ active: true, paused: false, lastGoodFixAt: now - WEAK_GPS_AFTER_MS - 1, startedAt: 0, now }), true);
  assert.equal(isGpsSignalWeak({ active: true, paused: false, lastGoodFixAt: now - 5_000, startedAt: 0, now }), false);
  assert.equal(isGpsSignalWeak({ active: true, paused: true, lastGoodFixAt: 0, startedAt: 0, now }), false);
  assert.equal(isGpsSignalWeak({ active: false, paused: false, lastGoodFixAt: 0, startedAt: 0, now }), false);
});

test('hike start: GPS starts before any route-guidance network lookup', () => {
  const start = read('app/(tabs)/activity/start.tsx');
  assert.ok(start.indexOf('await startActivityLocationTracking();') < start.indexOf('await buildRouteGuidance('));
});

test('Live Activity timer ticks natively from updatedAt while running', () => {
  const core = read('modules/stride-live-activity/ios/Core/StrideRunActivityAttributes.swift');
  const widget = read('targets/StrideRunLiveActivity/StrideRunLiveActivity.swift');
  const module = read('modules/stride-live-activity/ios/Module/StrideLiveActivityModule.swift');
  assert.match(core, /public var updatedAt: Double\?/);
  assert.match(module, /updatedAt: Date\(\)\.timeIntervalSince1970/);
  assert.match(widget, /Text\(start, style: \.timer\)/);
  assert.match(widget, /guard !state\.isPaused, state\.status != "Finished", let updatedAt = state\.updatedAt/);
});

// ─── Route guidance ──────────────────────────────────────────────────────────

test('turn directions: heading north then east is a RIGHT turn; north then west is LEFT', () => {
  const right = createSavedRouteTurnGuidancePlan(path(line([0, 0], [200, 0]), line([200, 0], [200, 200])), 'walking');
  assert.equal(right.kind, 'turn_by_turn');
  assert.equal(right.steps[0]?.instruction, 'Turn right');
  const left = createSavedRouteTurnGuidancePlan(path(line([0, 0], [200, 0]), line([200, 0], [200, -200])), 'walking');
  assert.equal(left.steps[0]?.instruction, 'Turn left');
});

test('a small jog before a corner does not produce a false or opposite turn', () => {
  // North 200 m with a 3 m rightward wiggle at 180 m, then a real LEFT turn.
  const geometry = path(
    line([0, 0], [175, 0], 5),
    [at(178, 3), at(182, 3), at(185, 0)],
    line([185, 0], [200, 0], 5),
    line([200, 0], [200, -200], 5),
  );
  const plan = createSavedRouteTurnGuidancePlan(geometry, 'walking');
  const turns = plan.steps.filter(step => step.id !== 'saved-route-finish');
  assert.equal(turns.length, 1);
  assert.equal(turns[0]?.instruction, 'Turn left');
});

test('steps advance by progress along the route even when a corner is cut', () => {
  const geometry = path(line([0, 0], [200, 0]), line([200, 0], [200, 200]));
  const plan = createSavedRouteTurnGuidancePlan(geometry, 'walking');
  let progress: RouteGuidanceProgress | null = null;
  for (const [n, e] of [[150, 0], [180, 0], [192, 25], [195, 60]] as Array<[number, number]>) {
    progress = updateRouteGuidanceProgress({ point: at(n, e), plan, previous: progress });
  }
  assert.equal(progress?.nextStepIndex, plan.steps.length - 1, 'moved past the turn without touching its vertex');
});

test('wrong-way detection after sustained travel against the route', () => {
  const plan = createSavedRouteTurnGuidancePlan(line([0, 0], [400, 0]), 'walking');
  let progress: RouteGuidanceProgress | null = null;
  for (const n of [200, 190, 180, 170, 160]) {
    progress = updateRouteGuidanceProgress({ point: at(n, 0), plan, previous: progress });
  }
  assert.equal(progress?.isWrongWay, true);
  assert.equal(progress?.nextInstruction, 'Wrong direction — turn around');
  // Forward travel clears it.
  for (const n of [170, 180, 190, 200]) {
    progress = updateRouteGuidanceProgress({ point: at(n, 0), plan, previous: progress });
  }
  assert.equal(progress?.isWrongWay, false);
});

test('off-route / wrong-way cues speak once, then at most once per minute', () => {
  const off = { isOffRoute: true, isWrongWay: false };
  const first = guidanceAlertCue(off, INITIAL_GUIDANCE_ALERT_STATE, 0);
  assert.ok(first.cue);
  const second = guidanceAlertCue(off, first.state, 5_000);
  assert.equal(second.cue, null);
  const third = guidanceAlertCue(off, second.state, GUIDANCE_ALERT_REPEAT_MS);
  assert.ok(third.cue);
  const cleared = guidanceAlertCue({ isOffRoute: false, isWrongWay: false }, third.state, GUIDANCE_ALERT_REPEAT_MS + 1);
  assert.equal(cleared.cue, null);
  const wrong = guidanceAlertCue({ isOffRoute: false, isWrongWay: true }, cleared.state, GUIDANCE_ALERT_REPEAT_MS + 2);
  assert.match(wrong.cue ?? '', /Wrong direction/);
  const runScreen = read('app/(tabs)/training/index.tsx');
  assert.doesNotMatch(runScreen, /off-route:\$\{progress\.offRouteSampleCount\}/);
  assert.doesNotMatch(read('app/(tabs)/activity/start.tsx'), /enqueueVoiceCue\('You appear to be off route\.'/);
});

// ─── Indoor ride / watch polish ──────────────────────────────────────────────

test('indoor ride prefers live Apple Watch / sensor heart rate and real sensor power', () => {
  const ride = read('app/(tabs)/activity/indoor-ride.tsx');
  assert.match(ride, /selectLiveHeartRate\(liveSensorReadings/);
  assert.match(ride, /if \(liveHeartRateBpm != null\) return;/);
  assert.match(ride, /selectLatestLiveMetric\(liveSensorReadings, 'power'/);
  assert.doesNotMatch(ride, /label="Cadence"/);
});

test('watch sync details are opt-in on the phone and folded on the watch', () => {
  const settings = read('src/store/settingsStore.ts');
  assert.match(settings, /showWatchSyncDetails: false,/);
  assert.match(read('app/(tabs)/settings/index.tsx'), /Show Watch Sync Details/);
  const diagnostics = read('src/components/watch/WatchStatusDiagnostics.tsx');
  assert.match(diagnostics, /if \(!detailed\) \{/);
  assert.match(diagnostics, /already ended/);
  const watchApp = read('targets/StrideOSWatch/StrideOSWatchApp.swift');
  assert.match(watchApp, /Text\("Sync details"\)/);
  assert.doesNotMatch(watchApp, /Text\("Workout type"\)/);
});
