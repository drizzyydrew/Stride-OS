import type {
  BeginnerPlanGoal,
  BeginnerPlanReadinessInput,
  BeginnerPlanRecommendation,
  BeginnerPlanSession,
  BeginnerPlanWeek,
  GeneratedBeginnerPlan,
} from '../types/beginnerPlan';
import type {
  CrossTrainingActivityPreference,
  PrimaryEnduranceMode,
  TrainingPreferences,
} from '../types/trainingPreferences';

export type BeginnerPlanDefinition = {
  goal: BeginnerPlanGoal;
  title: string;
  distanceLabel: string;
  minimumSupportedWeeks: number;
  baselineRecommendedWeeks: number;
  longestSessionMinutes: number;
};

export const BEGINNER_PLAN_DEFINITIONS: Record<BeginnerPlanGoal, BeginnerPlanDefinition> = {
  couch_to_5k: {
    goal: 'couch_to_5k',
    title: 'Couch to 5K',
    distanceLabel: '5K',
    minimumSupportedWeeks: 8,
    baselineRecommendedWeeks: 10,
    longestSessionMinutes: 45,
  },
  couch_to_10k: {
    goal: 'couch_to_10k',
    title: 'Couch to 10K',
    distanceLabel: '10K',
    minimumSupportedWeeks: 12,
    baselineRecommendedWeeks: 16,
    longestSessionMinutes: 75,
  },
  couch_to_half_marathon: {
    goal: 'couch_to_half_marathon',
    title: 'Couch to Half Marathon',
    distanceLabel: 'Half Marathon',
    minimumSupportedWeeks: 20,
    baselineRecommendedWeeks: 26,
    longestSessionMinutes: 150,
  },
  couch_to_marathon: {
    goal: 'couch_to_marathon',
    title: 'Couch to Marathon',
    distanceLabel: 'Marathon',
    minimumSupportedWeeks: 32,
    baselineRecommendedWeeks: 40,
    longestSessionMinutes: 240,
  },
};

