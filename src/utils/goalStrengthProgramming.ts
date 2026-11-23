import type { CompletedExercise, Exercise, PlannedExercise, StrengthEngineInput, StrengthLogRecord, StrengthSessionType } from '../types/strength';
import { trainingGoalBlend } from './trainingGoals';
import { compatibleExerciseOptions } from './exerciseAdaptation';
import { getGoalMesocycle } from './plan/goalMesocycle';
import { strengthExerciseEquipment, strengthProgressionLevel } from './strengthDesign';
import { mapEquipmentType } from './strengthSession';

/** Inspect attempts before judging success: a recent hard, skipped or ambiguous
 * attempt must not disappear and expose two older favorable performances. */
function strengthAttempts(exercise: Exercise, history: StrengthLogRecord[], now: number) {
  const seen = new Set<string>();
  return history.filter(record => record.exercises.some(item => item.exerciseId === exercise.id))
    .sort((a, b) => !Number.isFinite(a.timestamp) ? -1 : !Number.isFinite(b.timestamp) ? 1 : b.timestamp - a.timestamp).filter(record => {
      const key = record.scheduledSessionId ?? record.sessionId ?? record.id;
      if (seen.has(key) || seen.has(record.id)) return false;
      seen.add(key); seen.add(record.id); return true;
    }).map(record => {
      const matches = record.exercises.filter(item => item.exerciseId === exercise.id);
      const performed = matches.length === 1 ? matches[0] : undefined;
      const valid = !record.skipped && Number.isFinite(record.timestamp)
        && record.timestamp <= now && record.timestamp >= now - 42 * 86400000
        && performed && !performed.skipped;
      return { record, performed: valid ? performed : undefined };
    });
}

function resolvedSetup(exercise: Exercise, attempts: ReturnType<typeof strengthAttempts>) {
  const actual = attempts[0]?.performed?.equipmentType;
  return exercise.equipment.length === 1 ? exercise.equipment[0]
    : actual ? exercise.equipment.find(option => mapEquipmentType([option]) === actual) : undefined;
}

function exposure(performed: CompletedExercise | undefined, setup: ReturnType<typeof mapEquipmentType>, topReps: number, heavy = false, recovery = false) {
    if (!performed || performed.equipmentType !== setup) return null;
    const sets = performed.sets.filter(set => !set.isWarmup);
    if (sets.length < (recovery ? 1 : 2) || sets.some(set => !set.completed)
      || (performed.prescription && sets.length < performed.prescription.sets)
      || !sets.every(set => Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= (heavy ? 8 : recovery ? 6 : 7)
      && Number.isFinite(set.reps) && set.reps! >= (heavy ? 3 : topReps) && (!heavy || set.reps! <= 5))) return null;
    if (heavy) {
      const rx = performed.prescription;
      const scheme = rx?.repScheme;
      if (scheme?.kind !== 'reps' || scheme.repsMin !== 3 || scheme.repsMax !== 5
        || rx?.targetRpe !== 8 || (rx.restSeconds ?? 0) < 180) return null;
    }
    const loads = sets.map(set => {
      if (set.weight !== undefined) {
        if (Number.isFinite(set.weight) && set.weight > 0 && (set.weightUnit === 'lb' || set.weightUnit === 'kg')) return `${set.weight}:${set.weightUnit}`;
        if (set.weight === 0 && setup === 'bodyweight' && /^bw$/i.test(set.load?.trim() ?? '')) return 'BW';
        return null; // An unqualified structured quantity cannot borrow a stale display label's unit.
      }
      if (typeof set.load === 'string' && /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i.test(set.load.trim())) return set.load.trim().toLowerCase().replace(/\s+/g, '').replace(/lbs$/, 'lb');
      if (setup === 'bodyweight' && /^bw$/i.test(set.load?.trim() ?? '')) return 'BW';
      if (setup === 'resistance_band' && set.bandLevel) return `band:${set.bandLevel}:${set.bandCustomLabel ?? ''}`;
      return null;
    });
    if (!loads[0] || loads.some(load => load !== loads[0])) return null;
    return loads[0];
}

