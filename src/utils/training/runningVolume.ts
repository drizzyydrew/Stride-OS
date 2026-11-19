import type { RichWorkout, WorkoutEngineInput, WorkoutSegment } from '../../types/workout';
import { sundayOf, parseYMD } from '../calendarEngine';
import { actualRunningHistory, actualRunningMinutes } from './runningSpecificity';
import { normalizeRunningQuality } from '../runningQualityFeedback';
import { shouldApplyDeload } from './deloadModel';

export type RunningVolumeBudget = {
  minutes: number;
  baselineMinutes: number;
  source: 'actual_full_weeks' | 'reported_baseline' | 'conservative_start';
  decision: 'hold' | 'progress' | 'regress' | 'recover';
  rationale: string;
};
const DAY = 86_400_000;
const EXCLUDED = new Set(['rest', 'mobility', 'strength', 'cross_training']);
const formalQuality = (workout: RichWorkout) => !!workout.intervals && !EXCLUDED.has(workout.richType);

/** Bounded coaching policy, not a universal percentage rule. Only actual
 * completed full weeks provide observed capacity; a partial week cannot
 * accidentally shrink the next prescription or count as earned progression. */
export function runningVolumeBudget(input: WorkoutEngineInput, workouts: RichWorkout[]): RunningVolumeBudget {
  const current = input.referenceDate ? parseYMD(input.referenceDate) : new Date();
  const start = sundayOf(current).getTime();
  const records = actualRunningHistory(input.runningHistory ?? [], Math.min(Date.now(), start - 1));
  const weeks = Array.from({ length: 4 }, (_, week) => records.filter(record => record.timestamp < start - week * 7 * DAY
    && record.timestamp >= start - (week + 1) * 7 * DAY));
  const totals = weeks.map(week => week.reduce((sum, record) => sum + actualRunningMinutes(record), 0));
  const observed = totals.filter(total => total > 0);
  const longGap = !observed.length && actualRunningHistory(input.runningHistory ?? [], Math.min(Date.now(), start - 1), Infinity).length > 0;
  const easyZone = input.calibration?.paceZones.easy;
  const easySeconds = easyZone && Number.isFinite(easyZone.minSecPerMi) && Number.isFinite(easyZone.maxSecPerMi)
    && easyZone.minSecPerMi >= 180 && easyZone.minSecPerMi <= 1800 && easyZone.maxSecPerMi >= 180 && easyZone.maxSecPerMi <= 1800
    && easyZone.minSecPerMi <= easyZone.maxSecPerMi
    ? (easyZone.minSecPerMi + easyZone.maxSecPerMi) / 2 : undefined;
  const reported = Number.isFinite(input.weeklyMileage) && input.weeklyMileage > 0 ? input.weeklyMileage * (easySeconds ?? 600) / 60 : 0;
  const baselineMinutes = observed.length ? observed.reduce((sum, total) => sum + total, 0) / observed.length : longGap ? Math.min(60, reported || 60) : reported || 60;
  const source = observed.length ? 'actual_full_weeks' as const : reported && !longGap ? 'reported_baseline' as const : 'conservative_start' as const;
  const prefix = source === 'actual_full_weeks' ? 'Using actual running minutes from completed full weeks.'
    : source === 'reported_baseline' ? `Starting from reported weekly distance${easySeconds ? ' and current calibrated easy pace' : ', using an assumed ten minutes per mile only to bound time'}; this is not measured capacity.`
    : 'Starting with an assumed sixty-minute weekly ceiling until actual training is recorded; this is not measured capacity.';
  const recovery = ['deload', 'taper', 'transition', 'recovery'].includes(input.trainingPhase) || shouldApplyDeload(input.currentWeek, input.trainingPhase);
  const compromised = !Number.isFinite(input.recoveryScore) || !Number.isFinite(input.fatigueScore) || !Number.isFinite(input.acwr)
    || input.recoveryScore < 0 || input.recoveryScore > 100 || input.fatigueScore < 0 || input.fatigueScore > 100 || input.acwr < 0
    || !Number.isSafeInteger(input.recentHardSessions) || input.recentHardSessions < 0
    || input.recoveryScore < 55 || input.fatigueScore > 70 || input.acwr > 1.3 || input.injuryRisk
    || (input.soreness !== null && (!Number.isFinite(input.soreness) || input.soreness >= 6));
  const interrupted = longGap || (observed.length >= 1 && totals[0]! < baselineMinutes * 0.5);
  const restart = totals[0]! > 0 ? totals[0]! : totals[1]! > 0 ? totals[1]! * 0.7 : Math.min(60, baselineMinutes * 0.5);
  if (recovery || compromised || interrupted) return { minutes: Math.max(5, Math.floor(Math.min(baselineMinutes * 0.7, interrupted ? restart : Infinity))), baselineMinutes, source,
    decision: recovery ? 'recover' : 'regress', rationale: `${prefix} Reduce the ceiling for recovery or interrupted training; no catch-up volume.` };
  const reports = records.flatMap(record => {
    const report = normalizeRunningQuality(record.runningQuality, actualRunningMinutes(record));
    return report ? [{ ...report, timestamp: record.timestamp }] : [];
  }).sort((a, b) => b.timestamp - a.timestamp);
  const latest = reports[0];
  const plannedQuality = workouts.find(formalQuality);
  const plannedHardSeconds = plannedQuality?.intervals ? plannedQuality.intervals.totalWorkMin * 60 : 0;
  const addedQuality = !!plannedQuality && (!latest || plannedHardSeconds > latest.completedReps * latest.workSeconds
    || (plannedQuality.richType === 'vo2' && !['intervals', 'norwegian_4x4'].includes(latest.rung))
    || (plannedQuality.richType === 'threshold' && ['strides', 'gentle_fartlek'].includes(latest.rung)));
  const recent = [...weeks[0]!, ...weeks[1]!];
  const tolerated = weeks[0]!.length >= 2 && weeks[1]!.length >= 2 && recent.every(record => {
    const effort = normalizeRunningQuality(record.runningQuality, actualRunningMinutes(record))?.rpe ?? record.rpe;
    return Number.isFinite(effort) && effort! >= 1 && effort! <= 6;
  });
  const progress = tolerated && !addedQuality && input.recoveryScore >= 70 && input.fatigueScore <= 55 && input.recentHardSessions < 2
    && input.adherenceRate >= 0.75 && input.acwr <= 1.1;
  return { minutes: Math.max(5, Math.floor(baselineMinutes * (progress ? 1.05 : 1))), baselineMinutes, source,
    decision: progress ? 'progress' : 'hold',
    rationale: `${prefix} ${addedQuality ? 'Hold overall time while adding or extending faster work.' : progress ? 'A small five-percent time ceiling increase is available from recorded tolerance; it is a coaching choice, not an obligation.' : 'Repeat a manageable ceiling; time passing or a checked completion does not prove more capacity.'}` };
}

