import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMacroPlan, macroWeekForDate } from '../../src/utils/plan/macroPlanner';
import { getGoalMesocycle } from '../../src/utils/plan/goalMesocycle';
import { getPlanTemplateForDistance } from '../../src/utils/periodization';
import { generateRichWeek, buildRichDay } from '../../src/utils/workoutEngine';
import { runningSpecificityDecision, validReportedRunningQuality } from '../../src/utils/training/runningSpecificity';
import { buildSpecificityWorkout } from '../../src/utils/training/runningSpecificityWorkout';
import { fitRunningWeekToVolume, runningVolumeBudget } from '../../src/utils/training/runningVolume';
import { actualRunningHistory } from '../../src/utils/training/runningSpecificity';
import type { WorkoutEngineInput } from '../../src/types/workout';
import type { CompletedWorkoutRecord, RunningQualityFeedback } from '../../src/types/training';

const DAY = 86_400_000;
const referenceDate = '2026-08-17';
const now = new Date(`${referenceDate}T12:00:00`).getTime();
function record(daysAgo: number, patch: Partial<CompletedWorkoutRecord> = {}): CompletedWorkoutRecord {
  return { id: `run-${daysAgo}`, workoutId: 'easy_run', type: 'easy_run', intensity: 'easy', durationMinutes: 65,
    actualDurationMinutes: 65, estimatedLoad: 50, estimatedDistanceMiles: 6, timestamp: now - daysAgo * DAY,
    week: 1, completed: true, fatigueBefore: 20, fatigueAfter: 30, fatigueDelta: 10, recoveryBefore: 80, recoveryDelta: -10,
    rpe: 4, ...patch };
}
function history(): CompletedWorkoutRecord[] {
  return Array.from({ length: 12 }, (_, week) => [1, 3, 5].map(day => record(week * 7 + day))).flat();
}
function report(daysAgo: number, rung: RunningQualityFeedback['rung'], reps: number, seconds: number, patch: Partial<RunningQualityFeedback> = {}) {
  return record(daysAgo, { type: 'vo2', intensity: 'hard', runningQuality: { version: 1, source: 'athlete_reported', rung,
    completedReps: reps, workSeconds: seconds, rpe: 7, comfortableRecovery: true, recordedAt: now - DAY, ...patch } });
}
function input(patch: Partial<WorkoutEngineInput> = {}): WorkoutEngineInput {
  return { programmingVersion: 2, goalType: 'general_running', referenceDate, runningHistory: history(), calibration: null,
    fatigueSensitivity: 1, recoveryResponsiveness: 1, injuryRisk: false, fatigueScore: 25, recoveryScore: 85, soreness: 1,
    motivation: 8, acwr: 1, trainingPhase: 'vo2', progressionLevel: 'advanced', weeklyMileage: 30, currentWeek: 10,
    goalRace: 'sub_25_5k', weeksToRace: 10, recentIntensityDist: { easy: 20, moderate: 0, hard: 0 }, recentHardSessions: 0,
    adherenceRate: 1, consistencyScore: 90, longRunConsistency: 1, trainingStyle: 'mixed', ...patch };
}
function withReports(...reports: CompletedWorkoutRecord[]) { return [...history(), ...reports]; }

test('new-goal macro templates distinguish short race aerobic power from long-race specificity', () => {
  assert.ok(getPlanTemplateForDistance('5k', 2).phases.some(phase => phase.phase === 'vo2'));
  assert.ok(!getPlanTemplateForDistance('marathon', 2).phases.some(phase => phase.phase === 'vo2'));
  const legacy = buildMacroPlan({ goalType: 'hybrid', startDate: '2026-01-04', races: [], progressionLevel: 'intermediate', yearsRunning: 3, weeklyMileage: 20 });
  const current = buildMacroPlan({ goalType: 'hybrid', startDate: '2026-01-04', races: [], progressionLevel: 'intermediate', yearsRunning: 3, weeklyMileage: 20, programmingVersion: 2 });
  assert.equal(legacy.programmingVersion, undefined);
  assert.ok(legacy.weeks.every(week => !week.mesocycle));
  assert.equal(current.weeks[0]!.phase, 'aerobic_development');
  assert.equal(current.weeks[6]!.phase, 'base');
  assert.equal(current.weeks[12]!.phase, 'threshold');
  assert.equal(current.weeks[18]!.phase, 'vo2');
  assert.equal(current.weeks[3]!.phase, 'deload');
  assert.equal(current.weeks[6]!.mesocycle!.blockNumber, 2);
});

