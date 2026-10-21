import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { activityChangesToSync, MAX_PROPAGATED_DELETES } from '../../src/utils/cloudBackupDiff';
import { downsampleCoordinates, isDuplicateHealthKitWorkout, overlapsExistingActivity, type HealthKitWorkoutCandidate } from '../../src/utils/healthKitImport';
import { shouldWriteActivityToHealth, watchRecordedActivity } from '../../src/utils/healthActivityWrite';
import {
  INITIAL_PACE_CUE_STATE,
  nextPaceCue,
  PACE_CUE_MIN_GAP_SECONDS,
  PACE_ON_TARGET_CHECKIN_SECONDS,
  type PaceCueState,
} from '../../src/utils/workoutSegmentCoaching';
import {
  createNamedTurnGuidancePlan,
  createSavedRouteTurnGuidancePlan,
  isSilentGuidanceInstruction,
  namedTurnSteps,
  turnAnnouncementPhase,
  type GuidancePoint,
  type NamedRouteManeuver,
} from '../../src/lib/routeGuidance';
import type { Activity } from '../../src/types/activity';
import { createHydrationSafeStorage } from '../../src/store/hydrationSafeStorage';

const read = (path: string) => readFileSync(path, 'utf8');

// ─── Data safety ─────────────────────────────────────────────────────────────

test('storage guard: no write before a successful read; failed reads retry until readable', async () => {
  const disk = new Map<string, string>([['activity-store', '{"state":{"activities":[1,2,3]}}']]);
  let locked = true;
  const writes: string[] = [];
  const base = {
    getItem: async (k: string) => { if (locked) throw new Error('protected data unavailable'); return disk.get(k) ?? null; },
    setItem: async (k: string, v: string) => { writes.push(k); disk.set(k, v); },
    removeItem: async (k: string) => { disk.delete(k); },
  };
  let waits = 0;
  const storage = createHydrationSafeStorage(base, async () => { waits += 1; if (waits === 3) locked = false; });

  // While locked: the empty in-memory state must NOT be written over the data.
  await storage.setItem('activity-store', '{"state":{"activities":[]}}');
  assert.equal(writes.length, 0);
  assert.equal(storage.droppedWriteCount('activity-store'), 1);
  assert.equal(disk.get('activity-store'), '{"state":{"activities":[1,2,3]}}');

  // Hydration waits for the device to unlock and returns the REAL data.
  const value = await storage.getItem('activity-store');
  assert.equal(value, '{"state":{"activities":[1,2,3]}}');
  assert.ok(waits >= 3);
  assert.equal(storage.isKeyReadable('activity-store'), true);

  // After a successful read, writes go through normally.
  await storage.setItem('activity-store', '{"state":{"activities":[1,2,3,4]}}');
  assert.deepEqual(writes, ['activity-store']);
});

test('every persisted store uses the guarded storage', () => {
  const stores = ['activityStore', 'workoutStore', 'strengthStore', 'customWorkoutStore', 'trainingPlanStore', 'settingsStore', 'integrationsStore', 'checkInStore'];
  for (const store of stores) {
    const source = read(`src/store/${store}.ts`);
    if (store === 'activeActivityStore') {
      assert.match(source, /getItem: \(key: string\) => getAppStorage\(\).getItem\(key\)/);
      assert.match(source, /setItem: \(key: string, value: string\) => serializeActiveWrite\(\(\) => getAppStorage\(\).setItem\(key, value\)\)/);
      assert.match(source, /storage: activeRecordingStorage/);
    } else assert.match(source, /createAppJSONStorage\(\)/, store);
  }
  assert.match(read('src/store/persistStorage.ts'), /createHydrationSafeStorage\(AsyncStorage\)/);
});

