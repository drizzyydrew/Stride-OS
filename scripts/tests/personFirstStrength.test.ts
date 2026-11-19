import assert from 'node:assert/strict';
import test from 'node:test';
import { generateStrengthWeek } from '../../src/utils/strengthEngine';
import { estimateStrengthSessionMinutes, strengthExerciseReviewNote, strengthWeightForDisplay } from '../../src/utils/strengthDesign';
import { getLastLoggedExercise, suggestProgression } from '../../src/utils/strengthHistory';
import { reserveStrengthRestDay, markCapturedStrengthCompletions } from '../../src/utils/strengthRestDay';
import { strengthScheduledSessionId } from '../../src/utils/scheduledSessionIds';
import { addDays, toYMD } from '../../src/utils/calendarEngine';
import { completedExercisesFromActiveSession, trainingBlockCompletionFromActiveSession } from '../../src/utils/strengthPersistence';
import { ensureExerciseShape } from '../../src/utils/strengthSession';
import type { StrengthEngineInput, StrengthLogRecord, CompletedExercise } from '../../src/types/strength';
import type { CalendarEntry } from '../../src/utils/calendarEngine';

function input(patch: Partial<StrengthEngineInput> = {}): StrengthEngineInput {
  return { programmingVersion: 2, strengthLevel: 'intermediate', goalType: 'hybrid', trainingPhase: 'base', progressionLevel: 'advanced',
    weeklyMileage: 25, currentWeek: 1, fatigueScore: 30, recoveryScore: 75, soreness: 2, injuryRisk: false,
    acwr: 1, weeksToRace: 0, availableTimeMin: 60, liftDays: ['Tue', 'Thu'], strengthHistory: [], ...patch };
}
function record(exercises: CompletedExercise[], patch: Partial<StrengthLogRecord> = {}): StrengthLogRecord {
  return { id: 'log', sessionId: 's', sessionType: 'full_body', goal: 'force_production', week: 1, timestamp: Date.now(), completed: true,
    plannedDuration: 40, exercises, source: 'generated', fatigueBefore: 20, fatigueAfter: 25, fatigueDelta: 5, estimatedLoad: 50, ...patch };
}
function exercise(patch: Partial<CompletedExercise> = {}): CompletedExercise {
  return { exerciseId: 'pull_row', equipmentType: 'dumbbell', sets: [
    { completed: true, reps: 10, weight: 20, weightUnit: 'lb', rpe: 6 },
    { completed: true, reps: 10, weight: 20, weightUnit: 'lb', rpe: 7 },
  ], ...patch };
}

test('new plans use lifting experience independently; unknown defaults conservatively', () => {
  for (const strengthLevel of ['none', 'beginner', undefined] as const) {
    const week = generateStrengthWeek(input({ strengthLevel, progressionLevel: 'advanced' }));
    assert.ok(week.sessions.every(session => session.exercises.every(ex => ex.rpe <= 6)));
  }
  const experienced = generateStrengthWeek(input({ progressionLevel: 'beginner', strengthLevel: 'advanced' }));
  assert.ok(experienced.sessions.some(session => session.exercises.some(ex => ex.rpe === 7)));
  const legacyA = generateStrengthWeek(input({ programmingVersion: undefined, strengthLevel: 'advanced' }));
  const legacyB = generateStrengthWeek(input({ programmingVersion: 1, strengthLevel: 'none' }));
  assert.deepEqual(legacyA.sessions.map(s => s.exercises.map(ex => [ex.exerciseId, ex.sets, ex.repRange])),
    legacyB.sessions.map(s => s.exercises.map(ex => [ex.exerciseId, ex.sets, ex.repRange])));
});

test('full-body new plans cover push and pull within the actual time budget', () => {
  for (const minutes of [20, 30, 45, 60]) {
    const week = generateStrengthWeek(input({ availableTimeMin: minutes, availableEquipment: ['dumbbell'] }));
    for (const session of week.sessions) {
      assert.ok(estimateStrengthSessionMinutes(session.exercises) <= minutes);
      assert.ok(session.targetDuration <= minutes);
      assert.ok(session.exercises.some(ex => ex.exercise.pattern === 'push'));
      assert.ok(session.exercises.some(ex => ex.exercise.pattern === 'pull'));
      assert.ok(session.exercises.some(ex => ex.exercise.pattern === 'squat' || ex.exercise.pattern === 'hinge'));
    }
  }
});