export function resizeRunningEasyWorkout(workout: RichWorkout, minutes: number, calibrated: boolean, reason: string): RichWorkout {
  const seconds = Math.max(0, Math.floor(minutes * 60));
  const rest: WorkoutSegment = { label: 'Rest', duration: '0 min', targetSeconds: 0, paceGuide: 'No workout', hrZone: 1, rpe: [0, 0], instructions: 'Leave room to recover.' };
  if (seconds < 300) return { ...workout, richType: 'rest', type: 'rest', intensity: 'rest', protocol: undefined,
    title: 'Rest — Weekly Time Fit', durationMinutes: 0, targetDistance: 0, intervals: undefined, recoveryCost: 0, fatigueScore: 0,
    warmup: rest, mainSet: [], cooldown: rest, paceTargetSource: 'effort',
    paceGuidance: { label: 'Rest', description: 'No workout', targetPace: 'No workout' },
    purpose: 'An unstarted supporting run was omitted to keep the week within the available running-time ceiling.',
    score: { ...workout.score, intendedLoad: 0, estimatedFatigueCost: 0 }, progressionNote: reason };
  const warmSeconds = Math.floor(seconds * 0.15), coolSeconds = Math.floor(seconds * 0.1);
  const make = (label: string, targetSeconds: number): WorkoutSegment => ({ label, targetSeconds,
    duration: `${Math.round(targetSeconds / 60 * 10) / 10} min`, paceGuide: 'Easy, conversational effort', hrZone: 2,
    rpe: [2, 4], instructions: workout.richType === 'run_walk' ? 'Alternate comfortable short jogs with walking. More walking is welcome; stay within the time shown.' : 'Keep comfortable conversation possible. Shorten or walk if needed.' });
  const wasQuality = formalQuality(workout);
  return { ...workout, richType: wasQuality ? 'easy_run' : workout.richType,
    type: wasQuality ? 'easy_run' : workout.type, protocol: undefined,
    title: wasQuality ? 'Easy Run — Weekly Time Fit' : workout.title,
    durationMinutes: seconds / 60, recoveryCost: Math.round(minutes * 0.3), fatigueScore: Math.round(minutes * 0.25),
    targetDistance: Math.round((seconds / Math.max(300, workout.paceRange.minSecPerMi)) * 10) / 10,
    warmup: make('Warmup', warmSeconds), mainSet: [make(workout.richType === 'run_walk' ? 'Comfortable run/walk' : 'Easy running', seconds - warmSeconds - coolSeconds)], cooldown: make('Cooldown', coolSeconds),
    intervals: undefined, intensity: 'easy', hrZoneTarget: 2, rpeRange: [2, 4],
    paceTargetSource: calibrated ? 'calibration' : 'effort',
    paceGuidance: { label: 'Easy effort', description: 'Comfortable conversation; walk as needed.',
      targetPace: calibrated && !wasQuality ? workout.paceGuidance.targetPace : 'Easy, conversational effort' },
    purpose: 'Build repeatable aerobic work within the current time ceiling.',
    instructions: ['Start comfortably.', 'Keep the main work conversational and take walking breaks as needed.', 'Finish easily; do not make up omitted minutes.'],
    executionCues: ['Comfortable conversation.', 'Keep room to recover.'], failureConditions: ['Stop or shorten the session if symptoms or unusual difficulty arise.'],
    modifications: [{ condition: 'More effort than expected', action: 'Slow down, use more walking, or shorten the run.' }],
    rationale: { adaptation: 'Repeatable aerobic training', mechanism: 'An appropriate dose supports consistent practice while leaving room for recovery.', timeframe: 'Review actual response across repeated sessions.', scienceBasis: 'Individualized dose and progressive overload; the exact ceiling is a conservative coaching choice.' },
    score: { ...workout.score, intendedLoad: Math.round(minutes * 0.7), estimatedFatigueCost: Math.round(minutes * 0.3) },
    progressionNote: reason,
  };
}

