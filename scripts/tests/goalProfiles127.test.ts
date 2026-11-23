import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGoalIntent, legacyGoalForProfile, legacySupportingForIntent } from '../../src/utils/goalIntent';
import { profileExerciseIds } from '../../src/utils/goalProfileProgramming';
import { buildMacroPlan } from '../../src/utils/plan/macroPlanner';
import { generateStrengthWeek } from '../../src/utils/strengthEngine';
import { generateRichWeek } from '../../src/utils/workoutEngine';
import { estimateStrengthSessionMinutes } from '../../src/utils/strengthDesign';
import type { GoalIntent, GoalProfileId } from '../../src/types/goalIntent';
import type { StrengthEngineInput } from '../../src/types/strength';
import type { WorkoutEngineInput } from '../../src/types/workout';
const intent = (primary: GoalProfileId, patch: Partial<GoalIntent> = {}): GoalIntent => ({ version: 1, priorities: [primary], ...patch });
const strength = (primary: GoalProfileId, patch: Partial<StrengthEngineInput> = {}): StrengthEngineInput => ({
 programmingVersion: 2, goalIntent: intent(primary), goalType: legacyGoalForProfile(primary), goalScopeId: 'profiles-127',
 strengthLevel: 'intermediate', progressionLevel: 'intermediate', trainingPhase: 'base', currentWeek: 5, weeklyMileage: 15,
 fatigueScore: 25, recoveryScore: 85, soreness: 1, injuryRisk: false, acwr: 1, weeksToRace: 0, availableTimeMin: 60,
 availableEquipment: ['bodyweight', 'dumbbell', 'band'], liftDays: ['Tue', 'Thu'], strengthHistory: [], ...patch,
});
const aerobic = (primary: GoalProfileId, patch: Partial<WorkoutEngineInput> = {}): WorkoutEngineInput => ({
 programmingVersion: 2, goalIntent: intent(primary), goalType: legacyGoalForProfile(primary), goalScopeId: 'profiles-127',
 referenceDate: '2026-08-17', runningHistory: [], calibration: null, fatigueSensitivity: 1, recoveryResponsiveness: 1,
 injuryRisk: false, fatigueScore: 25, recoveryScore: 85, soreness: 1, motivation: 8, acwr: 1, trainingPhase: 'vo2',
 progressionLevel: 'intermediate', weeklyMileage: 15, currentWeek: 5, goalRace: 'sub_25_5k', weeksToRace: 0,
 recentIntensityDist: { easy: 20, moderate: 0, hard: 0 }, recentHardSessions: 0, adherenceRate: 1,
 consistencyScore: 90, longRunConsistency: 1, trainingStyle: 'mixed', ...patch,
});
const macro = (goalIntent?: GoalIntent) => buildMacroPlan({ programmingVersion: 2, goalType: goalIntent ? legacyGoalForProfile(goalIntent.priorities[0]!) : 'hybrid',
 goalIntent, startDate: '2026-08-02', races: [], progressionLevel: 'intermediate', yearsRunning: 3, weeklyMileage: 20 });

test('goal intent validates ordered unique priorities and preserves lossy legacy compatibility', () => {
 const value = intent('hiking', { priorities: ['hiking', 'build_muscle', 'get_faster'] });
 assert.deepEqual(validateGoalIntent(value)?.priorities, value.priorities);
 assert.deepEqual(legacySupportingForIntent(value), ['general_strength', 'get_faster']);
 assert.equal(validateGoalIntent(undefined), undefined);
 for (const priorities of [[], ['running', 'running'], ['running', 'hiking', 'power', 'get_faster'], ['running', 'race_prep']]) {
  assert.throws(() => validateGoalIntent({ version: 1, priorities } as GoalIntent));
 }
 assert.throws(() => validateGoalIntent(intent('hiking', { eventDate: '2026-99-99' })));
});

