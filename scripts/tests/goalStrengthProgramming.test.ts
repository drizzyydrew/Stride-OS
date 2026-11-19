import assert from 'node:assert/strict';
import test from 'node:test';
import { generateStrengthWeek, STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { applyGoalStrengthProgramming, comparableStrengthExposures } from '../../src/utils/goalStrengthProgramming';
import { estimateStrengthSessionMinutes } from '../../src/utils/strengthDesign';
import { suggestProgression } from '../../src/utils/strengthHistory';
import type { StrengthEngineInput, StrengthLogRecord } from '../../src/types/strength';

const input = (patch: Partial<StrengthEngineInput> = {}): StrengthEngineInput => ({ programmingVersion: 2, goalScopeId: 'goal-a', goalType: 'general_strength',
  strengthLevel: 'intermediate', progressionLevel: 'advanced', trainingPhase: 'base', currentWeek: 3, weeklyMileage: 15,
  fatigueScore: 25, recoveryScore: 80, soreness: 1, injuryRisk: false, acwr: 1, weeksToRace: 0, availableTimeMin: 60,
  availableEquipment: ['bodyweight', 'dumbbell'], liftDays: ['Tue', 'Thu'], strengthHistory: [], ...patch });
const log = (id: string, exerciseId = 'squat_goblet', patch: Partial<StrengthLogRecord> = {}): StrengthLogRecord => ({
  id, sessionId: 'captured', sessionType: 'full_body', goal: 'force_production', week: 1, timestamp: Date.now() - (id === 'a' ? 8 : 4) * 86400000,
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

test('one extra main set needs two comparable actual exposures; time or attendance alone never earns it', () => {
  const baseline = generateStrengthWeek(input()).sessions[0]!.exercises[0]!;
  assert.equal(baseline.sets, 2);
  const supported = generateStrengthWeek(input({ strengthHistory: [log('a'), log('b')] })).sessions[0]!.exercises[0]!;
  assert.equal(supported.sets, 3);
  for (const patch of [{ currentWeek: 9 }, { strengthHistory: [log('a')] }, { recoveryScore: 200 }, { fatigueScore: -1 }, { acwr: -1 }, { recoveryScore: NaN }]) {
    assert.ok(generateStrengthWeek(input(patch)).sessions[0]!.exercises[0]!.sets <= 2);
  }
  const missing = log('a'); missing.exercises[0]!.sets.forEach(set => { delete set.rpe; });
  assert.equal(generateStrengthWeek(input({ strengthHistory: [missing, log('b')] })).sessions[0]!.exercises[0]!.sets, 2);
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
  assert.notEqual(first, generateStrengthWeek(input({ currentWeek: 5 })).sessions[0]!.id);
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
