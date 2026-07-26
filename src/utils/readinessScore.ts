import type { DailyReadiness, ReadinessDetails, ReadinessInputs, ReadinessLabel } from '../types/readiness';

export const READINESS_HISTORY_DAYS = 28;
export const MIN_BASELINE_HISTORY = 7;
export const STARTER_SLEEP_BASELINE_MINUTES = 7 * 60;
export const READINESS_CHOICE_MIN = 1;
export const READINESS_CHOICE_MAX = 5;

export const READINESS_WEIGHTS = {
  sleepDuration: 0.21,
  sleepQuality: 0.14,
  body: 0.18,
  energy: 0.12,
  stress: 0.10,
  trainingRecovery: 0.25,
} as const;

export const READINESS_CHOICE_SCORE = {
  least_favorable: 20,
  below_average: 40,
  middle: 60,
  favorable: 80,
  most_favorable: 100,
} as const;

export type ReadinessContext = {
  /** 0-100 recent training load supplied by a caller that has it. */
  recentTrainingLoad?: number;
  /** A finite prior-day readiness score supplied by a caller that has it. */
  priorDayScore?: number;
  /** True when yesterday included a clearly demanding session. */
  priorDayHighIntensity?: boolean;
  /** Local YYYY-MM-DD key matching the entry being scored. */
  referenceDateKey?: string;
};

