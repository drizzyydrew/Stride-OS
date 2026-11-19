import type { CompletedWorkoutRecord, RunningQualityFeedback } from '../../types/training';
import type { WorkoutEngineInput, RichWorkoutType } from '../../types/workout';
import { normalizeRunningQuality } from '../runningQualityFeedback';

export type RunningQualityRung = 'strides' | 'gentle_fartlek' | 'tempo_threshold' | 'intervals' | 'norwegian_4x4';
export type ReportedRunningQuality = RunningQualityFeedback;
export type SpecificityDecision = {
  target?: 'race_pace';
  calibratedRacePaceSecPerMile?: number;
  stage: 'easy' | RunningQualityRung;
  reps: number;
  workSeconds: number;
  recoverySeconds: number;
  allowNorwegian: boolean;
  consistentWeeks: number;
  rationale: string;
};

const DAY = 86_400_000;
const QUALITY_TYPES = new Set<RichWorkoutType>(['strides', 'fartlek', 'hill_repeats', 'tempo', 'threshold', 'vo2', 'marathon_pace', 'progression_run']);
const RUN_TYPES = new Set(['easy_run', 'recovery_run', 'run_walk', 'long_run', 'progression_run', 'tempo', 'threshold', 'marathon_pace', 'vo2', 'hill_repeats', 'fartlek', 'norwegian_4x4', 'intervals', 'strides', 'sprint', 'taper_session', 'deload_session']);

/** Explicit self-report is useful evidence, not a measured physiological test.
 * Never reconstruct completed interval work from a planned title/duration. */
export function validReportedRunningQuality(value: unknown, actualMinutes: number): value is ReportedRunningQuality {
  return normalizeRunningQuality(value, actualMinutes) !== undefined;
}

export function actualRunningMinutes(record: CompletedWorkoutRecord): number {
  return typeof record.actualDurationMinutes === 'number' && Number.isFinite(record.actualDurationMinutes)
    && record.actualDurationMinutes > 0 ? record.actualDurationMinutes : 0;
}

export function actualRunningHistory(records: readonly CompletedWorkoutRecord[], cutoff: number, lookbackDays = 84): CompletedWorkoutRecord[] {
  const exact = new Map<string, CompletedWorkoutRecord>();
  for (const record of records) {
    const instance = (record as CompletedWorkoutRecord & { workoutInstanceId?: unknown }).workoutInstanceId;
    const key = typeof instance === 'string' && instance ? `instance:${instance}` : `record:${record.id}`;
    const previous = exact.get(key);
    if (!previous?.runningQuality || record.runningQuality) exact.set(key, record);
  }
  return [...exact.values()].filter(record => record.completed && !record.skipped
    && RUN_TYPES.has(record.type) && Number.isFinite(record.timestamp) && record.timestamp <= cutoff
    && record.timestamp >= cutoff - lookbackDays * DAY && actualRunningMinutes(record) >= 5);
}

