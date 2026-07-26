import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAdaptationOverlays,
  adaptationWeekKey,
  alternativesForSession,
  createAdaptationPreview,
  missedWorkoutActions,
  serializeConfirmedAdaptations,
  validateAdaptationSchedule,
} from '../adaptationWorkflow';
import type { ScheduledSession } from '../scheduledSessions';

function session(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: 'easy-1', date: '2026-07-26', originalDate: '2026-07-26',
    activityType: 'run', subtype: 'easy_run', title: 'Easy Run', purpose: 'Build aerobic consistency.',
    priority: 'primary', durationMinutes: 40, target: '40 min easy', status: 'upcoming',
    rpeTarget: '3-4', ...overrides,
  };
}

test('missed-workout preview preserves original prescription until confirmation and projects a reduced overlay', () => {
  const original = session();
  const preview = createAdaptationPreview('week:2026-07-26', [original], [{ scheduledSessionId: original.scheduledSessionId, action: 'reduced', reason: 'missed_schedule' }], 123);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(original.durationMinutes, 40);
  assert.equal(preview.overlays[0]?.original.durationMinutes, 40);
  assert.equal(preview.overlays[0]?.adapted?.durationMinutes, 28);
  assert.match(preview.overlays[0]?.adapted?.target ?? '', /^28 min · reduced from 40 min/);
  const applied = applyAdaptationOverlays([original], preview.overlays);
  assert.equal(applied[0]?.durationMinutes, 28);
  assert.equal(applied[0]?.scheduledSessionId, original.scheduledSessionId);
  assert.equal(original.durationMinutes, 40);
});

test('one stable session ID cannot be duplicated by a confirmed adaptation overlay', () => {
  const original = session();
  const preview = createAdaptationPreview('week:2026-07-26', [original], [{ scheduledSessionId: original.scheduledSessionId, action: 'moved', reason: 'weather_or_logistics', moveToDate: '2026-07-28' }], 123);
  const projected = applyAdaptationOverlays([original, { ...original }], preview.overlays);
  assert.equal(projected.length, 1);
  assert.equal(projected[0]?.date, '2026-07-28');
  assert.equal(projected[0]?.originalDate, '2026-07-26');
});

test('missed and health alternatives are conservative and do not promise a make-up session', () => {
  const easy = session();
  assert.deepEqual(alternativesForSession(easy, 'low_energy').map(item => item.action), [
    'unchanged',
    'reduced',
    'remove_intensity',
    'convert_easy',
    'convert_run_walk',
    'replace_walk',
    'replace_cycling',
    'replace_mobility',
    'active_recovery',
    'rest',
    'removed',
  ]);
  assert.ok(missedWorkoutActions(easy, 'missed_schedule').some(item => item.action === 'moved'));
  const runWalk = session({ activityType: 'run_walk', subtype: 'run_walk', title: 'Run/Walk Intervals' });
  assert.ok(missedWorkoutActions(runWalk, 'missed_schedule').some(item => item.action === 'moved'));
  const hard = session({ scheduledSessionId: 'hard-1', subtype: 'interval_run', title: 'Intervals' });
  assert.ok(!missedWorkoutActions(hard, 'missed_schedule').some(item => item.action === 'moved'));
});

test('preview reports unchanged sessions and records whether an alternative preserves intent', () => {
  const easy = session();
  const strength = session({
    scheduledSessionId: 'strength-1',
    activityType: 'strength',
    subtype: 'full_body',
    title: 'Full Body Strength',
    date: '2026-07-27',
    originalDate: '2026-07-27',
  });
  const preview = createAdaptationPreview('week:2026-07-26', [easy, strength], [{
    scheduledSessionId: easy.scheduledSessionId,
    action: 'replace_cycling',
    reason: 'travel',
  }], 123);
  assert.deepEqual(preview.unchangedSessionIds, [strength.scheduledSessionId]);
  assert.equal(preview.overlays[0]?.intentPreserved, true);
  assert.equal(preview.overlays[0]?.original.title, 'Easy Run');
  assert.equal(preview.overlays[0]?.adapted?.activityType, 'cycling');
});

