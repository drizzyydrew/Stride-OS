import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupportingGoals, validateSupportingGoals, trainingGoalBlend } from '../../src/utils/trainingGoals';
import { buildMacroPlan } from '../../src/utils/plan/macroPlanner';
import { generateStrengthWeek, STRENGTH_EXERCISES, SESSION_TEMPLATES } from '../../src/utils/strengthEngine';
import { estimateStrengthSessionMinutes } from '../../src/utils/strengthDesign';
import { MOBILITY_EXERCISES, MOBILITY_WORKOUTS } from '../../src/constants/mobilityBank';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import type { TrainingGoalType } from '../../src/types/plan';
import type { StrengthEngineInput } from '../../src/types/strength';

const macro = { goalType: 'general_strength' as const, startDate: '2026-01-04', races: [], progressionLevel: 'intermediate' as const,
  yearsRunning: 3, weeklyMileage: 20, programmingVersion: 2 as const };

test('goal preferences enforce one primary plus two unique supported emphases', () => {
  assert.deepEqual(normalizeSupportingGoals('get_faster', ['get_faster', 'bogus', 'hybrid', 'general_strength', 'general_running']), ['hybrid', 'general_strength']);
  for (const value of [['get_faster'], ['hybrid', 'hybrid'], ['hybrid', 'general_strength', 'general_running'], ['race_prep'], 'hybrid']) {
    assert.throws(() => validateSupportingGoals('get_faster', value), /up to two/);
  }
  assert.deepEqual(validateSupportingGoals('race_prep', ['get_faster', 'general_strength']), ['get_faster', 'general_strength']);
  assert.equal(trainingGoalBlend('race_prep', ['get_faster', 'general_strength']).runningGoal, 'race_prep');
});

test('explicit speed support changes strength-primary phases without adding a second plan or VO2 peak', () => {
  const original = buildMacroPlan(macro);
  const blended = buildMacroPlan({ ...macro, secondaryGoalTypes: ['get_faster'] });
  assert.equal(blended.goalType, 'general_strength');
  assert.equal(blended.totalWeeks, original.totalWeeks);
  assert.ok(blended.weeks.some(week => week.phase === 'threshold'));
  assert.ok(!original.weeks.some(week => week.phase === 'threshold'));
  assert.ok(!blended.weeks.some(week => week.phase === 'vo2' || week.phase === 'peak'));
  assert.ok(blended.weeks.filter(week => week.isDeload).every(week => original.weeks[week.weekNumber - 1]?.isDeload));
  const legacy = buildMacroPlan({ ...macro, programmingVersion: 1, secondaryGoalTypes: ['get_faster'] });
  const legacyOriginal = buildMacroPlan({ ...macro, programmingVersion: 1 });
  assert.deepEqual(legacy.weeks, legacyOriginal.weeks);
});

test('race-primary extra goals preserve its event-specific phases and taper dates', () => {
  const input = { ...macro, goalType: 'race_prep' as const, races: [{ id: 'race', name: 'Goal 5K', date: '2026-05-17', distance: '5k' as const, priority: 'A' as const }] };
  const primary = buildMacroPlan(input);
  const combined = buildMacroPlan({ ...input, secondaryGoalTypes: ['get_faster', 'general_strength'] });
  assert.deepEqual(combined.weeks.map(w => [w.phase, w.startDate, w.isRaceWeek, w.raceId]), primary.weeks.map(w => [w.phase, w.startDate, w.isRaceWeek, w.raceId]));
});

test('all five goals and supported combinations retain bounded strength doses across phases and levels', () => {
  for (const goalType of ['general_running', 'general_strength', 'get_faster', 'hybrid', 'race_prep'] as TrainingGoalType[]) {
    for (const phase of ['foundation', 'base', 'aerobic_development', 'threshold', 'vo2', 'race_specific', 'build', 'peak', 'deload', 'taper', 'transition', 'recovery'] as const) {
      for (const strengthLevel of ['beginner', 'intermediate', 'advanced'] as const) {
        const input: StrengthEngineInput = { programmingVersion: 2, goalScopeId: 'review', goalType,
          secondaryGoalTypes: normalizeSupportingGoals(goalType, ['get_faster', 'general_strength']),
          strengthLevel, progressionLevel: 'advanced', trainingPhase: phase, currentWeek: 11, weeklyMileage: 15,
          fatigueScore: 25, recoveryScore: 80, soreness: 1, injuryRisk: false, acwr: 1, weeksToRace: phase === 'taper' ? 1 : 10,
          availableTimeMin: 30, availableEquipment: ['bodyweight', 'dumbbell'], liftDays: ['Tue', 'Thu'], strengthHistory: [], hybridBalance: true };
        const week = generateStrengthWeek(input);
        assert.ok(week.sessions.length <= 2);
        assert.ok(week.sessions.every(session => estimateStrengthSessionMinutes(session.exercises) <= 30));
        assert.ok(week.sessions.every(session => session.exercises.every(ex => ex.rpe <= 8 && ex.sets > 0)));
        const regressed = generateStrengthWeek({ ...input, injuryRisk: true, recoveryScore: 30, soreness: 8 });
        assert.ok(regressed.sessions.every(session => session.exercises.every(ex => ex.exercise.pattern !== 'plyometric')));
      }
    }
  }
});

test('all preset and mobility rows have usable prescriptions, references and safety guidance', () => {
  assert.equal(STRENGTH_PRESET_WORKOUTS.length, 50);
  assert.equal(MOBILITY_WORKOUTS.length, 50);
  assert.equal(MOBILITY_EXERCISES.length, 24);
  for (const workout of STRENGTH_PRESET_WORKOUTS) {
    for (const ex of workout.exercises) assert.ok(ex.sets > 0 && ex.repScheme && ex.targetRpe! <= 8 && ex.restSeconds! > 0, `${workout.id}:${ex.name}`);
  }
  for (const workout of MOBILITY_WORKOUTS) {
    for (const item of workout.exercises) assert.ok(MOBILITY_EXERCISES.some(ex => ex.id === item.exerciseId), `${workout.id}:${item.exerciseId}`);
  }
  for (const ex of MOBILITY_EXERCISES) assert.ok(ex.howTo.length && ex.whenToStopOrModify && ex.dose);
  const ankle = MOBILITY_EXERCISES.find(ex => ex.id === 'knee_to_wall_ankle_mobilization')!;
  assert.match(ankle.howTo.join(' '), /closer to the wall or reduce/);
  assert.doesNotMatch(ankle.howTo.join(' '), /heel lifts.*step the foot back/);
});


test('all five generated strength templates resolve actual exercise definitions and use adjustable setup cues', () => {
  assert.equal(Object.keys(SESSION_TEMPLATES).length, 5);
  assert.equal(Object.keys(STRENGTH_EXERCISES).length, 42);
  for (const template of Object.values(SESSION_TEMPLATES)) {
    for (const id of template.exerciseIds) assert.ok(STRENGTH_EXERCISES[id], `${template.title}:${id}`);
  }
  for (const id of ['squat_goblet', 'squat_bulgarian', 'lunge_reverse']) {
    assert.doesNotMatch(STRENGTH_EXERCISES[id]!.coachingCues.join(' '), /shin vertical|crease of hip below knee/);
  }
});