test('foundation, practice-block review and recovery cadence are explicit separate clocks', () => {
  const plan = buildMacroPlan({ goalType: 'general_running', startDate: '2026-01-04', races: [], progressionLevel: 'beginner', yearsRunning: 0, weeklyMileage: 5, programmingVersion: 2 });
  assert.equal(plan.weeks[0]!.phase, 'foundation');
  assert.equal(plan.weeks[5]!.phase, 'foundation');
  assert.equal(plan.weeks[6]!.phase, 'aerobic_development');
  assert.equal(getGoalMesocycle(6, 'base', 'hybrid').doseStage, 'review');
  assert.equal(getGoalMesocycle(7, 'base', 'hybrid').weekInBlock, 1);
  assert.equal(getGoalMesocycle(8, 'base', 'hybrid').loadingWeek, 4);
  assert.equal(getGoalMesocycle(8, 'base', 'hybrid').doseStage, 'recover');
});

test('new-goal race scaling preserves exact event week and taper at short and long horizons', () => {
  for (const length of [6, 7, 8, 12, 16, 22, 30]) {
    const start = new Date('2026-01-04T12:00:00');
    const date = new Date(start.getTime() + (length - 1) * 7 * DAY).toISOString().slice(0, 10);
    const plan = buildMacroPlan({ goalType: 'race_prep', startDate: '2026-01-04', races: [{ id: 'race', name: 'Goal 5K', date, distance: '5k', priority: 'A' }],
      progressionLevel: 'advanced', yearsRunning: 5, weeklyMileage: 30, programmingVersion: 2 });
    assert.equal(plan.weeks.find(week => week.isRaceWeek)?.weekNumber, length, `race week ${length}`);
    assert.equal(plan.weeks[length - 1]!.phase, 'taper');
    assert.equal(plan.weeks[length - 2]!.phase, 'taper');
    assert.equal(plan.weeks.filter(week => week.phase === 'taper').length, 2, `two taper weeks at horizon ${length}`);
    assert.equal(macroWeekForDate(plan, start)?.mesocycle?.blockNumber, 1);
  }
});

test('calendar, planned quality labels and completion flags alone never earn formal speed work', () => {
  const unknown = history().map(({ actualDurationMinutes: _, ...rest }) => rest);
  assert.equal(runningSpecificityDecision(input({ runningHistory: unknown })).stage, 'easy');
  assert.equal(runningSpecificityDecision(input()).stage, 'strides');
  assert.equal(runningSpecificityDecision(input({ currentWeek: 1 })).stage, 'easy');
  for (const phase of ['foundation', 'deload', 'taper', 'recovery', 'transition'] as const)
    assert.equal(runningSpecificityDecision(input({ trainingPhase: phase })).stage, 'easy');
});

test('short actual exposures cannot skip directly into threshold or long intervals', () => {
  const tiny = withReports(report(8, 'gentle_fartlek', 1, 5));
  const fartlek = runningSpecificityDecision(input({ runningHistory: tiny }));
  assert.equal(fartlek.stage, 'gentle_fartlek');
  assert.ok(fartlek.reps * fartlek.workSeconds < 60);
  const threshold = runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'tempo_threshold', 1, 5)) }));
  assert.equal(threshold.stage, 'tempo_threshold');
  assert.ok(threshold.reps * threshold.workSeconds < 60);
});

test('actual repeated doses earn gradual exposure and four-by-two to three to four-minute progression', () => {
  assert.equal(runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'strides', 4, 15), report(16, 'strides', 4, 15)) })).stage, 'gentle_fartlek');
  assert.equal(runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'gentle_fartlek', 4, 60), report(16, 'gentle_fartlek', 4, 60)) })).stage, 'tempo_threshold');
  const first = runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'tempo_threshold', 3, 120), report(16, 'tempo_threshold', 3, 120)) }));
  assert.equal(first.stage, 'intervals'); assert.equal(first.workSeconds, 120);
  const next = runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'intervals', 4, 120)) }));
  assert.equal(next.workSeconds, 150); assert.equal(next.allowNorwegian, false);
  const before = runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'intervals', 4, 150)) }));
  assert.equal(before.workSeconds, 180); assert.equal(before.allowNorwegian, false);
  const final = runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180)) }));
  assert.equal(final.stage, 'norwegian_4x4'); assert.equal(final.workSeconds, 240);
});

