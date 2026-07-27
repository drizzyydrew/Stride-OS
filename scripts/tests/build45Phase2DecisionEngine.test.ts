import assert from 'node:assert/strict';
import test from 'node:test';

import { isEligibleForNorwegian4x4 } from '../../src/utils/advancedIntervals';
import { validateAdaptationSchedule } from '../../src/utils/adaptationWorkflow';
import { classifySessionStress } from '../../src/utils/sessionStress';
import { nextQualityRung } from '../../src/utils/training/qualityExposure';
import { buildRecalculationDecisionSnapshot } from '../../src/utils/training/recalculationDecisionSnapshot';
import { makeWeeklyTrainingDecision, decisionRequiresPlanRewrite } from '../../src/utils/training/trainingDecisionEngine';
import type { Activity } from '../../src/types/activity';
import type { ProgressionLevel, TrainingPhase } from '../../src/types/training';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

function decisionInput(overrides: Partial<Parameters<typeof makeWeeklyTrainingDecision>[0]> = {}) {
  return {
    phase: 'base' as TrainingPhase,
    progressionLevel: 'intermediate' as ProgressionLevel,
    currentWeek: 2,
    plannedSessionCount: 5,
    completedSessionCount: 5,
    readinessScore: 72,
    averageRpe: 6,
    acwr: 1,
    consistencyWeeks: 3,
    ...overrides,
  };
}

test('weekly decision engine covers progress maintain regress deload repeat and rebuild scenarios', () => {
  const cases: Array<[string, Partial<Parameters<typeof makeWeeklyTrainingDecision>[0]>, string]> = [
    ['earned progress', {}, 'progress'],
    ['no consistency maintain', { consistencyWeeks: 0 }, 'maintain'],
    ['planned deload', { currentWeek: 4 }, 'deload'],
    ['explicit deload', { phase: 'deload' }, 'deload'],
    ['low readiness', { readinessScore: 40 }, 'regress'],
    ['recovery label', { readinessLabel: 'Recovery Recommended' }, 'regress'],
    ['load spike', { acwr: 1.45 }, 'regress'],
    ['execution breakdown partial', { partialSessionCount: 2 }, 'regress'],
    ['execution breakdown stopped', { stoppedEarlyCount: 2 }, 'regress'],
    ['high rpe with imperfect week', { averageRpe: 8.5, completedSessionCount: 4 }, 'repeat'],
    ['one missed repeats', { missedSessionCount: 1, completedSessionCount: 3 }, 'repeat'],
    ['low adherence repeats', { completedSessionCount: 2 }, 'repeat'],
    ['missed multiple rebuilds', { missedSessionCount: 2, completedSessionCount: 2 }, 'rebuild'],
    ['interruptions rebuild', { interruptions: 2 }, 'rebuild'],
    ['reduced availability rebuild', { availableTrainingDays: 2 }, 'rebuild'],
    ['hard density regresses', { recentHardSessions: 2, completedSessionCount: 4 }, 'maintain'],
    ['taper maintain', { phase: 'taper', currentWeek: 3 }, 'progress'],
    ['peak progress if clean', { phase: 'peak', readinessScore: 85, acwr: 0.95 }, 'progress'],
    ['symptom-equivalent readiness low', { readinessScore: 44, averageRpe: 5 }, 'regress'],
    ['week one no calendar-only bump', { currentWeek: 1, consistencyWeeks: 0 }, 'maintain'],
  ];
  for (const [name, overrides, expected] of cases) {
    const result = makeWeeklyTrainingDecision(decisionInput(overrides));
    assert.equal(result.decision, expected, name);
    if (result.decision !== 'maintain') assert.ok(result.rationale.length > 20, name);
    assert.equal(result.simultaneousLoadIncreaseAllowed, false, name);
  }
});

test('decision rewrite helper flags only decisions that require plan review', () => {
  assert.equal(decisionRequiresPlanRewrite(makeWeeklyTrainingDecision(decisionInput({ missedSessionCount: 2 }))), true);
  assert.equal(decisionRequiresPlanRewrite(makeWeeklyTrainingDecision(decisionInput({ consistencyWeeks: 0 }))), false);
});

test('quality ladder advances conservatively and never starts formal quality in week one', () => {
  assert.equal(nextQualityRung({ progressionLevel: 'advanced', phase: 'build', planWeek: 1, recentConsistentWeeks: 10 }).allowed, false);
  assert.equal(nextQualityRung({ progressionLevel: 'beginner', phase: 'build', planWeek: 4, recentConsistentWeeks: 4, lastCompletedRung: 'strides', daysSinceLastQuality: 8 }).recommendedRung, 'gentle_fartlek');
  assert.equal(nextQualityRung({ progressionLevel: 'advanced', phase: 'threshold', planWeek: 6, recentConsistentWeeks: 12, lastCompletedRung: 'hills', daysSinceLastQuality: 8 }).recommendedRung, 'tempo_threshold');
  assert.equal(nextQualityRung({ progressionLevel: 'advanced', phase: 'vo2', planWeek: 10, recentConsistentWeeks: 16, lastCompletedRung: 'tempo_threshold', daysSinceLastQuality: 3 }).allowed, false);
});

