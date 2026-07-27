import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMacroPlan, macroWeekForDate } from '../../src/utils/plan/macroPlanner';
import { buildPeriodizationPlan, resolveTrainingPhase } from '../../src/utils/periodization';
import { getMesocyclePosition } from '../../src/utils/periodizationEngine';
import { computeProgressedMileage, shouldDeload } from '../../src/utils/progression';
import { classifySessionStress } from '../../src/utils/sessionStress';
import { resolveDeloadDecision, resolvePhaseWithDeload } from '../../src/utils/training/deloadModel';
import { generateRichWeek, getBaseTemplate } from '../../src/utils/workoutEngine';
import { generateStrengthWeek } from '../../src/utils/strengthEngine';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';
import type { WorkoutEngineInput } from '../../src/types/workout';
import type { StrengthEngineInput } from '../../src/types/strength';

function scheduled(overrides: Partial<ScheduledSession>): ScheduledSession {
  return {
    scheduledSessionId: overrides.scheduledSessionId ?? 'week:2026-07-26:run:test:0',
    date: overrides.date ?? '2026-07-26',
    originalDate: overrides.originalDate ?? overrides.date ?? '2026-07-26',
    activityType: overrides.activityType ?? 'run',
    subtype: overrides.subtype ?? 'easy_run',
    title: overrides.title ?? 'Easy Aerobic Run',
    purpose: overrides.purpose ?? 'Build aerobic capacity',
    priority: overrides.priority ?? 'primary',
    durationMinutes: overrides.durationMinutes ?? 40,
    target: overrides.target ?? '40 min easy',
    status: overrides.status ?? 'upcoming',
    ...overrides,
  };
}

const workoutInput: WorkoutEngineInput = {
  calibration: null,
  fatigueSensitivity: 1,
  recoveryResponsiveness: 1,
  injuryRisk: false,
  fatigueScore: 35,
  recoveryScore: 75,
  soreness: 2,
  motivation: 7,
  acwr: 1,
  trainingPhase: 'base',
  progressionLevel: 'intermediate',
  weeklyMileage: 25,
  currentWeek: 4,
  goalRace: 'half marathon',
  weeksToRace: 10,
  recentIntensityDist: { easy: 80, moderate: 10, hard: 10 },
  recentHardSessions: 0,
  adherenceRate: 0.9,
  consistencyScore: 82,
  longRunConsistency: 0.8,
};

const strengthInput: StrengthEngineInput = {
  trainingPhase: 'base',
  progressionLevel: 'intermediate',
  weeklyMileage: 25,
  currentWeek: 4,
  fatigueScore: 35,
  recoveryScore: 75,
  soreness: 2,
  injuryRisk: false,
  acwr: 1,
  weeksToRace: 10,
  availableTimeMin: 60,
  strengthHistory: [],
};

test('deload model preserves default 3+1 cadence and volume bounds', () => {
  assert.equal(shouldDeload(3), false);
  assert.equal(shouldDeload(4), true);
  assert.equal(resolvePhaseWithDeload(4, 'base'), 'deload');
  assert.equal(resolvePhaseWithDeload(4, 'taper'), 'taper');

  const decision = resolveDeloadDecision({ currentWeek: 4, phase: 'base' });
  assert.equal(decision.weekInBlock, 4);
  assert.equal(decision.isDeload, true);
  assert.equal(decision.blockMultiplier, 0.65);
  assert.equal(decision.volumeFactor, 0.7);
  assert.equal(resolveDeloadDecision({ currentWeek: 5, phase: 'base', blockLength: 4 }).weekInBlock, 5);
  assert.equal(resolveDeloadDecision({ currentWeek: 5, phase: 'base', blockLength: 4 }).isDeload, true);
  assert.equal(resolveDeloadDecision({ currentWeek: 4, phase: 'base', volumeFactor: 0.2 }).volumeFactor, 0.65);
  assert.equal(resolveDeloadDecision({ currentWeek: 4, phase: 'base', volumeFactor: 0.9 }).volumeFactor, 0.75);
});

test('periodization and progression delegate to the unified deload model without shifting default outputs', () => {
  const plan = buildPeriodizationPlan('half marathon', 20);
  assert.equal(resolveTrainingPhase(3, plan), 'base');
  assert.equal(resolveTrainingPhase(4, plan), 'deload');
  assert.equal(computeProgressedMileage({ baseMileage: 20, currentWeek: 4, phase: 'deload', progressionLevel: 'intermediate' }), 13);
  assert.deepEqual(getMesocyclePosition(4, 'base'), {
    blockNumber: 1,
    weekInBlock: 4,
    isDeload: true,
    isLoadingPeak: false,
    blockMultiplier: 0.65,
  });
});

test('workout and strength engines keep their default deload-week templates', () => {
  assert.deepEqual(getBaseTemplate(workoutInput), ['easy_run', 'deload_session', 'mobility', 'deload_session', 'rest', 'easy_run', 'rest']);
  const richWeek = generateRichWeek(workoutInput);
  assert.equal(richWeek.workouts[1]?.richType, 'deload_session');
  assert.match(richWeek.progressionNote, /block week 4\/4/);

  const strengthWeek = generateStrengthWeek(strengthInput);
  assert.equal(strengthWeek.primaryGoal, 'force_production');
  assert.equal(strengthWeek.sessions.length, 2);
  assert.ok(strengthWeek.weeklyVolumeSets > 0);
});