test('easy base never borrows quality and a block without an event never tapers', () => {
 const goalIntent = intent('aerobic_base', { priorities: ['aerobic_base', 'get_faster'] });
 const plan = macro(goalIntent);
 assert.ok(plan.weeks.every(week => ['base', 'foundation', 'deload'].includes(week.phase)));
 assert.ok(plan.weeks.every(week => !week.isTaper && !week.isRaceWeek));
 const week = generateRichWeek(aerobic('aerobic_base', { goalIntent }));
 assert.ok(week.workouts.every(workout => !workout.intervals && !['vo2', 'threshold', 'strides', 'fartlek'].includes(workout.richType)));
 const event = macro(intent('hiking', { eventDate: '2026-09-20' }));
 assert.ok(event.weeks.some(week => week.phase === 'taper'));
 assert.ok(event.weeks.some(week => week.phase === 'recovery'));
 assert.equal(macro().goalIntent, undefined);
});

test('outdoor profiles change real main exercises, retain bounds, and distinguish balance from strength', () => {
 const expected = { hiking: 'hike_step_up', downhill_skiing: 'ski_split_squat', snowboarding: 'snowboard_offset_squat', cross_country_skiing: 'xc_single_leg_step', mountaineering: 'mountaineering_step_up' } as const;
 for (const [profile, first] of Object.entries(expected)) {
  const week = generateStrengthWeek(strength(profile as GoalProfileId));
  const session = week.sessions[0]!;
  assert.equal(session.exercises.find(exercise=>exercise.exerciseId!=='foot_clock_reach')!.exerciseId, first);
  assert.ok(session.exercises.every(exercise => exercise.sets <= 5 && exercise.rpe <= 8));
  assert.ok(estimateStrengthSessionMinutes(session.exercises) <= 60);
  assert.equal(session.goalProfile, profile);
  const short = generateStrengthWeek(strength(profile as GoalProfileId, { availableTimeMin: 20 }));
  assert.ok(short.sessions.every(item => estimateStrengthSessionMinutes(item.exercises) <= 20));
  const inSeason = generateStrengthWeek(strength(profile as GoalProfileId, { goalIntent: intent(profile as GoalProfileId, { season: 'in_season' }) }));
  assert.ok(inSeason.sessions.every(item => item.exercises.every(exercise => exercise.sets <= 1)));
 }
 const full = generateStrengthWeek(strength('running', { availableTimeMin: 90 }));
 const balance = full.sessions.flatMap(session => session.exercises).find(exercise => exercise.exerciseId === 'foot_clock_reach');
 assert.ok(balance);
 assert.deepEqual(balance.repRange, [3, 3]);
 assert.equal(balance.sets, 2);
 assert.equal(balance.repScheme?.perSide, true);
});

test('sport aerobic prescriptions have effort/time targets and no invented distance or running pace', () => {
 for (const profile of ['hiking', 'downhill_skiing', 'snowboarding', 'cross_country_skiing', 'mountaineering'] as const) {
  const week = generateRichWeek(aerobic(profile));
  const work = week.workouts.filter(workout => !['rest', 'mobility', 'strength'].includes(workout.richType));
  assert.ok(work.length > 0);
  assert.ok(work.every(workout => workout.richType === 'cross_training' && workout.targetDistance === 0 && !workout.intervals));
  assert.ok(work.every(workout => workout.paceTargetSource === 'effort' && workout.goalProfile === profile));
  assert.ok(work.every(workout => workout.instructions.join(' ').includes('Terrain, descent and actual sport practice count')));
 }
});

test('power and muscle focus use distinct prescriptions and recovery overrides both', () => {
 const muscle = generateStrengthWeek(strength('build_muscle')).sessions[0]!.exercises[0]!;
 const power = generateStrengthWeek(strength('power')).sessions[0]!.exercises[0]!;
 assert.deepEqual(muscle.repRange, [8, 12]);
 assert.deepEqual(power.repRange, [2, 5]);
 assert.ok(power.rpe <= 6 && power.restSeconds >= 120 && power.loadTarget.includes('purposeful speed'));
 for (const primary of ['build_muscle', 'power', 'get_stronger'] as const) {
  const recovering = generateStrengthWeek(strength(primary, { recoveryScore: 35, fatigueScore: 80 }));
  assert.ok(recovering.sessions.every(session => session.exercises.every(exercise => exercise.sets <= 1 && exercise.rpe <= 6)));
 }
});

