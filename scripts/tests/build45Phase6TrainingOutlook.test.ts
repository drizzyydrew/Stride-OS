import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Activity } from '../../src/types/activity';
import { buildTrainingOutlook } from '../../src/utils/trainingOutlook';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);

function activity(id: string, daysAgo: number, load = 60): Activity {
  const startTime = NOW - daysAgo * DAY_MS;
  return {
    id,
    activityType: 'running',
    source: 'manual',
    status: 'completed',
    scheduled: true,
    startTime,
    endTime: startTime + 30 * 60 * 1000,
    rpe: 5,
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: load,
      running: load,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: load,
      nonImpactAerobic: 0,
      confidence: 'moderate',
    },
    createdAt: startTime,
    updatedAt: startTime,
  };
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

test('training outlook reports insufficient history before making specific claims', () => {
  const outlook = buildTrainingOutlook({ activities: [], now: NOW });
  assert.equal(outlook.status, 'insufficient_history');
  assert.equal(outlook.loadState, 'insufficient_data');
  assert.equal(outlook.confidence, 'limited');
  assert.equal(outlook.dateClaimAllowed, false);
});

test('training outlook flags fast load ramps without date-bearing race claims', () => {
  const activities = [activity('a', 1, 120), activity('b', 3, 110), activity('c', 5, 100), activity('d', 15, 35)];
  const outlook = buildTrainingOutlook({
    activities,
    currentWeek: 5,
    trainingPhase: 'base',
    readinessLabel: 'Mostly Ready',
    now: NOW,
  });

  assert.equal(outlook.loadState, 'ramping_quickly');
  assert.equal(outlook.status, 'progressing_cautiously');
  assert.equal(outlook.dateClaimAllowed, false);
  assert.match(outlook.message, /building quickly/i);
});

test('training outlook can produce strong-confidence qualitative goal support only after enough history', () => {
  const activities = Array.from({ length: 18 }, (_, index) => activity(`wk-${index}`, index * 3, 50));
  const outlook = buildTrainingOutlook({
    activities,
    currentWeek: 10,
    trainingPhase: 'race_specific',
    weeksToRace: 1,
    readinessLabel: 'Ready to Train',
    now: NOW,
  });

  assert.equal(outlook.confidence, 'strong');
  assert.equal(outlook.status, 'ready_for_current_goal');
  assert.equal(outlook.dateClaimAllowed, true);
  assert.doesNotMatch(outlook.message, /\b[A-Z][a-z]{2}\s+\d{1,2}\b/);
});

test('readiness and decision snapshots can qualify the outlook conservatively', () => {
  const activities = Array.from({ length: 8 }, (_, index) => activity(`steady-${index}`, index * 4, 55));
  const recovery = buildTrainingOutlook({
    activities,
    readinessLabel: 'Recovery Recommended',
    readinessScore: 40,
    now: NOW,
  });
  const rebuild = buildTrainingOutlook({
    activities,
    readinessLabel: 'Mostly Ready',
    decisionSnapshot: {
      decision: 'rebuild',
      phase: 'base',
      focus: 'Aerobic Capacity',
      rationale: 'Missed multiple sessions.',
      flags: ['missed_multiple_sessions'],
      confidence: 'moderate',
      updatedAt: NOW,
    },
    now: NOW,
  });

  assert.equal(recovery.status, 'recovery_needed');
  assert.equal(rebuild.status, 'plan_adjustment_needed');
});

test('recalculation pipeline stores outlook snapshots and names all Phase 6 trigger reasons', () => {
  const pipeline = read('src/lib/recalculation.ts');
  const store = read('src/store/recalculationStore.ts');
  assert.match(pipeline, /buildTrainingOutlook/);
  assert.match(store, /trainingOutlook\?: TrainingOutlook/);
  for (const reason of [
    'activity_added',
    'activity_updated',
    'activity_removed',
    'manual_refresh',
    'adaptation_confirmed',
    'missed_session',
    'readiness_changed',
    'deload_transition',
    'phase_transition',
    'event_date_changed',
  ]) {
    assert.match(pipeline, new RegExp(`'${reason}'`));
  }
});

test('Today dashboard uses Training Outlook and removes hardcoded forecast placeholders', () => {
  const dashboard = read('app/(tabs)/dashboard/index.tsx');
  assert.match(dashboard, /TRAINING OUTLOOK/);
  assert.match(dashboard, /buildTrainingOutlook/);
  assert.doesNotMatch(dashboard, /PERFORMANCE FORECAST/);
  assert.doesNotMatch(dashboard, /Peak Window/);
  assert.doesNotMatch(dashboard, /Race Ready/);
  assert.doesNotMatch(dashboard, /Aug 3/);
  assert.doesNotMatch(dashboard, />63</);
});
