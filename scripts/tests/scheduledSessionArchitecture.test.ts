// Build 44 Phase A — canonical scheduled-session ids, completion
// classification, skip-as-first-class-outcome, activity-store v1→v2 remap,
// the ACWR normalized-activity adapter, reschedule/remove-from-today
// visibility, and the recalculation pipeline's wiring into activityStore.
//
// Store files (activityStore.ts, recalculationStore.ts) transitively import
// react-native and cannot be loaded under plain node+tsx, so wiring into
// those files is verified by source assertion (the established pattern for
// this in the existing test suite) while every piece of actual business
// logic is imported and exercised directly.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { Activity, ActivityStatus } from '../../src/types/activity';
import { calculateActivityLoad } from '../../src/utils/activityLoad';
import {
  beginnerScheduledSessionId,
  otherScheduledSessionId,
  runScheduledSessionId,
  strengthScheduledSessionId,
} from '../../src/utils/scheduledSessionIds';
import {
  activityFromStrengthRecord,
  activityFromWorkoutRecord,
  remapLegacyScheduledSessionId,
  remapLegacyScheduledSessionIds,
} from '../../src/utils/activityMigration';
import {
  activityStatusForClassification,
  buildSkippedActivityDraft,
  classificationForActivity,
  classificationFromCompletionState,
  overlayCompletionOnScheduledSessions,
} from '../../src/utils/activityCompletion';
import {
  activeScheduledSessionsForDate,
  applyDateOverridesForDate,
} from '../../src/utils/scheduledSessions';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';
import { calculateACWR } from '../../src/utils/training/calculateACWR';
import { activitiesToACWRRecords } from '../../src/utils/training/activityACWRAdapter';
import type { CompletedWorkoutRecord } from '../../src/types/training';
import type { StrengthLogRecord } from '../../src/types/strength';

const read = (path: string) => readFileSync(path, 'utf8');

// ─── Canonical ID builders — byte-compat with the previously inlined format ──

test('canonical scheduled-session id builders match the exact previous inline format', () => {
  assert.equal(runScheduledSessionId('2026-07-25', 'easy_run', 2), 'week:2026-07-25:run:easy_run:2');
  assert.equal(strengthScheduledSessionId('2026-07-25', 'full_body_1'), 'week:2026-07-25:strength:full_body_1');
  assert.equal(otherScheduledSessionId('2026-07-25', 'mobility', 'Recovery Mobility'), 'week:2026-07-25:mobility:Recovery Mobility');
  assert.equal(beginnerScheduledSessionId('c25k', 'w1d1'), 'c25k:w1d1');
});

test('scheduledSessions.ts derivation imports the canonical builders instead of inlining the format', () => {
  const source = read('src/utils/scheduledSessions.ts');
  assert.match(source, /import\s*\{[^}]*runScheduledSessionId[^}]*\}\s*from\s*'\.\/scheduledSessionIds'/);
  assert.match(source, /runScheduledSessionId\(entry\.date, workout\.id, workout\.dayIndex\)/);
  assert.match(source, /strengthScheduledSessionId\(entry\.date, strength\.id\)/);
  assert.match(source, /beginnerScheduledSessionId\(plan\.id, session\.id\)/);
});

// ─── Completion classification ────────────────────────────────────────────────

test('classification maps onto the coarse ActivityStatus every screen already reads', () => {
  assert.equal(activityStatusForClassification('skipped'), 'skipped');
  assert.equal(activityStatusForClassification('partial'), 'partial');
  assert.equal(activityStatusForClassification('stopped_early'), 'partial');
  assert.equal(activityStatusForClassification('completed_as_prescribed'), 'completed');
  assert.equal(activityStatusForClassification('modified'), 'completed');
  assert.equal(activityStatusForClassification('equivalent_substitute'), 'completed');
  assert.equal(activityStatusForClassification('completed_other_activity'), 'completed');
  assert.equal(activityStatusForClassification(undefined), 'completed');
});

test('manual-entry completion states map onto the richer classification enum', () => {
  assert.equal(classificationFromCompletionState('completed_as_planned'), 'completed_as_prescribed');
  assert.equal(classificationFromCompletionState('modified'), 'modified');
  assert.equal(classificationFromCompletionState('partial'), 'partial');
  assert.equal(classificationFromCompletionState('stopped_early'), 'stopped_early');
});

