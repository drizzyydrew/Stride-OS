import { todayDateKey } from '../types/checkin';
import type { DailyReadiness, LegacyReadinessInputs } from '../types/readiness';
import { sleepDurationContribution } from './readinessScore';

const HISTORY_LIMIT = 120;
export const READINESS_STORE_SCHEMA_VERSION = 4;

type LegacyPersistedEntry = Partial<LegacyReadinessInputs> & {
  date?: unknown;
  score?: unknown;
  [key: string]: unknown;
};

type CurrentPersistedEntry = Omit<DailyReadiness, 'schemaVersion' | 'sleepQuality'> & {
  schemaVersion: 3 | 4;
  sleepQuality?: number;
};

export type ReadinessPersistedState = {
  schemaVersion: number;
  todayReadiness: DailyReadiness | null;
  history: DailyReadiness[];
  reminderEnabled: boolean;
};

function safeScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function validDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayDateKey();
}

/** Retains historical score/answers without manufacturing sleep duration. */
export function migrateLegacyReadinessEntry(entry: LegacyPersistedEntry): DailyReadiness {
  const legacyInputs: LegacyReadinessInputs = {
    sleepQuality: typeof entry.sleepQuality === 'number' ? entry.sleepQuality : undefined,
    energy: typeof entry.energy === 'number' ? entry.energy : undefined,
    stress: typeof entry.stress === 'number' ? entry.stress : undefined,
    soreness: typeof entry.soreness === 'number' ? entry.soreness : undefined,
    motivation: typeof entry.motivation === 'number' ? entry.motivation : undefined,
    trainingWillingness: typeof entry.trainingWillingness === 'number' ? entry.trainingWillingness : undefined,
  };
  const score = safeScore(entry.score);
  return {
    schemaVersion: 4,
    date: validDate(entry.date),
    score,
    sleepHours: 0,
    sleepMinutes: 0,
    sleepQuality: 0,
    sleepMinutesTotal: 0,
    bodyStatus: 3,
    energy: 3,
    stress: 3,
    details: {
      label: score >= 80 ? 'Ready to Train' : score >= 65 ? 'Mostly Ready' : score >= 45 ? 'Take It Easier Today' : 'Recovery Recommended',
      message: 'This is a retained legacy check-in. Add today’s sleep and check-in details for a current recommendation.',
      reasons: ['Legacy check-ins are retained without guessed sleep duration.'],
      baselineSleepMinutes: 420,
      baselineSource: 'starter_fallback',
      sleepContribution: 0,
      sleepDurationContribution: 0,
      sleepQualityContribution: 0,
      bodyContribution: 60,
      energyContribution: 60,
      stressContribution: 60,
      trainingRecoveryContribution: 80,
      differenceFromBaselineMinutes: -420,
      sleepDataConfidence: 'limited_history',
      recentTrainingAdjustment: 0,
      priorDayAdjustment: 0,
    },
    legacyInputs,
  };
}

function isV3Entry(entry: unknown): entry is CurrentPersistedEntry {
  return !!entry && typeof entry === 'object'
    && ((entry as CurrentPersistedEntry).schemaVersion === 3 || (entry as CurrentPersistedEntry).schemaVersion === 4)
    && typeof (entry as CurrentPersistedEntry).date === 'string';
}

