import assert from 'node:assert/strict';
import test from 'node:test';
import { getStrengthPresetWorkout, STRENGTH_PRESET_PRIORITY_MAINS, STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import {
  buildStrengthPresetContext, estimateStrengthPresetMinutes, resolveStrengthPresetWorkout,
  strengthPresetLaunchInput, type StrengthPresetContext,
} from '../../src/utils/strengthPresetProgramming';

const ready: StrengthPresetContext = { strengthLevel: 'intermediate', fatigueScore: 25, recoveryScore: 80,
  soreness: 2, trainingPhase: 'base', availableTimeMin: 60, goalType: 'general_running' };
const fullBody = () => getStrengthPresetWorkout('sw_barbell_full_body_strength_a')!;

test('practiced-lifter preset resolves priority mains, not a universal heavy prescription', () => {
  const before = JSON.stringify(fullBody());
  const result = resolveStrengthPresetWorkout(fullBody(), ready);
  assert.equal(result.canStart, true);
  assert.equal(result.recommended, true);
  assert.deepEqual(result.workout.exercises.slice(0, 2).map(ex => [ex.sets, ex.reps, ex.targetRpe, ex.restSeconds]),
    [[3, '3-5', 8, 180], [3, '3-5', 8, 180]]);
  assert.deepEqual(result.workout.exercises.slice(2).map(ex => [ex.name, ex.sets, ex.reps, ex.targetRpe, ex.restSeconds]),
    [['Bent-Over Row', 3, '8-10', 7, 90], ['Plank', 3, '30-45s', 7, 90]]);
  assert.ok(result.workout.durationMin >= estimateStrengthPresetMinutes(result.workout));
  assert.equal(JSON.stringify(fullBody()), before);
  assert.match(result.workout.exercises[0]!.notes!, /calibrate.*exercise and setup/i);
});

test('unknown or novice lifting experience cannot launch the heavy form, regardless of running goals', () => {
  for (const strengthLevel of [undefined, 'none', 'beginner'] as const) {
    const resolved = resolveStrengthPresetWorkout(fullBody(), { ...ready, strengthLevel, goalType: 'get_faster' });
    assert.equal(resolved.canStart, false);
    assert.equal(resolved.recommended, false);
    assert.equal(strengthPresetLaunchInput(resolved), null);
    assert.equal(resolved.alternativeWorkoutId, 'sw_barbell_beginner_full_body');
    const alternative = getStrengthPresetWorkout(resolved.alternativeWorkoutId!)!;
    assert.ok(alternative.equipment.every(item => item === 'bodyweight' || fullBody().equipment.includes(item)));
    assert.ok(alternative.exercises.every(ex => (ex.targetRpe ?? 0) <= 6));
  }
});

test('limited, invalid or unavailable recovery blocks heavy selection without changing other purposes', () => {
  const cases: Partial<StrengthPresetContext>[] = [
    { recoveryLimited: true }, { fatigueScore: 71 }, { recoveryScore: 64 }, { soreness: 7 },
    { fatigueScore: undefined }, { recoveryScore: NaN }, { fatigueScore: Infinity }, { recoveryScore: 101 },
    { fatigueScore: -1 }, { soreness: NaN }, { soreness: 11 },
    ...(['foundation', 'deload', 'recovery', 'transition', 'taper'] as const).map(trainingPhase => ({ trainingPhase })),
    { goalType: 'race_prep', trainingPhase: 'race_specific' },
    { goalType: 'race_prep', trainingPhase: 'threshold' },
  ];
  for (const patch of cases) {
    const result = resolveStrengthPresetWorkout(fullBody(), { ...ready, ...patch });
    assert.equal(result.canStart, false, JSON.stringify(patch));
    assert.equal(strengthPresetLaunchInput(result), null);
  }
  assert.equal(resolveStrengthPresetWorkout(fullBody(), { ...ready, trainingPhase: undefined }).canStart, true,
    'a practiced lifter can explicitly choose a preset outside a structured plan');
});

test('time guard uses the resolved full-rest duration and supplies a fitting lighter alternative', () => {
  const displayed = resolveStrengthPresetWorkout(fullBody(), ready).workout.durationMin;
  const short = resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: 30 });
  assert.equal(short.canStart, false);
  assert.match(short.reason!, new RegExp(String(displayed)));
  assert.equal(short.alternativeWorkoutId, 'sw_bodyweight_beginner_full_body');
  assert.ok(getStrengthPresetWorkout(short.alternativeWorkoutId!)!.durationMin <= 30);
  for (const availableTimeMin of [0, -10, NaN, Infinity]) {
    assert.equal(resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin }).canStart, false);
  }
  assert.equal(resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: displayed }).canStart, true);
  assert.equal(resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: 10 }).alternativeWorkoutId, undefined);
});