test('equipment fit does not pretend a light shoulder task replaces a row', () => {
  assert.doesNotThrow(() => generateStrengthWeek(input({ availableEquipment: {} as never })));
  const band = generateStrengthWeek(input({ availableEquipment: ['band'] }));
  assert.ok(band.sessions.every(session => session.exercises.some(ex => ex.exerciseId === 'pull_band_row')));
  assert.ok(band.sessions.every(session => session.exercises.every(ex => ex.exercise.equipment.some(e => ['bodyweight', 'band'].includes(e)))));
  const bodyweight = generateStrengthWeek(input({ availableEquipment: [] }));
  assert.ok(bodyweight.sessions.every(session => session.exercises.every(ex => ex.exercise.equipment.includes('bodyweight'))));
  assert.ok(bodyweight.sessions.every(session => session.title === 'Strength Priorities' && /omitted/.test(session.progressionNote)));
});

test('six-week review changes guidance without blind exercise swaps or weight increases', () => {
  const first = generateStrengthWeek(input({ currentWeek: 1 }));
  const seventh = generateStrengthWeek(input({ currentWeek: 7 }));
  assert.deepEqual(first.sessions.map(s => s.exercises.map(ex => [ex.exerciseId, ex.sets, ex.rpe])),
    seventh.sessions.map(s => s.exercises.map(ex => [ex.exerciseId, ex.sets, ex.rpe])));
  assert.match(strengthExerciseReviewNote(7), /Practice block 2.*six-week review.*new exercise or setup needs its own/);
  assert.ok(seventh.sessions.every(s => s.exercises.every(ex => ex.tempo !== '3:1:1' && !/1RM|%/.test(ex.loadTarget))));
});

test('attendance and unknown effort never earn a progression recommendation', () => {
  const history = Array.from({ length: 6 }, (_, i) => record([exercise({ sets: exercise().sets.map(set => ({ ...set, rpe: undefined })) })], { id: `s${i}`, overallRpe: undefined }));
  assert.equal(generateStrengthWeek(input({ strengthHistory: history })).progressionState, 'maintain');
  assert.equal(generateStrengthWeek(input({ strengthHistory: history.map(row => ({ ...row, overallRpe: 6 })) })).progressionState, 'maintain');
  const noPerformance = history.map(row => ({ ...row, overallRpe: 6, exercises: [] }));
  assert.equal(generateStrengthWeek(input({ strengthHistory: noPerformance })).progressionState, 'maintain');
  assert.equal(generateStrengthWeek(input({ strengthHistory: [record([exercise()], { overallRpe: 6 })] })).progressionState, 'maintain');
  const last = getLastLoggedExercise([record([exercise({ sets: [{ completed: true, reps: 10, weight: 20, weightUnit: 'lb' }] })])], 'pull_row');
  assert.doesNotMatch(suggestProgression(last, 1, false, 'lb', 10, 'dumbbell')!.headline, /Try|Add/);
});

test('working-set advice excludes warmups and uses the hardest set and minimum reps', () => {
  const last = getLastLoggedExercise([record([exercise({ sets: [
    { completed: true, isWarmup: true, reps: 15, weight: 5, weightUnit: 'lb', rpe: 2 },
    { completed: true, reps: 10, weight: 20, weightUnit: 'lb', rpe: 6 },
    { completed: true, reps: 8, weight: 20, weightUnit: 'lb', rpe: 9 },
  ] })])], 'pull_row')!;
  assert.equal(last.completedSets, 2); assert.equal(last.reps, 8); assert.equal(last.rpe, 9);
  assert.match(suggestProgression(last, 2, false, 'lb', 10, 'dumbbell')!.headline, /Repeat/);
  const enough = getLastLoggedExercise([record([exercise()])], 'pull_row')!;
  assert.match(suggestProgression(enough, 2, false, 'lb', 10, 'dumbbell')!.headline, /Try/);
  assert.doesNotMatch(suggestProgression(enough, 2, false, 'lb', 12, 'dumbbell')!.headline, /Try/);
  assert.doesNotMatch(suggestProgression(enough, 2, false, 'lb', 10, 'barbell')!.headline, /Try/);
  assert.doesNotMatch(suggestProgression(enough, 2, false, 'lb', null, 'dumbbell')!.headline, /Try|Add/);
});