test('supporting goals replace lower priority roles rather than adding sessions or hiding tertiary selection', () => {
 const fallback = ['squat_goblet', 'push_pushup', 'pull_row', 'hinge_rdl', 'lunge_reverse', 'calf_single_standing', 'trunk_dead_bug'];
 const ids = profileExerciseIds(intent('running', { priorities: ['running', 'hiking', 'snowboarding'] }), fallback, 0);
 assert.deepEqual(ids.slice(0, 3), fallback.slice(0, 3));
 assert.equal(ids[4], 'hike_step_up');
 assert.equal(profileExerciseIds(intent('running', { priorities: ['running', 'hiking', 'snowboarding'] }), fallback, 1)[5], 'snowboard_offset_squat');
 assert.equal(ids.length, fallback.length);
 const input = strength('running', { goalIntent: intent('running', { priorities: ['running', 'hiking', 'snowboarding'] }) });
 assert.equal(generateStrengthWeek(input).sessions.length, generateStrengthWeek(strength('running')).sessions.length);
});

test('Run farther reallocates a bounded easy week toward sustained work rather than adding total volume', async () => {
 const { fitRunningWeekToVolume } = await import('../../src/utils/training/runningVolume');
 const template = generateRichWeek(aerobic('aerobic_base')).workouts.find(workout => workout.richType === 'easy_run')!;
 const candidates = ['easy_run','easy_run','easy_run','long_run'].map((type,index) => ({ ...template, id: `candidate${index}`, richType: type as typeof template.richType, type: type as typeof template.type, durationMinutes: 100 }));
 const base = fitRunningWeekToVolume(aerobic('aerobic_base'), candidates);
 const farther = fitRunningWeekToVolume(aerobic('run_farther'), candidates);
 const long = (workouts: typeof candidates) => workouts.find(workout => workout.richType === 'long_run')!.durationMinutes;
 assert.ok(long(farther.workouts) > long(base.workouts));
 assert.equal(farther.budget.minutes, base.budget.minutes);
 assert.ok(long(farther.workouts) <= farther.budget.minutes * 0.35);
});

test('supporting muscle and power goals receive matching dose without replacing primary hinge', () => {
 const fallback = ['squat_goblet','push_pushup','pull_row','hinge_rdl','lunge_reverse','calf_single_standing','trunk_dead_bug'];
 const ids = profileExerciseIds(intent('get_stronger', { priorities: ['get_stronger','hiking','power'] }), fallback, 0);
 assert.deepEqual(ids.slice(0,4), fallback.slice(0,4));
 const power = generateStrengthWeek(strength('running', { goalIntent: intent('running', { priorities: ['running','power'] }) })).sessions[0]!.exercises.find(exercise=>exercise.loadTarget.includes('purposeful speed'))!;
 assert.deepEqual(power.repRange,[2,5]);
 assert.ok(power.loadTarget.includes('purposeful speed'));
 const muscle = generateStrengthWeek(strength('running', { goalIntent: intent('running', { priorities: ['running','build_muscle'] }) })).sessions[0]!.exercises.find(exercise=>exercise.repRange[0]===8&&exercise.repRange[1]===12&&exercise.exercise.pattern==='lunge')!;
 assert.deepEqual(muscle.repRange,[8,12]);
});

test('outdoor primary retains sport stimulus and permits at most one supporting run without borrowing ski fitness', () => {
 const goalIntent = intent('hiking',{priorities:['hiking','get_faster']});
 const week = generateRichWeek(aerobic('hiking',{goalIntent}));
 const work = week.workouts.filter(workout=>!['rest','mobility','strength'].includes(workout.richType));
 assert.ok(work.filter(workout=>workout.richType==='cross_training').length>=1);
 assert.ok(work.filter(workout=>workout.richType!=='cross_training').length<=1);
 assert.ok(work.every(workout=>!workout.intervals)); // no actual running quality evidence
 const onlyOne = generateRichWeek(aerobic('hiking',{goalIntent, runDays:['Mon'], availableDays:['Mon']}));
 assert.ok(onlyOne.workouts.filter(workout=>!['rest','mobility','strength'].includes(workout.richType)).every(workout=>workout.richType==='cross_training'));
 const invalid = generateStrengthWeek(strength('running',{recoveryScore:NaN, availableTimeMin:90}));
 assert.ok(invalid.sessions.every(session=>session.exercises.every(exercise=>exercise.sets<=1)));
});