test('explicit allowlist preserves Classic 5x5 and beginner, running, power and recovery prescriptions', () => {
  const protectedIds = ['sw_barbell_strength_5x5', 'sw_barbell_beginner_full_body', 'sw_barbell_runner_strength_gym',
    'sw_band_activation_pre_run', 'sw_post_run_recovery_bodyweight'];
  for (const id of protectedIds) {
    const original = getStrengthPresetWorkout(id)!;
    assert.ok(!STRENGTH_PRESET_PRIORITY_MAINS[id]);
    assert.equal(resolveStrengthPresetWorkout(original, { strengthLevel: 'beginner', recoveryLimited: true }).workout, original);
  }
  const classic = getStrengthPresetWorkout('sw_barbell_strength_5x5')!;
  assert.ok(classic.exercises.every(ex => ex.sets === 5 && ex.reps === '5'));
  assert.ok(classic.exercises.every(ex => ex.targetRpe === 7));
  for (const [id, mains] of Object.entries(STRENGTH_PRESET_PRIORITY_MAINS)) {
    const workout = getStrengthPresetWorkout(id)!;
    assert.equal(workout.trainingPurpose, 'strength');
    assert.ok(mains.length <= 2 && mains.every(name => workout.exercises.some(ex => ex.name === name)));
  }
});

test('optional fourth and fifth main sets change the displayed and launched dose and full-rest time only', () => {
  const original = JSON.stringify(fullBody());
  const three = resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: 120 });
  const durations = [three.workout.durationMin];
  for (const mainSets of [4, 5] as const) {
    const resolution = resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: 120, mainSets });
    assert.equal(resolution.canStart, true);
    assert.deepEqual(resolution.workout.exercises.slice(0, 2).map(ex => ex.sets), [mainSets, mainSets]);
    assert.deepEqual(resolution.workout.exercises.slice(2), three.workout.exercises.slice(2));
    assert.equal(strengthPresetLaunchInput(resolution)!.exercises[0]!.sets, mainSets);
    assert.equal(resolution.workout.durationMin, Math.max(fullBody().durationMin, estimateStrengthPresetMinutes(resolution.workout)));
    durations.push(resolution.workout.durationMin);
    const limited = resolveStrengthPresetWorkout(fullBody(), { ...ready, availableTimeMin: three.workout.durationMin, mainSets });
    assert.equal(limited.canStart, false);
  }
  assert.ok(durations[1]! > durations[0]! && durations[2]! > durations[1]!);
  assert.equal(JSON.stringify(fullBody()), original);
  assert.deepEqual(resolveStrengthPresetWorkout(getStrengthPresetWorkout('sw_barbell_strength_5x5')!, { ...ready, mainSets: 3 }).workout.exercises.map(ex => ex.sets), [5, 5, 5]);
});

test('session-fit bypass requires acknowledgement of the exact current context and prescription', () => {
  const fit = resolveStrengthPresetWorkout(fullBody(), { ...ready, strengthLevel: 'beginner' });
  assert.equal(strengthPresetLaunchInput(fit), null);
  const allowed = strengthPresetLaunchInput(fit, fit.sessionFitKey)!;
  assert.equal(allowed.workoutId, fullBody().id);
  assert.equal(allowed.exercises[0]!.sets, 3);
  assert.equal(strengthPresetLaunchInput(fit, 'different-session'), null);
  for (const patch of [{ mainSets: 4 as const }, { soreness: 8 }, { recoveryScore: 70 }, { trainingPhase: 'recovery' as const }]) {
    const changed = resolveStrengthPresetWorkout(fullBody(), { ...ready, strengthLevel: 'beginner', ...patch });
    assert.equal(strengthPresetLaunchInput(changed, fit.sessionFitKey), null);
  }
  // Acknowledgement neither changes the default decision nor bypasses malformed data.
  assert.equal(strengthPresetLaunchInput(fit), null);
  assert.equal(strengthPresetLaunchInput({ ...fit, workout: { ...fit.workout, durationMin: NaN } }, fit.sessionFitKey), null);
  assert.equal(strengthPresetLaunchInput({ ...fit, workout: { ...fit.workout, exercises: [{ ...fit.workout.exercises[0]!, sets: Infinity }] } }, fit.sessionFitKey), null);
});

test('power purpose keeps its distinct dose, speed-first order and session-fit guidance', () => {
  const power = getStrengthPresetWorkout('sw_barbell_total_body_power')!;
  assert.equal(power.exercises[0]!.name, 'Push Press');
  const before = JSON.stringify(power);
  const fresh = resolveStrengthPresetWorkout(power, { ...ready, mainSets: 5 });
  assert.equal(fresh.mode, 'power_specific');
  assert.equal(fresh.canStart, true);
  assert.deepEqual(fresh.workout.exercises, power.exercises);
  for (const patch of [{ strengthLevel: 'beginner' as const }, { fatigueScore: 90 }, { soreness: 8 }, { availableTimeMin: 10 }]) {
    const fit = resolveStrengthPresetWorkout(power, { ...ready, ...patch });
    assert.equal(fit.canStart, false);
    assert.equal(strengthPresetLaunchInput(fit), null);
    assert.ok(strengthPresetLaunchInput(fit, fit.sessionFitKey));
  }
  assert.equal(JSON.stringify(power), before);
});

