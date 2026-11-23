import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { generateStrengthWeek, STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { applyGoalStrengthProgramming, comparableStrengthExposures } from '../../src/utils/goalStrengthProgramming';
import { estimateStrengthSessionMinutes } from '../../src/utils/strengthDesign';
import { getLastLoggedExercise, strengthPrescriptionsMatch, suggestProgression } from '../../src/utils/strengthHistory';
import { formatPrescription } from '../../src/utils/prescriptionFormat';
import { mapEquipmentType } from '../../src/utils/strengthSession';
import { displayLabel } from '../../src/utils/displayLabels';
import { getGoalMesocycle } from '../../src/utils/plan/goalMesocycle';
import type { CompletedExercise, PlannedExercise, StrengthEngineInput, StrengthLogRecord, StrengthSession } from '../../src/types/strength';

const input = (patch: Partial<StrengthEngineInput> = {}): StrengthEngineInput => ({ programmingVersion: 2, goalScopeId: 'goal-a', goalType: 'general_strength',
  strengthLevel: 'intermediate', progressionLevel: 'advanced', trainingPhase: 'base', currentWeek: 5, weeklyMileage: 15,
  fatigueScore: 25, recoveryScore: 80, soreness: 1, injuryRisk: false, acwr: 1, weeksToRace: 0, availableTimeMin: 60,
  availableEquipment: ['bodyweight', 'dumbbell'], liftDays: ['Tue', 'Thu'], strengthHistory: [], ...patch });
const log = (id: string, exerciseId = 'squat_goblet', patch: Partial<StrengthLogRecord> = {}): StrengthLogRecord => ({
  id, sessionId: `captured:${id}`, sessionType: 'full_body', goal: 'force_production', week: 1, timestamp: Date.now() - (id === 'a' ? 8 : 4) * 86400000,
  completed: true, source: 'generated', plannedDuration: 30, estimatedLoad: 20, fatigueBefore: 20, fatigueAfter: 25, fatigueDelta: 5,
  exercises: [{ exerciseId, equipmentType: 'dumbbell', sets: [1, 2].map(() => ({ completed: true, reps: 10, weight: 20, weightUnit: 'lb', rpe: 6 })) }], ...patch });

test('goal-specific dose fits actual time and keeps legacy generation opt-in', () => {
  for (const goalType of ['general_strength', 'hybrid', 'general_running', 'race_prep'] as const) {
    for (const currentWeek of [1, 4, 6, 7, 12]) {
      const week = generateStrengthWeek(input({ goalType, currentWeek, availableTimeMin: 30 }));
      assert.ok(week.sessions.every(session => estimateStrengthSessionMinutes(session.exercises) <= 30));
      assert.ok(week.phaseNote.includes('Practice block'));
      assert.ok(week.sessions.every(session => session.exercises.every(exercise => exercise.rpe <= 8)));
    }
  }
  const legacy = generateStrengthWeek(input({ programmingVersion: 1 }));
  assert.ok(!legacy.phaseNote.includes('Practice block'));
  assert.ok(legacy.sessions.every(session => !session.id.startsWith('goal_')));
});

test('two preparatory exposures earn a calibrated heavy main-lift dose, not an immediate extra set', () => {
  const baseline = generateStrengthWeek(input()).sessions[0]!.exercises[0]!;
  assert.equal(baseline.sets, 2);
  const supported = generateStrengthWeek(input({ strengthHistory: [log('a'), log('b')] })).sessions[0]!.exercises[0]!;
  assert.equal(supported.sets, 2);
  assert.deepEqual(supported.repRange, [3, 5]);
  assert.equal(supported.rpe, 8);
  assert.equal(supported.rir, 2);
  assert.ok(supported.restSeconds >= 180);
  for (const patch of [{ currentWeek: 9 }, { strengthHistory: [log('a')] }, { recoveryScore: 200 }, { fatigueScore: -1 }, { acwr: -1 }, { recoveryScore: NaN }]) {
    assert.ok(generateStrengthWeek(input(patch)).sessions[0]!.exercises[0]!.sets <= 2);
  }
  const missing = log('a'); missing.exercises[0]!.sets.forEach(set => { delete set.rpe; });
  assert.equal(generateStrengthWeek(input({ strengthHistory: [missing, log('b')] })).sessions[0]!.exercises[0]!.sets, 2);
});

function exposure(id: string, daysAgo: number, patch: Partial<CompletedExercise> = {}): StrengthLogRecord {
  const entry = log(id, 'squat_goblet', { timestamp: Date.now() - daysAgo * 86400000 });
  entry.exercises[0] = { ...entry.exercises[0]!, ...patch };
  return entry;
}

function heavyExposure(id: string, daysAgo: number, weight = 30): StrengthLogRecord {
  return exposure(id, daysAgo, {
    prescription: { sets: 2, reps: '3–5', repScheme: { kind: 'reps', repsMin: 3, repsMax: 5 }, targetRpe: 8, restSeconds: 180, loadTarget: 'RPE 8 — calibrate this setup' },
    sets: [1, 2].map(() => ({ completed: true, reps: 4, weight, weightUnit: 'lb' as const, rpe: 8 })),
  });
}

function squat(patch: Partial<StrengthEngineInput> = {}): PlannedExercise {
  const exercise = generateStrengthWeek(input({ availableTimeMin: 120, ...patch })).sessions[0]!.exercises.find(item => item.exerciseId === 'squat_goblet');
  assert.ok(exercise, 'the fitted first strength session should retain its squat');
  return exercise;
}

function isHeavy(exercise: PlannedExercise): boolean {
  return exercise.repRange[0] === 3 && exercise.repRange[1] === 5 && exercise.rpe === 8 && exercise.restSeconds >= 180;
}

test('heavy entry uses actual equipment even when the athlete has several available alternatives, without transferring a weight', () => {
  const history = [exposure('older-base', 8), exposure('newer-base', 4)];
  const before = structuredClone(history);
  const planned = squat({ availableEquipment: ['bodyweight', 'dumbbell', 'kettlebell', 'barbell', 'cable'], strengthHistory: history });
  assert.ok(isHeavy(planned));
  assert.deepEqual(planned.exercise.equipment, ['dumbbell']);
  assert.equal(planned.sets, 2);
  assert.match(`${planned.loadTarget} ${planned.notes ?? ''}`, /calibrat|starting load/i);
  assert.doesNotMatch(planned.loadTarget, /\b20\s*(?:lb|kg)\b|\b(?:80|85)\s*%|measured maximum/i);
  assert.deepEqual(history, before, 'planning must not rewrite the actual preparatory sets');
});

test('the first successful heavy exposure bridges across eligible intensification weeks without oscillating prematurely', () => {
  const history = [exposure('base-a', 10), exposure('base-b', 7), heavyExposure('heavy-a', 3)];
  for (const currentWeek of [5, 6, 11]) {
    const planned = squat({ currentWeek, strengthHistory: history });
    assert.ok(isHeavy(planned), `week ${currentWeek} should retain the earned heavy prescription`);
    assert.equal(planned.sets, 2, 'one heavy exposure cannot simultaneously earn a third working set');
  }
  assert.equal(isHeavy(squat({ strengthHistory: [heavyExposure('unprepared-single-heavy', 2)] })), false, 'one low-rep workout without its preparatory history is not a qualifying bridge');
  assert.equal(isHeavy(squat({ recoveryScore: 64, strengthHistory: history })), false, 'prior heavy practice cannot bypass the current recovery gate');
});

test('strength-primary accumulation and intensification have distinct intent while recovery still overrides the six-week clock', () => {
  const history = [heavyExposure('familiar-heavy-a', 6), heavyExposure('familiar-heavy-b', 2, 35)];
  const expected = [
    'accumulation', 'accumulation', 'accumulation', 'recovery', 'intensification', 'intensification',
    'accumulation', 'recovery', 'accumulation', 'intensification', 'intensification', 'recovery',
  ] as const;
  for (const [index, strengthLoading] of expected.entries()) {
    const week = index + 1;
    const cycle = getGoalMesocycle(week, 'base', 'general_strength');
    assert.equal(cycle.strengthLoading, strengthLoading, `week ${week}: phase intent`);
    const result = generateStrengthWeek(input({ currentWeek: week, strengthHistory: history, availableTimeMin: 120 }));
    assert.equal(result.sessions[0]!.exercises.some(isHeavy), strengthLoading === 'intensification', `week ${week}: an old heavy performance cannot override current accumulation or recovery intent`);
  }
  const entryOnReviewWeek = squat({ currentWeek: 6, strengthHistory: [exposure('prepared-a', 8), exposure('prepared-b', 4)] });
  assert.ok(isHeavy(entryOnReviewWeek), 'the sixth practice week can introduce the earned intensification dose instead of being excluded only by its review label');
  for (const phase of ['deload', 'taper', 'recovery', 'transition'] as const) assert.equal(getGoalMesocycle(5, phase, 'general_strength').strengthLoading, 'recovery');
});

test('a new accumulation block preserves strength history and stable exercises without declaring a strength loss', () => {
  const history = [heavyExposure('practiced-a', 6), heavyExposure('practiced-b', 2, 35)];
  const before = structuredClone(history);
  const intensive = generateStrengthWeek(input({ currentWeek: 6, strengthHistory: history, availableTimeMin: 120 }));
  const accumulation = generateStrengthWeek(input({ currentWeek: 7, strengthHistory: history, availableTimeMin: 120 }));
  assert.deepEqual(accumulation.sessions[0]!.exercises.slice(0, 3).map(exercise => exercise.exerciseId), intensive.sessions[0]!.exercises.slice(0, 3).map(exercise => exercise.exerciseId));
  assert.ok(accumulation.sessions.every(session => session.exercises.every(exercise => !isHeavy(exercise))));
  assert.notEqual(accumulation.progressionState, 'regress');
  assert.doesNotMatch(accumulation.progressionReason, /lost strength|strength loss|became weaker/i);
  assert.deepEqual(history, before, 'the earlier low-repetition prescriptions and actual loads remain historical facts');
});

test('a third heavy working set needs two successful heavy sessions, while a between-session load change remains valid', () => {
  const history = [exposure('base-a', 12), exposure('base-b', 9), heavyExposure('heavy-a', 5, 30), heavyExposure('heavy-b', 2, 35)];
  const developed = squat({ strengthHistory: history });
  assert.ok(isHeavy(developed));
  assert.equal(developed.sets, 3);
  const reviewed = squat({ currentWeek: 6, strengthHistory: history });
  assert.ok(isHeavy(reviewed));
  assert.equal(reviewed.sets, 2, 'a review week retains familiar work without adding a set');
});

test('a completed captured third heavy set survives review without calendar-driven volume loss', () => {
  const latest = heavyExposure('own-three-sets', 2, 35);
  latest.exercises[0]!.prescription!.sets = 3;
  latest.exercises[0]!.sets.push({ ...latest.exercises[0]!.sets[0]! });
  const history = [exposure('base-a', 14), exposure('base-b', 11), heavyExposure('heavy-a', 7), latest];
  const before = structuredClone(history);
  for (const currentWeek of [5, 6, 11]) {
    const planned = squat({ currentWeek, strengthHistory: history });
    assert.ok(isHeavy(planned));
    assert.equal(planned.sets, 3, `week ${currentWeek} retains actual successful three-set work`);
  }
  assert.ok(squat({ currentWeek: 4, strengthHistory: history }).sets <= 2, 'recovery still overrides retained volume');
  assert.ok(squat({ availableTimeMin: 20, strengthHistory: history }).sets <= 2, 'retained volume cannot bypass the real time budget');
  assert.deepEqual(history, before);
  for (const incomplete of [false, true]) {
    const unfinished = structuredClone(latest);
    if (incomplete) unfinished.exercises[0]!.sets[2]!.completed = false;
    else unfinished.exercises[0]!.sets.pop();
    assert.equal(isHeavy(squat({ currentWeek: 6, strengthHistory: [...history.slice(0, -1), unfinished] })), false, 'a prescribed third set is not proof it was completed');
  }
});

test('completed planned recovery preserves familiar heavy practice without counting as another heavy success', () => {
  const history = [exposure('base-a', 12), exposure('base-b', 9), heavyExposure('heavy-a', 5)];
  const recovery = squat({ currentWeek: 4, strengthHistory: history });
  assert.equal(isHeavy(recovery), false);
  assert.ok(recovery.rpe <= 6);
  assert.match(recovery.loadTarget, /Recovery practice/);
  const recovered = exposure('completed-recovery', 1, {
    prescription: { sets: recovery.sets, reps: `${recovery.repRange[0]}–${recovery.repRange[1]}`, repScheme: structuredClone(recovery.repScheme), targetRpe: recovery.rpe, restSeconds: recovery.restSeconds, loadTarget: recovery.loadTarget },
    sets: Array.from({ length: recovery.sets }, () => ({ completed: true, reps: recovery.repRange[0], weight: 15, weightUnit: 'lb' as const, rpe: 5 })),
  });
  const after = squat({ currentWeek: 5, strengthHistory: [...history, recovered] });
  assert.ok(isHeavy(after), 'completing the easier captured recovery prescription should not erase prior familiar work');
  assert.equal(after.sets, 2, 'a recovery session is not the second successful heavy exposure needed for a third set');
  const improperlyBridged: string[] = [];
  for (const failure of ['below-prescribed-reps', 'hard', 'partial', 'unknown-target', 'unknown-rep-scheme'] as const) {
    const badRecovery = structuredClone(recovered);
    if (failure === 'below-prescribed-reps') badRecovery.exercises[0]!.sets[0]!.reps = 1;
    if (failure === 'hard') badRecovery.exercises[0]!.sets[0]!.rpe = 8;
    if (failure === 'partial') badRecovery.exercises[0]!.sets[0]!.completed = false;
    if (failure === 'unknown-target') delete badRecovery.exercises[0]!.prescription!.targetRpe;
    if (failure === 'unknown-rep-scheme') delete badRecovery.exercises[0]!.prescription!.repScheme;
    if (isHeavy(squat({ currentWeek: 5, strengthHistory: [...history, badRecovery] }))) improperlyBridged.push(failure);
  }
  assert.deepEqual(improperlyBridged, [], 'a recovery label must not conceal an underperformed or unknown prescription');
});

test('latest unsuccessful or unknown attempts cannot be skipped to unlock older good preparatory exposures', () => {
  const cases: Array<[string, (latest: StrengthLogRecord) => void]> = [
    ['whole matching session skipped', latest => { latest.skipped = true; }],
    ['exercise skipped', latest => { latest.exercises[0]!.skipped = true; }],
    ['unfinished set', latest => { latest.exercises[0]!.sets[1]!.completed = false; }],
    ['missing a captured prescribed working set', latest => {
      latest.exercises[0]!.prescription = { sets: 3, reps: '8–10', repScheme: { kind: 'reps', repsMin: 8, repsMax: 10 }, targetRpe: 7 };
    }],
    ['warm-up counted as a second working set', latest => { latest.exercises[0]!.sets[1]!.isWarmup = true; }],
    ['missing actual effort', latest => { delete latest.exercises[0]!.sets[1]!.rpe; }],
    ['hard actual set', latest => { latest.exercises[0]!.sets[1]!.rpe = 9; }],
    ['reps below preparatory target', latest => { latest.exercises[0]!.sets[1]!.reps = 7; }],
    ['unqualified numeric load', latest => { delete latest.exercises[0]!.sets[1]!.weightUnit; }],
    ['unqualified numeric load with a legacy display label', latest => { delete latest.exercises[0]!.sets[1]!.weightUnit; latest.exercises[0]!.sets[1]!.load = '20 lb'; }],
    ['mixed working-set units', latest => { latest.exercises[0]!.sets[1]!.weightUnit = 'kg'; }],
    ['mixed working-set loads', latest => { latest.exercises[0]!.sets[1]!.weight = 25; }],
    ['changed actual equipment', latest => { latest.exercises[0]!.equipmentType = 'barbell'; }],
    ['duplicate matching exercise with a hard set', latest => {
      latest.exercises.push({ ...structuredClone(latest.exercises[0]!), sets: [{ completed: true, reps: 10, weight: 20, weightUnit: 'lb', rpe: 9 }] });
    }],
    ['duplicate matching exercise with incomplete work', latest => {
      latest.exercises.push({ ...structuredClone(latest.exercises[0]!), sets: [{ completed: false, reps: 10, weight: 20, weightUnit: 'lb' }] });
    }],
  ];
  for (const [label, mutate] of cases) {
    const latest = exposure('latest-attempt', 1);
    mutate(latest);
    const history = [exposure('good-a', 10), latest, exposure('good-b', 6)];
    const result = squat({ strengthHistory: history });
    assert.equal(isHeavy(result), false, label);
    assert.ok(result.sets <= 2, `${label} must not earn an extra working set either`);
  }
});

test('a newer bad heavy exposure blocks retention rather than falling back to the older successful pair', () => {
  for (const failure of ['hard', 'above-target', 'partial', 'missing-effort', 'below-range', 'missing-prescription'] as const) {
    const latest = heavyExposure(`latest-${failure}`, 1, 35);
    if (failure === 'hard') latest.exercises[0]!.sets[1]!.rpe = 9;
    if (failure === 'above-target') latest.exercises[0]!.sets[1]!.rpe = 8.5;
    if (failure === 'partial') latest.exercises[0]!.sets[1]!.completed = false;
    if (failure === 'missing-effort') delete latest.exercises[0]!.sets[1]!.rpe;
    if (failure === 'below-range') latest.exercises[0]!.sets[1]!.reps = 2;
    if (failure === 'missing-prescription') delete latest.exercises[0]!.prescription;
    const result = squat({ strengthHistory: [heavyExposure('good-heavy-a', 9), latest, heavyExposure('good-heavy-b', 5)] });
    assert.equal(isHeavy(result), false, failure);
  }
});

test('duplicates and non-current evidence cannot masquerade as two independent preparatory sessions', () => {
  const first = exposure('one-session', 5);
  const duplicate = exposure('different-log-id', 5, structuredClone(first.exercises[0]!));
  duplicate.sessionId = first.sessionId;
  const histories = [
    [first, structuredClone(first)],
    [first, duplicate],
    [exposure('too-old-a', 60), exposure('too-old-b', 50)],
    [exposure('future-a', -3), exposure('future-b', -1)],
  ];
  for (const history of histories) assert.equal(isHeavy(squat({ strengthHistory: history })), false);
  const differentUnits = [exposure('lb-baseline', 8), exposure('kg-baseline', 3)];
  differentUnits[1]!.exercises[0]!.sets.forEach(set => { set.weightUnit = 'kg'; });
  assert.equal(isHeavy(squat({ strengthHistory: differentUnits })), false, 'between-session load units must be qualified consistently');
});

test('an unrelated skipped session does not erase successful evidence for this lift', () => {
  const unrelated = exposure('skipped-prehab', 1, { exerciseId: 'trunk_side_plank', equipmentType: 'bodyweight', skipped: true });
  unrelated.skipped = true;
  const result = squat({ strengthHistory: [exposure('base-a', 9), unrelated, exposure('base-b', 5)] });
  assert.ok(isHeavy(result));
  const warmups = [exposure('warmup-base-a', 9), exposure('warmup-base-b', 5)];
  warmups.forEach(record => record.exercises[0]!.sets.unshift({ completed: false, reps: 5, weight: 5, weightUnit: 'lb', isWarmup: true }));
  assert.ok(isHeavy(squat({ strengthHistory: warmups })), 'an uncompleted warm-up must not be mistaken for unfinished working sets');
});

test('novice, recovery, foundation, race and short-time contexts do not inherit a trained heavy dose', () => {
  const history = [exposure('base-a', 9), exposure('base-b', 5)];
  const cases: Array<[string, Partial<StrengthEngineInput>]> = [
    ['no lifting experience', { strengthLevel: 'none' }],
    ['beginner lifting experience', { strengthLevel: 'beginner' }],
    ['new practice block', { currentWeek: 1 }],
    ['foundation', { trainingPhase: 'foundation' }],
    ['deload', { trainingPhase: 'deload' }],
    ['scheduled recovery microcycle', { currentWeek: 4 }],
    ['taper', { trainingPhase: 'taper' }],
    ['low recovery', { recoveryScore: 54 }],
    ['unknown recovery', { recoveryScore: NaN }],
    ['unknown fatigue', { fatigueScore: NaN }],
    ['unknown soreness', { soreness: NaN }],
    ['high fatigue', { fatigueScore: 71 }],
    ['high soreness', { soreness: 7 }],
    ['symptom flag', { injuryRisk: true }],
    ['load spike', { acwr: 1.41 }],
    ['race-specific support', { goalType: 'race_prep', secondaryGoalTypes: ['general_strength'], trainingPhase: 'race_specific' }],
    ['imminent race', { weeksToRace: 2 }],
    ['short time window', { availableTimeMin: 20 }],
  ];
  const violations: string[] = [];
  for (const [label, patch] of cases) {
    const result = generateStrengthWeek(input({ availableTimeMin: 120, strengthHistory: history, ...patch }));
    if (!result.sessions.every(session => session.exercises.every(exercise => !isHeavy(exercise)))) violations.push(`${label}: heavy dose prescribed`);
    if (!result.sessions.every(session => estimateStrengthSessionMinutes(session.exercises) <= (patch.availableTimeMin ?? 120))) violations.push(`${label}: prescription exceeds the stated time budget`);
  }
  assert.deepEqual(violations, [], 'exceptions must preserve the actual dose and recovery/time constraints');
});

test('heavier work is limited to goal-specific compound priorities; bodyweight, timed and accessory tasks keep their own purpose', () => {
  const history = [exposure('all-base-a', 8), exposure('all-base-b', 4)].map(record => ({
    ...record,
    exercises: ['squat_goblet', 'hinge_rdl', 'pull_row'].map(exerciseId => ({ ...structuredClone(record.exercises[0]!), exerciseId })),
  }));
  for (const [goalType, secondaryGoalTypes, maximum] of [
    ['general_strength', [], 2], ['hybrid', [], 1], ['general_running', ['general_strength'], 1], ['general_running', [], 0],
  ] as const) {
    const result = generateStrengthWeek(input({ goalType, secondaryGoalTypes: [...secondaryGoalTypes], strengthHistory: history, availableTimeMin: 120 }));
    for (const session of result.sessions) {
      const heavy = session.exercises.filter(isHeavy);
      assert.ok(heavy.length <= maximum, `${goalType}: heavy work must respect the shared priority and recovery budget`);
      if (maximum) assert.ok(heavy.length > 0, `${goalType}: qualified weighted main lifts should receive the intended stimulus`);
      assert.ok(session.exercises.filter(exercise => ['trunk', 'mobility', 'carry', 'plyometric'].includes(exercise.exercise.pattern)).every(exercise => !isHeavy(exercise)));
    }
  }
  const source = squat();
  const timed: PlannedExercise = { ...source, exerciseId: 'carry_test', exercise: { ...source.exercise, id: 'carry_test', name: 'Dumbbell Carry', pattern: 'carry', equipment: ['dumbbell'] }, repScheme: { kind: 'duration', secondsMin: 30, secondsMax: 45 } };
  const timedHistory = [exposure('carry-a', 8, { exerciseId: 'carry_test' }), exposure('carry-b', 4, { exerciseId: 'carry_test' })];
  const result = applyGoalStrengthProgramming([timed], input({ strengthHistory: timedHistory }), 'full_body', { ...STRENGTH_EXERCISES, carry_test: timed.exercise }).exercises[0]!;
  assert.equal(result.repScheme?.kind, 'duration');
  assert.equal(isHeavy(result), false);
});

test('switching between preparatory and heavy rep targets recalibrates the load instead of repeating an incompatible weight', () => {
  const history = [heavyExposure('recent-heavy', 2, 40)];
  const last = getLastLoggedExercise(history, 'squat_goblet', 'lb', 'dumbbell');
  assert.ok(last);
  assert.equal(last.prescription?.targetRpe, 8, 'the prior target must come from the captured prescription, not the actual reps');
  const returned = suggestProgression(last, 2, false, 'lb', 10, 'dumbbell', { repsMin: 8, repsMax: 10, targetRpe: 7, loadTarget: 'RPE 7' });
  assert.match(`${returned?.headline} ${returned?.reason}`, /calibrat|starting load/i);
  assert.doesNotMatch(returned!.headline, /Repeat 40|Hold at 40|Try 4[025]/i);
  const base = exposure('recent-base', 2, { prescription: { sets: 2, reps: '8–10', repScheme: { kind: 'reps', repsMin: 8, repsMax: 10 }, targetRpe: 7, restSeconds: 120 } });
  const lastBase = getLastLoggedExercise([base], 'squat_goblet', 'lb', 'dumbbell');
  const entered = suggestProgression(lastBase, 2, false, 'lb', 5, 'dumbbell', { repsMin: 3, repsMax: 5, targetRpe: 8, loadTarget: 'RPE 8 — calibrate this setup' });
  assert.match(`${entered?.headline} ${entered?.reason}`, /calibrat|starting load/i);
  assert.doesNotMatch(entered!.headline, /Repeat 20|Try 22\.5|Try 25/i);
});

test('a compatible load reference requires the captured repetition and effort target, not just the same exercise name', () => {
  const prescription = heavyExposure('captured', 1).exercises[0]!.prescription;
  assert.equal(strengthPrescriptionsMatch(prescription, { repsMin: 3, repsMax: 5, targetRpe: 8 }), true);
  assert.equal(strengthPrescriptionsMatch(prescription, { repsMin: 8, repsMax: 10, targetRpe: 8 }), false);
  assert.equal(strengthPrescriptionsMatch(prescription, { repsMin: 3, repsMax: 5, targetRpe: 6 }), false);
  assert.equal(strengthPrescriptionsMatch(undefined, { repsMin: 3, repsMax: 5, targetRpe: 8 }), false);
  assert.equal(strengthPrescriptionsMatch(prescription, { repsMin: 3, repsMax: 5 }), false);
});

test('successful matched heavy work suggests an equipment-sized choice rather than a forced numeric jump', () => {
  const record = heavyExposure('top-of-range', 1, 20);
  record.exercises[0]!.sets.forEach(set => { set.reps = 5; });
  const before = structuredClone(record);
  const last = getLastLoggedExercise([record], 'squat_goblet', 'lb', 'dumbbell');
  const result = suggestProgression(last, 2, false, 'lb', 5, 'dumbbell', { repsMin: 3, repsMax: 5, targetRpe: 8 });
  assert.match(result!.headline, /small load increase/i);
  assert.match(result!.reason, /smallest available/i);
  assert.match(result!.reason, /jump is larger.*hold|hold.*equipment/i, 'coarse equipment jumps require consolidation instead of an invented microplate load');
  assert.doesNotMatch(result!.headline, /Try\s+\d|22\.5|25\s*lb/i);
  assert.deepEqual(record, before, 'a progression suggestion cannot alter the actual completed work or its prescribed weight');
});

test('missed rep minimum, excessive effort, limited recovery and unknown actual effort change the matched-dose advice', () => {
  const context = { repsMin: 3, repsMax: 5, targetRpe: 8 };
  for (const problem of ['missed-reps', 'near-max-effort'] as const) {
    const record = heavyExposure(problem, 1, 40);
    if (problem === 'missed-reps') record.exercises[0]!.sets[1]!.reps = 2;
    else record.exercises[0]!.sets[1]!.rpe = 10;
    const last = getLastLoggedExercise([record], 'squat_goblet', 'lb', 'dumbbell');
    const result = suggestProgression(last, 2, false, 'lb', 5, 'dumbbell', context);
    assert.match(`${result!.headline} ${result!.reason}`, /reduce.*recalibrat|lighter load/i, problem);
    assert.doesNotMatch(result!.headline, /Repeat 40|Try 4[025]/i);
  }
  const good = heavyExposure('matched-good', 1, 40);
  const last = getLastLoggedExercise([good], 'squat_goblet', 'lb', 'dumbbell');
  const limited = suggestProgression(last, 2, true, 'lb', 5, 'dumbbell', context);
  assert.match(`${limited!.headline} ${limited!.reason}`, /lighter.*load|recalibrat/i);
  assert.doesNotMatch(limited!.headline, /Hold at 40|Repeat 40/i);
  good.exercises[0]!.sets.forEach(set => { delete set.rpe; });
  const unknown = suggestProgression(getLastLoggedExercise([good], 'squat_goblet', 'lb', 'dumbbell'), 2, false, 'lb', 5, 'dumbbell', context);
  assert.match(unknown!.reason, /record actual effort/i);
  assert.doesNotMatch(unknown!.headline, /increase|Try\s+\d/i);
});

test('the actual Strength screen leaves incompatible v2 weights unset while retaining compatible and legacy references', () => {
  const source = ts.createSourceFile('strength-screen.tsx', readFileSync('app/(tabs)/strength/index.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'sessionToExDefs');
  assert.ok(declaration, 'exercise display mapping remains testable independently of rendering React Native');
  const compiled = ts.transpileModule(`${declaration.getText(source)}\nmodule.exports = sessionToExDefs;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: undefined as unknown };
  runInNewContext(compiled, { module, getLastLoggedExercise, strengthPrescriptionsMatch, mapEquipmentType, formatPrescription, displayLabel,
    PATTERN_MUSCLES: { squat: 'Quads · Glutes' }, Date,
  });
  const mapExercises = module.exports as (session: StrengthSession, history: StrengthLogRecord[], unit: 'lb' | 'kg') => Array<{ weight: number }>;
  const history = [exposure('base-a', 8), exposure('base-b', 4)];
  const firstHeavy = generateStrengthWeek(input({ strengthHistory: history, availableTimeMin: 120 })).sessions[0]!;
  assert.ok(isHeavy(firstHeavy.exercises[0]!));
  assert.equal(mapExercises(firstHeavy, history, 'lb')[0]!.weight, 0, 'a prior ten-rep load must not be preselected for first heavy calibration');
  const practicedHistory = [heavyExposure('heavy-a', 5, 30), heavyExposure('heavy-b', 2, 35)];
  const familiar = generateStrengthWeek(input({ strengthHistory: practicedHistory, availableTimeMin: 120 })).sessions[0]!;
  assert.equal(mapExercises(familiar, practicedHistory, 'lb')[0]!.weight, 35, 'the same captured reps and effort can retain a recent comparable reference');
  const returned: StrengthSession = { ...familiar, exercises: [{ ...familiar.exercises[0]!, repRange: [8, 10], repScheme: { kind: 'reps', repsMin: 8, repsMax: 10 }, rpe: 7 }] };
  assert.equal(mapExercises(returned, practicedHistory, 'lb')[0]!.weight, 0, 'the old low-rep load must not become a high-rep prescription');
  const newBlock = generateStrengthWeek(input({ currentWeek: 7, strengthHistory: practicedHistory, availableTimeMin: 120 })).sessions[0]!;
  assert.equal(mapExercises(newBlock, practicedHistory, 'lb')[0]!.weight, 0, 'the actual week-seven accumulation prescription requires a separate working-load calibration');
  assert.equal(mapExercises({ ...returned, id: 'strength_full_body_3_0' }, practicedHistory, 'lb')[0]!.weight, 35, 'legacy display references retain their existing behavior');
});

test('partial work, mixed setup, unknown units and duplicate history cannot earn progression', () => {
  const exercise = { ...STRENGTH_EXERCISES.squat_goblet!, equipment: ['dumbbell'] as const };
  const partial = log('a'); partial.exercises[0]!.sets.push({ completed: false, reps: 10 });
  assert.equal(comparableStrengthExposures({ ...exercise, equipment: ['dumbbell'] }, [partial], 10).length, 0);
  const unknown = log('a'); unknown.exercises[0]!.sets.forEach(set => { delete set.weightUnit; });
  assert.equal(comparableStrengthExposures({ ...exercise, equipment: ['dumbbell'] }, [unknown], 10).length, 0);
  assert.equal(comparableStrengthExposures({ ...exercise, equipment: ['dumbbell'] }, [log('a'), log('a')], 10).length, 1);
});

test('preferred unilateral variations have their own calibration and both-side timing', () => {
  const source = generateStrengthWeek(input()).sessions[0]!.exercises.find(ex => ex.exerciseId === 'hinge_rdl')!;
  const result = applyGoalStrengthProgramming([source], input({ exercisePreferences: { hinge_rdl: 'hinge_single_rdl' } }), 'full_body', STRENGTH_EXERCISES).exercises[0]!;
  assert.equal(result.exerciseId, 'hinge_single_rdl');
  assert.equal(result.repScheme?.perSide, true);
  assert.match(result.loadTarget, /calibrate/);
  assert.match(result.notes!, /weights do not transfer/);
  const invalid = applyGoalStrengthProgramming([source], input({ exercisePreferences: { hinge_rdl: 'pull_row' } }), 'full_body', STRENGTH_EXERCISES).exercises[0]!;
  assert.equal(invalid.exerciseId, 'hinge_rdl');
});

test('goal-scoped strength slots survive type changes and never merge separate goals', () => {
  const first = generateStrengthWeek(input()).sessions[0]!.id;
  assert.equal(first, generateStrengthWeek(input({ trainingPhase: 'taper' })).sessions[0]!.id);
  assert.notEqual(first, generateStrengthWeek(input({ goalScopeId: 'goal-b' })).sessions[0]!.id);
  assert.notEqual(first, generateStrengthWeek(input({ currentWeek: 6 })).sessions[0]!.id);
});

test('six-week review can rotate one practiced accessory while main lifts stay recognizable', () => {
  const week = generateStrengthWeek(input({ availableTimeMin: 120 }));
  const session = week.sessions[0]!;
  const trunk = session.exercises.find(ex => ex.exerciseId === 'trunk_dead_bug')!;
  assert.ok(trunk);
  const exposures = ['a', 'b'].map(id => {
    const entry = log(id, 'trunk_dead_bug');
    entry.exercises[0]!.equipmentType = 'bodyweight';
    entry.exercises[0]!.sets = [1, 2].map(() => ({ completed: true, reps: trunk.repRange[1], load: 'BW', rpe: 6 }));
    return entry;
  });
  const reviewed = generateStrengthWeek(input({ currentWeek: 7, availableTimeMin: 120, strengthHistory: exposures })).sessions[0]!;
  assert.deepEqual(reviewed.exercises.slice(0, 3).map(ex => ex.exerciseId), session.exercises.slice(0, 3).map(ex => ex.exerciseId));
  assert.equal(reviewed.exercises.filter(ex => ex.notes?.includes('Six-week accessory review')).length, 1);
  assert.match(reviewed.exercises.find(ex => ex.notes?.includes('Six-week accessory review'))!.loadTarget, /calibrate/);
  const variant = reviewed.exercises.find(ex => ex.notes?.includes('Six-week accessory review'))!;
  const practiced = log('variant', variant.exerciseId);
  practiced.exercises[0]!.equipmentType = 'bodyweight';
  practiced.exercises[0]!.sets = [{ completed: true, reps: 8, load: 'BW' }];
  const lateBlock = generateStrengthWeek(input({ currentWeek: 11, availableTimeMin: 120, strengthHistory: [practiced] })).sessions[0]!;
  assert.ok(lateBlock.exercises.some(ex => ex.exerciseId === variant.exerciseId));
});

test('a preferred movement can progress from its own history but never inherits the original exercise evidence', () => {
  const args = input({ exercisePreferences: { squat_goblet: 'squat_box' }, strengthHistory: [log('a'), log('b')] });
  const fresh = generateStrengthWeek(args).sessions[0]!.exercises[0]!;
  assert.equal(fresh.exerciseId, 'squat_box'); assert.equal(fresh.sets, 2); assert.match(fresh.loadTarget, /calibrate/);
  const ownHistory = ['a', 'b'].map(id => {
    const entry = log(id, 'squat_box'); entry.exercises[0]!.equipmentType = 'bodyweight';
    entry.exercises[0]!.sets = [1, 2].map(() => ({ completed: true, reps: 10, load: 'BW', rpe: 6 })); return entry;
  });
  const progressed = generateStrengthWeek({ ...args, strengthHistory: ownHistory }).sessions[0]!.exercises[0]!;
  assert.equal(progressed.sets, 3); assert.doesNotMatch(progressed.loadTarget, /calibrate/);
});

test('old performance remains a historical reference rather than a new load-increase recommendation', () => {
  const suggestion = suggestProgression({ timestamp: Date.now() - 100 * 86400000, completedSets: 3, reps: 12, load: '30 lb', rpe: 6,
    comparableWorkingSets: true, equipmentType: 'dumbbell' }, 3, false, 'lb', 12, 'dumbbell');
  assert.match(suggestion!.headline, /Recalibrate/); assert.doesNotMatch(suggestion!.headline, /Try|Add/);
});

test('advanced strength dose earns at most one set from two captured successes, never more than five', () => {
  function completedDose(id: string, days: number, sets: number) {
    const record = heavyExposure(id, days);
    record.exercises[0]!.prescription!.sets = sets;
    record.exercises[0]!.sets = Array.from({ length: sets }, () => ({ completed: true, reps: 4, weight: 30, weightUnit: 'lb' as const, rpe: 8 }));
    return record;
  }
  for (const sets of [3, 4, 5]) {
    const history = [completedDose('prior', 6, sets), completedDose('latest', 2, sets)];
    const before = structuredClone(history);
    const planned = squat({ strengthLevel: 'advanced', strengthHistory: history });
    assert.equal(planned.sets, Math.min(5, sets + 1));
    assert.deepEqual(planned.repRange, [3, 5]); assert.equal(planned.rpe, 8);
    assert.equal(squat({ strengthLevel: 'advanced', strengthHistory: history, currentWeek: 6 }).sets, sets,
      'review retains the completed dose without adding a set');
    assert.equal(squat({ strengthLevel: 'intermediate', strengthHistory: history }).sets, sets,
      'only advanced strength-priority work can earn the additional higher-volume dose');
    assert.deepEqual(history, before, 'planning cannot edit completed records');
  }
  const three = [completedDose('prior', 6, 3), completedDose('latest', 2, 3)];
  const differentLoad = structuredClone(three); differentLoad[0]!.exercises[0]!.sets.forEach(set => { set.weight = 25; });
  assert.equal(squat({ strengthLevel: 'advanced', strengthHistory: differentLoad }).sets, 3, 'do not increase load and sets from incomparable work');
  const priorTwo = [completedDose('prior', 6, 2), completedDose('latest', 2, 3)];
  assert.equal(squat({ strengthLevel: 'advanced', strengthHistory: priorTwo }).sets, 3, 'one three-set attempt is insufficient');
  const incomplete = structuredClone(three); incomplete[1]!.exercises[0]!.sets[2]!.completed = false;
  assert.ok(squat({ strengthLevel: 'advanced', strengthHistory: incomplete }).sets <= 2);
  assert.ok(squat({ strengthLevel: 'advanced', strengthHistory: three, recoveryScore: 40 }).sets <= 2);
  const short = generateStrengthWeek(input({ strengthLevel: 'advanced', strengthHistory: three, availableTimeMin: 20 }));
  assert.ok(short.sessions.every(session => estimateStrengthSessionMinutes(session.exercises) <= 20));
});
