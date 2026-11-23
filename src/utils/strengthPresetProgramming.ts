import {
  getStrengthPresetWorkout,
  presetExerciseId,
  STRENGTH_PRESET_PRIORITY_MAINS,
  type PresetStrengthWorkout,
} from '../constants/strengthBank';
import { resolveExerciseMetadata } from './exerciseCatalog';
import { normalizePlyometricResponse } from './plyometricFeedback';
import type { StrengthLogRecord } from '../types/strength';
import type { StrengthLevel, TrainingPhase } from '../types/training';
import type { TrainingGoalType } from '../types/plan';
import { todayDateKey } from '../types/checkin';
import type { ActiveStrengthSession } from './strengthSession';

export type StrengthPresetContext = {
  strengthLevel?: StrengthLevel;
  availableTimeMin?: number;
  fatigueScore?: number;
  recoveryScore?: number;
  soreness?: number | null;
  trainingPhase?: TrainingPhase;
  goalType?: TrainingGoalType;
  recoveryLimited?: boolean;
  /** A standalone preset choice, never an automatic plan progression. */
  mainSets?: 3 | 4 | 5;
  /** Actual controlled impact work with a later athlete report; lifting level alone is insufficient. */
  footImpactStage?: 0 | 1 | 2 | 3;
};

/** The library and detail screen use the same profile inputs. Running
 * experience never establishes lifting experience; old check-ins are ignored. */
export function buildStrengthPresetContext(
  onboarding: { strengthLevel?: StrengthLevel; strengthSessionMinutes?: number; hasCurrentInjury?: boolean; goalType?: TrainingGoalType },
  athlete: { fatigueScore?: number; recoveryScore?: number; trainingPhase?: TrainingPhase; goalType?: TrainingGoalType },
  checkIn?: { date: string; soreness: number } | null,
  today = todayDateKey(),
): StrengthPresetContext {
  return {
    strengthLevel: onboarding.strengthLevel,
    availableTimeMin: onboarding.strengthSessionMinutes,
    fatigueScore: athlete.fatigueScore,
    recoveryScore: athlete.recoveryScore,
    trainingPhase: athlete.trainingPhase,
    goalType: athlete.goalType ?? onboarding.goalType,
    soreness: checkIn?.date === today ? checkIn.soreness : null,
    recoveryLimited: onboarding.hasCurrentInjury === true,
  };
}

/** Two consecutive complete, tolerated exposures support one small volume step.
 * A newer uncertain/painful/missing report resets the recommendation to the introduction.
 * This is an app coaching rule, not a medical clearance test. */
export function footImpactProgressionStage(history: readonly StrengthLogRecord[], now = Date.now()): 0|1|2|3 {
  const impactName=(exercise:StrengthLogRecord['exercises'][number])=>exercise.name ?? resolveExerciseMetadata({id:exercise.exerciseId}).name;
  const unique=new Map<string,StrengthLogRecord>();
  for(const record of history) if(Number.isFinite(record.timestamp) && record.timestamp<=now && now-record.timestamp<=42*86400000) {
    const key=record.scheduledSessionId ?? record.sessionId ?? record.id;
    const prior=unique.get(key);
    // Conflicting copies cannot improve eligibility: prefer the incomplete/skipped copy.
    if(!prior || record.timestamp>prior.timestamp || record.timestamp===prior.timestamp&&(record.skipped || record.completed!==true))unique.set(key,record);
  }
  const attempts=[...unique.values()].filter(record=>record.exercises.some(ex=>/pogo|hop|jump|bound/i.test(impactName(ex)))).sort((a,b)=>b.timestamp-a.timestamp);
  if(attempts.length<2)return 0;
  const doses=attempts.slice(0,2).map(record=>{
    if(record.completed!==true || record.skipped)return 0;
    const impacts=record.exercises.filter(ex=>/pogo|hop|jump|bound/i.test(impactName(ex)));
    if(impacts.some(ex=>{
      const report=normalizePlyometricResponse(ex.impactResponse,record.timestamp,now);
      return ex.skipped || report?.landingControl!=='controlled' || report.symptomsDuring!=='none' || report.nextDayResponse!=='usual';
    }))return 0;
    const actual=impacts.filter(ex=>/low pogo hops|low forward.back line hops/i.test(impactName(ex)))
      .flatMap(ex=>ex.sets.filter(set=>set.completed&&!set.isWarmup&&Number.isInteger(set.reps)&&set.reps!>=5));
    if(actual.length<2)return 0;
    return actual.reduce((sum,set)=>sum+set.reps!,0);
  });
  const minimum=Math.min(...doses);
  return minimum>=20?3:minimum>=15?2:minimum>=10?1:0;
}