export type ReadinessCalculation = {
  score: number;
  sleepMinutesTotal: number;
  details: ReadinessDetails;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const DAY_MS = 24 * 60 * 60 * 1000;

function validChoice(value: unknown): number | undefined {
  const safe = finite(value);
  if (safe === undefined) return undefined;
  const rounded = Math.round(safe);
  return rounded >= READINESS_CHOICE_MIN && rounded <= READINESS_CHOICE_MAX ? rounded : undefined;
}

export function readinessChoiceContribution(value: unknown, fallback = READINESS_CHOICE_SCORE.middle): number {
  const choice = validChoice(value);
  if (choice === undefined) return fallback;
  return choice * 20;
}

/** Converts split sleep fields safely; invalid or negative values contribute zero. */
export function normalizeSleepMinutes(hours: unknown, minutes: unknown): number {
  const safeHours = Math.max(0, finite(hours) ?? 0);
  const safeMinutes = Math.max(0, finite(minutes) ?? 0);
  const total = Math.round(safeHours * 60 + safeMinutes);
  return clamp(total, 0, 14 * 60 + 59);
}

/**
 * Absolute sleep-duration contribution used when history is limited.
 * It uses interpolation between coach-readable reference points rather than
 * abrupt UI-level bands, and it does not treat unlimited sleep as always better.
 */
export function sleepDurationContribution(totalMinutes: unknown): number {
  const minutes = clamp(Math.round(finite(totalMinutes) ?? 0), 0, 14 * 60 + 59);
  if (minutes <= 0) return 0;
  const points: [number, number][] = [
    [0, 0],
    [3 * 60, 10],
    [4 * 60, 10],
    [5 * 60, 25],
    [6 * 60, 45],
    [7 * 60, 65],
    [7 * 60 + 30, 80],
    [8 * 60, 95],
    [8 * 60 + 30, 100],
    [9 * 60 + 30, 95],
    [10 * 60 + 30, 85],
    [14 * 60 + 59, 85],
  ];
  for (let index = 1; index < points.length; index += 1) {
    const [rightMinute, rightScore] = points[index];
    if (minutes <= rightMinute) {
      const [leftMinute, leftScore] = points[index - 1];
      const span = Math.max(1, rightMinute - leftMinute);
      const ratio = (minutes - leftMinute) / span;
      return Math.round(leftScore + (rightScore - leftScore) * ratio);
    }
  }
  return 85;
}

function formatSleepMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hr${minutes ? ` ${minutes} min` : ''}`;
}

function entrySleepMinutes(entry: Partial<DailyReadiness>): number | undefined {
  const total = finite(entry.sleepMinutesTotal);
  if (total !== undefined && total > 0) return clamp(Math.round(Math.abs(total)), 1, 14 * 60 + 59);
  const hasSplitSleep = finite(entry.sleepHours) !== undefined || finite(entry.sleepMinutes) !== undefined;
  if (!hasSplitSleep) return undefined;
  const normalized = normalizeSleepMinutes(entry.sleepHours, entry.sleepMinutes);
  return normalized > 0 ? normalized : undefined;
}

function parseDateKey(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return undefined;
  return timestamp;
}

function todayUTCDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Uses only valid dated sleep values inside a true 28-calendar-day rolling window. */
export function sleepBaseline(
  history: readonly Partial<DailyReadiness>[],
  referenceDateKey = todayUTCDateKey(),
): {
  minutes: number;
  source: ReadinessDetails['baselineSource'];
  validEntryCount: number;
} {
  const fallbackDate = parseDateKey(todayUTCDateKey()) ?? 0;
  const referenceDate = parseDateKey(referenceDateKey) ?? fallbackDate;
  const windowStart = referenceDate - (READINESS_HISTORY_DAYS - 1) * DAY_MS;
  const recent = history
    .map(entry => ({ date: parseDateKey(entry.date), minutes: entrySleepMinutes(entry) }))
    .filter((entry): entry is { date: number; minutes: number } =>
      entry.date !== undefined
      && entry.minutes !== undefined
      && entry.date >= windowStart
      && entry.date <= referenceDate);
  if (recent.length < MIN_BASELINE_HISTORY) {
    return { minutes: STARTER_SLEEP_BASELINE_MINUTES, source: 'starter_fallback', validEntryCount: recent.length };
  }
  return {
    minutes: Math.round(recent.reduce((sum, entry) => sum + entry.minutes, 0) / recent.length),
    source: 'personal_28_day',
    validEntryCount: recent.length,
  };
}

export function readinessLabel(score: unknown): ReadinessLabel {
  const safeScore = clamp(finite(score) ?? 0, 0, 100);
  if (safeScore >= 80) return 'Ready to Train';
  if (safeScore >= 65) return 'Mostly Ready';
  if (safeScore >= 45) return 'Take It Easier Today';
  return 'Recovery Recommended';
}

function labelMessage(label: ReadinessLabel): string {
  switch (label) {
    case 'Ready to Train': return 'Your check-in supports the planned workout. Keep the effort honest and adjust if anything changes.';
    case 'Mostly Ready': return 'The plan can work today. Start easy and keep the effort conversational if your body asks for it.';
    case 'Take It Easier Today': return 'Choose an easier version of the plan today. Protect the purpose, not the pace.';
    case 'Recovery Recommended': return 'Recovery is the better training choice today. An easy walk, mobility, or full rest still supports the week.';
  }
}

/**
 * Pure, conservative readiness calculation. It intentionally accepts optional
 * training hooks, so callers without load/history do not fabricate them.
 */
export function calculateReadiness(
  inputs: ReadinessInputs,
  history: readonly Partial<DailyReadiness>[] = [],
  context: ReadinessContext = {},
): ReadinessCalculation {
  const sleepMinutesTotal = normalizeSleepMinutes(inputs.sleepHours, inputs.sleepMinutes);
  const baseline = sleepBaseline(history, context.referenceDateKey);
  const sleepQualityContribution = readinessChoiceContribution(inputs.sleepQuality);
  const bodyContribution = readinessChoiceContribution(inputs.bodyStatus);
  const energyContribution = readinessChoiceContribution(inputs.energy);
  const stressContribution = readinessChoiceContribution(inputs.stress);
  const trainingRecovery = trainingRecoveryContribution(context);
  const reasons: string[] = [];

  // Personal baseline adds context, while an absolute low-sleep guard keeps a
  // chronically low baseline from presenting a short night as a green light.
  const absoluteSleep = sleepDurationContribution(sleepMinutesTotal);
  const differenceFromBaseline = sleepMinutesTotal - baseline.minutes;
  const personalAdjustment = baseline.source === 'personal_28_day'
    ? clamp(Math.round(differenceFromBaseline / 6), -15, 10)
    : 0;
  const sleepDurationScore = clamp(absoluteSleep + personalAdjustment, 0, 100);
  const sleepScore = Math.round((sleepDurationScore * 0.6) + (sleepQualityContribution * 0.4));
  if (baseline.source === 'personal_28_day' && differenceFromBaseline <= -45) {
    reasons.push(`You slept ${formatSleepMinutes(sleepMinutesTotal)}, about ${Math.abs(differenceFromBaseline)} minutes below your recent baseline.`);
  } else if (baseline.source === 'personal_28_day' && differenceFromBaseline >= 30) {
    reasons.push(`You slept ${formatSleepMinutes(sleepMinutesTotal)}, above your recent baseline.`);
  } else if (baseline.source === 'personal_28_day') {
    reasons.push(`You slept ${formatSleepMinutes(sleepMinutesTotal)}, close to your recent baseline.`);
  } else if (sleepMinutesTotal >= 7 * 60) {
    reasons.push(`You slept ${formatSleepMinutes(sleepMinutesTotal)}, within the general target range used while your baseline builds.`);
  } else {
    reasons.push(`You slept ${formatSleepMinutes(sleepMinutesTotal)}. StrideOS will personalize this comparison after more valid entries.`);
  }
  if (sleepQualityContribution <= READINESS_CHOICE_SCORE.below_average) reasons.push('Sleep quality was lower than ideal, so the recommendation stays conservative.');

  if (bodyContribution <= READINESS_CHOICE_SCORE.below_average) reasons.push('Your body status suggests keeping impact and intensity lower.');
  if (energyContribution <= READINESS_CHOICE_SCORE.below_average) reasons.push('Low energy is a reason to begin more gently.');
  if (stressContribution <= READINESS_CHOICE_SCORE.below_average) reasons.push('Higher stress can make the same workout feel harder.');
  if (trainingRecovery.recentTrainingAdjustment < 0) reasons.push('Recent training load adds a small recovery buffer.');
  if (trainingRecovery.priorDayAdjustment < 0) reasons.push('Yesterday’s lower readiness is carried forward cautiously.');
  if (trainingRecovery.priorDayIntensityAdjustment < 0) reasons.push('Yesterday included a demanding session, so today keeps a small recovery buffer.');

  const weightedScore =
    sleepDurationScore * READINESS_WEIGHTS.sleepDuration
    + sleepQualityContribution * READINESS_WEIGHTS.sleepQuality
    + bodyContribution * READINESS_WEIGHTS.body
    + energyContribution * READINESS_WEIGHTS.energy
    + stressContribution * READINESS_WEIGHTS.stress
    + trainingRecovery.score * READINESS_WEIGHTS.trainingRecovery;

  let score = weightedScore;
  const neutralSubjectiveScore =
    sleepDurationScore * READINESS_WEIGHTS.sleepDuration
    + READINESS_CHOICE_SCORE.middle * READINESS_WEIGHTS.sleepQuality
    + READINESS_CHOICE_SCORE.middle * READINESS_WEIGHTS.body
    + READINESS_CHOICE_SCORE.middle * READINESS_WEIGHTS.energy
    + stressContribution * READINESS_WEIGHTS.stress
    + trainingRecovery.score * READINESS_WEIGHTS.trainingRecovery;
  const overlapPenalty = Math.max(0, neutralSubjectiveScore - weightedScore);
  const overlapPenaltyCap = 16;
  if (overlapPenalty > overlapPenaltyCap) {
    score = neutralSubjectiveScore - overlapPenaltyCap;
    reasons.push('Overlapping fatigue, energy, and sleep-quality signals are grouped so the score is not reduced multiple times for the same underlying issue.');
  }

  const factor = (inputs.optionalFactor ?? '').toLowerCase();
  const factorAdjustment = factor === 'illness' ? -25 : factor === 'pain_or_symptoms' ? -20 : 0;
  if (factor === 'illness') reasons.push('Illness is a reason to rest or choose only very gentle activity.');
  if (factor === 'pain_or_symptoms') reasons.push('New pain or symptoms call for a conservative training choice.');

  score = clamp(Math.round(score + factorAdjustment), 0, 100);
  const label = readinessLabel(score);
  return {
    score,
    sleepMinutesTotal,
    details: {
      label,
      message: labelMessage(label),
      reasons,
      baselineSleepMinutes: baseline.minutes,
      baselineSource: baseline.source,
      sleepContribution: sleepScore,
      sleepDurationContribution: sleepDurationScore,
      sleepQualityContribution,
      bodyContribution,
      energyContribution,
      stressContribution,
      trainingRecoveryContribution: trainingRecovery.score,
      differenceFromBaselineMinutes: differenceFromBaseline,
      sleepDataConfidence: baseline.source === 'personal_28_day' ? 'personalized' : 'limited_history',
      overlapPenaltyCap: overlapPenalty > overlapPenaltyCap ? overlapPenaltyCap : undefined,
      recentTrainingAdjustment: trainingRecovery.recentTrainingAdjustment,
      priorDayAdjustment: trainingRecovery.priorDayAdjustment,
      priorDayIntensityAdjustment: trainingRecovery.priorDayIntensityAdjustment,
    },
  };
}

/** Compatibility helper for older call-sites; new code should use calculateReadiness. */
export function calculateReadinessScore(inputs: ReadinessInputs): number {
  return calculateReadiness(inputs).score;
}

export type ReadinessTier = 'high' | 'moderate' | 'low';

export function readinessTier(score: number): ReadinessTier {
  const label = readinessLabel(score);
  return label === 'Ready to Train' ? 'high' : label === 'Mostly Ready' ? 'moderate' : 'low';
}

function trainingRecoveryContribution(context: ReadinessContext): {
  score: number;
  recentTrainingAdjustment: number;
  priorDayAdjustment: number;
  priorDayIntensityAdjustment: number;
} {
  const load = finite(context.recentTrainingLoad);
  const loadPenalty = load === undefined ? 0 : Math.round(clamp((load - 50) * 0.35, 0, 18));
  const priorScore = finite(context.priorDayScore);
  const priorPenalty = priorScore === undefined ? 0 : Math.round(clamp((55 - priorScore) * 0.2, 0, 10));
  const intensityPenalty = context.priorDayHighIntensity ? 12 : 0;
  return {
    score: clamp(80 - loadPenalty - priorPenalty - intensityPenalty, 20, 100),
    recentTrainingAdjustment: -loadPenalty,
    priorDayAdjustment: -priorPenalty,
    priorDayIntensityAdjustment: -intensityPenalty,
  };
}

export const READINESS_INTERPRETATION: Record<ReadinessTier, { label: string; message: string }> = {
  high: { label: 'Ready to Train', message: labelMessage('Ready to Train') },
  moderate: { label: 'Mostly Ready', message: labelMessage('Mostly Ready') },
  low: { label: 'Take It Easier Today', message: labelMessage('Take It Easier Today') },
};
