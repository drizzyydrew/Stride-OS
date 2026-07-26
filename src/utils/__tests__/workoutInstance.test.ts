import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STALE_ACTIVE_SESSION_THRESHOLD_MS,
  buildWorkoutInstanceId,
  isStaleActiveSession,
  resolveLaunchDecision,
  synthesizeWorkoutInstanceId,
} from '../workoutInstance';

test('buildWorkoutInstanceId uses scheduledSessionId or "adhoc"', () => {
  assert.equal(buildWorkoutInstanceId('week:2026-07-25:run:w1:0', 1000), 'week:2026-07-25:run:w1:0:1000');
  assert.equal(buildWorkoutInstanceId(null, 1000), 'adhoc:1000');
  assert.equal(buildWorkoutInstanceId(undefined, 1000), 'adhoc:1000');
});

test('synthesizeWorkoutInstanceId keeps an existing id untouched', () => {
  assert.equal(
    synthesizeWorkoutInstanceId({ workoutInstanceId: 'existing:1', scheduledSessionId: 'x', startedAtMs: 5 }),
    'existing:1',
  );
});

test('synthesizeWorkoutInstanceId derives from scheduledSessionId + startedAt when missing', () => {
  assert.equal(
    synthesizeWorkoutInstanceId({ scheduledSessionId: 'sched1', startedAtMs: 500 }),
    'sched1:500',
  );
  assert.equal(
    synthesizeWorkoutInstanceId({ scheduledSessionId: null, startedAtMs: 500 }),
    'adhoc:500',
  );
});

test('synthesizeWorkoutInstanceId returns null when there is nothing to synthesize from', () => {
  assert.equal(synthesizeWorkoutInstanceId({ startedAtMs: null }), null);
  assert.equal(synthesizeWorkoutInstanceId({ startedAtMs: NaN }), null);
});

test('isStaleActiveSession: exactly at threshold is not stale, past it is', () => {
  const now = 10_000_000;
  assert.equal(isStaleActiveSession(now - STALE_ACTIVE_SESSION_THRESHOLD_MS, now), false);
  assert.equal(isStaleActiveSession(now - STALE_ACTIVE_SESSION_THRESHOLD_MS - 1, now), true);
  assert.equal(isStaleActiveSession(null, now), false);
  assert.equal(isStaleActiveSession(undefined, now), false);
  assert.equal(isStaleActiveSession(NaN, now), false);
});

test('resolveLaunchDecision: nothing active starts new silently', () => {
  const decision = resolveLaunchDecision({
    isActive: false,
    activeScheduledSessionId: null,
    requestedScheduledSessionId: 'sched1',
    startedAtMs: null,
  });
  assert.equal(decision, 'start_new');
});

test('resolveLaunchDecision: matching, fresh instance resumes silently', () => {
  const now = 1_000_000;
  const decision = resolveLaunchDecision({
    isActive: true,
    activeScheduledSessionId: 'sched1',
    requestedScheduledSessionId: 'sched1',
    startedAtMs: now - 1000,
    nowMs: now,
  });
  assert.equal(decision, 'resume');
});

test('resolveLaunchDecision: mismatched workout always confirms, even when fresh', () => {
  const now = 1_000_000;
  const decision = resolveLaunchDecision({
    isActive: true,
    activeScheduledSessionId: 'sched1',
    requestedScheduledSessionId: 'sched2',
    startedAtMs: now - 1000,
    nowMs: now,
  });
  assert.equal(decision, 'confirm');
});

test('resolveLaunchDecision: matching but stale instance confirms rather than silently resuming', () => {
  const now = 1_000_000;
  const decision = resolveLaunchDecision({
    isActive: true,
    activeScheduledSessionId: 'sched1',
    requestedScheduledSessionId: 'sched1',
    startedAtMs: now - STALE_ACTIVE_SESSION_THRESHOLD_MS - 1,
    nowMs: now,
  });
  assert.equal(decision, 'confirm');
});

test('resolveLaunchDecision: nothing-active-yet quick start with no scheduled session', () => {
  const decision = resolveLaunchDecision({
    isActive: true,
    activeScheduledSessionId: null,
    requestedScheduledSessionId: null,
    startedAtMs: 1,
    nowMs: 2,
  });
  assert.equal(decision, 'resume');
});