export function estimateStrengthPresetMinutes(workout: PresetStrengthWorkout): number {
  if (!workout.exercises.length) return 0;
  let lastRest = 0;
  const seconds = workout.exercises.reduce((total, exercise) => {
    const scheme = exercise.repScheme;
    const sides = scheme?.perSide ? 2 : 1;
    const reps = scheme && 'repsMin' in scheme ? (scheme.repsMax ?? scheme.repsMin ?? 8) : 8;
    const work = scheme?.kind === 'duration' ? (scheme.secondsMax ?? scheme.secondsMin) * sides
      : scheme?.kind === 'distance' ? (scheme.metersMax ?? scheme.metersMin) / 0.8 * sides
        : reps * (3 + (scheme?.kind === 'reps_hold' ? scheme.holdSeconds : 0)) * sides;
    lastRest = exercise.restSeconds ?? 90;
    return total + exercise.sets * (work + lastRest) + 15;
  }, 8 * 60);
  return Math.max(1, Math.ceil((seconds - lastRest) / 60));
}

type CapturedPresetSession = Pick<ActiveStrengthSession, 'workoutId' | 'workoutName' | 'plannedDurationMin' | 'exercises'> & { source: string };

export type ResolvedStrengthPreset = {
  workout: PresetStrengthWorkout;
  canStart: boolean;
  recommended: boolean;
  mode: 'standard' | 'strength_specific' | 'power_specific' | 'captured';
  reason?: string;
  alternativeWorkoutId?: string;
  /** Binds a one-session acknowledgement to exactly the guidance and dose shown. */
  sessionFitKey?: string;
};

/** The displayed resolved prescription is also the launch contract. No
 * previous working weight or estimated maximum is copied into a new session. */
export function strengthPresetLaunchInput(resolved: ResolvedStrengthPreset, acknowledgedSessionFitKey?: string) {
  if (acknowledgedSessionFitKey !== undefined && acknowledgedSessionFitKey !== resolved.sessionFitKey) return null;
  if (!resolved.canStart && (!resolved.reason || !resolved.sessionFitKey || acknowledgedSessionFitKey !== resolved.sessionFitKey)) return null;
  const workout = resolved.workout;
  if (!Number.isFinite(workout.durationMin) || workout.durationMin <= 0 || !workout.exercises.length
    || workout.exercises.some(ex => !ex.name.trim() || !Number.isInteger(ex.sets) || ex.sets < 1
      || !ex.reps.trim() || !Number.isFinite(ex.restSeconds ?? 90) || (ex.restSeconds ?? 90) < 0
      || ex.targetRpe !== undefined && (!Number.isFinite(ex.targetRpe) || ex.targetRpe < 1 || ex.targetRpe > 10))) return null;
  return {
    source: 'preset' as const,
    workoutId: workout.id,
    workoutName: workout.title,
    plannedDurationMin: workout.durationMin,
    exercises: workout.exercises.map(exercise => ({
      id: presetExerciseId(workout.id, exercise.name), name: exercise.name,
      sets: exercise.sets, reps: exercise.reps, repScheme: exercise.repScheme,
      equipment: [...exercise.equipment], notes: exercise.notes,
      plannedRpe: exercise.targetRpe, plannedRestSeconds: exercise.restSeconds,
      plannedLoadTarget: exercise.targetRpe ? `Target RPE ${exercise.targetRpe}; calibrate this exercise, setup and repetition target separately` : undefined,
    })),
  };
}

function lighterAlternative(workout: PresetStrengthWorkout, minutes: number | undefined): string | undefined {
  const options = ['sw_barbell_beginner_full_body', 'sw_bodyweight_beginner_full_body'];
  return options.find(id => {
    const alternative = getStrengthPresetWorkout(id);
    return !!alternative && alternative.equipment.every(item => item === 'bodyweight' || workout.equipment.includes(item))
      && (minutes === undefined || alternative.durationMin <= minutes);
  });
}

/** Resolves future preset prescriptions only. An existing session keeps the
 * prescription captured at start, even when profile/catalog rules change. */