test('activities persisted before completionClassification existed derive it from status, no rewrite required', () => {
  assert.equal(classificationForActivity({ status: 'skipped' }), 'skipped');
  assert.equal(classificationForActivity({ status: 'partial' }), 'partial');
  assert.equal(classificationForActivity({ status: 'completed' }), 'completed_as_prescribed');
  assert.equal(classificationForActivity({ status: 'completed', completionClassification: 'equivalent_substitute' }), 'equivalent_substitute');
});

// ─── Skip as a first-class completion outcome ────────────────────────────────

function session(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: 'week:2026-07-25:run:easy_run:4',
    trainingBlockId: 'block-1',
    goalPlanId: 'goal-1',
    date: '2026-07-25',
    originalDate: '2026-07-25',
    activityType: 'run',
    subtype: 'easy_run',
    title: 'Easy Aerobic Run',
    purpose: 'Aerobic base.',
    priority: 'primary',
    durationMinutes: 30,
    target: '30 min easy',
    status: 'today',
    ...overrides,
  };
}

test('skipping a scheduled session builds a linked Activity with status and classification "skipped"', () => {
  const draft = buildSkippedActivityDraft(session(), 'Too tired', Date.parse('2026-07-25T09:00:00'));
  assert.equal(draft.status, 'skipped');
  assert.equal(draft.completionClassification, 'skipped');
  assert.equal(draft.scheduledSessionId, 'week:2026-07-25:run:easy_run:4');
  assert.equal(draft.scheduled, true);
  assert.equal(draft.associatedTrainingBlockId, 'block-1');
  assert.equal(draft.notes, 'Too tired');
  assert.equal(draft.metrics.durationSeconds, 0);
});

test('a skipped activity overlays the scheduled session as skipped, not completed', () => {
  const planned = session();
  const skipped: Activity = {
    id: 'activity-skip-1',
    activityType: 'running',
    source: 'training_plan',
    status: 'skipped',
    completionClassification: 'skipped',
    scheduled: true,
    scheduledSessionId: planned.scheduledSessionId,
    startTime: Date.parse('2026-07-25T09:00:00'),
    indoor: false,
    metrics: { durationSeconds: 0 },
    trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 0 }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const [overlaid] = overlayCompletionOnScheduledSessions([planned], [skipped]);
  assert.equal(overlaid!.status, 'skipped');
  assert.equal(overlaid!.completionState, 'skipped');
  assert.equal(overlaid!.completedActivityId, 'activity-skip-1');
});

// ─── activityMigration canonical id derivation ───────────────────────────────

function legacyWorkout(overrides: Partial<CompletedWorkoutRecord> = {}): CompletedWorkoutRecord {
  return {
    id: 'w3_easy_run_4',
    workoutId: 'easy_run',
    type: 'easy_run',
    intensity: 'easy',
    durationMinutes: 30,
    estimatedLoad: 21,
    estimatedDistanceMiles: 3,
    timestamp: Date.parse('2026-07-25T09:00:00'),
    week: 3,
    completed: true,
    fatigueBefore: 20,
    fatigueAfter: 25,
    fatigueDelta: 5,
    recoveryBefore: 80,
    recoveryDelta: -2,
    source: 'generated',
    ...overrides,
  };
}

test('a completeWorkout-shaped record derives the canonical scheduledSessionId from its own id/week/timestamp', () => {
  const migrated = activityFromWorkoutRecord(legacyWorkout());
  assert.equal(migrated.scheduledSessionId, 'week:2026-07-25:run:easy_run:4');
  assert.equal(migrated.completionClassification, 'completed_as_prescribed');
});

test('a skipped completeWorkout-shaped record still derives the canonical id and is classified skipped', () => {
  const migrated = activityFromWorkoutRecord(legacyWorkout({ id: 'w3_easy_run_4', skipped: true, skippedReason: 'Illness' }));
  assert.equal(migrated.scheduledSessionId, 'week:2026-07-25:run:easy_run:4');
  assert.equal(migrated.status, 'skipped');
  assert.equal(migrated.completionClassification, 'skipped');
});

test('an ad-hoc manual-log id (not the w{week}_{workoutId}_{dayIndex} shape) is left as the bare workoutId, not miscanonicalized', () => {
  const migrated = activityFromWorkoutRecord(legacyWorkout({ id: 'gps_run_1700000000000', workoutId: 'easy_run' }));
  assert.equal(migrated.scheduledSessionId, 'easy_run');
});