/** Valid consecutive recent attempts, not a selection of favorable history. */
export function comparableStrengthExposures(exercise: Exercise, history: StrengthLogRecord[], topReps: number, now = Date.now()) {
  const attempts = strengthAttempts(exercise, history, now);
  const option = resolvedSetup(exercise, attempts);
  if (!option) return [];
  const setup = mapEquipmentType([option]);
  const result = [];
  for (const { record, performed } of attempts) {
    const load = exposure(performed, setup, topReps);
    if (!load) break;
    result.push({ id: record.id, timestamp: record.timestamp, load });
  }
  return result;
}

function strengthSpecificEvidence(exercise: Exercise, history: StrengthLogRecord[], now: number) {
  const attempts = strengthAttempts(exercise, history, now);
  const option = resolvedSetup(exercise, attempts);
  if (!option || !['barbell', 'dumbbell', 'kettlebell', 'machine'].includes(option)) return null;
  const setup = mapEquipmentType([option]);
  // Planned easy recovery is not a failed heavy session and earns no progress.
  let offset = 0;
  while (offset < 2) {
    const performed = attempts[offset]?.performed;
    const targetRpe = performed?.prescription?.targetRpe;
    const scheme = performed?.prescription?.repScheme;
    if (!performed?.prescription?.loadTarget?.startsWith('Recovery practice after strength-specific work')
      || !Number.isFinite(targetRpe) || targetRpe! < 1 || targetRpe! > 6
      || scheme?.kind !== 'reps' || !scheme.repsMin || !exposure(performed, setup, scheme.repsMin, false, true)) break;
    offset++;
  }
  const recent = attempts.slice(offset);
  const basePair = (start: number) => {
    const first = exposure(recent[start]?.performed, setup, 10);
    return !!first && first === exposure(recent[start + 1]?.performed, setup, 10);
  };
  const firstHeavy = exposure(recent[0]?.performed, setup, 3, true);
  const secondHeavy = exposure(recent[1]?.performed, setup, 3, true);
  const latestHeavy = recent[0]?.performed;
  // A prescribed dose is only retained when its actual working sets were
  // completed. Extra ad-hoc sets do not silently become next week's target.
  const capturedDose = (performed: CompletedExercise | undefined, valid: string | null) => {
    const count = performed?.prescription?.sets;
    return valid && Number.isSafeInteger(count) && count! >= 2 && count! <= 5
      && performed!.sets.filter(set => !set.isWarmup).length >= count! ? count! : 2;
  };
  const completedDose = capturedDose(latestHeavy, firstHeavy);
  const priorDose = capturedDose(recent[1]?.performed, secondHeavy);
  return { option, prepared: offset === 0 && basePair(0),
    familiar: !!firstHeavy && (!!secondHeavy || basePair(1)),
    twoHeavy: !!firstHeavy && !!secondHeavy, completedDose, priorDose,
    sameHeavyLoad: !!firstHeavy && firstHeavy === secondHeavy };

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
  const cycle = getGoalMesocycle(input.currentWeek, input.trainingPhase, input.goalType ?? 'general_running', input.goalIntent);
  const level = strengthProgressionLevel(input.strengthLevel);
  const recoveryLimited = cycle.recovery || input.injuryRisk || !Number.isFinite(input.recoveryScore)
    || input.recoveryScore < 0 || input.recoveryScore > 100
    || !Number.isFinite(input.fatigueScore) || input.fatigueScore < 0 || input.fatigueScore > 100
    || !Number.isFinite(input.acwr) || input.acwr < 0 || input.acwr > 1.4
    || (input.soreness !== null && !Number.isFinite(input.soreness))
    || input.recoveryScore < 55 || input.fatigueScore > 70 || (input.soreness ?? 0) >= 7;
  const blend = trainingGoalBlend(input.goalType ?? 'general_running', input.secondaryGoalTypes);
  const strengthFirst = input.goalType === 'general_strength';
  const strengthSupport = input.goalType === 'hybrid' || blend.secondary.includes('general_strength') || blend.secondary.includes('hybrid');
  const raceSupport = input.goalType === 'race_prep' && ['threshold', 'vo2', 'race_specific', 'build', 'peak', 'taper'].includes(input.trainingPhase);
  const candidates = Object.values(library).map(exercise => ({ ...exercise, equipment: strengthExerciseEquipment(exercise, input.availableEquipment) }))
    .filter(exercise => exercise.equipment.length > 0);
  let rotated = false;
  let progressed = false;
  let heavyCount = 0;
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
    let repRange: [number, number] = index < 3
      ? strengthFirst && level !== 'beginner' ? [6, 10] : [8, 10]
      : [8, 12];
    let sets = recoveryLimited ? Math.min(exercise.sets, 1) : Math.min(exercise.sets, raceSupport ? 2 : 3);
    const specific = strengthSpecificEvidence(exercise.exercise, input.strengthHistory, Date.now());
    const eligible = (!input.goalIntent || input.goalIntent.priorities[0] === 'get_stronger' || index === 4 && input.goalIntent.priorities[1] === 'get_stronger' || index === 5 && input.goalIntent.priorities[2] === 'get_stronger') && (strengthFirst || strengthSupport) && level !== 'beginner' && !raceSupport
      && input.trainingPhase !== 'foundation' && Number.isFinite(input.availableTimeMin) && input.availableTimeMin! >= 30
      && ['squat', 'hinge', 'lunge', 'push', 'pull'].includes(exercise.exercise.pattern)
      && heavyCount < (strengthFirst ? 2 : 1);
    const heavy = eligible && !recoveryLimited && input.recoveryScore >= 65 && specific
      && (!strengthFirst || cycle.strengthLoading === 'intensification')
      && (specific.familiar || (cycle.doseStage === 'develop' || strengthFirst && cycle.strengthLoading === 'intensification')
        && specific.prepared && input.recoveryScore >= 65);
    const recoveryAfterHeavy = eligible && recoveryLimited && specific?.familiar;
    if (heavy) {
      heavyCount++;
      exercise = { ...exercise, exercise: { ...exercise.exercise, equipment: [specific.option] } };
      // Review retains the successfully completed captured dose; neither a
      // calendar change nor unplanned extra sets prove more capacity.
      repRange = [3, 5]; sets = specific.completedDose;
      if (sets === 2 && !progressed && specific.twoHeavy && cycle.doseStage === 'develop' && input.recoveryScore >= 65) {
        sets = 3; progressed = true;
      } else if (sets >= 3 && sets < 5 && !progressed && strengthFirst && level === 'advanced'
        && input.availableTimeMin! >= 60 && cycle.doseStage === 'develop'
        && specific.twoHeavy && specific.priorDose >= sets && specific.sameHeavyLoad) {
        // After repeated success at this dose, add at most one working set
        // to one priority lift. The final fitter still protects actual time.
        sets += 1; progressed = true;
      }
    }
    const evidence = comparableStrengthExposures(exercise.exercise, input.strengthHistory, repRange[1]);
    const comparablePair = evidence.length >= 2 && evidence[0]!.load === evidence[1]!.load;
    const needsCalibration = !!exercise.notes && !comparablePair;
    if (!heavy && !progressed && index === 0 && !recoveryLimited && !raceSupport && cycle.doseStage === 'develop'
      && !needsCalibration && comparablePair && sets === 2 && input.recoveryScore >= 65) {
      sets = 3; progressed = true;
    }
    const rpe = heavy ? 8 : Math.min(exercise.rpe, recoveryLimited ? 6 : level === 'beginner' ? 7 : 8);
    return { ...exercise, sets, repRange, repScheme: { kind: 'reps' as const, repsMin: repRange[0], repsMax: repRange[1], perSide: scheme?.perSide ?? exercise.exercise.unilateral },
      rpe, rir: 10 - rpe, restSeconds: Math.max(exercise.restSeconds, heavy ? 180 : (strengthFirst || strengthSupport) && index < 3 ? 120 : 90),
      loadTarget: recoveryAfterHeavy ? `Recovery practice after strength-specific work — recalibrate a lighter load for ${repRange[0]}–${repRange[1]} reps at RPE ${rpe}`
        : heavy ? `RPE 8 — strength-specific 3–5 reps, about two reps in reserve. Calibrate this rep range and setup; do not transfer or automatically increase the last working weight.`
        : needsCalibration ? `RPE ${rpe} — calibrate this exercise and setup separately` : `RPE ${rpe} — choose a repeatable load for ${repRange[0]}–${repRange[1]} reps`,
      progressionRule: 'Repeat the same setup. Build to the top of the rep range at the intended effort before choosing a small equipment-appropriate load increase. Missing effort, changed setup or a new variation calls for calibration.',
      regressionRule: 'If the work is too hard, reduce load or reps while retaining the intended movement. Reduce a working set when recovery is limited; record what you actually complete.',
    };
  });
  const note = `${cycle.focus}. Practice block ${cycle.blockNumber}, week ${cycle.weekInBlock}/6; loading/recovery week ${cycle.loadingWeek}/4.${rotated ? ' One compatible accessory variation was selected; calibrate its load separately.' : ' Useful main lifts stay consistent.'}${heavyCount ? ' Earned main-lift work uses 3–5 reps at RPE 8 with at least three minutes rest; accessories retain their own purpose. This is effort guidance, not a measured percentage of 1RM.' : ''}${progressed ? ' One main exercise gains a working set after two comparable, manageable recorded exposures in its own rep range; the time budget still applies.' : ' Calendar advancement alone adds no load or working sets.'}`;
  if (!input.goalIntent) return { exercises: adapted, cycle, note };
  const primary = input.goalIntent.priorities[0];
  const specific = adapted.map((exercise, index) => {
    const focus = index === 4 ? input.goalIntent?.priorities[1] ?? primary : index === 5 ? input.goalIntent?.priorities[2] ?? primary : primary;
    const priorityPower = focus === 'power' && (index < 3 || focus !== primary);
    const pattern = exercise.exercise.pattern;
    const supported = recoveryLimited || input.goalIntent?.season === 'in_season';
    if (pattern === 'mobility' || pattern === 'plyometric') return exercise;
    if (pattern === 'trunk' || pattern === 'carry' || exercise.repScheme?.kind === 'duration') return {
      ...exercise, sets: supported ? 1 : Math.min(2, exercise.sets), rpe: Math.min(exercise.rpe, supported ? 6 : 7),
    };
    let reps: [number, number] = exercise.repRange;
    let sets = exercise.sets;
    let rpe = exercise.rpe;
    let rest = exercise.restSeconds;
    if (focus === 'build_muscle') { reps = level === 'beginner' ? [10, 15] : [8, 12]; sets = Math.min(4, sets); rest = Math.max(90, rest); }
    if (priorityPower) {
      reps = level === 'beginner' || supported ? [5, 6] : [2, 5]; sets = supported ? 1 : Math.min(3, Math.max(2, sets));
      rpe = Math.min(6, rpe); rest = Math.max(120, rest);
    }
    if (focus === 'general_fitness') { reps = [10, 15]; sets = Math.min(2, sets); }
    if (['hiking', 'cross_country_skiing', 'mountaineering'].includes(focus!) && pattern !== 'push' && pattern !== 'pull') reps = [8, 12];
    if (['downhill_skiing', 'snowboarding'].includes(focus!)) { reps = [6, 10]; rest = Math.max(120, rest); }
    if (supported) { sets = 1; rpe = Math.min(6, rpe); }
    return { ...exercise, sets, repRange: reps,
      repScheme: { kind: 'reps' as const, repsMin: reps[0], repsMax: reps[1], perSide: exercise.exercise.unilateral },
      rpe, rir: 10 - rpe, restSeconds: rest,
      loadTarget: priorityPower ? `RPE ${rpe} — a controllable load moved with purposeful speed; stop before speed or control drops. No maximum-load target.` : `RPE ${rpe} — calibrate a repeatable load for ${reps[0]}–${reps[1]} repetitions in this setup`,
      notes: [exercise.notes, priorityPower ? 'Power practice uses few quality repetitions with full recovery. Beginners establish controlled technique before ballistic variations.' : undefined].filter(Boolean).join(' ') || undefined,
    };
  });
  return { exercises: specific, cycle, note };
}