export function runningSpecificityDecision(input: WorkoutEngineInput): SpecificityDecision {
  const now = input.referenceDate ? new Date(`${input.referenceDate}T12:00:00`).getTime() : Date.now();
  const evidenceCutoff = Math.min(Date.now(), now);
  const history = actualRunningHistory(input.runningHistory ?? [], evidenceCutoff);
  // Two actual sessions establish a practiced week, not a clinical clearance.
  let consistentWeeks = 0;
  for (let week = 0; week < 12; week++) {
    const entries = history.filter(record => record.timestamp <= evidenceCutoff - week * 7 * DAY && record.timestamp > evidenceCutoff - (week + 1) * 7 * DAY);
    if (entries.length < 2) break;
    consistentWeeks++;
  }
  const base = { reps: 0, workSeconds: 0, recoverySeconds: 0, allowNorwegian: false, consistentWeeks };
  const hold = (rationale: string): SpecificityDecision => ({ ...base, stage: 'easy', rationale });
  if (!Number.isFinite(now)) return hold('Training dates are unavailable; repeat easy work until the plan can be reviewed.');
  if (!Number.isSafeInteger(input.currentWeek) || input.currentWeek < 1 || !Number.isSafeInteger(input.recentHardSessions) || input.recentHardSessions < 0
    || input.recoveryScore < 0 || input.recoveryScore > 100 || input.fatigueScore < 0 || input.fatigueScore > 100 || input.acwr < 0
    || input.recentHardSessions >= 2 || !Number.isFinite(input.recoveryScore) || !Number.isFinite(input.fatigueScore) || !Number.isFinite(input.acwr)
    || input.recoveryScore < 55 || input.fatigueScore > 70 || input.acwr > 1.3 || input.injuryRisk
    || (input.soreness !== null && (!Number.isFinite(input.soreness) || input.soreness >= 6)))
    return hold('Keep this exposure easy while recovery, symptoms or combined demand need attention.');
  if (input.currentWeek <= 1 || ['foundation', 'deload', 'taper', 'recovery', 'transition'].includes(input.trainingPhase)
    || input.goalType === 'general_strength' || input.trainingStyle === 'base_only')
    return hold('The current goal or recovery phase calls for easy aerobic practice, not added speed work.');
  if (consistentWeeks < 2) return hold('Build at least two repeatable weeks of actual running before introducing faster work.');

  const reports = history.flatMap(record => {
    const q = normalizeRunningQuality(record.runningQuality, actualRunningMinutes(record));
    return q && (q.recordedAt === undefined || q.recordedAt <= evidenceCutoff) ? [{ ...q, timestamp: record.timestamp }] : [];
  }).sort((a, b) => b.timestamp - a.timestamp);
  const latest = reports[0];
  const recentlyHard = history.some(record => record.timestamp > now - 6 * DAY && ['hard', 'max'].includes(record.intensity));
  if (recentlyHard) return hold('A recent demanding run already supplies the quality stimulus; do not stack another exposure.');
  const strides: SpecificityDecision = { ...base, stage: 'strides', reps: 4, workSeconds: 15, recoverySeconds: 75,
    rationale: 'Begin with four relaxed accelerations and full easy recovery. Report actual effort before adding sustained faster work.' };
  if (!latest || latest.timestamp < now - 42 * DAY || input.trainingPhase === 'base') return strides;
  if (!latest.comfortableRecovery || latest.rpe > 8) return { ...strides,
    rationale: 'The last reported quality session was hard to recover from. Regress to relaxed accelerations or keep the run easy.' };
  const tolerated = reports.filter(report => report.timestamp >= now - 42 * DAY && report.comfortableRecovery && report.rpe <= 8);
  const practices = (rung: RunningQualityRung, reps: number, seconds: number) => tolerated.filter(report => report.rung === rung && report.completedReps >= reps && report.workSeconds >= seconds).length;
  if (latest.rung === 'strides' && (practices('strides', 4, 15) < 2 || latest.completedReps < 4 || latest.workSeconds < 15)) return { ...strides,
    reps: Math.min(4, latest.completedReps + (latest.rpe <= 6 ? 1 : 0)), workSeconds: Math.min(20, latest.workSeconds),
    rationale: 'Repeat relaxed accelerations. Build a repeatable dose before adding sustained faster bouts.' };
  if (latest.rung === 'strides') return { ...base, stage: 'gentle_fartlek', reps: 4, workSeconds: 30, recoverySeconds: 90,
    rationale: 'After tolerated accelerations, introduce short controlled faster bouts; add duration before asking for more pace.' };
  if (input.progressionLevel === 'beginner' || ['aerobic_development'].includes(input.trainingPhase)
    || (latest.rung === 'gentle_fartlek' && (practices('gentle_fartlek', 4, 60) < 2 || latest.completedReps < 4 || latest.workSeconds < 60))) return {
    ...base, stage: 'gentle_fartlek', reps: latest.rung === 'gentle_fartlek' ? Math.min(4, latest.completedReps + (latest.rpe <= 6 ? 1 : 0)) : 4,
    workSeconds: Math.min(60, latest.rung === 'gentle_fartlek' ? latest.workSeconds + (latest.rpe <= 6 && latest.completedReps >= 4 ? 15 : 0) : 30), recoverySeconds: 90,
    rationale: 'Repeat gentle faster bouts within the foundation earned so far; calendar progress does not establish interval readiness.' };
  if (latest.rung === 'gentle_fartlek') return { ...base, stage: 'tempo_threshold', reps: 3, workSeconds: 120, recoverySeconds: 120,
    rationale: 'Introduce short controlled sustained efforts with easy recoveries; threshold work is distinct from aerobic-power intervals.' };
  if (input.goalType === 'race_prep' && input.trainingPhase === 'race_specific'
    && ['tempo_threshold', 'intervals', 'norwegian_4x4'].includes(latest.rung)
    && latest.completedReps * latest.workSeconds >= 360) {
    const meters = input.raceDistance === 'marathon' ? 42195 : input.raceDistance === 'half_marathon' ? 21097.5 : input.raceDistance === '10k' ? 10000 : input.raceDistance === '5k' ? 5000 : undefined;
    const prediction = meters && input.calibration?.racePredictions?.find(item => Math.abs(item.distanceMeters - meters) < 5);
    const pace = prediction && Number.isFinite(prediction.predictedSeconds) && prediction.predictedSeconds > 0
      ? prediction.predictedSeconds / (prediction.distanceMeters / 1609.344) : undefined;
    return { ...base, stage: 'tempo_threshold', target: 'race_pace', reps: 3,
      workSeconds: Math.min(360, Math.floor((latest.completedReps * latest.workSeconds + (latest.rpe <= 7 ? 120 : 0)) / 3)), recoverySeconds: 120,
      calibratedRacePaceSecPerMile: pace,
      rationale: 'Practice manageable bouts at current event-specific effort after shorter quality work is tolerated. Build time at that effort before extending the session; aspirational goal pace is not proof of current capacity.' };
  }
  if (input.trainingPhase === 'threshold' || input.trainingPhase === 'build' || input.trainingStyle === 'threshold'
    || (latest.rung === 'tempo_threshold' && (practices('tempo_threshold', 3, 120) < 2 || latest.completedReps < 3 || latest.workSeconds < 120))) {
    const total = latest.completedReps * latest.workSeconds;
    const reps = Math.min(3, latest.completedReps + (latest.rpe <= 6 ? 1 : 0));
    return { ...base, stage: 'tempo_threshold', reps,
      workSeconds: Math.min(360, Math.max(5, Math.floor((total + (latest.rpe <= 7 ? Math.min(120, total * 0.25) : 0)) / reps))), recoverySeconds: 120,
      rationale: 'Build manageable minutes at controlled sustained effort. Repeat or shorten when actual effort or recovery calls for it.' };
  }
  if (latest.rung === 'tempo_threshold') return { ...base, stage: 'intervals', reps: 4, workSeconds: 120, recoverySeconds: 180,
    rationale: 'Start aerobic-power exposure with four two-minute controlled hard bouts; do not jump directly to four-minute work intervals.' };
  const weeklyMinutes = history.filter(record => record.timestamp > evidenceCutoff - 28 * DAY).reduce((sum, record) => sum + actualRunningMinutes(record), 0) / 4;
  const recoveredPowerPractices = tolerated.filter(report => ['intervals', 'norwegian_4x4'].includes(report.rung)
    && report.completedReps >= 4 && report.workSeconds >= 180 && report.rpe >= 6).length;
  const can4x4 = ['vo2', 'peak'].includes(input.trainingPhase) && consistentWeeks >= 8 && weeklyMinutes >= 180
    && input.recoveryScore >= 70 && input.fatigueScore <= 55
    && latest.completedReps >= 4 && latest.workSeconds >= 180 && latest.rpe >= 6 && recoveredPowerPractices >= 2
    && ['intervals', 'norwegian_4x4'].includes(latest.rung)
    && (input.goalType !== 'race_prep' || input.weeksToRace >= 4);
  if (can4x4) return { ...base, stage: 'norwegian_4x4', reps: 4, workSeconds: 240, recoverySeconds: 180, allowNorwegian: true,
    rationale: 'A reported, recovered four-by-three-minute exposure supports considering four-by-four for aerobic power. This is a conservative coaching choice, not threshold training or a fitness test.' };
  const reps = Math.min(4, latest.completedReps + (latest.rpe <= 6 ? 1 : 0));
  return { ...base, stage: 'intervals', reps, workSeconds: Math.min(180, latest.workSeconds >= 120 && latest.completedReps >= 4 && latest.rpe <= 7 ? latest.workSeconds + 30 : latest.workSeconds), recoverySeconds: 180,
    rationale: 'Build from two-minute toward three-minute aerobic-power bouts using reported tolerance. Repeat the dose when the last effort was already challenging.' };
}

/** At most one formal quality session in the generated week. Preferences and
 * ambitious race goals cannot override the earned exposure or recovery gate. */
export function applyRunningSpecificity(types: RichWorkoutType[], decision: SpecificityDecision): RichWorkoutType[] {
  let used = false;
  return types.map(type => {
    if (!QUALITY_TYPES.has(type)) return type;
    if (used || decision.stage === 'easy') return 'easy_run';
    used = true;
    return decision.stage === 'strides' ? 'strides' : decision.stage === 'gentle_fartlek' ? 'fartlek'
      : decision.stage === 'tempo_threshold' ? 'threshold' : 'vo2';
  });
}