function legacyStrength(overrides: Partial<StrengthLogRecord> = {}): StrengthLogRecord {
  return {
    id: 'sw2_full_body_1_0',
    sessionId: 'full_body_1',
    sessionType: 'full_body',
    goal: 'maintenance',
    week: 2,
    timestamp: Date.parse('2026-07-25T09:00:00'),
    completed: true,
    plannedDuration: 45,
    actualDuration: 45,
    exercises: [],
    source: 'generated',
    fatigueBefore: 20,
    fatigueAfter: 25,
    fatigueDelta: 5,
    estimatedLoad: 80,
    ...overrides,
  };
}

test('a logSession/skipSession-shaped strength record (raw session id distinct from its completionKey) derives the canonical id', () => {
  const migrated = activityFromStrengthRecord(legacyStrength());
  assert.equal(migrated.scheduledSessionId, 'week:2026-07-25:strength:full_body_1');
});

test('a manualLog-shaped strength record (sessionId === completionKey) prefers an explicit scheduledSessionId when present', () => {
  const withExplicitLink = activityFromStrengthRecord(legacyStrength({
    id: 'strength_w2_s0',
    sessionId: 'strength_w2_s0',
    scheduledSessionId: 'week:2026-07-25:strength:full_body_1',
  }));
  assert.equal(withExplicitLink.scheduledSessionId, 'week:2026-07-25:strength:full_body_1');

  const withoutExplicitLink = activityFromStrengthRecord(legacyStrength({
    id: 'strength_w2_s0',
    sessionId: 'strength_w2_s0',
  }));
  assert.equal(withoutExplicitLink.scheduledSessionId, 'strength_w2_s0');
});

// ─── Activity store schema v1 → v2 remap ─────────────────────────────────────

function persistedActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity_workout_w3_easy_run_4',
    activityType: 'running',
    source: 'legacy_import',
    status: 'completed' as ActivityStatus,
    scheduled: true,
    scheduledSessionId: 'easy_run',
    legacyWorkoutId: 'w3_easy_run_4',
    startTime: Date.parse('2026-07-25T09:00:00'),
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }),
    createdAt: Date.parse('2026-07-25T09:00:00'),
    updatedAt: Date.parse('2026-07-25T09:00:00'),
    ...overrides,
  };
}

test('v1→v2 remaps a bare legacy scheduledSessionId to the canonical form', () => {
  const remapped = remapLegacyScheduledSessionId(persistedActivity());
  assert.equal(remapped.scheduledSessionId, 'week:2026-07-25:run:easy_run:4');
});

test('v1→v2 remap is idempotent — running it twice does not change an already-canonical id', () => {
  const once = remapLegacyScheduledSessionIds([persistedActivity()]);
  const twice = remapLegacyScheduledSessionIds(once);
  assert.equal(once[0]!.scheduledSessionId, twice[0]!.scheduledSessionId);
  assert.equal(twice[0]!.scheduledSessionId, 'week:2026-07-25:run:easy_run:4');
});

test('v1→v2 remap never deletes activities, even ones it cannot derive a canonical id for', () => {
  const undeterminable = persistedActivity({ id: 'activity_workout_gps_run_1', legacyWorkoutId: 'gps_run_1', scheduledSessionId: 'easy_run' });
  const result = remapLegacyScheduledSessionIds([persistedActivity(), undeterminable]);
  assert.equal(result.length, 2);
  assert.equal(result[1]!.scheduledSessionId, 'easy_run');
});

test('v1→v2 remap keeps both activities on collision rather than merging or dropping one', () => {
  const legacyBare = persistedActivity();
  const alreadyCanonical = persistedActivity({
    id: 'activity_new_write',
    scheduledSessionId: 'week:2026-07-25:run:easy_run:4',
    legacyWorkoutId: undefined,
    updatedAt: Date.parse('2026-07-25T10:00:00'),
  });
  const result = remapLegacyScheduledSessionIds([legacyBare, alreadyCanonical]);
  assert.equal(result.length, 2);
  assert.equal(result.filter(a => a.scheduledSessionId === 'week:2026-07-25:run:easy_run:4').length, 2);
  // Overlay resolution picks the most recently updated of the two.
  const [overlaid] = overlayCompletionOnScheduledSessions([session({ scheduledSessionId: 'week:2026-07-25:run:easy_run:4' })], result);
  assert.equal(overlaid!.completedActivityId, 'activity_new_write');
});