test('unknown/mixed loads are not bodyweight; explicit added load beats a bodyweight equipment tag', () => {
  for (const sets of [[{ completed: true, reps: 10, rpe: 6 }], [
    { completed: true, reps: 10, rpe: 6, weight: 20, weightUnit: 'lb' as const },
    { completed: true, reps: 10, rpe: 6, weight: 20, weightUnit: 'kg' as const },
  ]]) {
    const last = getLastLoggedExercise([record([exercise({ equipmentType: undefined, sets })])], 'pull_row')!;
    assert.equal(last.load, undefined);
    assert.match(suggestProgression(last, 1, false, 'lb', 10, 'dumbbell')!.headline, /Check/);
  }
  const weighted = getLastLoggedExercise([record([exercise({ equipmentType: 'bodyweight' })])], 'pull_row')!;
  assert.equal(weighted.load, '20 lb');
  const metric = getLastLoggedExercise([record([exercise()])], 'pull_row', 'kg')!;
  assert.equal(metric.load, '9.1 kg');
  assert.equal(getLastLoggedExercise([record([exercise({ equipmentType: 'barbell' })])], 'pull_row', 'lb', 'dumbbell')!.load, undefined);
});

test('captured load display converts explicit units without rewriting recorded weight', () => {
  const set = { weight: 50, weightUnit: 'lb' as const };
  assert.equal(strengthWeightForDisplay(set.weight, set.weightUnit, undefined, 'kg'), 22.7);
  assert.equal(strengthWeightForDisplay(undefined, undefined, '50 lb', 'kg'), 22.7);
  assert.equal(strengthWeightForDisplay(undefined, undefined, '50', 'kg'), null);
  assert.equal(strengthWeightForDisplay(50, undefined, '50 lb', 'kg'), null);
  assert.deepEqual(set, { weight: 50, weightUnit: 'lb' });
});

test('reducing already-low dose never increases one working set to two', () => {
  const baseline = generateStrengthWeek(input({ trainingPhase: 'taper' }));
  const reduced = generateStrengthWeek(input({ trainingPhase: 'taper', strengthHistory: [record([exercise()], { overallRpe: 9 })] }));
  assert.ok(reduced.sessions.every((session, i) => session.exercises.every((ex, j) => ex.sets <= baseline.sessions[i]!.exercises[j]!.sets)));
});

const start = new Date(2026, 10, 15);
function crowdedWeek() {
  const map = new Map<string, CalendarEntry[]>();
  const session = generateStrengthWeek(input()).sessions[0]!;
  for (let i = 0; i < 7; i++) {
    const date = toYMD(addDays(start, i));
    map.set(date, i === 6 ? [{ date, type: 'strength', label: session.title, color: 'blue', session, completed: false }]
      : [{ date, type: 'run', label: 'Easy Run', color: 'blue', completed: false }]);
  }
  return map;
}

test('new generated rest-day pairing is stable after completing every visible run and lift', () => {
  const map = crowdedWeek();
  const first = reserveStrengthRestDay({ calendarMap: map, weekStartDate: start, liftDays: ['Mon', 'Sat'] });
  assert.equal(first.calendarMap.size, 6);
  assert.equal(first.omittedSessionIds.length, 0);
  const before = [...first.calendarMap].flatMap(([date, entries]) => entries.filter(e => e.type === 'strength').map(e => [e.session!.id, date]));
  for (const date of map.keys()) {
    const completed = new Map([...map].map(([d, entries]) => [d, entries.map(e => ({ ...e, completed: d === date }))]));
    const after = reserveStrengthRestDay({ calendarMap: completed, weekStartDate: start, liftDays: ['Mon', 'Sat'] });
    assert.deepEqual([...after.calendarMap].flatMap(([d, entries]) => entries.filter(e => e.type === 'strength').map(e => [e.session!.id, d])), before);
  }
});

test('rest-day selection protects long runs and flags completed/active conflicts instead of dropping them', () => {
  const map = crowdedWeek();
  for (const [date, entries] of map) if (entries[0]!.type === 'run') map.set(date, [{ ...entries[0]!, label: 'Long Run' }]);
  const omitted = reserveStrengthRestDay({ calendarMap: map, weekStartDate: start, liftDays: ['Mon', 'Sat'] });
  assert.equal(omitted.omittedSessionIds.length, 1); assert.equal(omitted.calendarMap.size, 6);
  const source = [...map.values()].flat().find(e => e.type === 'strength')!;
  const active = reserveStrengthRestDay({ calendarMap: map, weekStartDate: start, liftDays: ['Sat'], activeStrengthSessionId: source.session!.id });
  assert.equal(active.calendarMap, map); assert.match(active.note!, /review/);
  source.completed = true;
  assert.equal(reserveStrengthRestDay({ calendarMap: map, weekStartDate: start, liftDays: ['Sat'] }).calendarMap, map);
});