export function resolveStrengthPresetWorkout(
  original: PresetStrengthWorkout,
  context: StrengthPresetContext,
  active?: CapturedPresetSession | null,
): ResolvedStrengthPreset {
  if (active?.source === 'preset' && active.workoutId === original.id) {
    const exercises = active.exercises.map(exercise => ({
      name: exercise.name, sets: exercise.sets, reps: exercise.reps, repScheme: exercise.repScheme,
      // Preserve captured strings, including a legacy/customized setup, rather
      // than reconstructing it from today's catalog.
      equipment: [...exercise.equipment] as PresetStrengthWorkout['equipment'],
      notes: exercise.notes, targetRpe: exercise.plannedRpe, restSeconds: exercise.plannedRestSeconds,
    }));
    return { workout: { ...original, title: active.workoutName, durationMin: active.plannedDurationMin,
      exercises, equipment: [...new Set(exercises.flatMap(exercise => exercise.equipment))],
      planningNote: 'Continue the prescription captured when this workout started. Current catalog or profile changes do not replace your active workout.',
    }, canStart: true, recommended: false, mode: 'captured' };
  }

  // New supporting modules scale from lifting experience, not running experience.
  if(original.id.startsWith('sw_') && original.goalProfiles?.length && original.id!=='sw_foot_reactive') {
    const novice = context.strengthLevel!=='intermediate' && context.strengthLevel!=='advanced';
    const lighter = context.recoveryLimited || context.fatigueScore!=null && context.fatigueScore>70 || context.recoveryScore!=null && context.recoveryScore<65 || context.soreness!=null && context.soreness>=7
      || ['deload','taper','recovery','transition'].includes(context.trainingPhase ?? '');
    if(novice || lighter) original={...original,exercises:original.exercises.map(exercise=>{
      if(!exercise.targetRpe || /clock reach|toe press/i.test(exercise.name))return exercise;
      const strengthReps=exercise.repScheme?.kind==='reps';
      return {...exercise,sets:Math.min(2,exercise.sets),targetRpe:lighter?5:6,
        ...(strengthReps?{reps:exercise.repScheme?.perSide?'8-12 per side':'8-12',repScheme:{kind:'reps' as const,repsMin:8,repsMax:12,perSide:exercise.repScheme?.perSide}}:{}),
        notes:`${exercise.notes ?? ''} Today's introductory/recovery dose uses manageable effort; reduce load or use the supported/bilateral alternative when needed.`};
    })};
  }
  if(original.id==='sw_foot_reactive') {
    const stage=context.footImpactStage ?? 0;
    const pogos={...original.exercises[0]!,sets:stage===0?2:3};
    const lines={...original.exercises[1]!,sets:stage===2?1:2};
    original={...original,title:stage===0?'Reactive Feet & Ankles — Introduction':original.title,
      exercises:stage<2?[pogos]:[pogos,lines],durationMin:stage===0?10:15,
      planningNote:`Today's dose: ${stage===0?10:stage===1?15:stage===2?20:25} two-foot landing events (twice as many individual foot contacts). Replace existing impact work. Two recent controlled exposures with an acceptable later/next-day report support only one dose step. New symptoms, uncertain control or missing response return the recommendation to the introduction. Stop or skip if not tolerated.`};
  }
  const mains = STRENGTH_PRESET_PRIORITY_MAINS[original.id];
  const powerSpecific = original.trainingPurpose === 'power';
  if (!powerSpecific && (original.trainingPurpose !== 'strength' || !mains?.length)) {
    return { workout: original, canStart: true, recommended: original.categories.includes('recommended'), mode: 'standard' };
  }
  const selectedSets = context.mainSets === 4 || context.mainSets === 5 ? context.mainSets : 3;
  const exercises = original.exercises.map(exercise => ({ ...exercise,
    ...(mains?.includes(exercise.name) ? { sets: selectedSets } : {}),
  }));
  const workout = { ...original, exercises,
    durationMin: Math.max(original.durationMin, estimateStrengthPresetMinutes({ ...original, exercises })),
  };
  const validScore = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const phaseLimited = !!context.trainingPhase && (['foundation', 'deload', 'taper', 'recovery', 'transition'].includes(context.trainingPhase)
    || context.goalType === 'race_prep' && ['threshold', 'vo2', 'race_specific', 'build', 'peak'].includes(context.trainingPhase));
  let reason: string | undefined;
  if (original.id !== 'sw_foot_reactive' && context.strengthLevel !== 'intermediate' && context.strengthLevel !== 'advanced') {
    reason = powerSpecific
      ? 'This power preset calls for practiced lifting and controlled, quick repetitions. Build a repeatable setup with a simpler session first; stop power sets when speed or control drops.'
      : 'This low-repetition preset is for practiced lifters. Choose a lighter calibration session while you establish a repeatable setup and lifting experience.';
  } else if (!validScore(context.fatigueScore) || !validScore(context.recoveryScore) || context.recoveryLimited
    || context.fatigueScore! > 70 || context.recoveryScore! < 65 || phaseLimited
    || context.soreness != null && (!Number.isFinite(context.soreness) || context.soreness < 1 || context.soreness > 10 || context.soreness >= 7)) {
    reason = 'Your current training phase or recovery information calls for a lighter session. Keep the main work manageable and return to this preset when it fits your training.';
  } else if (context.availableTimeMin !== undefined && (!Number.isFinite(context.availableTimeMin) || context.availableTimeMin <= 0 || context.availableTimeMin < workout.durationMin)) {
    reason = `Allow about ${workout.durationMin} minutes for this preset, including full rests and rehearsal sets. Choose a shorter session that fits your available time.`;
  }
  const minutes = typeof context.availableTimeMin === 'number' && Number.isFinite(context.availableTimeMin) && context.availableTimeMin > 0
    ? context.availableTimeMin : undefined;
  const sessionFitKey = JSON.stringify({ context, workout }, (_key, value) =>
    typeof value === 'number' && !Number.isFinite(value) ? String(value) : value);
  return { workout, canStart: !reason, recommended: original.categories.includes('recommended') && !reason,
    mode: powerSpecific ? 'power_specific' : 'strength_specific', reason, sessionFitKey,
    ...(reason ? { alternativeWorkoutId: lighterAlternative(workout, minutes) } : {}),
  };
}
