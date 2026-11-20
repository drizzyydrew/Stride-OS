import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeekPlan, type EngineInput } from '../../src/utils/trainingEngine';
import { isHardLowerStrengthStress } from '../../src/utils/sessionStress';
import type { CompletedWorkoutRecord } from '../../src/types/training';
import type { RichWorkout } from '../../src/types/workout';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';
import type { CalendarEntry } from '../../src/utils/calendarEngine';
import { runScheduledSessionId } from '../../src/utils/scheduledSessionIds';
import type { RunWorkoutRecord } from '../../src/utils/runCompletionIdentity';
import { generateBeginnerPlan } from '../../src/utils/beginnerPlans';
import { buildMacroPlan } from '../../src/utils/plan/macroPlanner';
import { alignStoredBeginnerMacro } from '../../src/utils/plan/storedBeginnerMacro';

const DAY = 86400000;
const reference = new Date('2026-11-15T12:00:00').getTime();
function history(): CompletedWorkoutRecord[] {
  return Array.from({ length: 8 }, (_, week) => Array.from({ length: 3 }, (_, day) => ({
    id: `actual-${week}-${day}`, workoutId: 'actual', type: 'easy_run' as const, intensity: 'easy' as const,
    durationMinutes: 80, actualDurationMinutes: 80, estimatedLoad: 20, estimatedDistanceMiles: 8,
    timestamp: reference - (week * 7 + day + 1) * DAY, week: 10 - week, completed: true as const,
    fatigueBefore: 20, fatigueAfter: 30, fatigueDelta: 10, recoveryBefore: 80, recoveryDelta: -3, rpe: 3,
    ...(day === 0 && (week === 1 || week === 2) ? { runningQuality: { version: 1 as const, source: 'athlete_reported' as const, rung: 'intervals' as const,
      completedReps: 4, workSeconds: 180, rpe: 7, comfortableRecovery: true } } : {}),
  }))).flat();
}
function input(patch: Partial<EngineInput> = {}): EngineInput {
  return { referenceDate: '2026-11-15', goalRace: '5k', goalType: 'hybrid', goalScopeId: 'integration-goal', strengthProgrammingVersion: 2, trainingMode: 'structured',
    weeklyMileage: 25, fatigueScore: 25, recoveryScore: 80, currentWeek: 19, trainingPhase: 'vo2', progressionLevel: 'advanced',
    macroWeek: { weekNumber: 19, startDate: '2026-11-15', phase: 'vo2', isDeload: false, isTaper: false, isRaceWeek: false, focus: 'Aerobic power' },
    beforeStart: false, programStartDate: '2026-07-12', races: [], calibration: null, fatigueSensitivity: 1, recoveryResponsiveness: 1,
    returningFromInjury: false, availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], runDays: ['Tue', 'Thu', 'Sat'], liftDays: ['Mon'],
    trainingStyle: 'mixed', primaryGoal: '5k', hasCurrentInjury: false, strengthLevel: 'intermediate', strengthSessionMinutes: 30,
    strengthEquipment: ['bodyweight', 'dumbbell'], soreness: 1, motivation: 7, acwr: 1, recentIntensityDist: { easy: 8, moderate: 0, hard: 0 },
    recentHardSessions: 0, adherenceRate: 1, consistencyScore: 90, longRunConsistency: 1, completedWorkoutKeys: [], completedStrengthKeys: [],
    strengthHistory: [], runningHistory: history(), ...patch };
}
function scheduled(entry: CalendarEntry): ScheduledSession {
  return { scheduledSessionId: 'test', date: entry.date, originalDate: entry.date, activityType: entry.type, subtype: entry.session?.sessionType ?? entry.workout?.type ?? entry.type,
    title: entry.label, purpose: entry.session?.purpose ?? '', target: '', priority: 'supporting', durationMinutes: entry.session?.targetDuration ?? entry.workout?.durationMinutes ?? 0,
    status: 'upcoming', strengthSession: entry.session, richWorkout: entry.workout as RichWorkout | undefined };
}

