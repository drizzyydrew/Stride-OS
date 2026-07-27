import type { Activity } from '../types/activity';
import type { Shoe } from '../store/gearStore';
import { evaluateAchievements, HEALTHY_ACHIEVEMENTS, type AchievementId } from './achievements';
import { mostUsedShoe } from './gear';

export type StrideReportPeriod = 'weekly' | 'monthly' | 'yearly';
export type StrideReportShareVariant = 'clean_summary' | 'data_focus' | 'achievement_focus';

export type StrideReportRange = {
  startTime: number;
  endTime: number;
  label: string;
};

export type StrideReportHighlight = {
  label: string;
  value: string;
  detail?: string;
};

export type StrideReportActivityReference = {
  id: string;
  title: string;
  dateLabel: string;
  distanceMiles?: number;
  elevationGainMeters?: number;
};

export type StrideReport = {
  period: StrideReportPeriod;
  range: StrideReportRange;
  totals: {
    distanceMiles: number;
    trainingMinutes: number;
    activeDays: number;
    runs: number;
    strengthSessions: number;
    crossTrainingSessions: number;
    mobilitySessions: number;
    averageRunMiles: number | null;
    elevationGainMeters: number;
    averageElevationGainMeters: number | null;
  };
  longestRun: StrideReportActivityReference | null;
  highestElevationActivity: StrideReportActivityReference | null;
  mostUsedShoe: { label: string; miles: number } | null;
  mostUsedRoute: { routeId: string; activityCount: number; miles: number } | null;
  healthyAchievements: StrideReportHighlight[];
  highlights: StrideReportHighlight[];
  upcomingFocus?: string;
  privacyDefaults: {
    includeRouteMaps: false;
    includeExactLocations: false;
    includeSymptoms: false;
    includeReadinessDetails: false;
    includePrivateNotes: false;
    includeHealthInformation: false;
  };
};

export type BuildStrideReportInput = {
  period: StrideReportPeriod;
  activities: readonly Activity[];
  shoes?: readonly Shoe[];
  now?: Date | number;
  upcomingFocus?: string;
  awardedAchievementIds?: readonly AchievementId[];
};

export type StrideReportSharePayload = {
  variant: StrideReportShareVariant;
  period: StrideReportPeriod;
  rangeLabel: string;
  headline: string;
  highlights: StrideReportHighlight[];
  totals: StrideReport['totals'];
  longestRun: StrideReportActivityReference | null;
  highestElevationActivity: StrideReportActivityReference | null;
  privacyDefaults: StrideReport['privacyDefaults'];
};

type StrideReportBase = Omit<StrideReport, 'highlights' | 'privacyDefaults'>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const METERS_PER_MILE = 1609.344;

const PERIOD_DAYS: Record<StrideReportPeriod, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export const STRIDE_REPORT_PRIVACY_DEFAULTS: StrideReport['privacyDefaults'] = {
  includeRouteMaps: false,
  includeExactLocations: false,
  includeSymptoms: false,
  includeReadinessDetails: false,
  includePrivateNotes: false,
  includeHealthInformation: false,
};

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function milesFromMeters(value: unknown): number {
  const meters = safeNumber(value);
  return meters && meters > 0 ? meters / METERS_PER_MILE : 0;
}

