import type { Exercise, PlannedExercise, StrengthEngineInput, StrengthSession, StrengthLogRecord } from '../types/strength';
import { actualRunningHistory } from './training/runningSpecificity';
import { estimateStrengthSessionMinutes, strengthTimeBudget } from './strengthDesign';
import { sundayOf, addDays, toYMD } from './calendarEngine';
import { INTRO_PLYOMETRIC, PLYOMETRIC_CATALOG, plyometricTask, plyometricFootContacts, nextPlyometricTask, easierPlyometricTask, type PlyometricTask } from './plyometricCatalog';
import { normalizePlyometricResponse } from './plyometricFeedback';
export { INTRO_PLYOMETRIC, PLYOMETRIC_CATALOG } from './plyometricCatalog';
import { getGoalMesocycle } from './plan/goalMesocycle';

const DAY = 86_400_000;
/** Reactive calf work remains impact work even when an older entry used the
 * calf_ankle pattern. Reuse this rule for recovery/spacing, not just labels. */
export function isReactiveExercise(exercise: Pick<Exercise, 'pattern' | 'name'>): boolean {
  return exercise.pattern === 'plyometric' || /\bpogo\b|\bbounds?\b|\bhop(s|ping)?\b|\bjump(s|ing)?\b|\bpower skips?\b/i.test(exercise.name);
}

export function isRecordedReactiveExercise(exercise: Pick<import('../types/strength').CompletedExercise, 'exerciseId' | 'name'>): boolean {
  return ['calf_pogo', 'plyo_box_jump', 'plyo_single_hop', 'b_box_jump', 'b_bound', 'b_depth_jump', 'b_jump_squat'].includes(exercise.exerciseId)
    || exercise.exerciseId.startsWith('plyo_') || (!!exercise.name && isReactiveExercise({ pattern: 'trunk', name: exercise.name }));
}


function actualWorkingSets(record: StrengthLogRecord, exerciseId: string) {
  if (!record.completed || record.skipped) return [];
  const matches = record.exercises.filter(item => item.exerciseId === exerciseId);
  const exercise = matches.length===1 && !matches[0]!.skipped ? matches[0] : undefined;
  if (!exercise || exercise.equipmentType !== 'bodyweight'
    || (plyometricTask(exerciseId)?.exercise.unilateral && exercise.prescription?.repScheme?.perSide !== true)) return [];
  const sets = exercise.sets.filter(set => !set.isWarmup);
  if (sets.length < 2 || (exercise.prescription && (!Number.isSafeInteger(exercise.prescription.sets) || exercise.prescription.sets<1 || sets.length < exercise.prescription.sets))
    || !sets.every(set => set.completed && Number.isSafeInteger(set.reps) && set.reps! > 0
      && Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 6
      && !set.holdSeconds && !set.distanceMeters && (set.weight === undefined || set.weight === 0)
      && (!set.load || /^bw$/i.test(set.load.trim())))) return [];
  return sets;
}

function recentRecords(input: StrengthEngineInput, now: number) {
  const seen = new Set<string>();
  // Keep attempts until qualification. Otherwise an unfinished or skipped
  // recent workout can reveal older favorable impact/preparation evidence.
  return input.strengthHistory.filter(record => Number.isFinite(record.timestamp)
    && record.timestamp <= now && record.timestamp >= now - 42 * DAY)
    .sort((a, b) => b.timestamp - a.timestamp).filter(record => {
      const key = record.scheduledSessionId || record.sessionId || record.id;
      if (seen.has(key) || seen.has(record.id)) return false;
      seen.add(key); seen.add(record.id); return true;
    });
}

/** Numeric cutoffs are bounded coaching choices, not medical clearance. A
 * calendar/experience label alone never establishes tolerance for jumping. */