test('eligible 4x4 survives the real new-goal hybrid generator when actual dates and volume leave room', () => {
  const week = buildWeekPlan(input({ strengthLevel: 'advanced' }));
  const sessions = [...week.calendarMap.values()].flat();
  assert.ok(sessions.some(entry => (entry.workout as RichWorkout | undefined)?.protocol === 'norwegian_4x4'));
  assert.ok(week.richWeek.workouts.some(workout => workout.protocol === 'norwegian_4x4'));
  assert.ok(week.calendarMap.size <= 6);
});

test('three-run hybrid availability reduces unstarted lower support beside quality instead of making every day hard', () => {
  const week = buildWeekPlan(input({ macroWeek: { ...input().macroWeek!, phase: 'build' }, runDays: ['Mon', 'Wed', 'Fri'], liftDays: ['Tue', 'Thu'] }));
  for (const date of ['2026-11-17', '2026-11-19']) {
    for (const entry of week.calendarMap.get(date) ?? []) {
      if (entry.type === 'strength') assert.equal(isHardLowerStrengthStress(scheduled(entry)), false);
    }
  }
  assert.ok(week.adaptations.some(note => /Lower-body work was reduced|supporting lift moved|shares a quality day/.test(note)));
});

test('seven available running days still leave a full generated rest day', () => {
  const all = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const week = buildWeekPlan(input({ availableDays: [...all], runDays: [...all], liftDays: ['Tue', 'Thu'] }));
  assert.ok(week.calendarMap.size <= 6, `occupied dates: ${week.calendarMap.size}`);
});

test('exact completed running links protect the next lift while a missed planned run is not treated as performed', () => {
  const args = input({ referenceDate: '2026-11-18', macroWeek: { ...input().macroWeek!, phase: 'build' }, runDays: ['Mon', 'Tue', 'Fri'], liftDays: ['Wed', 'Sat'] });
  const baseline = buildWeekPlan(args);
  const quality = baseline.calendarMap.get('2026-11-17')!.find(entry => entry.workout)!.workout as RichWorkout;
  assert.ok(baseline.calendarMap.get('2026-11-18')!.some(entry => entry.session && isHardLowerStrengthStress(scheduled(entry))));
  const completed: RunWorkoutRecord = { ...history()[0]!, id: 'completed-tuesday', timestamp: new Date('2026-11-17T12:00:00').getTime(),
    scheduledSessionId: runScheduledSessionId('2026-11-17', quality.id, quality.dayIndex), runningQuality: undefined, actualDurationMinutes: 35, rpe: 7 };
  const updated = buildWeekPlan({ ...args, runningHistory: [...history(), completed] });
  assert.ok(updated.calendarMap.get('2026-11-17')!.some(entry => entry.completed));
  assert.ok(updated.calendarMap.get('2026-11-18')!.every(entry => !entry.session || !isHardLowerStrengthStress(scheduled(entry))));
});

test('stored beginner sessions own the macro focus and never advertise unprescribed VO2 or threshold', () => {
  const stored = generateBeginnerPlan({ goal: 'couch_to_5k', startingLevel: 'walking', continuousWalkMinutes: 35,
    continuousRunMinutes: 0, recentConsistentWeeks: 4, availableDaysPerWeek: 4, hasCurrentSymptoms: false,
    crossTrainingExperience: false, startDate: '2026-01-04' }, 'running');
  const macro = buildMacroPlan({ programmingVersion: 2, goalType: 'general_running', startDate: stored.startDate, races: [],
    progressionLevel: 'advanced', yearsRunning: 3, weeklyMileage: 25 });
  const aligned = alignStoredBeginnerMacro(macro, stored);
  assert.equal(aligned.weeks.length, stored.weeks.length);
  assert.equal(aligned.totalWeeks, stored.durationWeeks);
  for (const prescribed of stored.weeks) {
    const projected = aligned.weeks[prescribed.weekNumber - 1]!;
    assert.equal(projected.focus, prescribed.focus);
    assert.equal(projected.isDeload, prescribed.isRecoveryWeek);
    assert.ok(!['threshold', 'vo2', 'race_specific'].includes(projected.phase));
  }
  const legacy = { ...macro, programmingVersion: undefined };
  assert.equal(alignStoredBeginnerMacro(legacy, stored), legacy);
});