const norwegianBase = {
  progressionLevel: 'advanced' as const,
  trainingPhase: 'vo2' as TrainingPhase,
  recentConsistentWeeks: 12,
  weeklyRunningMinutes: 240,
  toleratedLowerIntensityIntervals: true,
  hasNearbyHardSession: false,
  readinessScore: 82,
  hasCurrentSymptoms: false,
  beginnerFoundationPlanActive: false,
  featureFlagEnabled: true,
};

test('Norwegian 4x4 eligibility has one positive path and explicit negative gates', () => {
  assert.equal(isEligibleForNorwegian4x4(norwegianBase), true);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, featureFlagEnabled: false }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, progressionLevel: 'beginner' }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, trainingPhase: 'foundation' }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, trainingPhase: 'base' }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, recentConsistentWeeks: 7 }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, weeklyRunningMinutes: 170 }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, toleratedLowerIntensityIntervals: false }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, hasNearbyHardSession: true }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, hasAdjacentHardLowerBodySession: true }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, readinessScore: 69 }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, hasCurrentSymptoms: true }), false);
  assert.equal(isEligibleForNorwegian4x4({ ...norwegianBase, beginnerFoundationPlanActive: true }), false);
});

function session(overrides: Partial<ScheduledSession>): ScheduledSession {
  const value: ScheduledSession = {
    scheduledSessionId: overrides.scheduledSessionId ?? `s:${Math.random()}`,
    date: overrides.date ?? '2026-08-03',
    originalDate: overrides.originalDate ?? overrides.date ?? '2026-08-03',
    activityType: overrides.activityType ?? 'run',
    subtype: overrides.subtype ?? 'easy_run',
    title: overrides.title ?? 'Easy Run',
    purpose: overrides.purpose ?? 'Aerobic capacity',
    priority: overrides.priority ?? 'primary',
    durationMinutes: overrides.durationMinutes ?? 45,
    target: overrides.target ?? 'Easy',
    status: overrides.status ?? 'upcoming',
    ...overrides,
  };
  return { ...value, stress: classifySessionStress(value) };
}

test('adaptation validator uses stress axes for unacceptable and acceptable hard-session pairings', () => {
  const intervals = session({ scheduledSessionId: 'run-hard', title: 'VO2 Intervals', subtype: 'vo2' });
  const lower = session({ scheduledSessionId: 'lower-hard', activityType: 'strength', priority: 'supporting', title: 'Heavy Lower Strength', purpose: 'Squat and deadlift' });
  const upper = session({ scheduledSessionId: 'upper-hard', activityType: 'strength', priority: 'supporting', title: 'Upper Strength', purpose: 'Press and row' });
  const recovery = session({ scheduledSessionId: 'recovery', date: '2026-08-04', activityType: 'mobility', priority: 'optional', title: 'Recovery Mobility', durationMinutes: 20 });
  const nextHard = session({ scheduledSessionId: 'next-hard', date: '2026-08-04', title: 'Tempo Run', subtype: 'tempo' });

  assert.equal(validateAdaptationSchedule([intervals, upper]).some(conflict => conflict.code === 'stress_axis_overlap'), false);
  assert.equal(validateAdaptationSchedule([intervals, lower, recovery]).some(conflict => conflict.code === 'stress_axis_overlap'), false);
  assert.equal(validateAdaptationSchedule([intervals, lower, nextHard]).some(conflict => conflict.code === 'stress_axis_overlap'), true);
});

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: overrides.id ?? 'a1',
    activityType: overrides.activityType ?? 'running',
    source: 'manual',
    status: overrides.status ?? 'completed',
    scheduled: false,
    startTime: 1,
    endTime: 2,
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: { method: 'session_rpe', wholeBody: 30, running: 30, walking: 0, strength: 0, crossTraining: 0, impactBearing: 30, nonImpactAerobic: 0, confidence: 'moderate' },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test('recalculation decision snapshot is pure, compact, and preserves ACWR summary data', () => {
  const result = buildRecalculationDecisionSnapshot([
    activity({ id: 'completed', rpe: 6 }),
    activity({ id: 'partial', status: 'partial', completionClassification: 'partial', rpe: 8 }),
  ]);
  assert.equal(typeof result.acwr.acwr, 'number');
  assert.ok(result.decisionSnapshot.rationale);
  assert.ok(result.decisionSnapshot.rationale.length < 500);
});
