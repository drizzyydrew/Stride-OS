import {
  getStrengthPresetWorkout,
  presetExerciseId,
  STRENGTH_PRESET_PRIORITY_MAINS,
  type PresetStrengthWorkout,
} from '../constants/strengthBank';
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
  if (context.strengthLevel !== 'intermediate' && context.strengthLevel !== 'advanced') {
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