test('threshold goals, beginners, missing readiness and poor hybrid recovery cannot schedule four-by-four', () => {
  const reports = withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180));
  for (const patch of [{ progressionLevel: 'beginner' as const }, { trainingStyle: 'threshold' as const }, { trainingPhase: 'threshold' as const },
    { goalType: 'general_strength' as const }, { goalType: 'hybrid' as const, fatigueScore: 78 }, { recoveryScore: Number.NaN }, { acwr: Number.NaN },
    { recentHardSessions: 2 }, { injuryRisk: true }, { goalType: 'race_prep' as const, weeksToRace: 2 }]) {
    assert.equal(runningSpecificityDecision(input({ runningHistory: reports, ...patch })).allowNorwegian, false, JSON.stringify(patch));
  }
  assert.equal(runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'intervals', 4, 180, { comfortableRecovery: false })) })).stage, 'strides');
  assert.equal(runningSpecificityDecision(input({ runningHistory: withReports(report(8, 'intervals', 4, 180, { rpe: 2 }), report(16, 'intervals', 4, 180, { rpe: 2 })) })).allowNorwegian, false);
});

test('generated four-by-four has exact ordered targets and recoveries and effort fallback', () => {
  const ready = input({ runningHistory: withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180)) });
  const workouts = generateRichWeek(ready).workouts;
  const quality = workouts.find(workout => workout.protocol === 'norwegian_4x4')!;
  assert.ok(quality);
  assert.equal(workouts.filter(workout => ['hard', 'max'].includes(workout.intensity)).length, 1);
  assert.equal(quality.type, 'norwegian_4x4'); assert.equal(quality.durationMinutes, 40);
  assert.deepEqual(quality.mainSet.map(segment => segment.targetSeconds), [240, 180, 240, 180, 240, 180, 240]);
  assert.equal(quality.warmup.targetSeconds, 600); assert.equal(quality.cooldown.targetSeconds, 300);
  assert.equal(quality.paceTargetSource, 'effort');
  assert.match(quality.paceGuidance.targetPace, /Controlled hard/);
  assert.match(quality.purpose, /distinct from lactate-threshold/);
  assert.equal(buildRichDay('vo2', ready, 1).protocol, 'norwegian_4x4');
  const short = buildSpecificityWorkout({ ...quality, durationMinutes: 25 }, runningSpecificityDecision(ready), false);
  assert.equal(short.protocol, undefined); assert.equal(short.richType, 'easy_run'); assert.equal(short.durationMinutes, 25);
  assert.ok(!/4×4/.test(short.title));
});

test('legacy running output is preserved and invalid reports fail the shared contract', () => {
  const old = generateRichWeek(input({ programmingVersion: undefined, runningHistory: [] }));
  const same = generateRichWeek(input({ programmingVersion: 1, runningHistory: history() }));
  assert.deepEqual(old.workouts.map(w => [w.richType, w.durationMinutes, w.intervals]), same.workouts.map(w => [w.richType, w.durationMinutes, w.intervals]));
  assert.equal(validReportedRunningQuality({ version: 1, source: 'athlete_reported', rung: 'strides', completedReps: 4, workSeconds: 60, rpe: 5, comfortableRecovery: true }, 30), false);
});

test('new-goal slot identity survives quality changes and cannot complete a different goal', () => {
  const easy = generateRichWeek(input({ goalScopeId: 'goal A', runningHistory: [] })).workouts;
  const advanced = generateRichWeek(input({ goalScopeId: 'goal A', runningHistory: withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180)) })).workouts;
  assert.deepEqual(easy.map(w => w.id), advanced.map(w => w.id));
  const other = generateRichWeek(input({ goalScopeId: 'goal B' })).workouts;
  assert.ok(other.every((workout, index) => workout.id !== easy[index]!.id));
  const nextWeek = generateRichWeek(input({ goalScopeId: 'goal A', currentWeek: 11 })).workouts;
  assert.ok(nextWeek.every((workout, index) => workout.id !== easy[index]!.id));
  assert.equal(buildRichDay('vo2', input({ goalScopeId: 'goal A' }), 1).id, easy[1]!.id);
});

