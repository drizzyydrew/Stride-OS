import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifyExerciseStimulus, compatibleExerciseOptions, EXERCISE_ADAPTATION_OPTIONS, getExerciseAdjustment, remainingExerciseDoseEdits, supportsExerciseEquipment } from '../../src/utils/exerciseAdaptation';
import { STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import { MOBILITY_EXERCISES } from '../../src/constants/mobilityBank';
import { ensureSessionShape, substituteExercise, type ActiveStrengthSession } from '../../src/utils/strengthSession';
import { completedExercisesFromActiveSession, trainingBlockCompletionFromActiveSession } from '../../src/utils/strengthPersistence';

test('all known engine, preset, mobility, built-in and canonical inventory names have an explicit stimulus profile', () => {
  const inventory = JSON.parse(readFileSync('docs/exercise-library-inventory.json', 'utf8')) as { entries: { canonicalName: string }[] };
  const builtIns = [...readFileSync('src/store/exerciseStore.ts', 'utf8').matchAll(/\{ id: 'b_[^']+',\s+name:\s*'([^']+)'/g)].map(match => ({ name: match[1]! }));
  const exercises = [...Object.values(STRENGTH_EXERCISES), ...STRENGTH_PRESET_WORKOUTS.flatMap(workout => workout.exercises),
    ...MOBILITY_EXERCISES, ...builtIns, ...inventory.entries.map(item => ({ name: item.canonicalName })), ...EXERCISE_ADAPTATION_OPTIONS];
  for (const exercise of exercises) assert.ok(classifyExerciseStimulus(exercise), exercise.name);
  assert.equal(classifyExerciseStimulus({ name: 'My unfamiliar custom movement' }), null);
  assert.equal(getExerciseAdjustment({ exercise: { id: 'custom', name: 'My unfamiliar custom movement' }, reason: 'dislike' }).options.length, 0);
});

test('alternatives preserve movement, muscles and stimulus rather than muscle overlap alone', () => {
  const row = { id: 'row', name: 'Dumbbell Row' };
  const rowOptions = compatibleExerciseOptions(row, EXERCISE_ADAPTATION_OPTIONS);
  assert.ok(rowOptions.some(item => item.name === 'Resistance-Band Row'));
  assert.ok(!rowOptions.some(item => /pull-apart|face pull|pulldown/i.test(item.name)));
  const jump = compatibleExerciseOptions({ id: 'jump', name: 'Box Jump' }, EXERCISE_ADAPTATION_OPTIONS);
  assert.ok(jump.some(item => /jump squat/i.test(item.name)));
  assert.ok(!jump.some(item => item.name === 'Goblet Squat'));
  assert.equal(classifyExerciseStimulus({ name: 'Lunge with Rotation' })?.stimulus, 'mobility');
  assert.equal(classifyExerciseStimulus({ name: 'Dumbbell Floor Press' })?.family, 'horizontal_push');
  assert.notEqual(classifyExerciseStimulus({ name: 'Standing Calf Raise' })?.family, classifyExerciseStimulus({ name: 'Seated Calf Raise' })?.family);
  assert.notEqual(classifyExerciseStimulus({ name: 'Nordic Curl' })?.family, classifyExerciseStimulus({ name: 'Romanian Deadlift' })?.family);
});

test('a power-sounding movement does not imply a power stimulus in a high-repetition or timed circuit', () => {
  assert.equal(classifyExerciseStimulus({ name: 'Kettlebell Swing', repScheme: { kind: 'reps', repsMin: 15, repsMax: 20 } })?.stimulus, 'capacity');
  assert.equal(classifyExerciseStimulus({ name: 'Thruster', repScheme: { kind: 'duration', secondsMin: 60 } })?.stimulus, 'capacity');
  assert.equal(classifyExerciseStimulus({ name: 'Kettlebell Swing', repScheme: { kind: 'reps', repsMin: 3, repsMax: 5 } })?.stimulus, 'power');
  assert.equal(compatibleExerciseOptions({ id: 'swing', name: 'Kettlebell Swing', stimulus: 'capacity' }, EXERCISE_ADAPTATION_OPTIONS).length, 0);
});

test('equipment requirements include setup and malformed availability fails closed', () => {
  assert.equal(supportsExerciseEquipment(['bodyweight', 'bench'], ['bodyweight']), false);
  assert.equal(supportsExerciseEquipment(['band', 'secure_anchor'], ['band']), false);
  assert.equal(supportsExerciseEquipment(['band', 'secure_anchor'], ['resistance_band', 'secure_anchor']), true);
  assert.equal(supportsExerciseEquipment(['dumbbell'], 'dumbbell' as never), false);
  const options = compatibleExerciseOptions({ id: 'row', name: 'Dumbbell Row' }, EXERCISE_ADAPTATION_OPTIONS, { availableEquipment: ['bodyweight'] });
  assert.equal(options.length, 0);
});

test('easy/hard targets affect only unperformed working sets and never invent load or actual effort', () => {
  const exercise = { setEntries: [
    { id: 'done', completed: true, reps: 8 }, { id: 'warmup', completed: false, isWarmup: true, reps: 8 },
    { id: 'pending', completed: false, reps: 8 }, { id: 'unknown', completed: false },
  ] };
  assert.deepEqual(remainingExerciseDoseEdits(exercise, 'too_easy'), [{ id: 'pending', patch: { reps: 9 } }]);
  assert.deepEqual(remainingExerciseDoseEdits(exercise, 'too_hard'), [{ id: 'pending', patch: { reps: 6 } }]);
  assert.equal(exercise.setEntries[0]!.reps, 8);
  for (const value of [0.01, 0.5, 1, 2, 3, 4, 30]) {
    const [hold] = remainingExerciseDoseEdits({ setEntries: [{ id: 'h', completed: false, holdSeconds: value }] }, 'too_hard');
    const [distance] = remainingExerciseDoseEdits({ setEntries: [{ id: 'd', completed: false, distanceMeters: value }] }, 'too_hard');
    assert.ok(hold!.patch.holdSeconds! <= value);
    assert.ok(distance!.patch.distanceMeters! <= value);
  }
});

function session(): ActiveStrengthSession {
  return ensureSessionShape({ workoutId: 'strength', workoutName: 'Test', plannedDurationMin: 30,
    startedAt: 1, pausedAt: null, pausedDurationMs: 0, status: 'active', workoutInstanceId: 'instance',
    currentExerciseIndex: 0, completedExerciseIds: [], loadByExercise: {}, rpeByExercise: {},
    exercises: [{ id: 'row', name: 'Dumbbell Row', sets: 3, reps: '8–12', equipment: ['dumbbell'], plannedRpe: 7,
      plannedRestSeconds: 90, plannedLoadTarget: 'Choose own setup load', repScheme: { kind: 'reps', repsMin: 8, repsMax: 12 } }] });
}

test('a replacement preserves captured prescription, has stable own identity, and never transfers load or RPE', () => {
  const original = session();
  original.loadByExercise.row = '50 lb'; original.rpeByExercise.row = 8;
  const replaced = substituteExercise(original, 'row', { canonicalExerciseId: 'pull_band_row', name: 'Resistance-Band Row', equipment: ['band'], plannedSets: 3, plannedReps: '8–12' });
  const variant = replaced.exercises[0]!;
  assert.equal(variant.canonicalExerciseId, 'pull_band_row');
  assert.equal(variant.setEntries.length, 3);
  assert.equal(variant.substitutedFromPrescription?.sets, 3);
  assert.equal(variant.substitutedFromPrescription?.targetRpe, 7);
  assert.equal(replaced.loadByExercise[variant.id], undefined);
  assert.equal(replaced.rpeByExercise[variant.id], undefined);
  assert.ok(variant.setEntries.every(set => set.weight === undefined && set.rpe === undefined && !set.completed));
  const saved = completedExercisesFromActiveSession(replaced.exercises, 'training_block');
  assert.equal(saved[0]!.exerciseId, 'pull_band_row');
  assert.equal(saved[0]!.substitutedFromPrescription?.name, 'Dumbbell Row');
});

test('partial substitution retains performed sets and inserts only remaining work with honest completion classification', () => {
  const original = session();
  original.exercises[0]!.setEntries[0] = { ...original.exercises[0]!.setEntries[0]!, completed: true, reps: 8, weight: 50, weightUnit: 'lb', rpe: 7 };
  const replaced = substituteExercise(original, 'row', { canonicalExerciseId: 'pull_band_row', name: 'Resistance-Band Row', equipment: ['band'], plannedSets: 3, plannedReps: '8–12' });
  assert.equal(replaced.exercises.length, 2);
  assert.equal(replaced.exercises[0]!.sets, 3);
  assert.deepEqual(replaced.exercises[0]!.setEntries, [original.exercises[0]!.setEntries[0]]);
  assert.equal(replaced.exercises[1]!.setEntries.length, 2);
  assert.ok(!replaced.exercises[0]!.skipped);
  replaced.exercises[1]!.setEntries.forEach(set => { set.completed = true; });
  const completion = trainingBlockCompletionFromActiveSession({ ...replaced, source: 'training_block' } as never, 600);
  assert.equal(completion.completionClassification, 'modified');
  assert.equal(completion.exercises[0]!.sets[0]!.weight, 50);
  const completed = { ...original, completedExerciseIds: ['row'] };
  assert.equal(substituteExercise(completed, 'row', { name: 'Resistance-Band Row' }), completed);
});

test('presets fit their purpose and keep independent target effort rather than impute actual RPE', () => {
  for (const workout of STRENGTH_PRESET_WORKOUTS) {
    assert.ok(workout.planningNote);
    assert.ok(workout.exercises.every(exercise => Number.isFinite(exercise.targetRpe) && Number.isFinite(exercise.restSeconds)));
    if (workout.trainingPurpose === 'running_support' || /beginner/i.test(workout.title)) assert.ok(workout.exercises.every(exercise => exercise.sets <= 2));
    if (workout.trainingPurpose === 'activation' || workout.trainingPurpose === 'recovery') assert.ok(workout.exercises.every(exercise => exercise.targetRpe! <= 3));
  }
  const power = STRENGTH_PRESET_WORKOUTS.find(item => item.id === 'sw_barbell_total_body_power')!;
  assert.ok(power.exercises.find(item => item.name === 'Push Press')!.reps.includes('3-5'));
  assert.ok(power.exercises.every(item => item.restSeconds! >= 120));
});