function minutesFromSeconds(value: unknown): number {
  const seconds = safeNumber(value);
  return seconds && seconds > 0 ? seconds / 60 : 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function titleForActivity(activity: Activity): string {
  const type = activity.activityType
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  if (activity.subtype === 'treadmill') return `Treadmill ${type}`;
  if (activity.subtype === 'run_walk') return 'Run/Walk';
  return type;
}

function periodRange(period: StrideReportPeriod, nowInput: Date | number | undefined): StrideReportRange {
  const endDate = nowInput instanceof Date
    ? new Date(nowInput)
    : new Date(typeof nowInput === 'number' ? nowInput : Date.now());
  const endTime = endDate.getTime();
  const startTime = endTime - ((PERIOD_DAYS[period] * MS_PER_DAY) - 1);
  const label = period === 'weekly'
    ? 'Last 7 days'
    : period === 'monthly'
      ? 'Last 30 days'
      : 'Last 365 days';
  return { startTime, endTime, label };
}

function isCompletedTraining(activity: Activity): boolean {
  return activity.status !== 'skipped';
}

function isRun(activity: Activity): boolean {
  return activity.activityType === 'running';
}

function isQualifyingRun(activity: Activity): boolean {
  if (!isRun(activity) || !isCompletedTraining(activity)) return false;
  return milesFromMeters(activity.metrics.distanceMeters) > 0
    || minutesFromSeconds(activity.metrics.durationSeconds) >= 1;
}

function isCrossTraining(activity: Activity): boolean {
  return [
    'cycling',
    'indoor_cycling',
    'swimming',
    'elliptical',
    'rowing',
    'stair_climbing',
    'hiking',
    'cross_country_skiing',
  ].includes(activity.activityType);
}

function hasValidElevation(activity: Activity): boolean {
  const gain = safeNumber(activity.metrics.elevationGainMeters);
  if (gain === null || gain < 0) return false;
  if (activity.subtype === 'treadmill' || activity.indoor) return false;
  if (activity.metrics.distanceSource === 'treadmill_reported') return false;
  return true;
}

function referenceFor(activity: Activity): StrideReportActivityReference {
  const elevationGainMeters = hasValidElevation(activity)
    ? safeNumber(activity.metrics.elevationGainMeters) ?? undefined
    : undefined;
  return {
    id: activity.id,
    title: titleForActivity(activity),
    dateLabel: dateLabel(activity.startTime),
    distanceMiles: round(milesFromMeters(activity.metrics.distanceMeters), 1),
    elevationGainMeters,
  };
}

function mostUsedRouteFor(activities: readonly Activity[]): StrideReport['mostUsedRoute'] {
  const routes = new Map<string, { routeId: string; activityCount: number; miles: number }>();
  for (const activity of activities) {
    if (!isCompletedTraining(activity)) continue;
    const routeId = typeof activity.metrics.routeId === 'string' ? activity.metrics.routeId.trim() : '';
    if (!routeId) continue;
    const current = routes.get(routeId) ?? { routeId, activityCount: 0, miles: 0 };
    current.activityCount += 1;
    current.miles += milesFromMeters(activity.metrics.distanceMeters);
    routes.set(routeId, current);
  }
  const top = [...routes.values()].sort((a, b) => {
    if (b.activityCount !== a.activityCount) return b.activityCount - a.activityCount;
    return b.miles - a.miles;
  })[0];
  return top ? { ...top, miles: round(top.miles, 1) } : null;
}

function buildHighlights(report: StrideReportBase): StrideReportHighlight[] {
  const highlights: StrideReportHighlight[] = [
    {
      label: 'Training time',
      value: `${Math.round(report.totals.trainingMinutes)} min`,
      detail: `${report.totals.activeDays} active day${report.totals.activeDays === 1 ? '' : 's'}`,
    },
    {
      label: 'Distance',
      value: `${report.totals.distanceMiles.toFixed(1)} mi`,
      detail: report.totals.runs > 0
        ? `${report.totals.runs} run${report.totals.runs === 1 ? '' : 's'}`
        : 'No qualifying runs',
    },
  ];

  if (report.longestRun) {
    highlights.push({
      label: 'Longest run',
      value: `${(report.longestRun.distanceMiles ?? 0).toFixed(1)} mi`,
      detail: `${report.longestRun.title} · ${report.longestRun.dateLabel}`,
    });
  }

  if (report.mostUsedShoe) {
    highlights.push({
      label: 'Most-used shoe',
      value: report.mostUsedShoe.label,
      detail: `${report.mostUsedShoe.miles.toFixed(1)} mi this period`,
    });
  }

  if (report.mostUsedRoute) {
    highlights.push({
      label: 'Most-used route',
      value: `${report.mostUsedRoute.activityCount} outings`,
      detail: `${report.mostUsedRoute.miles.toFixed(1)} mi total`,
    });
  }

  if (report.highestElevationActivity) {
    highlights.push({
      label: 'Most climbing',
      value: `${Math.round(report.highestElevationActivity.elevationGainMeters ?? 0)} m`,
      detail: `${report.highestElevationActivity.title} · ${report.highestElevationActivity.dateLabel}`,
    });
  }

  if (report.totals.strengthSessions > 0) {
    highlights.push({
      label: 'Strength',
      value: `${report.totals.strengthSessions}`,
      detail: 'Strength session count',
    });
  }

  if (report.healthyAchievements.length > 0) {
    highlights.push(report.healthyAchievements[0]);
  }

  return highlights;
}

export function buildStrideReport(input: BuildStrideReportInput): StrideReport {
  const range = periodRange(input.period, input.now);
  const periodActivities = input.activities
    .filter(activity => activity.startTime >= range.startTime && activity.startTime <= range.endTime)
    .filter(isCompletedTraining);
  const qualifyingRuns = periodActivities.filter(isQualifyingRun);
  const activeDays = new Set(periodActivities.map(activity => new Date(activity.startTime).toISOString().slice(0, 10)));
  const validElevationActivities = periodActivities.filter(hasValidElevation);

  const totalDistanceMiles = periodActivities.reduce(
    (sum, activity) => sum + milesFromMeters(activity.metrics.distanceMeters),
    0,
  );
  const totalTrainingMinutes = periodActivities.reduce(
    (sum, activity) => sum + minutesFromSeconds(activity.metrics.durationSeconds ?? activity.metrics.activeTimeSeconds),
    0,
  );
  const elevationGainMeters = validElevationActivities.reduce(
    (sum, activity) => sum + (safeNumber(activity.metrics.elevationGainMeters) ?? 0),
    0,
  );
  const longestRun = qualifyingRuns
    .filter(activity => milesFromMeters(activity.metrics.distanceMeters) > 0)
    .sort((a, b) => milesFromMeters(b.metrics.distanceMeters) - milesFromMeters(a.metrics.distanceMeters))[0];
  const highestElevationActivity = validElevationActivities
    .filter(activity => (safeNumber(activity.metrics.elevationGainMeters) ?? 0) > 0)
    .sort((a, b) => (safeNumber(b.metrics.elevationGainMeters) ?? 0) - (safeNumber(a.metrics.elevationGainMeters) ?? 0))[0];
  const topShoe = input.shoes ? mostUsedShoe(periodActivities, input.shoes) : null;
  const achievementIds = evaluateAchievements(periodActivities, input.awardedAchievementIds ?? []);
  const healthyAchievements: StrideReportHighlight[] = [];
  for (const id of achievementIds) {
    const definition = HEALTHY_ACHIEVEMENTS.find(item => item.id === id);
    if (!definition) continue;
    healthyAchievements.push({
      label: 'Healthy progress',
      value: definition.title,
      detail: definition.description,
    });
  }

  const reportBase: StrideReportBase = {
    period: input.period,
    range,
    totals: {
      distanceMiles: round(totalDistanceMiles, 1),
      trainingMinutes: round(totalTrainingMinutes, 0),
      activeDays: activeDays.size,
      runs: qualifyingRuns.length,
      strengthSessions: periodActivities.filter(activity => activity.activityType === 'strength').length,
      crossTrainingSessions: periodActivities.filter(isCrossTraining).length,
      mobilitySessions: periodActivities.filter(activity => activity.activityType === 'mobility').length,
      averageRunMiles: qualifyingRuns.length > 0
        ? round(qualifyingRuns.reduce((sum, activity) => sum + milesFromMeters(activity.metrics.distanceMeters), 0) / qualifyingRuns.length, 1)
        : null,
      elevationGainMeters: round(elevationGainMeters, 0),
      averageElevationGainMeters: validElevationActivities.length > 0
        ? round(elevationGainMeters / validElevationActivities.length, 0)
        : null,
    },
    longestRun: longestRun ? referenceFor(longestRun) : null,
    highestElevationActivity: highestElevationActivity ? referenceFor(highestElevationActivity) : null,
    mostUsedShoe: topShoe ? {
      label: `${topShoe.shoe.brand} ${topShoe.shoe.model}`.trim(),
      miles: topShoe.miles,
    } : null,
    mostUsedRoute: mostUsedRouteFor(periodActivities),
    healthyAchievements,
    upcomingFocus: input.period === 'weekly' ? input.upcomingFocus : undefined,
  };

  return {
    ...reportBase,
    highlights: buildHighlights(reportBase),
    privacyDefaults: STRIDE_REPORT_PRIVACY_DEFAULTS,
  };
}

export function buildStrideReportSharePayload(
  report: StrideReport,
  variant: StrideReportShareVariant,
): StrideReportSharePayload {
  const headline = variant === 'achievement_focus' && report.healthyAchievements[0]
    ? report.healthyAchievements[0].value
    : variant === 'data_focus'
      ? `${report.totals.distanceMiles.toFixed(1)} miles · ${Math.round(report.totals.trainingMinutes)} minutes`
      : `${report.range.label} with StrideOS`;

  return {
    variant,
    period: report.period,
    rangeLabel: report.range.label,
    headline,
    highlights: report.highlights.slice(0, variant === 'data_focus' ? 6 : 4),
    totals: report.totals,
    longestRun: report.longestRun,
    highestElevationActivity: report.highestElevationActivity,
    privacyDefaults: report.privacyDefaults,
  };
}