test('weekly Tuesday quality is spaced from the candidate Tuesday rather than the preceding Sunday', () => {
  const tuesday = report(6, 'intervals', 4, 120); // Tue Aug11, five days before this plan's Sunday.
  const week = generateRichWeek(input({ referenceDate: '2026-08-16', recentHardSessions: 1,
    runningHistory: withReports(tuesday), availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }));
  const quality = week.workouts.find(workout => workout.richType === 'vo2');
  assert.ok(quality, 'Tuesday Aug18 is seven days after the prior Tuesday; do not inadvertently force a two-week cadence');
  assert.equal(quality.intervals?.workLabel, '2.5 min');
  const tooClose = generateRichWeek(input({ referenceDate: '2026-08-16', recentHardSessions: 1,
    runningHistory: withReports(report(1, 'intervals', 4, 120)) }));
  assert.ok(tooClose.workouts.every(workout => workout.richType !== 'vo2'));
});

test('race-specific phase practices current event effort rather than adding another VO2 protocol', () => {
  const work = generateRichWeek(input({ goalType: 'race_prep', raceDistance: 'marathon', trainingPhase: 'race_specific',
    runningHistory: withReports(report(8, 'tempo_threshold', 3, 120), report(16, 'tempo_threshold', 3, 120)) })).workouts;
  const racePractice = work.find(workout => workout.title === 'Race-Specific Pace Practice');
  assert.ok(racePractice); assert.equal(racePractice.protocol, undefined);
  assert.equal(racePractice.paceTargetSource, 'effort');
  assert.match(racePractice.purpose, /event-specific/);
});

test('three-run hybrid weeks retain earned relaxed accelerations instead of dropping them behind easy slots', () => {
  const week = generateRichWeek(input({ goalType: 'hybrid', trainingPhase: 'aerobic_development', runDays: ['Mon', 'Wed', 'Sat'] }));
  assert.equal(week.workouts.filter(workout => workout.richType === 'strides').length, 1);
  assert.equal(week.workouts.filter(workout => workout.richType === 'long_run').length, 1);
  assert.equal(week.workouts.filter(workout => workout.durationMinutes > 0).length, 3);
});

test('out-of-range state and exact recording aliases cannot earn quality or inflate observed weeks', () => {
  const reports = withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180));
  for (const patch of [{ recoveryScore: 200 }, { fatigueScore: -1 }, { acwr: -1 }, { recentHardSessions: -1 }])
    assert.equal(runningSpecificityDecision(input({ runningHistory: reports, ...patch })).stage, 'easy');
  const one = { ...report(8, 'intervals', 4, 180), workoutInstanceId: 'same-physical-run' };
  const aliases = [one, { ...one, id: 'restored-alias' }];
  assert.equal(actualRunningHistory(aliases, now).length, 1);
  assert.equal(runningSpecificityDecision(input({ runningHistory: [...history(), ...aliases] })).allowNorwegian, false);
});

test('new-goal volume uses actual full weeks and does not grow total time while faster work increases', () => {
  const stage = input({ runningHistory: withReports(report(8, 'intervals', 4, 120)), runDays: ['Mon', 'Wed', 'Sat'] });
  const week = generateRichWeek(stage);
  const budget = runningVolumeBudget(stage, week.workouts);
  assert.equal(budget.source, 'actual_full_weeks'); assert.equal(budget.decision, 'hold');
  assert.ok(week.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0) <= budget.minutes);
  const extraCurrentWeek = [...stage.runningHistory!, record(0, { actualDurationMinutes: 300 })];
  assert.equal(runningVolumeBudget({ ...stage, runningHistory: extraCurrentWeek }, week.workouts).baselineMinutes, budget.baselineMinutes);
  for (const workout of week.workouts) {
    const seconds = [workout.warmup, ...workout.mainSet, workout.cooldown].reduce((sum, segment) => sum + (segment.targetSeconds ?? 0), 0);
    if (workout.durationMinutes > 0) assert.ok(Math.abs(seconds / 60 - workout.durationMinutes) < 0.01);
    if (workout.richType === 'long_run') assert.ok(workout.durationMinutes <= budget.minutes * 0.35);
  }
});