// ─── ACWR unified onto the normalized activity store ─────────────────────────

test('activitiesToACWRRecords projects normalized activities into calculateACWR-compatible records', () => {
  const activities: Activity[] = [
    persistedActivity({ id: 'a', legacyWorkoutId: 'w1_easy_run_0', trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }) }),
  ];
  const records = activitiesToACWRRecords(activities);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.timestamp, activities[0]!.startTime);
  assert.equal(records[0]!.estimatedLoad, activities[0]!.trainingLoad.wholeBody);
});

test('activitiesToACWRRecords never double-counts a legacy-imported activity against its canonical-write counterpart', () => {
  const legacy = persistedActivity({ id: 'activity_workout_w1_easy_run_0', legacyWorkoutId: 'w1_easy_run_0' });
  const sameCompletionRewritten = persistedActivity({
    id: 'activity_workout_w1_easy_run_0', // same deterministic id — this is the common case
    legacyWorkoutId: 'w1_easy_run_0',
    scheduledSessionId: 'week:2026-07-25:run:easy_run:0',
  });
  const records = activitiesToACWRRecords([legacy, sameCompletionRewritten]);
  assert.equal(records.length, 1);
});

test('activitiesToACWRRecords excludes skipped activities from load', () => {
  const completed = persistedActivity({ id: 'a' });
  const skipped = persistedActivity({ id: 'b', legacyWorkoutId: 'w4_easy_run_1', status: 'skipped', trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 0 }) });
  const records = activitiesToACWRRecords([completed, skipped]);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.estimatedLoad, completed.trainingLoad.wholeBody);
});

test('calculateACWR produces the same math whether fed legacy CompletedWorkoutRecord or the normalized-activity adapter output', () => {
  const timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const legacyStyle = calculateACWR([{ timestamp, estimatedLoad: 40 }, { timestamp: timestamp - 20 * 86_400_000, estimatedLoad: 30 }]);
  const activity = persistedActivity({
    id: 'a',
    startTime: timestamp,
    trainingLoad: { ...calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }), wholeBody: 40 },
  });
  const activity2 = persistedActivity({
    id: 'b',
    legacyWorkoutId: 'w1_easy_run_1',
    startTime: timestamp - 20 * 86_400_000,
    trainingLoad: { ...calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }), wholeBody: 30 },
  });
  const adapterStyle = calculateACWR(activitiesToACWRRecords([activity, activity2]));
  assert.deepEqual(adapterStyle, legacyStyle);
});

// ─── Removed-from-today stays reachable; reschedule moves dates ─────────────

test('removing a session from today demotes it to optional instead of making it unreachable', () => {
  const todayRun = session();
  const active = activeScheduledSessionsForDate([todayRun], [todayRun], '2026-07-25', undefined, [todayRun.scheduledSessionId]);
  assert.equal(active.length, 1);
  assert.equal(active[0]!.priority, 'optional');
  assert.equal(active[0]!.scheduledSessionId, todayRun.scheduledSessionId);
});

test('applyDateOverridesForDate moves a session off its original date and onto the new one exactly once', () => {
  const moved = session({ scheduledSessionId: 'sess-move', date: '2026-07-25' });
  const overrides = { 'sess-move': '2026-07-26' };
  const origin = applyDateOverridesForDate([moved], [moved], '2026-07-25', overrides);
  assert.equal(origin.length, 0);
  const destination = applyDateOverridesForDate([], [moved], '2026-07-26', overrides);
  assert.equal(destination.length, 1);
  assert.equal(destination[0]!.date, '2026-07-26');
  assert.equal(destination[0]!.scheduledSessionId, 'sess-move');
});

test('applyDateOverridesForDate is a no-op when there are no overrides', () => {
  const todayRun = session();
  assert.deepEqual(applyDateOverridesForDate([todayRun], [todayRun], '2026-07-25', {}), [todayRun]);
});

// ─── Delete restores the scheduled session to incomplete ────────────────────