export function plyometricDose(input: StrengthEngineInput): { task: PlyometricTask; reps: number; note: string } | null {
  const requested = input.referenceDate ? new Date(`${input.referenceDate}T12:00:00`).getTime() : Date.now();
  const now = Math.min(Date.now(), requested);
  if (!Number.isFinite(now) || input.programmingVersion !== 2
    || !['get_faster', 'general_running', 'hybrid', 'race_prep'].includes(input.goalType ?? '')
    || !Number.isSafeInteger(input.currentWeek) || input.currentWeek < 3
    || getGoalMesocycle(input.currentWeek, input.trainingPhase, input.goalType!).recovery
    || !['base', 'aerobic_development', 'threshold', 'vo2', 'build'].includes(input.trainingPhase)
    || input.injuryRisk || !Number.isFinite(input.recoveryScore) || input.recoveryScore < 70 || input.recoveryScore > 100
    || !Number.isFinite(input.fatigueScore) || input.fatigueScore < 0 || input.fatigueScore > 50
    || !Number.isFinite(input.acwr) || input.acwr < 0 || input.acwr > 1.3
    || !Number.isFinite(input.availableTimeMin) || input.availableTimeMin < 25
    || input.soreness === null || !Number.isFinite(input.soreness) || input.soreness < 0 || input.soreness > 3
    || (input.weeksToRace > 0 && input.weeksToRace <= 3)) return null;
  const running = actualRunningHistory(input.runningHistory ?? [], now, 28);
  for (let week = 0; week < 2; week++) {
    const practicedDays = new Set(running.filter(record => record.timestamp > now - (week + 1) * 7 * DAY
      && record.timestamp <= now - week * 7 * DAY).map(record => toYMD(new Date(record.timestamp))));
    if (practicedDays.size < 2) return null;
  }
  const records = recentRecords(input, now);
  if (records[0]?.overallRpe !== undefined && (!Number.isFinite(records[0].overallRpe) || records[0].overallRpe! > 7)) return null;
  // Two separate days of actual manageable lower-body AND calf practice.
  const preparationRole = (item: StrengthLogRecord['exercises'][number]) =>
    (/^calf_(single_standing|seated)$/.test(item.exerciseId) || ['foot_supported_calf','foot_loaded_single_calf','foot_loaded_bent_knee','foot_loaded_seated'].includes(item.exerciseId)) ? 'calf'
      : /^(squat_|hinge_|lunge_)/.test(item.exerciseId) ? 'lower' : undefined;
  const preparationDays = new Set<string>();
  const preparatory: StrengthLogRecord[] = [];
  for (const record of records) {
    const usable = record.exercises.filter(item => preparationRole(item));
    if (!usable.length) continue; // Unrelated upper-body or mobility work is not a failed preparation attempt.
    const day = toYMD(new Date(record.timestamp));
    if (preparationDays.has(day)) continue;
    preparationDays.add(day);
    const manageable = record.completed && !record.skipped
      && ['lower', 'calf'].every(role => usable.some(item => {
      if (preparationRole(item) !== role) return false;
      const sets = item.sets.filter(set => !set.isWarmup);
      return !item.skipped && !!item.equipmentType && sets.length >= 2 && (!item.prescription || sets.length >= item.prescription.sets)
        && sets.every(set => set.completed && Number.isSafeInteger(set.reps) && set.reps! >= 6
          && !set.holdSeconds && !set.distanceMeters
          && (set.weight === undefined || (Number.isFinite(set.weight) && set.weight >= 0 && ['lb', 'kg'].includes(set.weightUnit ?? '')))
          && (set.load === undefined || /^bw$/i.test(set.load.trim()) || /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i.test(set.load.trim()))
          && Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 7);
    }));
    if (!manageable) break;
    preparatory.push(record);
  }
  if (new Set(preparatory.map(record => toYMD(new Date(record.timestamp)))).size < 2) return null;
  // Completed contacts still happened if the parent workout/exercise was later
  // marked unfinished or skipped. Preserve their reported adverse response.
  const impactReports = records.flatMap(record=>record.exercises.filter(ex=>isRecordedReactiveExercise(ex)
    && ex.sets.some(set=>set.completed && !set.isWarmup && (set.reps??0)>0)).map(ex=>({timestamp:record.timestamp,response:normalizePlyometricResponse(ex.impactResponse,record.timestamp,now)})));
  const adverse = impactReports.find(item=>item.response?.symptomsDuring==='present' || item.response?.nextDayResponse==='worse' || item.response?.landingControl==='lost');
  const observedAll = records.flatMap(record => record.exercises.flatMap(exercise => {
    const task = plyometricTask(exercise.exerciseId);
    return task
      ? [{ record, exercise, task, response: normalizePlyometricResponse(exercise.impactResponse, record.timestamp, now) }] : [];
  }));
  const responsePositive = (item: typeof observedAll[number]) => item.response?.landingControl === 'controlled'
    && item.response.symptomsDuring === 'none' && item.response.nextDayResponse === 'usual';
  let observed=observedAll;
  if(adverse){
    const calibration=observedAll.filter(item=>item.record.timestamp>adverse.timestamp && item.task.tier==='easy' && responsePositive(item)
      && actualWorkingSets(item.record,item.task.exercise.id).length>=2 && actualWorkingSets(item.record,item.task.exercise.id).every(set=>set.reps!>=5));
    const distinct=new Map<string,typeof calibration[number]>();
    for(const item of calibration) distinct.set(toYMD(new Date(item.record.timestamp)),item);
    if(distinct.size<2) return null;
    // Restart from two later, explicitly reported easy calibration days. Old
    // higher-tier work and an unrelated tiny positive report cannot clear it.
    const chronological=[...distinct.values()].sort((a,b)=>a.record.timestamp-b.record.timestamp);
    const restartedAt=chronological[1]!.record.timestamp;
    observed=observedAll.filter(item=>item.record.timestamp>=restartedAt);
  }
  const latest = observed[0];
  const practicesAt = (task: PlyometricTask, reps: number) => new Set(observed.filter(item => item.task.exercise.id === task.exercise.id
    && responsePositive(item) && actualWorkingSets(item.record, task.exercise.id).length >= 2
    && actualWorkingSets(item.record, task.exercise.id).every(set => set.reps! >= reps))
    .map(item => toYMD(new Date(item.record.timestamp)))).size;
  let task = PLYOMETRIC_CATALOG[0]!, reps = task.initialReps;
  if (latest) {
    if (actualWorkingSets(latest.record, latest.exercise.exerciseId).length === 0
      || latest.response?.symptomsDuring === 'present' || latest.response?.nextDayResponse === 'worse'
      || latest.response?.landingControl === 'lost') return null;
    if (latest.task.tier !== 'easy' && !responsePositive(latest)) return null;
    task = latest.task;
    const latestMinimumReps=Math.min(...actualWorkingSets(latest.record,latest.exercise.exerciseId).map(set=>set.reps!));
    // A harder tier additionally retains an actual single-leg strength and
    // running foundation; an advanced label or a week number is insufficient.
    const singleLegDays = new Set(preparatory.filter(record => ['calf_single_standing', 'lunge_reverse'].every(role => record.exercises.some(exercise => {
      const match = role === 'calf_single_standing' ? ['calf_single_standing','foot_loaded_single_calf'].includes(exercise.exerciseId)
        : ['lunge_reverse', 'squat_bulgarian', 'hinge_single_rdl'].includes(exercise.exerciseId);
      return match && !exercise.skipped && !!exercise.equipmentType && exercise.prescription?.repScheme?.perSide===true
        && exercise.sets.filter(set => !set.isWarmup).length >= Math.max(2,exercise.prescription.sets)
        && exercise.sets.filter(set => !set.isWarmup).every(set => set.completed && Number.isSafeInteger(set.reps) && set.reps! >= 6
          && !set.holdSeconds && !set.distanceMeters
          && (set.weight===undefined || (Number.isFinite(set.weight) && set.weight>=0 && ['lb','kg'].includes(set.weightUnit??'')))
          && (set.load===undefined || /^bw$/i.test(set.load.trim()) || /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i.test(set.load.trim()))
          && Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 7);
    }))).map(record => toYMD(new Date(record.timestamp)))).size;
    const hasRunningFoundation = Array.from({length:6},(_,week) => new Set(actualRunningHistory(input.runningHistory ?? [], now, 42)
      .filter(record => record.timestamp > now-(week+1)*7*DAY && record.timestamp <= now-week*7*DAY)
      .map(record => toYMD(new Date(record.timestamp)))).size).every(days => days>=2);
    const hardReady = singleLegDays >= 3 && hasRunningFoundation;
    if (task.tier === 'hard' && !hardReady) return null;
    const request = latest.response?.nextStep ?? 'repeat';
    if (request === 'easier') {
      task = easierPlyometricTask(latest.task);
      reps = Math.min(task.initialReps, Math.max(1, Math.min(...actualWorkingSets(latest.record, latest.exercise.exerciseId).map(set=>set.reps!))));
    } else {
      reps = Math.min(task.initialReps,latestMinimumReps);
      if (responsePositive(latest)) {
        while (reps < task.maxReps && reps<=latestMinimumReps && practicesAt(task,reps)>=3) reps++;
      }
      const nextTask = nextPlyometricTask(task);
      const nextTier = nextTask && (nextTask.tier!=='hard' || hardReady) ? nextTask : undefined;
      const threshold = task.tier === 'easy' ? 6 : 4;
      if (nextTier && request === 'consider_harder' && responsePositive(latest) && latestMinimumReps>=threshold && practicesAt(task,threshold)>=3) {
        task = nextTier;
        reps = task.initialReps;
      }
    }
  }
  const preference = input.exercisePreferences?.[task.exercise.id] ?? input.exercisePreferences?.[INTRO_PLYOMETRIC.id];
  const preferred = preference ? plyometricTask(preference) : undefined;
  const tierRank = {easy:0,medium:1,hard:2};
  if (preferred && preferred.exercise.id!==task.exercise.id && tierRank[preferred.tier]<=tierRank[task.tier] && preferred.role===task.role) {
    task=preferred; reps=Math.min(task.initialReps,reps); // A different task starts its own dose calibration.
  }
  return { task, reps, note: `Optional ${task.tier}-demand plyometrics: ${task.purpose} Two sets of ${reps}${task.exercise.unilateral?' per leg':''} total ${plyometricFootContacts(task,2,reps)} foot contacts. ${task.count} Same-task actual work, landing control and next-day response inform progression; higher demands also require your explicit request. Tiers are relative guides, not clearance. Skip or reduce if this does not fit today.` };

}