test('strength-primary speed support changes an existing run slot while preserving the shared time and recovery budget', () => {
  const base = input({ goalType: 'general_strength', macroWeek: { weekNumber: 11, startDate: '2026-11-15', phase: 'threshold', isDeload: false, isTaper: false, isRaceWeek: false, focus: 'Strength priority' } });
  const ordinary = buildWeekPlan(base);
  const combined = buildWeekPlan({ ...base, secondaryGoalTypes: ['get_faster', 'general_running'] });
  const quality = (week: ReturnType<typeof buildWeekPlan>) => week.richWeek.workouts.filter(workout => !!workout.intervals);
  assert.equal(quality(ordinary).length, 0);
  assert.equal(quality(combined).length, 1, 'one existing run slot gets the earned speed stimulus');
  assert.ok(combined.richWeek.workouts.filter(workout => workout.durationMinutes > 0).length <= base.runDays!.length);
  assert.ok(combined.richWeek.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0)
    <= ordinary.richWeek.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0) + 0.1);
  const easyOnly = buildWeekPlan({ ...base, secondaryGoalTypes: ['get_faster'], trainingStyle: 'base_only' });
  assert.equal(quality(easyOnly).length, 0, 'explicit easy-only preference wins over supporting speed');
  assert.ok(JSON.stringify(easyOnly).includes('easy-only preference is active'));
  const regressed = buildWeekPlan({ ...base, secondaryGoalTypes: ['get_faster'], recoveryScore: 30, fatigueScore: 90 });
  assert.equal(quality(regressed).length, 0);
});


test('strength-primary speed support balances adjacent lower-body work without changing single-goal strength', () => {
  const base = input({ goalType: 'general_strength', runDays: ['Mon', 'Wed', 'Fri'], liftDays: ['Tue', 'Thu'],
    macroWeek: { ...input().macroWeek!, phase: 'threshold' } });
  const ordinary = buildWeekPlan(base);
  const emptySupporting = buildWeekPlan({ ...base, secondaryGoalTypes: [] });
  assert.deepEqual({ runs: emptySupporting.richWeek.workouts, strength: emptySupporting.strengthWeek.sessions, calendar: emptySupporting.calendarMap, notes: emptySupporting.adaptations },
    { runs: ordinary.richWeek.workouts, strength: ordinary.strengthWeek.sessions, calendar: ordinary.calendarMap, notes: ordinary.adaptations }, 'legacy single-goal strength prescriptions remain unchanged');
  const combined = buildWeekPlan({ ...base, secondaryGoalTypes: ['get_faster'] });
  const entries = [...combined.calendarMap.values()].flat();
  const qualityDates = entries.filter(entry => !!(entry.workout as RichWorkout | undefined)?.intervals).map(entry => entry.date);
  assert.equal(qualityDates.length, 1);
  for (const entry of entries.filter(entry => entry.session)) {
    if (qualityDates.some(date => Math.abs(new Date(date + 'T12:00:00').getTime() - new Date(entry.date + 'T12:00:00').getTime()) <= DAY)) {
      assert.equal(isHardLowerStrengthStress(scheduled(entry)), false, 'nearby lower work is reduced within existing days');
    }
  }
  assert.ok(combined.adaptations.some(note => /Lower-body work may be reduced/.test(note)));
  const regressed = buildWeekPlan({ ...base, secondaryGoalTypes: ['get_faster'], recoveryScore: 30, fatigueScore: 90 });
  assert.ok(regressed.richWeek.workouts.every(workout => !workout.intervals));
});