test('existing outdoor mobility slots use the relevant curated preparation without adding days or time', () => {
 const legacy = generateRichWeek(aerobic('running',{goalIntent:undefined, trainingPhase:'foundation'}));
 const sport = generateRichWeek(aerobic('cross_country_skiing',{trainingPhase:'foundation'}));
 const before = legacy.workouts.filter(workout=>workout.richType==='mobility');
 const after = sport.workouts.filter(workout=>workout.richType==='mobility');
 assert.equal(after.length,before.length);
 assert.ok(after.length>0);
 assert.ok(after.every((workout,index)=>workout.durationMinutes<=before[index]!.durationMinutes && workout.mainSet.some(segment=>segment.label==='shoulder wall slides')));
 assert.ok(after.every(workout=>workout.title.includes('Cross-Country Skiing')));
});

test('30-minute two-lift running and outdoor plans retain fresh balance and direct calf work without displacing main roles', () => {
 for(const profile of ['running','race_prep','get_faster','aerobic_base','run_farther','hybrid','hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering'] as const) {
  const week=generateStrengthWeek(strength(profile,{availableTimeMin:30,currentWeek:5}));
  assert.equal(week.sessions.length,2);
  for(const session of week.sessions) {
   assert.equal(session.exercises[0]!.exerciseId,'foot_clock_reach', `${profile}: balance while fresh`);
   assert.equal(session.exercises[0]!.sets,1);
   assert.ok(session.exercises.some(exercise=>exercise.exercise.pattern==='calf_ankle'), `${profile}: calf strength remains`);
   assert.ok(estimateStrengthSessionMinutes(session.exercises)<=30);
   assert.ok(session.warmupProtocol.includes('Do not repeat'));
   assert.ok(!session.exercises.some(exercise=>exercise.exercise.pattern==='plyometric'));
  }
  const balanceRounds=week.sessions.reduce((sum,session)=>sum+session.exercises.filter(exercise=>exercise.exerciseId==='foot_clock_reach').reduce((n,exercise)=>n+exercise.sets,0),0);
  assert.equal(balanceRounds,2);
  const allRows=week.sessions.reduce((sum,session)=>sum+session.exercises.reduce((total,exercise)=>total+exercise.sets,0),0);
  assert.equal(week.weeklyVolumeSets,allRows-balanceRounds);
  if(profile==='cross_country_skiing')assert.ok(week.sessions.every(session=>session.warmupProtocol.includes('shoulder wall slides')));
 }
 const running=generateStrengthWeek(strength('running',{availableTimeMin:30}));
 for(const session of running.sessions)assert.ok(['squat_goblet','hinge_rdl','push_pushup','pull_row'].every(id=>session.exercises.some(exercise=>exercise.exerciseId===id)));
 for(const profile of ['get_stronger','build_muscle','power'] as const)assert.ok(generateStrengthWeek(strength(profile,{availableTimeMin:30})).sessions.every(session=>session.exercises[0]!.exerciseId!=='foot_clock_reach'));
});


test('race preparation retains small foot/balance roles through taper without adding hard work or jumps', () => {
 for(const trainingPhase of ['base','taper','recovery'] as const) {
  const week=generateStrengthWeek(strength('race_prep',{availableTimeMin:30,trainingPhase,weeksToRace:trainingPhase==='taper'?1:8}));
  assert.ok(week.sessions.length>0);
  for(const session of week.sessions) {
   assert.ok(session.exercises.some(exercise=>exercise.exerciseId==='foot_clock_reach'));
   assert.ok(session.exercises.some(exercise=>exercise.exercise.pattern==='calf_ankle'));
   assert.ok(estimateStrengthSessionMinutes(session.exercises)<=30);
   assert.ok(!session.exercises.some(exercise=>exercise.exercise.pattern==='plyometric'));
   if(trainingPhase!=='base')assert.ok(session.exercises.every(exercise=>exercise.sets<=1&&exercise.rpe<=6));
  }
 }
});