test('removing the linked activity from the array restores the scheduled session to its unlinked state', () => {
  const planned = session();
  const completed: Activity = {
    id: 'activity-1',
    activityType: 'running',
    source: 'training_plan',
    status: 'completed',
    scheduled: true,
    scheduledSessionId: planned.scheduledSessionId,
    startTime: Date.parse('2026-07-25T09:00:00'),
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 30, rpe: 5 }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const [beforeDelete] = overlayCompletionOnScheduledSessions([planned], [completed]);
  assert.equal(beforeDelete!.status, 'completed');
  assert.equal(beforeDelete!.completedActivityId, 'activity-1');

  // removeActivity's effect on the activities array is exactly this filter —
  // the overlay is purely derived, so no separate "un-complete" step exists
  // or is needed.
  const remaining = [completed].filter(activity => activity.id !== 'activity-1');
  const [afterDelete] = overlayCompletionOnScheduledSessions([planned], remaining);
  assert.equal(afterDelete!.status, 'today');
  assert.equal(afterDelete!.completedActivityId, undefined);
});

// ─── Wiring assertions — files that transitively import react-native and
//     can't be exercised directly under plain node+tsx ──────────────────────

test('activityStore is on schema v2, remaps legacy ids on every hydration, and recalculates after every mutation', () => {
  const source = read('src/store/activityStore.ts');
  assert.match(source, /ACTIVITY_STORE_SCHEMA_VERSION\s*=\s*2/);
  assert.match(source, /remapLegacyScheduledSessionIds/);
  assert.match(source, /runRecalculation\('activity_added', get\(\)\.activities\)/);
  assert.match(source, /runRecalculation\('activity_updated', get\(\)\.activities\)/);
  assert.match(source, /runRecalculation\('activity_removed', get\(\)\.activities\)/);
});

test('the recalculation pipeline and its store exist with the documented state shape', () => {
  const pipeline = read('src/lib/recalculation.ts');
  assert.match(pipeline, /export function runRecalculation/);
  const store = read('src/store/recalculationStore.ts');
  assert.match(store, /lastRunAt/);
  assert.match(store, /status:/);
  assert.match(store, /'idle'\s*\|\s*'running'\s*\|\s*'success'\s*\|\s*'error'/);
});

test('the Activity screen exposes a manual Refresh control wired to the same recalculation path', () => {
  const source = read('app/(tabs)/activity/index.tsx');
  assert.match(source, /runRecalculation\('manual_refresh', activities\)/);
  assert.match(source, /useRecalculationStore/);
});

test('Calendar exposes Skip and routes Reschedule through the validated adaptation preview', () => {
  const source = read('app/(tabs)/calendar/index.tsx');
  assert.match(source, /text: 'Skip'/);
  assert.match(source, /text: 'Reschedule'/);
  assert.match(source, /buildSkippedActivityDraft/);
  assert.match(source, /preferredAction: 'moved'/);
  assert.match(source, /pathname: '\/\(tabs\)\/training\/adapt'/);
  assert.doesNotMatch(source, /rescheduleSession\(/);
});

test('GPS tracked activity (activity/start.tsx) and the primary Running tab both stamp scheduledSessionId on completion', () => {
  const start = read('app/(tabs)/activity/start.tsx');
  assert.match(start, /scheduledSessionId:\s*latest\.scheduledSessionId/);
  assert.match(start, /scheduledSessionId\?:\s*string/);

  const training = read('app/(tabs)/training/index.tsx');
  assert.match(training, /completedScheduledSessionId\s*=\s*useActiveRunStore\.getState\(\)\.scheduledSessionId/);
  assert.match(training, /updateActivity\(`activity_workout_\$\{id\}`/);
});

test('strength completion from the Strength screen passes its canonical scheduledSessionId through to the store write', () => {
  const strengthStore = read('src/store/strengthStore.ts');
  assert.match(strengthStore, /scheduledSessionId:\s*entry\.scheduledSessionId/);
  const strengthScreen = read('app/(tabs)/strength/index.tsx');
  assert.match(strengthScreen, /scheduledSessionId:\s*activeEntry\?\.scheduledSessionId/);
});

test('useWeekPlan derives ACWR from the normalized activity store, not legacy workout-store history alone', () => {
  const source = read('src/hooks/useWeekPlan.ts');
  assert.match(source, /activitiesToACWRRecords\(activities\)/);
  assert.match(source, /useActivityStore\(s => s\.activities\)/);
});
