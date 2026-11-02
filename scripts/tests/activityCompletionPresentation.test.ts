import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity, CompletionClassification } from '../../src/types/activity';
import { activityStatusForClassification, buildManualActivityDraft } from '../../src/utils/activityCompletion';
import { buildActivitySummary } from '../../src/utils/activitySummary';
import { calculateActivityLoad } from '../../src/utils/activityLoad';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

function savedManual(session: ScheduledSession | null = null): Activity {
  const now = Date.UTC(2026, 10, 1, 12);
  return {
    ...buildManualActivityDraft(session, { activityType: 'running', durationMinutes: 45,
      distance: 4.5, distanceUnit: 'mi' }, now),
    id: 'synthetic-manual-run', createdAt: now, updatedAt: now,
    trainingLoad: calculateActivityLoad({ activityType: 'running', durationMinutes: 45, rpe: 5 }),
  };
}

function summaryRows(activity: Activity) {
  return buildActivitySummary(activity, 'imperial', { dataRich: true }).sections.flatMap(section => section.metrics);
}

test('an unlinked saved manual run cannot advertise prescription adherence from the default completion state', () => {
  const activity = savedManual();
  const original = structuredClone(activity);
  assert.equal(activity.completionClassification, 'completed_as_prescribed', 'exercise the actual manual-entry default');
  const rows = summaryRows(activity);
  assert.equal(rows.find(row => row.label === 'Entry')?.value, 'Manually logged');
  assert.equal(rows.some(row => row.label === 'Completed vs planned' || row.label === 'Linked plan'), false);
  assert.equal(rows.some(row => /prescribed/i.test(row.value)), false);
  assert.deepEqual(activity, original, 'presentation must not rewrite the saved completion state');
});

test('flags and goal/block metadata alone do not establish a linked prescription', () => {
  for (const scheduledSessionId of [undefined, '', '   ']) {
    const rows = summaryRows({ ...savedManual(), scheduled: true,
      associatedGoalId: 'synthetic-goal', associatedTrainingBlockId: 'synthetic-block', scheduledSessionId });
    assert.equal(rows.some(row => row.label === 'Completed vs planned' || row.label === 'Linked plan'), false);
  }
});

const completionLabels: [CompletionClassification, string][] = [
  ['completed_as_prescribed', 'Completed as prescribed'], ['modified', 'Modified'],
  ['equivalent_substitute', 'Equivalent substitute'], ['partial', 'Partial'],
  ['completed_other_activity', 'Completed other activity'], ['stopped_early', 'Stopped early'], ['skipped', 'Skipped'],
];

test('linked activity detail preserves every explicit completion classification', () => {
  const session = { scheduledSessionId: 'synthetic-session', trainingBlockId: 'synthetic-block',
    goalPlanId: 'synthetic-goal', activityType: 'run', durationMinutes: 45 } as ScheduledSession;
  for (const [classification, label] of completionLabels) {
    const activity = { ...savedManual(session), completionClassification: classification,
      status: activityStatusForClassification(classification) };
    const original = structuredClone(activity);
    const rows = summaryRows(activity);
    assert.equal(rows.find(row => row.label === 'Completed vs planned')?.value, label);
    assert.equal(rows.find(row => row.label === 'Linked plan')?.value, 'Scheduled workout');
    assert.deepEqual(activity, original);
  }
});

test('a linked legacy record without a classification does not invent a completion comparison', () => {
  const rows = summaryRows({ ...savedManual(), scheduledSessionId: 'synthetic-session', completionClassification: undefined });
  assert.equal(rows.some(row => row.label === 'Completed vs planned'), false);
  assert.equal(rows.find(row => row.label === 'Linked plan')?.value, 'Scheduled workout');
});