test('Recommended retains its existing category rather than admitting every allowed preset', () => {
  const oldCategoryIds = new Set(STRENGTH_PRESET_WORKOUTS.filter(w => w.categories.includes('recommended')).map(w => w.id));
  const resolvedIds = STRENGTH_PRESET_WORKOUTS.map(w => resolveStrengthPresetWorkout(w, ready))
    .filter(result => result.recommended).map(result => result.workout.id);
  assert.deepEqual(new Set(resolvedIds), oldCategoryIds);
  assert.equal(resolveStrengthPresetWorkout(getStrengthPresetWorkout('sw_barbell_deadlift_day')!, ready).recommended, false);
});

test('displayed resolved dose is exactly the launch prescription, with no assumed working weights', () => {
  const resolution = resolveStrengthPresetWorkout(fullBody(), ready);
  const launch = strengthPresetLaunchInput(resolution)!;
  assert.equal(launch.workoutId, resolution.workout.id);
  assert.equal(launch.plannedDurationMin, resolution.workout.durationMin);
  assert.deepEqual(launch.exercises.map(ex => [ex.name, ex.sets, ex.reps, ex.repScheme, ex.plannedRpe, ex.plannedRestSeconds]),
    resolution.workout.exercises.map(ex => [ex.name, ex.sets, ex.reps, ex.repScheme, ex.targetRpe, ex.restSeconds]));
  assert.ok(launch.exercises.every(ex => !('weight' in ex) && !('load' in ex)));
  assert.match(launch.exercises[0]!.plannedLoadTarget!, /calibrate.*repetition target separately/);
});

test('an already started preset preserves captured dose and duration across catalog or profile changes', () => {
  const active = { source: 'preset', workoutId: fullBody().id, workoutName: 'Captured original workout', plannedDurationMin: 37,
    exercises: [{ id: 'captured', name: 'Back Squat', sets: 4, reps: '6-8', equipment: ['barbell', 'squat_rack'],
      plannedRpe: 7, plannedRestSeconds: 90, setEntries: [{ id: 'actual-set', completed: true, reps: 6, weight: 80, weightUnit: 'lb' as const, rpe: 7 }] }],
  };
  const before = JSON.stringify(active);
  const resumed = resolveStrengthPresetWorkout(fullBody(), { strengthLevel: 'beginner', recoveryLimited: true }, active);
  assert.equal(resumed.mode, 'captured');
  assert.equal(resumed.canStart, true);
  assert.equal(resumed.workout.durationMin, 37);
  assert.equal(resumed.workout.title, 'Captured original workout');
  assert.deepEqual(resumed.workout.exercises.map(ex => [ex.sets, ex.reps, ex.targetRpe, ex.restSeconds]), [[4, '6-8', 7, 90]]);
  assert.equal(JSON.stringify(active), before);
  assert.equal(resolveStrengthPresetWorkout(fullBody(), { strengthLevel: 'beginner' }, { ...active, workoutId: 'different' }).canStart, false);
});

test('context uses actual lifting experience, canonical goal override and only today’s check-in', () => {
  const context = buildStrengthPresetContext({ strengthLevel: 'intermediate', strengthSessionMinutes: 40, goalType: 'general_strength' },
    { fatigueScore: 20, recoveryScore: 80, trainingPhase: 'threshold', goalType: 'race_prep' },
    { date: '2026-11-21', soreness: 10 }, '2026-11-22');
  assert.equal(context.soreness, null);
  assert.equal(context.goalType, 'race_prep');
  assert.equal(context.strengthLevel, 'intermediate');
  assert.equal(context.availableTimeMin, 40);
  assert.equal(resolveStrengthPresetWorkout(fullBody(), context).canStart, false);
  assert.equal(buildStrengthPresetContext({}, {}, { date: '2026-11-22', soreness: 8 }, '2026-11-22').soreness, 8);
});

test('catalog doses distinguish low demand, beginner practice, heavy strength and higher-repetition work', () => {
  const schemes = new Set<string>();
  for (const workout of STRENGTH_PRESET_WORKOUTS) for (const exercise of workout.exercises) {
    assert.ok(exercise.sets >= 1 && exercise.sets <= 5);
    const lowDemand = workout.trainingPurpose === 'activation' || workout.trainingPurpose === 'recovery';
    if (lowDemand || /beginner/i.test(workout.title)) assert.ok(exercise.sets <= 3);
    const reps = exercise.repScheme && 'repsMin' in exercise.repScheme ? exercise.repScheme.repsMin : undefined;
    if (workout.trainingPurpose !== 'power' && (reps === undefined || reps > 6)) assert.ok(exercise.sets <= 4);
    schemes.add(`${exercise.sets}x${exercise.reps}`);
  }
  assert.ok(schemes.size > 10, 'variety follows exercise purpose rather than a universal 3x10');
  assert.ok([...schemes].some(scheme => scheme.startsWith('2x')));
  assert.ok([...schemes].some(scheme => scheme.startsWith('5x5')));
});