test('sign-out keeps local history; sign-in merges (never replaces)', () => {
  const auth = read('src/store/authStore.ts');
  const signOut = auth.slice(auth.indexOf('signOut: async () => {'));
  assert.doesNotMatch(signOut.slice(0, 700), /setState\(\{ completedWorkouts: \[\], history: \[\] \}\)/);
  assert.match(read('src/lib/authRedirect.ts'), /mergeRestoredActivities\(result\.activities\)/);
  assert.match(read('src/store/activityStore.ts'), /mergeRestoredActivities: \(records\) => \{[\s\S]*?if \(index < 0\)/);
});

test('cloud backup: composite-key upserts, activity history backed up, bulk deletes never propagated', () => {
  const sync = read('src/lib/syncService.ts');
  assert.match(sync, /from\('activity_logs'\)\.upsert\(rows, \{ onConflict: 'user_id,id' \}\)/);
  assert.match(sync, /onConflict: 'user_id,date'/);
  assert.match(sync, /supabase\.from\('activity_logs'\)\.select\('data'\)/);

  const a = { id: 'a', updatedAt: 1 } as Activity;
  const b = { id: 'b', updatedAt: 1 } as Activity;
  const b2 = { id: 'b', updatedAt: 2 } as Activity;
  const c = { id: 'c', updatedAt: 1 } as Activity;
  const changes = activityChangesToSync([a, b], [b2, c]);
  assert.deepEqual(changes.upserts.map(x => x.id).sort(), ['b', 'c']);
  assert.deepEqual(changes.deletes, ['a']);
  // A wipe (everything disappears at once) must not delete the cloud copy.
  const wipe = activityChangesToSync([a, b, c], []);
  assert.ok(wipe.deletes.length > MAX_PROPAGATED_DELETES);
  const bridge = read('src/components/sync/CloudBackupBridge.tsx');
  assert.match(bridge, /if \(deletes\.length <= MAX_PROPAGATED_DELETES\)/);
});

// ─── Apple Health restore / second copy ──────────────────────────────────────

function candidate(overrides: Partial<HealthKitWorkoutCandidate>): HealthKitWorkoutCandidate {
  return {
    uuid: 'u1', sourceBundleIdentifier: 'com.mooremovement.strideos.watch', startTime: 1_000_000, endTime: 1_000_000 + 1_800_000,
    activityType: 'running', durationSeconds: 1800, ...overrides,
  };
}

test('restore: exact watch/phone lineage is not imported twice; overlap alone is retained', () => {
  const phoneRun = { id: 'p', activityType: 'running', startTime: 1_000_000 + 20_000, endTime: 1_000_000 + 1_790_000, metrics: { durationSeconds: 1770 } } as unknown as Activity;
  assert.equal(overlapsExistingActivity(candidate({}), [phoneRun]), false);
  assert.equal(isDuplicateHealthKitWorkout(candidate({}), [phoneRun]), false);
  assert.equal(isDuplicateHealthKitWorkout(candidate({ strideOSActivityId: 'p' }), [phoneRun]), true);
  const laterRide = candidate({ uuid: 'u2', activityType: 'cycling', startTime: 9_000_000, endTime: 10_000_000 });
  assert.equal(isDuplicateHealthKitWorkout(laterRide, [phoneRun]), false);
});

test('restore keeps GPS routes (downsampled, first and last kept)', () => {
  const points = Array.from({ length: 5000 }, (_, i) => ({ latitude: 44 + i * 1e-5, longitude: -121, timestamp: i }));
  const down = downsampleCoordinates(points, 2000);
  assert.equal(down.length, 2000);
  assert.equal(down[0], points[0]);
  assert.equal(down[down.length - 1], points[points.length - 1]);
  const health = read('src/lib/healthKit.ts');
  assert.match(health, /includeRoutes && routes\.length > 0 \? routeCoordinatesFrom\(routes\)/);
  assert.match(read('src/lib/healthActivityRestore.ts'), /days: RESTORE_DAYS,\s+limit: RESTORE_LIMIT,\s+includeRoutes: true/);
});

test('every completed activity is saved to Apple Health once, with its route; imports are never written back', () => {
  assert.equal(shouldWriteActivityToHealth({ source: 'tracked', status: 'completed', metrics: { durationSeconds: 1200 } } as Activity), true);
  assert.equal(shouldWriteActivityToHealth({ source: 'healthkit', status: 'completed', metrics: { durationSeconds: 1200 } } as Activity), false);
  assert.equal(shouldWriteActivityToHealth({ source: 'tracked', status: 'completed', metrics: { durationSeconds: 20 } } as Activity), false);
  const health = read('src/lib/healthKit.ts');
  assert.match(health, /healthKitRecordingMetadata\(\{ strideOSActivityId: activity\.id/);
  assert.match(health, /saved\.saveWorkoutRoute\(route\.map/);
  // A run the watch also recorded is already in Health: no second copy.
  const run = { startTime: 1_000 } as Activity;
  assert.equal(watchRecordedActivity(run, 5_000), false);
  assert.equal(watchRecordedActivity(run, 500), false);
  assert.equal(watchRecordedActivity(run, undefined), false);
  const recorded = { ...run, workoutInstanceId: 'recording-A', watchRecording: { workoutInstanceId: 'recording-A', confirmedAt: 5000, state: 'ended' } } as Activity;
  assert.equal(watchRecordedActivity(recorded), true);
  assert.equal(watchRecordedActivity({ ...recorded, workoutInstanceId: 'recording-B' }), false);
  const writer = read('src/components/sync/HealthActivityWriter.tsx');
  assert.match(writer, /if \(watchRecordedActivity\(activity\)\) return;/);
  assert.match(writer, /overlapsExistingActivity\(candidate, \[activity\]\)\)\) return;/);
  // The old route-less per-record writes are retired (no duplicate runs).
  assert.doesNotMatch(read('src/lib/externalIntegrations.ts'), /writeWorkout\(record\)/);
});

// ─── Pace cues ───────────────────────────────────────────────────────────────

test('pace cues: only after 20 s off pace, never more than once per 2 minutes, on-pace check-ins', () => {
  let state: PaceCueState = INITIAL_PACE_CUE_STATE;
  const cues: Array<[number, string]> = [];
  const run = (from: number, to: number, pace: number) => {
    for (let t = from; t <= to; t += 1) {
      const r = nextPaceCue(state, { targetPaceSecPerMile: 480, currentPaceSecPerMile: pace, segmentElapsedSeconds: t, elapsedSeconds: t, imperial: true });
      state = r.state;
      if (r.cue) cues.push([t, r.cue]);
    }
  };
  run(0, 29, 540);          // grace period: silent
  run(30, 48, 540);         // off pace, but not yet 20 s
  assert.equal(cues.length, 0);
  run(49, 400, 540);        // sustained slow
  assert.match(cues[0]![1], /^Speed up\. Target 8:00 per mile\./);
  for (let i = 1; i < cues.length; i += 1) {
    assert.ok(cues[i]![0] - cues[i - 1]![0] >= PACE_CUE_MIN_GAP_SECONDS, 'cues spaced by at least 2 minutes');
  }
  const before = cues.length;
  run(401, 401 + PACE_ON_TARGET_CHECKIN_SECONDS, 482);  // back on pace for 5+ min
  assert.ok(cues.slice(before).some(([, text]) => /^On pace\./.test(text)));
  assert.ok(cues.slice(before).length <= 2);
});

// ─── Navigation ──────────────────────────────────────────────────────────────

const ORIGIN = { latitude: 44.05, longitude: -121.31 };
function at(n: number, e: number): GuidancePoint {
  return { latitude: ORIGIN.latitude + n / 111_320, longitude: ORIGIN.longitude + e / (111_320 * Math.cos((ORIGIN.latitude * Math.PI) / 180)) };
}
function line(from: [number, number], to: [number, number], step = 10): GuidancePoint[] {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(len / step));
  return Array.from({ length: n + 1 }, (_, i) => at(from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n));
}
const m = (point: GuidancePoint, type: string, name: string, modifier?: string): NamedRouteManeuver => ({ ...point, type, name, modifier });

test('named directions: silent on the same street or going straight; spoken when turning onto a new street', () => {
  const maneuvers = [
    m(at(0, 0), 'depart', 'Wall Street'),
    m(at(200, 0), 'continue', 'Wall Street', 'straight'),           // same street: silent
    m(at(400, 0), 'new name', 'Bond Street', 'straight'),           // new name, straight: silent
    m(at(600, 0), 'turn', 'Greenwood Avenue', 'right'),             // spoken
    m(at(600, 300), 'turn', 'Greenwood Avenue', 'left'),            // same street bends: silent
    m(at(900, 300), 'arrive', '', undefined),
  ];
  assert.deepEqual(namedTurnSteps(maneuvers).map(s => s.instruction), ['Turn right onto Greenwood Avenue']);

  const geometry = [...line([0, 0], [600, 0]), ...line([600, 0], [600, 300]).slice(1), ...line([600, 300], [900, 300]).slice(1)];
  const plan = createNamedTurnGuidancePlan(geometry, 'walking', maneuvers);
  assert.equal(plan?.steps[0]?.instruction, 'Turn right onto Greenwood Avenue');
  // Reversed route: maneuvers don't start at the route's start -> not used.
  assert.equal(createNamedTurnGuidancePlan([...geometry].reverse(), 'walking', maneuvers), null);
  assert.match(read('src/lib/routing.ts'), /steps=true/);
  assert.match(read('app/(tabs)/training/route-builder.tsx'), /maneuvers: routed\?\.maneuvers/);
});

test('routes without street names only speak clear turns (no "bear" at every intersection)', () => {
  const gentle = createSavedRouteTurnGuidancePlan([...line([0, 0], [200, 0]), ...line([200, 0], [340, 140]).slice(1)], 'walking');
  assert.equal(gentle.steps.filter(s => !s.id.endsWith('finish')).length, 0, '45 degree bend is silent');
  const sharp = createSavedRouteTurnGuidancePlan([...line([0, 0], [200, 0]), ...line([200, 0], [200, 200]).slice(1)], 'walking');
  assert.equal(sharp.steps[0]?.instruction, 'Turn right');
  assert.equal(turnAnnouncementPhase(250), 'approach');
  assert.equal(turnAnnouncementPhase(100), 'approach');
  assert.equal(turnAnnouncementPhase(20), 'now');
  assert.equal(isSilentGuidanceInstruction('Continue to finish'), true);
  assert.equal(isSilentGuidanceInstruction('Turn right onto Greenwood Avenue'), false);
});

// ─── Apple Watch route (protected path invariants) ───────────────────────────

test('watch route recording never prompts inside a start and cleans up on every exit', () => {
  const swift = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const idle = swift.slice(swift.indexOf('private func requestRoutePermissionsWhenIdle'), swift.indexOf('private static let bundleAllowsBackgroundLocation'));
  // No HealthKit sheet from the watch outside the start path (HK serializes sheets).
  assert.doesNotMatch(idle, /requestAuthorization\(toShare/);
  assert.match(idle, /guard !self\.routePermissionsRequested, !self\.isActive, !self\.isStartingWorkout else \{ return \}\n\s+self\.routePermissionsRequested = true/);
  // Start-path auth is unchanged (workout type only).
  assert.match(swift, /let shareTypes: Set<HKSampleType> = \[HKObjectType\.workoutType\(\)\]/);
  // GPS requires an existing location grant. Health route insertion separately
  // requires sharing authorization; XC distance may use authorized GPS without it.
  const start = swift.slice(swift.indexOf('private func startRouteRecordingIfPossible'), swift.indexOf('private func stopRouteRecording'));
  assert.match(start, /guard kind\.tracksDistance, environment != "indoor"/);
  assert.match(start, /authorization == \.authorizedWhenInUse \|\| authorization == \.authorizedAlways else \{ return \}/);
  assert.match(start, /routeBuilder = canRecordRoute \? HKWorkoutRouteBuilder\(healthStore: healthStore, device: nil\) : nil/);
  assert.doesNotMatch(start, /requestWhenInUseAuthorization|requestAuthorization\(/);
  assert.match(swift, /healthStore\.authorizationStatus\(for: HKSeriesType\.workoutRoute\(\)\) == \.sharingAuthorized/);
  assert.match(swift, /if Self\.bundleAllowsBackgroundLocation \{\s+manager\.allowsBackgroundLocationUpdates = true/);
  assert.match(read('targets/StrideOSWatch/Info.plist'), /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>location<\/string>/);
  assert.match(read('targets/StrideOSWatch/expo-target.config.js'), /UIBackgroundModes: \['location'\]/);
  // GPS stops on failure, restart, and end; route builder captured synchronously.
  assert.equal((swift.match(/^\s+abandonRoute\(\)$/gm) ?? []).length, 3, "failStart, session failure, beginWorkout");
  assert.match(swift, /let routeBuilder = self\.routeBuilder\n\s+self\.routeBuilder = nil\n\s+guard let builder else/);
  // Heart rate isn't queued while the phone is unreachable.
  assert.match(swift, /if \["heartRate", "telemetry"\]\.contains\(payload\["type"\] as\? String \?\? ""\) \{ return \}/);
  // The iPhone grants route sharing (shared with the watch app).
  assert.match(read('src/lib/healthKit.ts'), /const SHARE_TYPES = \[[\s\S]*?'HKWorkoutRouteTypeIdentifier'/);
});