test('hill work can become a treadmill equivalent without changing its stable identity or interval purpose', () => {
  const hills = session({
    scheduledSessionId: 'hills-1',
    subtype: 'hill_repeats',
    title: '6 × 2-minute Hill Repetitions',
    purpose: 'Aerobic power and uphill force production.',
    target: '6 × 2 min controlled uphill',
    mainSet: '6 × 2 min uphill with 2 min easy recovery',
  });
  assert.ok(alternativesForSession(hills, 'no_hills_available').some(item => item.action === 'treadmill_equivalent'));
  const preview = createAdaptationPreview('week:2026-07-26', [hills], [{
    scheduledSessionId: hills.scheduledSessionId,
    action: 'treadmill_equivalent',
    reason: 'no_hills_available',
  }], 123);
  const overlay = preview.overlays[0];
  assert.equal(overlay.original.title, '6 × 2-minute Hill Repetitions');
  assert.equal(overlay.adapted?.scheduledSessionId, hills.scheduledSessionId);
  assert.equal(overlay.adapted?.purpose, hills.purpose);
  assert.equal(overlay.intentPreserved, true);
  assert.match(overlay.adapted?.mainSet ?? '', /treadmill incline/i);
});

test('conflict validator protects beginner-safe scheduling and locked plan boundaries', () => {
  const runWalk = session({ scheduledSessionId: 'rw', activityType: 'run_walk', subtype: 'run_walk', title: 'Run/Walk' });
  const easy = session({ scheduledSessionId: 'easy', activityType: 'run', date: runWalk.date, originalDate: runWalk.date });
  const hardOne = session({ scheduledSessionId: 'hard-one', date: '2026-07-27', originalDate: '2026-07-27', subtype: 'interval_run', title: 'Intervals' });
  const hardTwo = session({ scheduledSessionId: 'hard-two', date: '2026-07-28', originalDate: '2026-07-28', subtype: 'tempo_run', title: 'Tempo' });
  const conflicts = validateAdaptationSchedule([runWalk, easy, hardOne, hardTwo], { lockedDates: ['2026-07-28'], planStartDate: '2026-07-26', planEndDate: '2026-07-27' });
  assert.ok(conflicts.some(item => item.code === 'two_primary_runs'));
  assert.ok(conflicts.some(item => item.code === 'run_walk_plus_easy'));
  assert.ok(conflicts.some(item => item.code === 'consecutive_hard'));
  assert.ok(conflicts.some(item => item.code === 'plan_boundary'));
});

test('hard sessions separated by empty recovery days are not treated as consecutive', () => {
  const monday = session({
    scheduledSessionId: 'hard-monday',
    date: '2026-07-27',
    originalDate: '2026-07-27',
    subtype: 'interval_run',
    title: 'Intervals',
  });
  const friday = session({
    scheduledSessionId: 'hard-friday',
    date: '2026-07-31',
    originalDate: '2026-07-31',
    subtype: 'tempo_run',
    title: 'Tempo',
  });
  assert.equal(
    validateAdaptationSchedule([monday, friday]).some(item => item.code === 'consecutive_hard'),
    false,
  );
});

test('confirmed adaptation persistence accepts only confirmed serializable records', () => {
  const saved = serializeConfirmedAdaptations({
    good: { weekKey: 'week:2026-07-26', confirmation: 'confirmed', overlays: [] },
    preview: { weekKey: 'week:2026-07-26', confirmation: 'preview', overlays: [] },
    broken: null,
  });
  assert.deepEqual(Object.keys(saved), ['good']);
});

test('calendar week keys do not depend on the first scheduled workout date', () => {
  assert.equal(adaptationWeekKey('2026-07-26'), 'week:2026-07-26');
});

test('replacing a confirmed preview can still start from the immutable canonical prescription', () => {
  const canonical = session();
  const first = createAdaptationPreview('week:2026-07-26', [canonical], [{
    scheduledSessionId: canonical.scheduledSessionId,
    action: 'reduced',
    reason: 'poor_sleep',
  }], 100);
  const displayed = applyAdaptationOverlays([canonical], first.overlays);
  assert.equal(displayed[0].durationMinutes, 28);
  const replacement = createAdaptationPreview('week:2026-07-26', [canonical], [{
    scheduledSessionId: canonical.scheduledSessionId,
    action: 'replace_walk',
    reason: 'lower_impact_needed',
  }], 200);
  assert.equal(replacement.overlays[0].original.durationMinutes, 40);
  assert.equal(replacement.overlays[0].original.activityType, 'run');
});