test('macro planner uses the same deload cadence for generated and extended weeks', () => {
  const plan = buildMacroPlan({
    goalType: 'general_running',
    startDate: '2026-07-26',
    races: [],
    progressionLevel: 'intermediate',
    yearsRunning: 3,
    weeklyMileage: 25,
  });
  assert.equal(plan.weeks.find(week => week.weekNumber === 4)?.phase, 'deload');
  assert.equal(macroWeekForDate(plan, new Date('2027-10-10T12:00:00'))?.phase, 'deload');
});

test('session stress classifier covers run, long-run, strength, upper-only, and recovery archetypes', () => {
  assert.equal(classifySessionStress(scheduled({ title: 'Run/Walk Intervals', activityType: 'run_walk', subtype: 'run_walk' })).classification, 'easy');
  assert.equal(classifySessionStress(scheduled({ title: '6 x 2 min Hill Repeats', subtype: 'hill_repeats', durationMinutes: 50 })).classification, 'hard');
  assert.equal(classifySessionStress(scheduled({ title: 'Long Easy Run', subtype: 'long_run', durationMinutes: 85 })).classification, 'medium');

  const lower = classifySessionStress(scheduled({ activityType: 'strength', subtype: 'lower_power', title: 'Heavy Lower Strength', purpose: 'Squat and deadlift strength' }));
  assert.equal(lower.classification, 'hard');
  assert.equal(lower.axes.lowerMuscular, 3);

  const upper = classifySessionStress(scheduled({ activityType: 'strength', subtype: 'upper_strength', title: 'Upper Push Pull Strength', purpose: 'Press and row' }));
  assert.equal(upper.classification, 'hard');
  assert.equal(upper.axes.lowerMuscular, 0);

  assert.equal(classifySessionStress(scheduled({ activityType: 'mobility', subtype: 'mobility', title: 'Recovery Mobility', durationMinutes: 20 })).classification, 'recovery');
});

test('consecutive-day hard pairs conflict only on overlapping stress systems (final-audit regression)', async () => {
  const { hasOverlappingHardStress } = await import('../../src/utils/sessionStress');
  const { validateAdaptationSchedule } = await import('../../src/utils/adaptationWorkflow');

  const day = (date: string, overrides: Partial<ScheduledSession>) =>
    scheduled({ date, originalDate: date, scheduledSessionId: `week:${date}:${overrides.activityType ?? 'run'}:${overrides.title}:${Math.random()}`, ...overrides });

  const upper = (date: string) => day(date, { activityType: 'strength', priority: 'supporting', subtype: 'upper_strength', title: 'Upper Push Pull Strength', purpose: 'Press and row' });
  const lower = (date: string) => day(date, { activityType: 'strength', priority: 'supporting', subtype: 'lower_power', title: 'Heavy Lower Strength', purpose: 'Squat and deadlift' });
  const intervals = (date: string) => day(date, { title: 'VO2 Intervals', subtype: 'vo2', durationMinutes: 50 });
  const hills = (date: string) => day(date, { title: 'Hill Repeats', subtype: 'hill_repeats', durationMinutes: 50 });
  const tempo = (date: string) => day(date, { title: 'Tempo Run', subtype: 'tempo', durationMinutes: 45 });
  const fourByFour = (date: string) => day(date, { title: 'Norwegian 4x4 Intervals', subtype: 'vo2', durationMinutes: 45 });

  const codes = (sessions: ScheduledSession[]) => validateAdaptationSchedule(sessions).map(conflict => conflict.code);

  // Acceptable pairings (rule 4F): no consecutive_hard / recovery_spacing.
  assert.equal(codes([upper('2026-08-03'), intervals('2026-08-04')]).some(code => code === 'consecutive_hard' || code === 'recovery_spacing'), false);
  assert.equal(codes([upper('2026-08-03'), hills('2026-08-04')]).some(code => code === 'consecutive_hard' || code === 'recovery_spacing'), false);
  assert.equal(codes([upper('2026-08-03'), fourByFour('2026-08-04')]).some(code => code === 'consecutive_hard' || code === 'recovery_spacing'), false);

  // Unacceptable pairings still conflict.
  assert.equal(codes([lower('2026-08-03'), hills('2026-08-04')]).includes('consecutive_hard'), true);
  assert.equal(codes([intervals('2026-08-03'), lower('2026-08-04')]).includes('consecutive_hard'), true);
  assert.equal(codes([fourByFour('2026-08-03'), tempo('2026-08-04')]).includes('consecutive_hard'), true);

  // Overlap helper direct checks.
  assert.equal(hasOverlappingHardStress(upper('2026-08-03'), intervals('2026-08-04')), false);
  assert.equal(hasOverlappingHardStress(lower('2026-08-03'), hills('2026-08-04')), true);
});
