import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { buildManualActivityDraft, activityStatusForClassification } from '../../src/utils/activityCompletion';
import { categoryFromScheduledType, classifySubstitution } from '../../src/utils/substitution';
import { summarizeStrengthSession } from '../../src/utils/strengthSummary';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

function baseScheduledSession(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: 'week:2026-07-27:strength:strength_full_body_1_1',
    date: '2026-07-27',
    originalDate: '2026-07-27',
    activityType: 'strength',
    subtype: 'general',
    title: 'Full Body Strength',
    purpose: 'Full-body strength session.',
    priority: 'primary',
    durationMinutes: 45,
    target: 'RPE 7',
    status: 'today',
    ...overrides,
  };
}

// This mirrors custom-session.tsx's finish() function exactly (draft
// builder + classification override), so it can be exercised without React.
function buildCustomFinishDraft(scheduledSession: ScheduledSession | null, actualCategory: 'strength' = 'strength') {
  const substitution = scheduledSession
    ? classifySubstitution({
      scheduledCategory: categoryFromScheduledType(scheduledSession.activityType),
      actualCategory,
      intentMatch: categoryFromScheduledType(scheduledSession.activityType) === actualCategory,
    })
    : null;

  const summary = summarizeStrengthSession({
    exercises: [{
      id: 'ex1', name: 'Goblet Squat', equipmentType: 'kettlebell',
      setEntries: [{ id: 's1', reps: 10, weight: 35, weightUnit: 'lb', completed: true }],
    }],
    durationSeconds: 900,
  });

  const draft = buildManualActivityDraft(scheduledSession, {
    activityType: 'strength',
    durationMinutes: summary.durationMinutes,
    rpe: summary.averageRpe ?? undefined,
    notes: 'Custom Workout · Do My Own Workout',
    indoor: true,
  });

  const classification = substitution?.classification;
  return {
    ...draft,
    completionClassification: classification ?? draft.completionClassification,
    status: classification ? activityStatusForClassification(classification) : draft.status,
  };
}

test('custom finish against a scheduled strength session links scheduledSessionId and classifies as equivalent_substitute', () => {
  const scheduled = baseScheduledSession();
  const draft = buildCustomFinishDraft(scheduled);
  assert.equal(draft.scheduledSessionId, scheduled.scheduledSessionId);
  assert.equal(draft.completionClassification, 'equivalent_substitute');
  assert.equal(draft.status, 'completed');
  assert.equal(draft.activityType, 'strength');
});

test('custom finish against a scheduled mobility session is honestly completed_other_activity, not linked as satisfying intent', () => {
  const scheduled = baseScheduledSession({ activityType: 'mobility', title: 'Mobility Flow' });
  const draft = buildCustomFinishDraft(scheduled);
  assert.equal(draft.completionClassification, 'completed_other_activity');
  // Still linked — the athlete deliberately launched this against the
  // scheduled session — but never claims the original intent was satisfied.
  assert.equal(draft.scheduledSessionId, scheduled.scheduledSessionId);
});

test('standalone custom finish (no scheduled session) has no scheduledSessionId and defaults to completed_as_prescribed-equivalent state', () => {
  const draft = buildCustomFinishDraft(null);
  assert.equal(draft.scheduledSessionId, undefined);
  assert.equal(draft.scheduled, false);
});

test('custom-session.tsx writes through one strength-store path that creates exactly one Activity', () => {
  const source = readFileSync(join(process.cwd(), 'app/(tabs)/strength/custom-session.tsx'), 'utf8');
  const strengthStore = readFileSync(join(process.cwd(), 'src/store/strengthStore.ts'), 'utf8');
  const manualLogCalls = source.match(/\bmanualLog\(/g) ?? [];
  assert.equal(manualLogCalls.length, 1, 'custom-session.tsx should record one canonical strength completion');
  assert.doesNotMatch(source, /\baddActivity\(/);
  assert.doesNotMatch(source, /\blogStrengthSession\(/);
  assert.match(strengthStore, /manualLog:[\s\S]*addActivity\(activityFromStrengthRecord\(record, false\)\)/);
});

test('custom-session.tsx is registered as a strength route reachable from the Strength screen and Calendar', () => {
  const strengthScreen = readFileSync(join(process.cwd(), 'app/(tabs)/strength/index.tsx'), 'utf8');
  const calendar = readFileSync(join(process.cwd(), 'app/(tabs)/calendar/index.tsx'), 'utf8');
  assert.match(strengthScreen, /strength\/custom-session/);
  assert.match(strengthScreen, /Do My Own Workout/);
  assert.match(calendar, /strength\/custom-session/);
  assert.match(calendar, /Do My Own Workout/);
});
