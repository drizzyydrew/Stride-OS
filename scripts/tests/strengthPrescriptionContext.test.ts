import assert from 'node:assert/strict';
import test from 'node:test';
import type { CompletedExercise, RepScheme, StrengthLogRecord } from '../../src/types/strength';
import { getLastLoggedExercise, strengthPrescriptionsMatch, suggestProgression } from '../../src/utils/strengthHistory';

const prescription = (repScheme: RepScheme): NonNullable<CompletedExercise['prescription']> => ({
  sets: 2, reps: '6–10', repScheme, targetRpe: 7, restSeconds: 120,
});
const plain: RepScheme = { kind: 'reps', repsMin: 6, repsMax: 10 };
const context = { repsMin: 6, repsMax: 10, targetRpe: 7, repScheme: plain };

test('an unchanged plain-repetition target retains its reference while unknown targets require calibration', () => {
  const prior = prescription(plain);
  assert.equal(strengthPrescriptionsMatch(prior, context), true);
  assert.equal(strengthPrescriptionsMatch(prior, { repsMin: 6, repsMax: 10, targetRpe: 7 }), true);
  assert.equal(strengthPrescriptionsMatch(undefined, context), false);
  assert.equal(strengthPrescriptionsMatch({ ...prior, targetRpe: undefined }, context), false);
  assert.equal(strengthPrescriptionsMatch(prior, { ...context, targetRpe: NaN }), false);
  assert.equal(strengthPrescriptionsMatch(prior, { ...context, targetRpe: 8 }), false);
});

test('tempo and ordinary repetitions never exchange weight references merely because rep bounds match', () => {
  const tempo: RepScheme = { ...plain, kind: 'reps_tempo', repsMin: 6, tempo: '3:1:1' };
  assert.equal(strengthPrescriptionsMatch(prescription(tempo), context), false);
  assert.equal(strengthPrescriptionsMatch(prescription(plain), { ...context, repScheme: tempo }), false);
  assert.equal(strengthPrescriptionsMatch(prescription(tempo), { ...context, repScheme: tempo }), true);
  assert.equal(strengthPrescriptionsMatch(prescription(tempo), {
    ...context, repScheme: { ...tempo, tempo: '2:0:1' },
  }), false);
});

test('per-side targets require the same counting convention, including historic omitted false', () => {
  const perSide: RepScheme = { ...plain, perSide: true };
  assert.equal(strengthPrescriptionsMatch(prescription(perSide), context), false);
  assert.equal(strengthPrescriptionsMatch(prescription(plain), { ...context, repScheme: perSide }), false);
  assert.equal(strengthPrescriptionsMatch(prescription(perSide), { ...context, repScheme: perSide }), true);
  assert.equal(strengthPrescriptionsMatch(prescription(plain), { ...context, repScheme: { ...plain, perSide: false } }), true);
});

test('timed, distance and hold tasks cannot become ordinary repetition-based load comparisons', () => {
  const otherSchemes: RepScheme[] = [
    { kind: 'duration', secondsMin: 30 },
    { kind: 'distance', metersMin: 20 },
    { kind: 'reps_hold', repsMin: 6, repsMax: 10, holdSeconds: 3 },
  ];
  for (const scheme of otherSchemes) assert.equal(strengthPrescriptionsMatch(prescription(scheme), context), false);
});

function record(id: string, timestamp: number): StrengthLogRecord {
  return {
    id, sessionId: id, sessionType: 'full_body', goal: 'force_production', week: 1, timestamp,
    completed: true, source: 'generated', plannedDuration: 30, estimatedLoad: 20,
    fatigueBefore: 20, fatigueAfter: 25, fatigueDelta: 5,
    exercises: [{ exerciseId: 'squat_goblet', equipmentType: 'dumbbell', prescription: prescription(plain),
      sets: [1, 2].map(() => ({ completed: true, reps: 10, weight: 20, weightUnit: 'lb' as const, rpe: 7 })) }],
  };
}

test('a nonfinite attempt timestamp fails closed instead of exposing older favorable work', () => {
  const valid = record('valid-earlier', Date.now() - 86400000);
  for (const timestamp of [NaN, Infinity, -Infinity]) {
    const invalid = record('invalid-latest-attempt', timestamp);
    for (const records of [[valid, invalid], [invalid, valid]]) {
      const before = structuredClone(records);
      const last = getLastLoggedExercise(records, 'squat_goblet', 'lb', 'dumbbell');
      assert.ok(last);
      assert.equal(Number.isFinite(last.timestamp), false);
      const suggestion = suggestProgression(last, 2, false, 'lb', 10, 'dumbbell', context);
      assert.match(suggestion!.headline, /recalibrate/i);
      assert.doesNotMatch(suggestion!.headline, /increase|try\s+\d/i);
      assert.deepEqual(records, before);
    }
  }
});

test('a changed tempo yields calibration advice even after otherwise successful working sets', () => {
  const prior = record('prior-tempo', Date.now() - 86400000);
  prior.exercises[0]!.prescription = prescription({ kind: 'reps_tempo', repsMin: 6, repsMax: 10, tempo: '3:1:1' });
  const last = getLastLoggedExercise([prior], 'squat_goblet', 'lb', 'dumbbell');
  assert.equal(last?.comparableWorkingSets, true);
  const suggestion = suggestProgression(last, 2, false, 'lb', 10, 'dumbbell', context);
  assert.match(suggestion!.headline, /calibrate/i);
  assert.doesNotMatch(suggestion!.headline, /increase|try\s+\d/i);
});
