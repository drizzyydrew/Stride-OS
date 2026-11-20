import type { Exercise, PlannedExercise, StrengthEngineInput, StrengthLogRecord, StrengthSessionType } from '../types/strength';
import { trainingGoalBlend } from './trainingGoals';
import { compatibleExerciseOptions } from './exerciseAdaptation';
import { getGoalMesocycle } from './plan/goalMesocycle';
import { strengthExerciseEquipment, strengthProgressionLevel } from './strengthDesign';
import { mapEquipmentType } from './strengthSession';

/** Explicit comparable working sets are evidence; attendance and target RPE
 * are not. Setup/resistance changes require a new calibration. */
export function comparableStrengthExposures(exercise: Exercise, history: StrengthLogRecord[], topReps: number, now = Date.now()) {
  if (exercise.equipment.length !== 1) return [];
  const setup = mapEquipmentType(exercise.equipment);
  return history.filter(record => !record.skipped && Number.isFinite(record.timestamp)
    && record.timestamp <= now && record.timestamp >= now - 42 * 86400000).flatMap(record => {
    const performed = record.exercises.find(item => item.exerciseId === exercise.id && !item.skipped && item.equipmentType === setup);
    const sets = performed?.sets.filter(set => set.completed && !set.isWarmup) ?? [];
    if (sets.length < 2 || performed!.sets.some(set => !set.isWarmup && !set.completed)
      || (performed?.prescription && sets.length < performed.prescription.sets)
      || !sets.every(set => Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 7
      && Number.isFinite(set.reps) && set.reps! >= topReps)) return [];
    const loads = sets.map(set => {
      if (typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight > 0 && (set.weightUnit === 'lb' || set.weightUnit === 'kg')) return `${set.weight}:${set.weightUnit}`;
      if (typeof set.load === 'string' && /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i.test(set.load.trim())) return set.load.trim().toLowerCase().replace(/\s+/g, '').replace(/lbs$/, 'lb');
      if (setup === 'bodyweight' && /^bw$/i.test(set.load?.trim() ?? '')) return 'BW';
      if (setup === 'resistance_band' && set.bandLevel) return `band:${set.bandLevel}:${set.bandCustomLabel ?? ''}`;
      return null;
    });
    if (!loads[0] || loads.some(load => load !== loads[0])) return [];
    return [{ id: record.id, timestamp: record.timestamp, load: loads[0] }];
  }).sort((a, b) => b.timestamp - a.timestamp).filter((record, index, all) => all.findIndex(other => other.id === record.id) === index);
}

function replacementOf(original: PlannedExercise, replacement: Exercise, input: StrengthEngineInput, reason: string): PlannedExercise {
  return { ...original, exerciseId: replacement.id,
    repScheme: original.repScheme ? { ...original.repScheme, perSide: replacement.unilateral } : undefined,
    exercise: { ...replacement, equipment: strengthExerciseEquipment(replacement, input.availableEquipment) },
    coachingCues: replacement.coachingCues, rationale: replacement.rationale,
    loadTarget: `RPE ${original.rpe} — calibrate this exercise and setup separately`,
    notes: `${reason} ${original.exercise.name} → ${replacement.name}. Establish a new starting load; weights do not transfer between variations.` };
}

/** Goal-directed prescriptions within the existing phase/recovery schedule.
 * Six-week variation is a review opportunity, never evidence of more fitness. */