export function fitRunningWeekToVolume(input: WorkoutEngineInput, workouts: RichWorkout[]) {
  const budget = runningVolumeBudget(input, workouts);
  const runners = workouts.filter(workout => !EXCLUDED.has(workout.richType));
  if (!runners.length) return { workouts, budget };
  let quality = runners.find(formalQuality);
  if (quality && quality.durationMinutes + Math.max(0, runners.length - 1) * 5 > budget.minutes) quality = undefined;
  const ordinary = runners.filter(workout => workout !== quality);
  const remaining = Math.max(0, budget.minutes - (quality?.durationMinutes ?? 0));
  const allowed = [...ordinary].sort((a, b) => (a.richType === 'long_run' ? 1 : 0) - (b.richType === 'long_run' ? 1 : 0))
    .slice(0, Math.min(ordinary.length, Math.floor(remaining / 5)));
  const weights = allowed.reduce((sum, workout) => sum + (workout.richType === 'long_run' ? 1.4 : 1), 0);
  const extra = Math.max(0, remaining - allowed.length * 5);
  const next = workouts.map(workout => {
    if (EXCLUDED.has(workout.richType) || workout === quality) return workout;
    const share = allowed.includes(workout) ? 5 + (weights ? extra * (workout.richType === 'long_run' ? 1.4 : 1) / weights : 0) : 0;
    if (workout.richType === 'long_run' && allowed.length === 1 && budget.minutes < 15) {
      return resizeRunningEasyWorkout({ ...workout, richType: 'easy_run', type: 'easy_run', title: 'Easy Run — Rebuild' }, Math.min(workout.durationMinutes, share), input.calibration !== null, budget.rationale);
    }
    const cap = workout.richType === 'long_run' ? Math.min(share, budget.minutes * 0.35) : share;
    return resizeRunningEasyWorkout(workout, Math.min(workout.durationMinutes, cap), input.calibration !== null, budget.rationale);
  });
  return { workouts: next, budget };
}