function migrateV2ReadinessEntry(entry: Record<string, unknown>): DailyReadiness {
  const details = (entry.details && typeof entry.details === 'object'
    ? entry.details
    : {}) as Record<string, unknown>;
  const total = typeof entry.sleepMinutesTotal === 'number' && Number.isFinite(entry.sleepMinutesTotal)
    ? Math.max(0, Math.min(1440, Math.round(entry.sleepMinutesTotal)))
    : 0;
  const baseline = typeof details.baselineSleepMinutes === 'number' && Number.isFinite(details.baselineSleepMinutes)
    ? Math.max(0, Math.min(1440, Math.round(details.baselineSleepMinutes)))
    : 420;
  const baselineSource = details.baselineSource === 'personal_28_day'
    ? 'personal_28_day' as const
    : 'starter_fallback' as const;
  return {
    ...(entry as Omit<DailyReadiness, 'schemaVersion' | 'details'>),
    schemaVersion: 4,
    sleepQuality: typeof entry.sleepQuality === 'number' ? entry.sleepQuality : 0,
    stress: typeof entry.stress === 'number' ? 6 - Math.max(1, Math.min(5, Math.round(entry.stress))) : 3,
    details: {
      label: details.label as DailyReadiness['details']['label'],
      message: typeof details.message === 'string' ? details.message : 'Add a new daily check-in for an updated recommendation.',
      reasons: Array.isArray(details.reasons) ? details.reasons.filter((reason): reason is string => typeof reason === 'string') : [],
      baselineSleepMinutes: baseline,
      baselineSource,
      sleepContribution: sleepDurationContribution(total),
      sleepDurationContribution: sleepDurationContribution(total),
      sleepQualityContribution: typeof entry.sleepQuality === 'number' ? Math.max(20, Math.min(100, Math.round(entry.sleepQuality) * 20)) : 0,
      bodyContribution: typeof entry.bodyStatus === 'number' ? Math.max(20, Math.min(100, Math.round(entry.bodyStatus) * 20)) : 60,
      energyContribution: typeof entry.energy === 'number' ? Math.max(20, Math.min(100, Math.round(entry.energy) * 20)) : 60,
      stressContribution: typeof entry.stress === 'number' ? Math.max(20, Math.min(100, (6 - Math.round(entry.stress)) * 20)) : 60,
      trainingRecoveryContribution: typeof details.trainingRecoveryContribution === 'number' ? details.trainingRecoveryContribution : 80,
      differenceFromBaselineMinutes: total - baseline,
      sleepDataConfidence: baselineSource === 'personal_28_day' ? 'personalized' : 'limited_history',
      subjectiveCap: typeof details.subjectiveCap === 'number' ? details.subjectiveCap : undefined,
      overlapPenaltyCap: typeof details.overlapPenaltyCap === 'number' ? details.overlapPenaltyCap : undefined,
      recentTrainingAdjustment: typeof details.recentTrainingAdjustment === 'number' ? details.recentTrainingAdjustment : 0,
      priorDayAdjustment: typeof details.priorDayAdjustment === 'number' ? details.priorDayAdjustment : 0,
      priorDayIntensityAdjustment: typeof details.priorDayIntensityAdjustment === 'number' ? details.priorDayIntensityAdjustment : 0,
    },
  };
}

function migrateV3ReadinessEntry(entry: CurrentPersistedEntry): DailyReadiness {
  const legacyStress = typeof entry.stress === 'number' ? entry.stress : 3;
  const nextStress = entry.schemaVersion === 3
    ? 6 - Math.max(1, Math.min(5, Math.round(legacyStress)))
    : Math.max(1, Math.min(5, Math.round(legacyStress)));
  return {
    ...entry,
    schemaVersion: 4,
    sleepQuality: typeof entry.sleepQuality === 'number' ? entry.sleepQuality : 0,
    stress: nextStress,
    details: {
      ...entry.details,
      sleepDurationContribution: entry.details.sleepDurationContribution ?? entry.details.sleepContribution,
      sleepQualityContribution: entry.details.sleepQualityContribution ?? 0,
      bodyContribution: entry.details.bodyContribution ?? (typeof entry.bodyStatus === 'number' ? Math.max(20, Math.min(100, Math.round(entry.bodyStatus) * 20)) : 60),
      energyContribution: entry.details.energyContribution ?? (typeof entry.energy === 'number' ? Math.max(20, Math.min(100, Math.round(entry.energy) * 20)) : 60),
      stressContribution: entry.details.stressContribution ?? Math.max(20, Math.min(100, nextStress * 20)),
      trainingRecoveryContribution: entry.details.trainingRecoveryContribution ?? 80,
      priorDayIntensityAdjustment: entry.details.priorDayIntensityAdjustment ?? 0,
    },
  };
}

/** Idempotent persisted-state migration, deliberately free of React Native storage. */
export function migrateReadinessState(persisted: unknown): ReadinessPersistedState {
  const state = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  const entries = Array.isArray(state.history) ? state.history : [];
  const migratedHistory = entries.map(entry => isV3Entry(entry)
    ? migrateV3ReadinessEntry(entry)
    : (entry as Record<string, unknown>)?.schemaVersion === 2
      ? migrateV2ReadinessEntry(entry as Record<string, unknown>)
      : migrateLegacyReadinessEntry(entry as LegacyPersistedEntry));
  const migratedToday = state.todayReadiness
    ? (isV3Entry(state.todayReadiness)
      ? migrateV3ReadinessEntry(state.todayReadiness)
      : (state.todayReadiness as Record<string, unknown>)?.schemaVersion === 2
        ? migrateV2ReadinessEntry(state.todayReadiness as Record<string, unknown>)
        : migrateLegacyReadinessEntry(state.todayReadiness as LegacyPersistedEntry))
    : null;
  const merged = [...migratedHistory, ...(migratedToday && !migratedHistory.some(entry => entry.date === migratedToday.date) ? [migratedToday] : [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_LIMIT);
  return {
    schemaVersion: READINESS_STORE_SCHEMA_VERSION,
    todayReadiness: migratedToday,
    history: merged,
    reminderEnabled: state.reminderEnabled === true,
  };
}
