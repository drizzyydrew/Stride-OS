import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { Activity } from '../../src/types/activity';
import { calculateActivityLoad } from '../../src/utils/activityLoad';
import {
  buildManualActivityDraft,
  calculatePaceOrSpeed,
  getCompletedActivityForScheduledSession,
  overlayCompletionOnScheduledSessions,
  plannedVersusCompletedComparison,
} from '../../src/utils/activityCompletion';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

const read = (path: string) => readFileSync(path, 'utf8');

function session(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: 'sched-run-walk-1',
    trainingBlockId: 'block-1',
    goalPlanId: 'goal-1',
    date: '2026-07-22',
    originalDate: '2026-07-22',
    activityType: 'run_walk',
    subtype: 'run_walk',
    title: 'Run/Walk Intervals',
    purpose: 'Build aerobic consistency.',
    priority: 'primary',
    durationMinutes: 28,
    warmup: '5-minute easy walk',
    mainSet: '6 rounds: 180 sec run / 120 sec walk',
    cooldown: '5-minute easy walk',
    target: '28 min - 6 rounds - 180 sec run / 120 sec walk',
    hrTarget: 'Zone 2 or below',
    rpeTarget: '3-4',
    paceTarget: 'Conversational',
    runWalk: {
      totalMinutes: 28,
      warmupMinutes: 5,
      runSeconds: 180,
      walkSeconds: 120,
      rounds: 6,
      cooldownMinutes: 5,
      hrZone: 'Zone 2 or below',
      rpe: '3-4',
      pace: 'Conversational',
      voicePrompts: ['Begin running.', 'Slow to a walk.', 'Workout complete.'],
    },
    status: 'today',
    loadEstimate: 84,
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  const startTime = Date.parse('2026-07-22T08:00:00');
  return {
    id: 'activity-1',
    activityType: 'running',
    subtype: 'run_walk',
    source: 'training_plan',
    status: 'completed',
    scheduled: true,
    associatedTrainingBlockId: 'block-1',
    associatedGoalId: 'goal-1',
    scheduledSessionId: 'sched-run-walk-1',
    startTime,
    endTime: startTime + 24 * 60_000,
    rpe: 7,
    notes: 'Stopped early after six harder-than-planned intervals.',
    indoor: false,
    metrics: { durationSeconds: 1440, distanceMeters: 2.1 * 1609.344 },
    trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 24, rpe: 7 }),
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  };
}

test('scheduled run-walk prepopulates manual completion while preserving planned data separately', () => {
  const planned = session();
  const draft = buildManualActivityDraft(planned, {
    durationMinutes: 24,
    distance: 2.1,
    distanceUnit: 'mi',
    rpe: 7,
    completionState: 'stopped_early',
    notes: 'Stopped early.',
  }, Date.parse('2026-07-22T09:00:00'));

  assert.equal(draft.scheduledSessionId, planned.scheduledSessionId);
  assert.equal(draft.associatedTrainingBlockId, 'block-1');
  assert.equal(draft.associatedGoalId, 'goal-1');
  assert.equal(draft.scheduled, true);
  assert.equal(draft.status, 'partial');
  assert.equal(draft.metrics.durationSeconds, 1440);
  assert.equal(Math.round((draft.metrics.distanceMeters ?? 0) / 1609.344 * 10) / 10, 2.1);
  assert.equal(draft.metrics.runWalkIntervals?.length, planned.runWalk!.rounds * 2);
  assert.equal(planned.durationMinutes, 28);
  assert.equal(planned.runWalk?.runSeconds, 180);
});

test('scheduled strength completion prepopulates a linked strength activity', () => {
  const planned = session({
    scheduledSessionId: 'sched-strength-1',
    activityType: 'strength',
    subtype: 'foundation_strength',
    title: 'Runner Foundation Strength A',
    priority: 'supporting',
    durationMinutes: 30,
    target: '30 min - 5 exercises',
  });
  const draft = buildManualActivityDraft(planned, {
    activityType: 'strength',
    durationMinutes: 26,
    rpe: 6,
    completionState: 'modified',
    indoor: true,
  });

  assert.equal(draft.activityType, 'strength');
  assert.equal(draft.source, 'training_plan');
  assert.equal(draft.scheduledSessionId, 'sched-strength-1');
  assert.equal(draft.metrics.durationSeconds, 1560);
  assert.equal(draft.rpe, 6);
});