function dateAtUtcMidnight(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`);
  return parsed;
}

function addWeeks(date: string, weeks: number): string {
  const result = dateAtUtcMidnight(date);
  result.setUTCDate(result.getUTCDate() + weeks * 7);
  return result.toISOString().slice(0, 10);
}

function weeksBetween(start: string, end: string): number {
  return Math.floor(
    (dateAtUtcMidnight(end).getTime() - dateAtUtcMidnight(start).getTime())
      / (7 * 24 * 60 * 60 * 1000),
  );
}

export function recommendBeginnerPlanDuration(
  input: BeginnerPlanReadinessInput,
): BeginnerPlanRecommendation {
  const definition = BEGINNER_PLAN_DEFINITIONS[input.goal];
  let recommendedWeeks = definition.baselineRecommendedWeeks;
  const reasoning = [
    `${definition.distanceLabel} progression starts with aerobic consistency and durability before intensity.`,
  ];
  const progressionRequirements = [
    'Complete most easy sessions without a sustained symptom increase.',
    'Repeat or hold a week when readiness or recovery remains low.',
    'Keep easy sessions conversational and preserve recovery between harder demands.',
  ];

  if (input.startingLevel === 'inactive') {
    const addition = input.goal === 'couch_to_marathon' ? 10
      : input.goal === 'couch_to_half_marathon' ? 7 : 4;
    recommendedWeeks += addition;
    reasoning.push('The opening phase establishes regular walking before running volume progresses.');
  } else if (input.startingLevel === 'walking') {
    recommendedWeeks += input.goal === 'couch_to_marathon' ? 6 : 3;
    reasoning.push('Existing walking supports the aerobic start, with run/walk tolerance built gradually.');
  } else if (input.startingLevel === 'running' && input.continuousRunMinutes >= 30) {
    recommendedWeeks -= input.goal === 'couch_to_5k' ? 2 : 3;
    reasoning.push('Current continuous running capacity supports beginning beyond the earliest run/walk stage.');
  }

  if (input.continuousWalkMinutes < 30) {
    recommendedWeeks += input.goal === 'couch_to_marathon' ? 4 : 2;
    reasoning.push('Build toward a comfortable 30-minute continuous walk before extending running intervals.');
    progressionRequirements.push('Build continuous comfortable walking to at least 30 minutes.');
  }
  if (input.availableDaysPerWeek < 3) {
    recommendedWeeks += 4;
    reasoning.push('Fewer than three available days requires slower frequency and duration progression.');
  }
  if (input.recentConsistentWeeks < 4) {
    recommendedWeeks += 2;
    reasoning.push('A short recent training history supports a longer foundation phase.');
  } else if (input.recentConsistentWeeks >= 12 && input.startingLevel === 'running') {
    recommendedWeeks -= 2;
  }
  if (input.hasCurrentSymptoms) {
    recommendedWeeks += 4;
    reasoning.push('Current symptoms require conservative progression and modification based on response.');
    progressionRequirements.push('Seek appropriate clinical guidance for concerning or persistent symptoms.');
  }
  if (input.readinessScore != null && input.readinessScore < 50) {
    recommendedWeeks += 2;
    reasoning.push('Current readiness supports holding progression until recovery is more consistent.');
  }
  if (input.crossTrainingExperience) {
    reasoning.push('Cross-training may support aerobic volume, but does not replace impact-specific progression.');
  }

  recommendedWeeks = Math.max(definition.minimumSupportedWeeks, recommendedWeeks);
  const earliestSupportedTargetDate = addWeeks(input.startDate, recommendedWeeks);
  const accelerated = input.requestedTargetDate != null
    && weeksBetween(input.startDate, input.requestedTargetDate) < recommendedWeeks;

  return {
    recommendedWeeks,
    minimumSupportedWeeks: definition.minimumSupportedWeeks,
    earliestSupportedTargetDate,
    reasoning,
    progressionRequirements,
    accelerated,
  };
}

export function requiresAcceleratedAcknowledgment(
  input: BeginnerPlanReadinessInput,
): boolean {
  return recommendBeginnerPlanDuration(input).accelerated;
}

function sessionActivityType(
  kind: BeginnerPlanSession['kind'],
  mode: PrimaryEnduranceMode,
): BeginnerPlanSession['activityType'] {
  if (kind === 'strength') return 'strength';
  if (kind === 'mobility') return 'mobility';
  if (kind === 'cross_training') return 'cycling';
  if (kind === 'walk' || mode === 'walking') return 'walking';
  return 'running';
}

function buildEnduranceSession(
  goal: BeginnerPlanGoal,
  week: number,
  totalWeeks: number,
  dayIndex: number,
  durationMinutes: number,
  mode: PrimaryEnduranceMode,
  isLong: boolean,
): BeginnerPlanSession {
  const earlyRatio = week / totalWeeks;
  const shouldRunWalk = mode === 'run_walk'
    || (mode !== 'walking' && earlyRatio < (goal === 'couch_to_5k' ? 0.72 : 0.42));
  const kind: BeginnerPlanSession['kind'] = mode === 'walking'
    ? 'walk'
    : shouldRunWalk
      ? 'run_walk'
      : isLong
        ? 'long_session'
        : 'easy_run';
  const runSeconds = kind === 'run_walk'
    ? Math.min(600, 30 + Math.floor((week - 1) / 2) * 30)
    : undefined;
  const walkSeconds = kind === 'run_walk'
    ? Math.max(60, 120 - Math.floor((week - 1) / 3) * 15)
    : undefined;
  const repeats = runSeconds && walkSeconds
    ? Math.max(3, Math.floor((durationMinutes * 60) / (runSeconds + walkSeconds)))
    : undefined;

  return {
    id: `week_${week}_day_${dayIndex}_${kind}`,
    dayIndex,
    kind,
    activityType: sessionActivityType(kind, mode),
    durationMinutes,
    intensity: 'easy',
    purpose: isLong
      ? 'Extend sustainable aerobic time while preserving a conversational effort.'
      : 'Build repeatable aerobic frequency without accumulating unnecessary moderate intensity.',
    runSeconds,
    walkSeconds,
    repeats,
    explanation: isLong
      ? 'This is the week’s longer session. Keep it controlled so the following days remain recoverable.'
      : 'This session supports aerobic development and leaves room for strength, recovery, and the longer session.',
  };
}

function buildWeek(
  goal: BeginnerPlanGoal,
  weekNumber: number,
  totalWeeks: number,
  longestSessionMinutes: number,
  mode: PrimaryEnduranceMode,
): BeginnerPlanWeek {
  const isRecoveryWeek = weekNumber % 4 === 0 && weekNumber < totalWeeks;
  const progress = Math.min(1, weekNumber / totalWeeks);
  const recoveryMultiplier = isRecoveryWeek ? 0.76 : 1;
  const shortDuration = Math.round((20 + progress * 25) * recoveryMultiplier);
  const longDuration = Math.round(
    Math.min(longestSessionMinutes, 28 + progress * (longestSessionMinutes - 28))
      * recoveryMultiplier,
  );
  const sessions: BeginnerPlanSession[] = [
    buildEnduranceSession(goal, weekNumber, totalWeeks, 1, shortDuration, mode, false),
    {
      id: `week_${weekNumber}_day_2_strength`,
      dayIndex: 2,
      kind: 'strength',
      activityType: 'strength',
      durationMinutes: isRecoveryWeek ? 20 : 30,
      intensity: 'easy',
      purpose: 'Maintain strength and movement capacity alongside endurance progression.',
      supplements: true,
      explanation: 'This supports the plan without replacing the primary endurance sessions. Keep loading recoverable.',
    },
    buildEnduranceSession(goal, weekNumber, totalWeeks, 3, shortDuration, mode, false),
    {
      id: `week_${weekNumber}_day_4_mobility`,
      dayIndex: 4,
      kind: 'mobility',
      activityType: 'mobility',
      durationMinutes: 15,
      intensity: 'recovery',
      purpose: 'Use a low-load recovery session between endurance days.',
      supplements: true,
      explanation: 'This supports recovery and movement options without adding another aerobic intensity day.',
    },
    buildEnduranceSession(goal, weekNumber, totalWeeks, 6, longDuration, mode, true),
  ];

  return {
    weekNumber,
    isRecoveryWeek,
    focus: isRecoveryWeek
      ? 'Absorb the previous three weeks with reduced duration and no added intensity.'
      : weekNumber <= Math.ceil(totalWeeks * 0.35)
        ? 'Build consistency and comfortable run/walk or walking duration.'
        : 'Progress sustainable duration while protecting hard/easy separation.',
    sessions,
  };
}

export function generateBeginnerPlan(
  input: BeginnerPlanReadinessInput,
  primaryEnduranceMode: PrimaryEnduranceMode,
  acceleratedAcknowledgedAt?: number,
): GeneratedBeginnerPlan {
  const recommendation = recommendBeginnerPlanDuration(input);
  if (recommendation.accelerated && acceleratedAcknowledgedAt == null) {
    throw new Error('Accelerated timeline acknowledgment is required before generating this plan.');
  }

  const requestedWeeks = input.requestedTargetDate
    ? Math.max(1, weeksBetween(input.startDate, input.requestedTargetDate))
    : recommendation.recommendedWeeks;
  const durationWeeks = recommendation.accelerated
    ? requestedWeeks
    : recommendation.recommendedWeeks;
  const definition = BEGINNER_PLAN_DEFINITIONS[input.goal];
  const createdAt = Date.now();

  return {
    id: `preset_plan_${input.goal}_${createdAt}`,
    goal: input.goal,
    primaryEnduranceMode,
    startDate: input.startDate,
    targetDate: addWeeks(input.startDate, durationWeeks),
    durationWeeks,
    recommendation,
    acceleratedAcknowledgedAt,
    weeks: Array.from({ length: durationWeeks }, (_, index) =>
      buildWeek(
        input.goal,
        index + 1,
        durationWeeks,
        definition.longestSessionMinutes,
        primaryEnduranceMode,
      )),
    createdAt,
  };
}

function isSeasonallyAvailable(
  preference: CrossTrainingActivityPreference,
  month: number,
): boolean {
  return !preference.seasonalMonths?.length || preference.seasonalMonths.includes(month);
}

export function integrateCrossTrainingIntoWeek(
  week: BeginnerPlanWeek,
  preferences: TrainingPreferences,
  month: number,
  readinessScore: number,
): BeginnerPlanWeek {
  if (
    preferences.crossTrainingDecision !== 'yes'
    || preferences.crossTrainingFrequencyPerWeek <= 0
    || preferences.crossTrainingActivities.length === 0
  ) {
    return week;
  }

  const eligible = preferences.crossTrainingActivities.filter(preference =>
    isSeasonallyAvailable(preference, month));
  if (eligible.length === 0) return week;

  let sessions = [...week.sessions];
  const count = Math.min(preferences.crossTrainingFrequencyPerWeek, 4);
  for (let index = 0; index < count; index += 1) {
    const preference = eligible[index % eligible.length];
    const isIntensitySession = preference.activityType === 'hiit'
      || preference.activityType === 'mixed_modal';
    const shouldReplace = isIntensitySession
      || readinessScore < 55
      || preference.use === 'replace_easy_aerobic'
      || (preference.use === 'either' && index === 0);
    const replaceable = sessions.find(session =>
      ['walk', 'run_walk', 'easy_run'].includes(session.kind)
      && !session.replacesSessionId);
    const preferredDay = preference.preferredDays.find(day =>
      !sessions.some(session => session.dayIndex === day));
    const supplementalDay = preferredDay
      ?? [0, 5, 2, 4, 1, 3, 6].find(day => !sessions.some(session => session.dayIndex === day));
    if ((!shouldReplace || !replaceable) && supplementalDay == null) continue;
    const replaces = shouldReplace && Boolean(replaceable);
    const dayIndex = replaces && replaceable
      ? replaceable.dayIndex
      : supplementalDay as number;
    const durationMinutes = Math.max(
      10,
      Math.min(180, preference.typicalDurationMinutes),
    );
    const session: BeginnerPlanSession = {
      id: `week_${week.weekNumber}_day_${dayIndex}_${preference.activityType}_slot_${index + 1}`,
      dayIndex,
      kind: 'cross_training',
      activityType: preference.activityType,
      durationMinutes: week.isRecoveryWeek
        ? Math.round(durationMinutes * 0.75)
        : durationMinutes,
      intensity: preference.activityType === 'hiit' || preference.activityType === 'mixed_modal'
        ? 'moderate'
        : readinessScore < 55 ? 'recovery' : 'easy',
      purpose: replaces
        ? 'Maintain aerobic work with a lower-impact or preferred cross-training option.'
        : 'Add preferred aerobic variety without replacing the primary endurance progression.',
      replacesSessionId: replaces ? replaceable?.id : undefined,
      supplements: !replaces,
      explanation: replaces
        ? 'This replaces an easy aerobic session. It contributes whole-body and cross-training load, not running mileage.'
        : 'This supplements the plan. Keep the effort controlled so it does not compromise the next primary session.',
    };

    sessions = replaces && replaceable
      ? sessions.map(existing => existing.id === replaceable.id ? session : existing)
      : [...sessions, session];
  }

  return {
    ...week,
    sessions: sessions.sort((a, b) => a.dayIndex - b.dayIndex),
  };
}
