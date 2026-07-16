import type { RichWeek, RichWorkout } from '../types/workout';
import type {
  CrossTrainingActivityPreference,
  TrainingPreferences,
} from '../types/trainingPreferences';

export type CrossTrainingProgrammingContext = {
  month: number;
  readinessScore: number;
};

const REPLACEABLE_TYPES = new Set<RichWorkout['richType']>([
  'easy_run',
  'recovery_run',
  'run_walk',
  'deload_session',
]);

function isAvailable(preference: CrossTrainingActivityPreference, month: number): boolean {
  return !preference.seasonalMonths?.length || preference.seasonalMonths.includes(month);
}

function activityLabel(preference: CrossTrainingActivityPreference): string {
  return preference.activityType
    .split('_')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function crossTrainingWorkout(
  base: RichWorkout,
  preference: CrossTrainingActivityPreference,
  relationship: 'replace' | 'supplement',
  dayIndex: number,
  readinessScore: number,
): RichWorkout {
  const label = activityLabel(preference);
  const isIntensity = preference.activityType === 'hiit'
    || preference.activityType === 'mixed_modal';
  const intensity = isIntensity ? 'hard' : readinessScore < 55 ? 'very_easy' : 'easy';
  const rpeRange: [number, number] = isIntensity ? [7, 8] : readinessScore < 55 ? [2, 3] : [3, 5];
  const durationMinutes = Math.max(
    10,
    Math.min(180, preference.typicalDurationMinutes),
  );
  const relationshipText = relationship === 'replace'
    ? 'This replaces an easy aerobic session and contributes cross-training load, not running mileage.'
    : 'This supplements the primary plan; keep it controlled so the next key session remains recoverable.';

  return {
    ...base,
    id: `${base.id}_${preference.activityType}_${relationship}`,
    title: label,
    description: `${durationMinutes} minutes of ${label.toLowerCase()} at RPE ${rpeRange[0]}–${rpeRange[1]}.`,
    type: 'cross_training',
    richType: 'cross_training',
    dayIndex,
    durationMinutes,
    targetDistance: undefined,
    intensity,
    paceRange: { minSecPerMi: 0, maxSecPerMi: 0 },
    hrZoneTarget: isIntensity ? 4 : readinessScore < 55 ? 1 : 2,
    rpeRange,
    purpose: `${relationshipText} ${base.purpose}`,
    instructions: [
      `Complete ${durationMinutes} minutes of ${label.toLowerCase()}.`,
      `Use RPE ${rpeRange[0]}–${rpeRange[1]} and the activity-specific metrics available.`,
      relationshipText,
    ],
    executionCues: isIntensity
      ? ['Keep work intervals deliberate.', 'Stop adding intensity if form or recovery declines.']
      : ['Keep breathing controlled.', 'Finish with enough reserve for the next planned session.'],
    mainSet: [{
      label: relationship === 'replace' ? 'Aerobic replacement' : 'Supplemental aerobic work',
      duration: `${durationMinutes} min`,
      paceGuide: `RPE ${rpeRange[0]}–${rpeRange[1]}`,
      hrZone: isIntensity ? 4 : readinessScore < 55 ? 1 : 2,
      rpe: rpeRange,
      instructions: relationshipText,
    }],
    intervals: isIntensity ? base.intervals : undefined,
    score: {
      ...base.score,
      intendedLoad: Math.round(durationMinutes * (isIntensity ? 1.2 : 0.7)),
      recoveryDemandHours: isIntensity ? 48 : 24,
    },
    progressionNote: relationshipText,
  };
}

function freeDay(workouts: RichWorkout[], preferredDays: number[]): number {
  const occupied = new Set(workouts.map(workout => workout.dayIndex));
  return preferredDays.find(day => !occupied.has(day))
    ?? [0, 2, 4, 6, 1, 3, 5].find(day => !occupied.has(day))
    ?? 5;
}

export function applyCrossTrainingPreferencesToWeek(
  week: RichWeek,
  preferences: TrainingPreferences,
  context: CrossTrainingProgrammingContext,
): RichWeek {
  if (
    preferences.crossTrainingDecision !== 'yes'
    || preferences.crossTrainingFrequencyPerWeek <= 0
    || preferences.crossTrainingActivities.length === 0
  ) {
    return week;
  }

  const eligible = preferences.crossTrainingActivities
    .filter(preference => isAvailable(preference, context.month))
    .slice(0, Math.min(3, preferences.crossTrainingFrequencyPerWeek));
  if (eligible.length === 0) return week;

  let workouts = [...week.workouts];
  let loadDelta = 0;
  for (const preference of eligible) {
    const isIntensity = preference.activityType === 'hiit'
      || preference.activityType === 'mixed_modal';
    const replacementIndex = workouts.findIndex(workout =>
      REPLACEABLE_TYPES.has(workout.richType));
    const shouldReplace = isIntensity
      || context.readinessScore < 55
      || preference.use === 'replace_easy_aerobic'
      || preference.use === 'either';

    if (shouldReplace && replacementIndex >= 0) {
      const existing = workouts[replacementIndex];
      const replacement = crossTrainingWorkout(
        existing,
        preference,
        'replace',
        existing.dayIndex,
        context.readinessScore,
      );
      loadDelta += replacement.score.intendedLoad - existing.score.intendedLoad;
      workouts[replacementIndex] = replacement;
      continue;
    }

    const template = workouts.find(workout => REPLACEABLE_TYPES.has(workout.richType));
    if (!template) continue;
    const supplemental = crossTrainingWorkout(
      template,
      preference,
      'supplement',
      freeDay(workouts, preference.preferredDays),
      context.readinessScore,
    );
    loadDelta += supplemental.score.intendedLoad;
    workouts.push(supplemental);
  }

  return {
    ...week,
    workouts: workouts.sort((a, b) => a.dayIndex - b.dayIndex),
    weekScore: {
      ...week.weekScore,
      totalIntendedLoad: Math.max(0, week.weekScore.totalIntendedLoad + loadDelta),
    },
    progressionNote: `${week.progressionNote} Cross-training is integrated as a documented replacement or supplement; it does not add running mileage.`,
  };
}