/** Strip legacy template jumps for all v2 goals, then add at most one small
 * optional dose within the actual time budget. Later calendar balancing may
 * remove it again around key runs; it never moves missed work forward. */
export function applyGoalPlyometrics(sessions: StrengthSession[], input: StrengthEngineInput, allowNewImpact = true): StrengthSession[] {
  if (input.programmingVersion !== 2) return sessions;
  const dose = allowNewImpact ? plyometricDose(input) : null;
  const weekStartDate = sundayOf(input.referenceDate ? new Date(`${input.referenceDate}T12:00:00`) : new Date());
  const weekStart = weekStartDate.getTime(), weekEnd = addDays(weekStartDate, 7).getTime();
  const performedThisWeek = input.strengthHistory.filter(record => Number.isFinite(record.timestamp) && record.timestamp >= weekStart && record.timestamp < weekEnd
    && record.timestamp <= Date.now() && record.exercises.some(ex => isRecordedReactiveExercise(ex)
      && ex.sets.some(set => set.completed && !set.isWarmup && (set.reps ?? 0) > 0)));
  let used = false;
  return sessions.map(session => {
    const original = session.exercises;
    let exercises = original.filter(ex => !isReactiveExercise(ex.exercise));
    const changed = exercises.length !== original.length;
    let added = false;
    if (dose && !used && performedThisWeek.length === 0 && !input.activeStrengthSessionId && !['prehab', 'activation'].includes(session.sessionType) && strengthTimeBudget(input.availableTimeMin) >= 25) {
      const plyo: PlannedExercise = {
        exerciseId: dose.task.exercise.id, exercise: dose.task.exercise, sets: 2, repRange: [dose.reps, dose.reps],
        repScheme: { kind: 'reps', repsMin: dose.reps, repsMax: dose.reps, perSide:dose.task.exercise.unilateral }, rpe: 5, rir: 5,
        restSeconds: dose.task.tier==='hard'?120:90, tempo: 'Controlled reactive contacts; full recovery', loadTarget: 'Bodyweight only — quality contacts, not fatigue',
        progressionRule: 'Repeat this exact task and setup. Three separate actual exposures with controlled landings, no reported symptoms and a usual next-day response support a small contact change. A harder tier also needs your request and lower-volume calibration; no automatic depth jumps or external load.',
        regressionRule: 'Reduce remaining contacts or skip impact work. Keep ordinary calf strength as preparation if tolerated; it is a different stimulus, not an equivalent jump replacement.',
        coachingCues: dose.task.exercise.coachingCues, rationale: dose.task.exercise.rationale,
        notes: dose.note,
      };
      // Preserve the first lower/push/pull roles. Remove only trailing support
      // if the small plyometric dose and those priorities still fit.
      const balance = input.goalIntent ? exercises.filter(exercise=>['foot_clock_reach','foot_clock_supported'].includes(exercise.exerciseId)) : [];
      let candidate = input.goalIntent ? [...balance,plyo,...exercises.filter(exercise=>!balance.includes(exercise))] : [plyo, ...exercises];
      // Explicit profile plans have already fitted primary, balance and calf roles.
      // Optional impact may use genuinely spare time; it cannot evict that work.
      if (!input.goalIntent) while (candidate.length > 4 && estimateStrengthSessionMinutes(candidate) > strengthTimeBudget(input.availableTimeMin)) candidate.pop();
      if (estimateStrengthSessionMinutes(candidate) <= strengthTimeBudget(input.availableTimeMin)) {
        exercises = candidate; used = true; added = true;
      }
    }
    if (!changed && !added) return session;
    return { ...session, exercises, primaryPatterns: [...new Set(exercises.map(ex => ex.exercise.pattern))],
      targetDuration: estimateStrengthSessionMinutes(exercises),
      progressionNote: `${session.progressionNote} ${added ? dose!.note : 'Reactive jumps are held until actual practice, current recovery and available time support them; continue manageable strength preparation.'}` };
  });
}
