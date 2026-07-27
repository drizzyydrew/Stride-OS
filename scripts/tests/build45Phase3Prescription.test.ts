import assert from 'node:assert/strict';
import test from 'node:test';

import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import { evaluateContinuousRunEligibility, recommendBeginnerPlanDuration } from '../../src/utils/beginnerPlans';
import { parsePrescriptionScheme, formatPrescription, formatPrescriptionWithSets } from '../../src/utils/prescriptionFormat';
import { SESSION_TEMPLATES, generateStrengthWeek } from '../../src/utils/strengthEngine';
import { synthesizeSetEntries } from '../../src/utils/strengthSession';
import { summarizeStrengthSession } from '../../src/utils/strengthSummary';
import type { BeginnerPlanReadinessInput } from '../../src/types/beginnerPlan';
import type { StrengthEngineInput } from '../../src/types/strength';

test('RepScheme formatting handles duration, distance, tempo, and reps plus hold without rendering fake reps', () => {
  assert.equal(formatPrescriptionWithSets(3, { kind: 'duration', secondsMin: 30 }), '3 × 30s');
  assert.equal(formatPrescriptionWithSets(3, { kind: 'distance', metersMin: 30, metersMax: 40 }), '3 × 30 m–40 m');
  assert.equal(formatPrescription({ kind: 'reps_tempo', repsMin: 6, repsMax: 8, tempo: '3:1:1' }), '6–8 reps @ 3:1:1');
  assert.equal(formatPrescription({ kind: 'reps_hold', repsMin: 10, repsMax: 12, holdSeconds: 2, perSide: true }), '10–12 reps + 2s hold per side');
});

test('prescription parser annotates planks, carries, tempo reps, and AMRAP fallback', () => {
  assert.equal(parsePrescriptionScheme('30-45s', { exerciseName: 'Plank' })?.kind, 'duration');
  assert.equal(parsePrescriptionScheme('30-40m', { exerciseName: 'Farmer Carry' })?.kind, 'distance');
  assert.equal(parsePrescriptionScheme('8-10', { exerciseName: 'Tempo Squat', tempo: '3:1:1' })?.kind, 'reps_tempo');
  assert.deepEqual(parsePrescriptionScheme('AMRAP'), { kind: 'reps', label: 'AMRAP', perSide: false });
});

test('active set synthesis consumes every RepScheme kind without inventing reps for holds or carries', () => {
  const plank = synthesizeSetEntries(2, '30s', { kind: 'duration', secondsMin: 30 });
  assert.equal(plank[0]?.reps, undefined);
  assert.equal(plank[0]?.holdSeconds, 30);
  const carry = synthesizeSetEntries(2, '30m', { kind: 'distance', metersMin: 30 });
  assert.equal(carry[0]?.reps, undefined);
  assert.equal(carry[0]?.distanceMeters, 30);
  const calf = synthesizeSetEntries(2, '10-12', { kind: 'reps_hold', repsMin: 10, repsMax: 12, holdSeconds: 2 });
  assert.equal(calf[0]?.reps, 10);
  assert.equal(calf[0]?.holdSeconds, undefined);
  const tempo = synthesizeSetEntries(2, '6-8', { kind: 'reps_tempo', repsMin: 6, repsMax: 8, tempo: '3:1:1' });
  assert.equal(tempo[0]?.reps, 6);
});

test('strength summary keeps carry distance separate from reps, holds, and external load', () => {
  const summary = summarizeStrengthSession({
    durationSeconds: 1800,
    exercises: [{
      id: 'carry',
      name: 'Farmer Carry',
      equipmentType: 'dumbbell',
      setEntries: [
        { id: 'a', distanceMeters: 30, completed: true },
        { id: 'b', distanceMeters: 40, completed: true },
      ],
    }],
  });
  assert.equal(summary.totalDistanceMeters, 70);
  assert.equal(summary.totalReps, 0);
  assert.equal(summary.hasExternalLoadVolume, false);
});

test('session templates and preset bank annotate isometric and carry prescriptions with non-reps schemes', () => {
  const templateValues = Object.values(SESSION_TEMPLATES);
  assert.ok(templateValues.some(template => template.repSchemes?.trunk_side_plank?.kind === 'duration'));
  assert.ok(templateValues.some(template => template.repSchemes?.trunk_copenhagen?.kind === 'duration'));
  assert.ok(templateValues.some(template => template.repSchemes?.calf_single_standing?.kind === 'reps_hold'));

  const bankExercises = STRENGTH_PRESET_WORKOUTS.flatMap(workout => workout.exercises);
  const isometricOrCarry = bankExercises.filter(exercise => /plank|carry/i.test(exercise.name));
  assert.ok(isometricOrCarry.length > 0);
  for (const exercise of isometricOrCarry) {
    assert.notEqual(exercise.repScheme?.kind, 'reps', `${exercise.name} should not be plain reps`);
  }
});

function strengthInput(overrides: Partial<StrengthEngineInput> = {}): StrengthEngineInput {
  return {
    trainingPhase: 'build',
    progressionLevel: 'advanced',
    weeklyMileage: 25,
    currentWeek: 5,
    fatigueScore: 30,
    recoveryScore: 80,
    soreness: null,
    injuryRisk: false,
    acwr: 1,
    weeksToRace: 12,
    availableTimeMin: 60,
    strengthHistory: [],
    ...overrides,
  };
}

test('generated strength weeks carry RepScheme through planned exercises', () => {
  const week = generateStrengthWeek(strengthInput({ trainingPhase: 'foundation', progressionLevel: 'beginner' }));
  const schemes = week.sessions.flatMap(session => session.exercises.map(exercise => exercise.repScheme?.kind));
  assert.ok(schemes.includes('duration') || schemes.includes('reps_hold'));
});

function beginnerInput(overrides: Partial<BeginnerPlanReadinessInput> = {}): BeginnerPlanReadinessInput {
  return {
    goal: 'couch_to_half_marathon',
    startingLevel: 'running',
    continuousWalkMinutes: 35,
    continuousRunMinutes: 30,
    continuousRunDistanceMeters: 3200,
    recentConsistentWeeks: 8,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    crossTrainingExperience: false,
    startDate: '2026-08-02',
    completionGoal: 'run_continuously',
    ...overrides,
  };
}

test('continuous 5K eligibility gate recommends alternatives below 5K and allows 5K or farther', () => {
  const below = evaluateContinuousRunEligibility(beginnerInput({ continuousRunDistanceMeters: 3200 }));
  assert.equal(below.eligible, false);
  assert.ok(below.alternatives.some(option => /Couch to 5K/i.test(option)));
  const allowed = evaluateContinuousRunEligibility(beginnerInput({ continuousRunDistanceMeters: 5000 }));
  assert.equal(allowed.eligible, true);
  const completeDistance = evaluateContinuousRunEligibility(beginnerInput({ completionGoal: 'complete_distance', continuousRunDistanceMeters: 0 }));
  assert.equal(completeDistance.eligible, true);
});

test('continuous-run readiness affects recommendation copy without blocking plan recommendation', () => {
  const recommendation = recommendBeginnerPlanDuration(beginnerInput({ continuousRunDistanceMeters: 1609 }));
  assert.equal(recommendation.continuousRunEligibility?.eligible, false);
  assert.ok(recommendation.reasoning.some(reason => /continuous 5K/i.test(reason)));
  assert.ok(recommendation.recommendedWeeks >= recommendation.minimumSupportedWeeks);
});