test('completion overlay links completed and partial activities back to scheduled sessions', () => {
  const planned = session();
  const completed = activity();
  const partial = activity({ id: 'activity-2', scheduledSessionId: 'sched-partial', status: 'partial' });
  const overlaid = overlayCompletionOnScheduledSessions([
    planned,
    session({ scheduledSessionId: 'sched-partial', title: 'Easy Aerobic Run' }),
  ], [completed, partial]);

  assert.equal(overlaid[0].status, 'completed');
  assert.equal(overlaid[0].completedActivityId, 'activity-1');
  assert.equal(overlaid[1].status, 'partial');
  assert.equal(overlaid[1].completedActivityId, 'activity-2');
  assert.equal(getCompletedActivityForScheduledSession([completed], planned.scheduledSessionId)?.id, 'activity-1');
});

test('planned-versus-completed comparison includes exact planned and actual values', () => {
  const rows = plannedVersusCompletedComparison(session(), activity());
  assert.match(rows.join(' | '), /Planned duration: 28 min/);
  assert.match(rows.join(' | '), /Planned intervals: 6 rounds of 180 sec run \/ 120 sec walk/);
  assert.match(rows.join(' | '), /Actual duration: 24 min/);
  assert.match(rows.join(' | '), /Actual distance: 2\.10 mi/);
  assert.match(rows.join(' | '), /Actual RPE: 7\/10/);
});

test('live pace and speed calculations are safe and unit-aware', () => {
  assert.equal(calculatePaceOrSpeed('running', 2, 'mi', 1200, 'mi').label, '10:00/mi');
  assert.equal(calculatePaceOrSpeed('walking', 5, 'km', 3600, 'km').label, '12:00/km');
  assert.equal(calculatePaceOrSpeed('cycling', 20, 'mi', 3600, 'mi').label, '20.0 mph');
  assert.equal(calculatePaceOrSpeed('downhill_skiing', 10, 'km', 1800, 'km').label, '20.0 km/h');
  assert.equal(calculatePaceOrSpeed('running', 0, 'mi', 1200).label, '--');
  assert.equal(calculatePaceOrSpeed('running', 2, 'mi', 0).label, '--');
});

test('manual Activity UI includes running, run-walk, strength, optional routes, and linked completion copy', () => {
  const manual = read('app/(tabs)/activity/manual.tsx');
  assert.match(manual, /label: 'Running'/);
  assert.match(manual, /label: 'Run\/Walk'/);
  assert.match(manual, /label: 'Strength Training'/);
  assert.match(manual, /OPTIONAL ROUTE/);
  assert.match(manual, /No route/);
  assert.match(manual, /scheduledSessionId/);
  assert.match(manual, /Planned workout details stay unchanged/);
});

test('Calendar exposes completion and linked-activity actions from scheduled session cards', () => {
  const calendar = read('app/(tabs)/calendar/index.tsx');
  assert.match(calendar, /Mark Completed/);
  assert.match(calendar, /Log Manually/);
  assert.match(calendar, /View Completed Activity/);
  assert.match(calendar, /Edit Activity/);
  assert.match(calendar, /Compare Planned vs\. Completed/);
  assert.match(calendar, /scheduledSessionId: entry\.scheduledSessionId/);
});

test('Activity store prevents duplicate completion records by scheduledSessionId', () => {
  const source = read('src/store/activityStore.ts');
  assert.match(source, /activity\.scheduledSessionId/);
  assert.match(source, /findIndex\(item => item\.scheduledSessionId === activity\.scheduledSessionId\)/);
  assert.match(source, /id: item\.id/);
});

test('Running, Strength, Today, Activity, and Coach expose linked completion paths', () => {
  assert.match(read('app/(tabs)/training/index.tsx'), /Log Completion/);
  assert.match(read('app/(tabs)/training/index.tsx'), /todayPlannedSession\?\.completedActivityId/);
  assert.match(read('app/(tabs)/strength/index.tsx'), /buildManualActivityDraft\(activeEntry\?\.scheduledSession/);
  assert.match(read('app/(tabs)/dashboard/index.tsx'), /primarySession\.completedActivityId/);
  assert.match(read('app/(tabs)/activity/[activityId].tsx'), /Edit activity/);
  assert.match(read('app/(tabs)/coach/index.tsx'), /getPlannedVersusCompletedComparison/);
});

test('weather and AQI attribution use actual configured Open-Meteo providers', () => {
  const weather = read('src/lib/weather.ts');
  const today = read('app/(tabs)/dashboard/index.tsx');
  assert.match(weather, /weatherProvider/);
  assert.match(weather, /Open-Meteo/);
  assert.match(weather, /Open-Meteo Air Quality API/);
  assert.match(today, /Weather data provided by/);
  assert.match(today, /Air-quality data provided by/);
});