test('new completion snapshots retain prescribed versus actual sets without inventing actual RPE', () => {
  const ex = ensureExerciseShape({ id: 'pull_row', name: 'Row', sets: 2, reps: '8–10', equipment: ['dumbbell'],
    plannedRpe: 7, plannedRestSeconds: 90, plannedLoadTarget: 'RPE7',
    setEntries: [{ id: 'a', reps: 8, weight: 20, weightUnit: 'lb', completed: true }] });
  const modified = { ...ex, setEntries: [{ ...ex.setEntries[0]!, reps: 6 }] };
  const result = completedExercisesFromActiveSession([modified], 'training_block')[0]!;
  assert.equal(result.prescription?.sets, 2); assert.equal(result.prescription?.reps, '8–10');
  assert.equal(result.prescription?.targetRpe, 7); assert.equal(result.sets[0]!.reps, 6); assert.equal(result.sets[0]!.rpe, undefined);
  assert.equal(ex.setEntries[0]!.reps, 8);
});


test('captured training workout can finish after it disappears from a new week', () => {
  const ex = ensureExerciseShape({ id: 'pull_row', name: 'Captured Row', sets: 2, reps: '8–10', equipment: ['dumbbell'],
    plannedRpe: 7, setEntries: [{ id: 'a', reps: 8, weight: 50, weightUnit: 'lb', completed: true }] });
  const active = { workoutId: 'old_week_lift', workoutName: 'Original lift', workoutInstanceId: 'old_week_lift_started_123',
    plannedDurationMin: 30, exercises: [ex], currentExerciseIndex: 0, completedExerciseIds: [], rpeByExercise: {}, loadByExercise: {},
    startedAt: 123, pausedAt: null, pausedDurationMs: 0, status: 'paused' as const, scheduledSessionId: 'week:2026-11-15:strength:old_week_lift',
    trackingContext: { completionKey: 'strength_w2_s0', week: 2, sessionType: 'full_body' as const, goal: 'force_production' as const } };
  const newWeek = generateStrengthWeek(input({ currentWeek: 9, goalType: 'general_running' }));
  assert.equal(newWeek.sessions.some(session => session.id === active.workoutId), false);
  const result = trainingBlockCompletionFromActiveSession(active, 1500);
  assert.equal(result.completionKey, 'training_block_old_week_lift_started_123');
  assert.equal(result.workoutName, 'Original lift'); assert.equal(result.week, 2);
  assert.equal(result.scheduledSessionId, active.scheduledSessionId);
  assert.equal(result.exercises[0]!.sets[0]!.weight, 50); assert.equal(result.exercises[0]!.sets[0]!.weightUnit, 'lb');
  assert.equal(result.exercises[0]!.prescription?.reps, '8–10'); assert.equal(result.overallRpe, undefined);
  assert.deepEqual(trainingBlockCompletionFromActiveSession(active, 1500), result);
  const legacy = trainingBlockCompletionFromActiveSession({ ...active, trackingContext: undefined }, 1500);
  assert.equal(legacy.source, 'manual'); assert.match(legacy.notes, /Legacy draft.*not captured/);
  assert.equal(legacy.week, 1); assert.notEqual(legacy.week, 9);
});

test('new picker load persists explicit units through restored metric display and completion', () => {
  const ex = ensureExerciseShape({ id: 'pull_row', name: 'Row', sets: 1, reps: '10', equipment: ['dumbbell'] });
  const loadByExercise = { pull_row: `${50} ${'lb'}` };
  assert.equal(strengthWeightForDisplay(undefined, undefined, loadByExercise.pull_row, 'kg'), 22.7);
  const completed = completedExercisesFromActiveSession([ex], 'training_block', ['pull_row'], {}, loadByExercise);
  assert.equal(completed[0]!.sets[0]!.weight, 50); assert.equal(completed[0]!.sets[0]!.weightUnit, 'lb');
  assert.deepEqual(loadByExercise, { pull_row: '50 lb' });
});


test('canonical completion protects a finished supporting lift before a rest-day omission', () => {
  const map = crowdedWeek();
  for (const [date, entries] of map) if (entries[0]!.type === 'run') map.set(date, [{ ...entries[0]!, label: 'Long Run' }]);
  const source = [...map.values()].flat().find(entry => entry.type === 'strength')!;
  const completionId = strengthScheduledSessionId(source.date, source.session!.id);
  const overlaid = markCapturedStrengthCompletions(map, [completionId]);
  const result = reserveStrengthRestDay({ calendarMap: overlaid, weekStartDate: start, liftDays: ['Mon', 'Sat'] });
  assert.equal(result.omittedSessionIds.length, 0); assert.equal(result.calendarMap.size, 7);
  assert.match(result.note!, /review/);
  assert.equal(markCapturedStrengthCompletions(map, [`week:1900-01-01:strength:${source.session!.id}`]).get(source.date)![0]!.completed, false);
});