test('low or unknown starting capacity cannot jump from short foundation work into several hours', () => {
  const low = input({ weeklyMileage: 3, runningHistory: [], trainingPhase: 'aerobic_development', currentWeek: 7, runDays: ['Mon', 'Wed', 'Sat'] });
  const week = generateRichWeek(low);
  assert.ok(week.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0) <= 30);
  assert.ok(week.workouts.every(workout => !workout.intervals));
  assert.match(week.progressionNote, /assumed ten minutes per mile/);
  const unknown = generateRichWeek({ ...low, weeklyMileage: 0 });
  assert.ok(unknown.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0) <= 60);
  assert.match(unknown.progressionNote, /assumed sixty-minute/);
});

test('recovery, interruption and protocol-budget changes reduce actual targets without relabeling partial four-by-four', () => {
  const ready = input({ runningHistory: withReports(report(8, 'intervals', 4, 180), report(16, 'intervals', 4, 180)), runDays: ['Mon', 'Wed', 'Sat'] });
  const quality = generateRichWeek(ready).workouts.find(workout => workout.protocol === 'norwegian_4x4')!;
  assert.ok(quality);
  const shortCapacity = [record(8, { actualDurationMinutes: 10 }), record(10, { actualDurationMinutes: 10 })];
  const fitted = fitRunningWeekToVolume({ ...ready, runningHistory: shortCapacity }, [quality]);
  assert.equal(fitted.workouts[0]!.protocol, undefined);
  assert.ok(fitted.workouts[0]!.durationMinutes <= 20);
  const normal = generateRichWeek(input({ runDays: ['Mon', 'Wed', 'Sat'] }));
  const recoveryInput = input({ trainingPhase: 'deload', currentWeek: 12, runDays: ['Mon', 'Wed', 'Sat'] });
  const recovery = generateRichWeek(recoveryInput);
  assert.ok(recovery.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0) < normal.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0));
  const gap = runningVolumeBudget(input({ runningHistory: [record(75)] }), []);
  assert.equal(gap.decision, 'regress'); assert.ok(gap.minutes <= 60);
  const oldWeekOnly = runningVolumeBudget(input({ runningHistory: [record(19, { actualDurationMinutes: 200 })] }), []);
  assert.equal(oldWeekOnly.decision, 'regress'); assert.ok(oldWeekOnly.minutes <= 60);
  const recentOnly = runningVolumeBudget(input({ runningHistory: [record(3, { actualDurationMinutes: 50 })] }), []);
  assert.equal(recentOnly.decision, 'hold'); assert.equal(recentOnly.minutes, 50);
});

test('easy volume only gains a small ceiling from repeated explicit manageable actuals', () => {
  const easy = input({ trainingPhase: 'base', runningHistory: history(), runDays: ['Mon', 'Wed', 'Sat'] });
  const noQuality = generateRichWeek({ ...easy, trainingStyle: 'base_only' }).workouts;
  assert.equal(runningVolumeBudget(easy, noQuality).decision, 'progress');
  const noEffort = history().map(({ rpe: _, ...rest }) => rest);
  assert.equal(runningVolumeBudget({ ...easy, runningHistory: noEffort }, noQuality).decision, 'hold');
  const cap = runningVolumeBudget(easy, noQuality);
  assert.ok(cap.minutes <= cap.baselineMinutes * 1.05);
});

test('seven available days never mean seven running days in new generated goals', () => {
  const week = generateRichWeek(input({ trainingPhase: 'base', availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], runDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }));
  assert.ok(week.workouts.filter(workout => workout.durationMinutes > 0 && workout.richType !== 'mobility').length <= 6);
  assert.ok(week.workouts.some(workout => workout.richType === 'rest'));
});

test('malformed calibrated pace cannot inflate a reported starting-time ceiling', () => {
  const broken = { paceZones: { easy: { minSecPerMi: 5000, maxSecPerMi: 1000 } } } as WorkoutEngineInput['calibration'];
  const budget = runningVolumeBudget(input({ runningHistory: [], weeklyMileage: 3, calibration: broken }), []);
  assert.equal(budget.minutes, 30); assert.match(budget.rationale, /assumed ten minutes/);
});