export function applyGoalStrengthProgramming(exercises: PlannedExercise[], input: StrengthEngineInput, sessionType: StrengthSessionType, library: Record<string, Exercise>) {
  const cycle = getGoalMesocycle(input.currentWeek, input.trainingPhase, input.goalType ?? 'general_running');
  const level = strengthProgressionLevel(input.strengthLevel);
  const recoveryLimited = cycle.recovery || input.injuryRisk || !Number.isFinite(input.recoveryScore)
    || input.recoveryScore < 0 || input.recoveryScore > 100
    || !Number.isFinite(input.fatigueScore) || input.fatigueScore < 0 || input.fatigueScore > 100
    || !Number.isFinite(input.acwr) || input.acwr < 0 || input.acwr > 1.4
    || (input.soreness !== null && !Number.isFinite(input.soreness))
    || input.recoveryScore < 55 || input.fatigueScore > 70 || (input.soreness ?? 0) >= 7;
  const blend = trainingGoalBlend(input.goalType ?? 'general_running', input.secondaryGoalTypes);
  const strengthFirst = input.goalType === 'general_strength';
  const strengthSupport = blend.secondary.includes('general_strength') || blend.secondary.includes('hybrid');
  const raceSupport = input.goalType === 'race_prep' && ['threshold', 'vo2', 'race_specific', 'build', 'peak', 'taper'].includes(input.trainingPhase);
  const candidates = Object.values(library).map(exercise => ({ ...exercise, equipment: strengthExerciseEquipment(exercise, input.availableEquipment) }))
    .filter(exercise => exercise.equipment.length > 0);
  let rotated = false;
  let progressed = false;
  const adapted = exercises.map((original, index) => {
    let exercise = original;
    const preferredId = input.exercisePreferences?.[original.exerciseId];
    const options = compatibleExerciseOptions(original.exercise, candidates, { availableEquipment: input.availableEquipment });
    const preferred = preferredId ? options.find(candidate => candidate.id === preferredId) : undefined;
    if (preferred) exercise = replacementOf(original, preferred, input, 'Your selected variation.');
    else if (!preferredId && !rotated && !recoveryLimited && cycle.blockNumber > 1 && cycle.blockNumber % 2 === 0 && index >= 3) {
      const alternatives = options.filter(candidate => candidate.cnsLoad !== 'high'
        && !exercises.some(item => item.exerciseId === candidate.id));
      const alternative = alternatives[(Math.floor(cycle.blockNumber / 2) - 1) % Math.max(1, alternatives.length)];
      const practicedAlternative = alternative && input.strengthHistory.some(record => !record.skipped
        && Number.isFinite(record.timestamp) && record.timestamp <= Date.now() && record.timestamp >= Date.now() - 42 * 86400000
        && record.exercises.some(item => !item.skipped && item.exerciseId === alternative.id && item.sets.some(set => set.completed && !set.isWarmup)));
      if (alternative && (practicedAlternative || comparableStrengthExposures(original.exercise, input.strengthHistory, original.repRange[1]).length >= 2)) {
        exercise = replacementOf(original, alternative, input, 'Six-week accessory review.'); rotated = true;
      }
    }
    const scheme = exercise.repScheme;
    const repeatLift = sessionType === 'full_body' && !['mobility', 'plyometric', 'carry', 'trunk'].includes(exercise.exercise.pattern)
      && (!scheme || scheme.kind === 'reps' || scheme.kind === 'reps_tempo');
    if (!repeatLift) return exercise;
    // A new variation starts from a manageable baseline. A lower rep target
    // is a goal-specific stimulus, not permission to transfer a heavier load.
    const repRange: [number, number] = index < 3
      ? strengthFirst && level !== 'beginner' ? [6, 10] : [8, 10]
      : [8, 12];
    let sets = recoveryLimited ? Math.min(exercise.sets, 1) : Math.min(exercise.sets, raceSupport ? 2 : 3);
    const evidence = comparableStrengthExposures(exercise.exercise, input.strengthHistory, repRange[1]);
    const comparablePair = evidence.length >= 2 && evidence[0]!.load === evidence[1]!.load;
    const needsCalibration = !!exercise.notes && !comparablePair;
    if (!progressed && index === 0 && !recoveryLimited && !raceSupport && cycle.doseStage === 'develop'
      && !needsCalibration && comparablePair && sets === 2 && input.recoveryScore >= 65) {
      sets = 3; progressed = true;
    }
    const rpe = Math.min(exercise.rpe, recoveryLimited ? 6 : level === 'beginner' ? 7 : 8);
    return { ...exercise, sets, repRange, repScheme: { kind: 'reps' as const, repsMin: repRange[0], repsMax: repRange[1], perSide: scheme?.perSide ?? exercise.exercise.unilateral },
      rpe, rir: 10 - rpe, restSeconds: Math.max(exercise.restSeconds, (strengthFirst || strengthSupport) && index < 3 ? 120 : 90),
      loadTarget: needsCalibration ? `RPE ${rpe} — calibrate this exercise and setup separately` : `RPE ${rpe} — choose a repeatable load for ${repRange[0]}–${repRange[1]} reps`,
      progressionRule: 'Repeat the same setup. Build to the top of the rep range at the intended effort before choosing a small equipment-appropriate load increase. Missing effort, changed setup or a new variation calls for calibration.',
      regressionRule: 'If the work is too hard, reduce load or reps while retaining the intended movement. Reduce a working set when recovery is limited; record what you actually complete.',
    };
  });
  const note = `${cycle.focus}. Practice block ${cycle.blockNumber}, week ${cycle.weekInBlock}/6; loading/recovery week ${cycle.loadingWeek}/4.${rotated ? ' One compatible accessory variation was selected; calibrate its load separately.' : ' Useful main lifts stay consistent.'}${progressed ? ' One main exercise gains a working set after two comparable, manageable recorded exposures; the time budget still applies.' : ' Calendar advancement alone adds no load or working sets.'}`;
  return { exercises: adapted, cycle, note };
}
