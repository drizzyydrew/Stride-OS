import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrengthLogRecord, CompletedExercise } from '../../src/types/strength';
import { summarizeExerciseVolume } from '../../src/utils/exerciseVolume';

const now = new Date(2026, 10, 20, 12).getTime();
function log(exercises: CompletedExercise[], patch: Partial<StrengthLogRecord> = {}): StrengthLogRecord {
  return { id: 'real-completion-fixture', sessionId: 'same-scheduled-slot', timestamp: now - 1000,
    completed: true, exercises, ...patch } as StrengthLogRecord;
}
const squat = (): CompletedExercise => ({ exerciseId: 'b_back_squat', name: 'Back Squat',
  sets: [{ id: 'unique-squat-set', reps: 6, weight: 100, weightUnit: 'lb', completed: true },
    { id: 'warmup', reps: 6, completed: true, isWarmup: true }, { id: 'target-only', reps: 6, completed: false }] });

test('weekly volume uses completed working sets and separates supporting muscles without inventing hamstring squat sets', () => {
  const result = summarizeExerciseVolume([log([squat()])], now);
  assert.equal(result.muscles.quads?.directSets, 1);
  assert.equal(result.muscles.glutes?.directSets, 1);
  assert.equal(result.muscles.core?.supportingSets, 1);
  assert.equal(result.muscles.hamstrings?.directSets ?? 0, 0);
});

test('an incomplete runtime record and a repeated explicit set ID cannot inflate weekly work', () => {
  const incomplete = log([squat()], { completed: false } as unknown as Partial<StrengthLogRecord>);
  assert.deepEqual(summarizeExerciseVolume([incomplete], now).muscles, {});
  const result = summarizeExerciseVolume([log([squat(), squat()])], now);
  assert.equal(result.muscles.quads?.directSets, 1);
});

test('unknown movements remain unclassified; power practice is not reported as direct strength sets', () => {
  const result = summarizeExerciseVolume([log([
    { exerciseId: 'athlete-custom', name: 'My own movement', sets: [{ id: 'own-set', reps: 8, completed: true }] },
    { exerciseId: 'plyo_low_pogo', name: 'Low Pogo Hops', sets: [{ id: 'practice-set', reps: 5, completed: true }] },
  ])], now);
  assert.equal(result.unclassifiedSets, 1);
  assert.equal(result.muscles.calves?.directSets ?? 0, 0);
  assert.equal(result.muscles.calves?.practiceSets, 1);
});

test('different actual sessions sharing a scheduled slot are retained while duplicate completion IDs are not', () => {
  const a = log([squat()]);
  const b = log([{ ...squat(), sets: [{ id: 'second-real-set', reps: 6, completed: true }] }], { id: 'another-actual-completion' });
  const result = summarizeExerciseVolume([a, a, b], now);
  assert.equal(result.muscles.quads?.directSets, 2);
});
