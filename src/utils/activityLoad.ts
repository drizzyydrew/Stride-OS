import type {
  Activity,
  ActivityFilter,
  ActivityLoadDimensions,
  ActivityMetrics,
  ActivityType,
} from '../types/activity';

const NON_IMPACT_AEROBIC = new Set<ActivityType>([
  'cycling',
  'indoor_cycling',
  'swimming',
  'elliptical',
  'rowing',
]);

const IMPACT_BEARING = new Set<ActivityType>([
  'running',
  'walking',
  'hiking',
  'downhill_skiing',
  'cross_country_skiing',
  'stair_climbing',
  'hiit',
  'mixed_modal',
  'strength',
]);

const CROSS_TRAINING = new Set<ActivityType>([
  'cycling',
  'indoor_cycling',
  'swimming',
  'hiking',
  'downhill_skiing',
  'cross_country_skiing',
  'elliptical',
  'rowing',
  'stair_climbing',
  'hiit',
  'mixed_modal',
  'other',
]);

const ESTIMATED_INTENSITY_FACTOR: Record<ActivityType, number> = {
  running: 0.75,
  walking: 0.42,
  cycling: 0.62,
  indoor_cycling: 0.62,
  swimming: 0.68,
  hiking: 0.58,
  downhill_skiing: 0.58,
  cross_country_skiing: 0.72,
  elliptical: 0.58,
  rowing: 0.66,
  stair_climbing: 0.72,
  hiit: 0.9,
  mixed_modal: 0.86,
  strength: 0.65,
  mobility: 0.2,
  other: 0.45,
};

export type ActivityLoadInput = {
  activityType: ActivityType;
  durationMinutes: number;
  rpe?: number;
  heartRateZoneMinutes?: Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
};

function rounded(value: number): number {
  return Math.max(0, Math.round(value));
}

export function calculateActivityLoad(input: ActivityLoadInput): ActivityLoadDimensions {
  const duration = Math.max(0, input.durationMinutes);
  const rpe = input.rpe == null ? undefined : Math.min(10, Math.max(1, input.rpe));
  const zones = input.heartRateZoneMinutes;
  let method: ActivityLoadDimensions['method'];
  let confidence: ActivityLoadDimensions['confidence'];
  let wholeBody: number;

  if (rpe != null && duration > 0) {
    method = 'session_rpe';
    confidence = 'high';
    wholeBody = duration * rpe;
  } else if (zones && Object.values(zones).some(minutes => (minutes ?? 0) > 0)) {
    method = 'heart_rate_zones';
    confidence = 'moderate';
    wholeBody = ([1, 2, 3, 4, 5] as const).reduce(
      (sum, zone) => sum + (zones[zone] ?? 0) * zone,
      0,
    );
  } else {
    method = 'estimated';
    confidence = 'low';
    wholeBody = duration * ESTIMATED_INTENSITY_FACTOR[input.activityType];
  }

  const total = rounded(wholeBody);
  return {
    method,
    wholeBody: total,
    running: input.activityType === 'running' ? total : 0,
    walking: input.activityType === 'walking' ? total : 0,
    strength: input.activityType === 'strength' ? total : 0,
    crossTraining: CROSS_TRAINING.has(input.activityType) ? total : 0,
    impactBearing: IMPACT_BEARING.has(input.activityType) ? total : 0,
    nonImpactAerobic: NON_IMPACT_AEROBIC.has(input.activityType) ? total : 0,
    confidence,
  };
}

const DISTANCE_TYPES = new Set<ActivityType>([
  'running', 'walking', 'cycling', 'indoor_cycling', 'swimming', 'hiking',
  'downhill_skiing', 'cross_country_skiing', 'elliptical', 'rowing',
]);
const ELEVATION_TYPES = new Set<ActivityType>([
  'running', 'walking', 'cycling', 'hiking', 'downhill_skiing', 'cross_country_skiing',
]);
const PACE_TYPES = new Set<ActivityType>(['running', 'walking', 'hiking']);
const SPEED_TYPES = new Set<ActivityType>([
  'cycling', 'indoor_cycling', 'downhill_skiing', 'cross_country_skiing',
]);
const CADENCE_TYPES = new Set<ActivityType>([
  'running', 'walking', 'cycling', 'indoor_cycling', 'rowing',
]);
const ROUTE_TYPES = new Set<ActivityType>([
  'running', 'walking', 'cycling', 'hiking', 'downhill_skiing', 'cross_country_skiing',
]);

export function sanitizeActivityMetrics(
  activityType: ActivityType,
  metrics: ActivityMetrics,
): ActivityMetrics {
  const clean: ActivityMetrics = {
    durationSeconds: metrics.durationSeconds,
    elapsedTimeSeconds: metrics.elapsedTimeSeconds,
    activeTimeSeconds: metrics.activeTimeSeconds,
    averageHeartRateBpm: metrics.averageHeartRateBpm,
    maximumHeartRateBpm: metrics.maximumHeartRateBpm,
    heartRateZoneSeconds: metrics.heartRateZoneSeconds,
    estimatedCalories: metrics.estimatedCalories,
  };

  if (DISTANCE_TYPES.has(activityType)) clean.distanceMeters = metrics.distanceMeters;
  if (ELEVATION_TYPES.has(activityType)) {
    clean.elevationGainMeters = metrics.elevationGainMeters;
    clean.elevationLossMeters = metrics.elevationLossMeters;
  }
  if (PACE_TYPES.has(activityType)) clean.pace = metrics.pace;
  if (SPEED_TYPES.has(activityType)) clean.speed = metrics.speed;
  if (CADENCE_TYPES.has(activityType)) clean.cadenceRpm = metrics.cadenceRpm;
  if (activityType === 'cycling' || activityType === 'indoor_cycling') {
    clean.cyclingPowerWatts = metrics.cyclingPowerWatts;
  }
  if (activityType === 'running' || activityType === 'walking') {
    clean.runWalkIntervals = metrics.runWalkIntervals;
  }
  if (ROUTE_TYPES.has(activityType)) {
    clean.routeId = metrics.routeId;
    clean.routeCoordinates = metrics.routeCoordinates;
  }
  if (activityType === 'swimming') clean.swimming = metrics.swimming;
  if (activityType === 'downhill_skiing' || activityType === 'cross_country_skiing') {
    clean.skiing = metrics.skiing;
  }
  if (activityType === 'hiit' || activityType === 'mixed_modal') {
    clean.mixedModal = metrics.mixedModal;
  }
  if (activityType === 'strength') clean.strength = metrics.strength;

  return Object.fromEntries(
    Object.entries(clean).filter(([, value]) => value !== undefined),
  ) as ActivityMetrics;
}

export function activityMatchesFilter(activity: Activity, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'cycling') {
    return activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling';
  }
  if (filter === 'skiing') {
    return activity.activityType === 'downhill_skiing'
      || activity.activityType === 'cross_country_skiing';
  }
  if (filter === 'hiit_mixed') {
    return activity.activityType === 'hiit' || activity.activityType === 'mixed_modal';
  }
  if (filter === 'other') {
    return [
      'elliptical',
      'rowing',
      'stair_climbing',
      'other',
    ].includes(activity.activityType);
  }
  return activity.activityType === filter;
}

export type ActivityLoadSummary = Omit<ActivityLoadDimensions, 'method' | 'confidence'> & {
  durationMinutes: number;
};

export function summarizeActivityLoad(activities: Activity[]): ActivityLoadSummary {
  return activities
    .filter(activity => activity.status !== 'skipped')
    .reduce<ActivityLoadSummary>((summary, activity) => ({
      wholeBody: summary.wholeBody + activity.trainingLoad.wholeBody,
      running: summary.running + activity.trainingLoad.running,
      walking: summary.walking + activity.trainingLoad.walking,
      strength: summary.strength + activity.trainingLoad.strength,
      crossTraining: summary.crossTraining + activity.trainingLoad.crossTraining,
      impactBearing: summary.impactBearing + activity.trainingLoad.impactBearing,
      nonImpactAerobic: summary.nonImpactAerobic + activity.trainingLoad.nonImpactAerobic,
      durationMinutes: summary.durationMinutes + (activity.metrics.durationSeconds ?? 0) / 60,
    }), {
      wholeBody: 0,
      running: 0,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: 0,
      nonImpactAerobic: 0,
      durationMinutes: 0,
    });
}

type LoadDimension = 'wholeBody' | 'running' | 'walking' | 'strength' | 'crossTraining';

export type ActivityLoadTrend = {
  acute: number;
  chronic: number;
  ratio: number;
  dimension: LoadDimension;
  interpretation: 'workload_trend_only';
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The ratio is intentionally exposed as a workload trend. It is not an injury
// predictor and must be interpreted with readiness, symptoms, and adherence.
export function calculateActivityLoadTrend(
  activities: Activity[],
  dimension: LoadDimension,
  now = Date.now(),
): ActivityLoadTrend {
  const completed = activities.filter(activity =>
    activity.status !== 'skipped' && activity.startTime <= now);
  const acuteLoad = completed
    .filter(activity => now - activity.startTime <= 7 * DAY_MS)
    .reduce((sum, activity) => sum + activity.trainingLoad[dimension], 0);
  const chronicLoad = completed
    .filter(activity => now - activity.startTime <= 42 * DAY_MS)
    .reduce((sum, activity) => sum + activity.trainingLoad[dimension], 0);
  const acute = acuteLoad / 7;
  const chronic = chronicLoad / 42;
  const ratio = chronic === 0 ? 1 : acute / chronic;

  return {
    acute: Math.round(acute * 10) / 10,
    chronic: Math.round(chronic * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    dimension,
    interpretation: 'workload_trend_only',
  };
}

export type ActivityDistributionSummary = {
  countByType: Partial<Record<ActivityType, number>>;
  durationMinutesByType: Partial<Record<ActivityType, number>>;
  totalDurationMinutes: number;
};

export function summarizeActivityDistribution(
  activities: Activity[],
): ActivityDistributionSummary {
  const summary: ActivityDistributionSummary = {
    countByType: {},
    durationMinutesByType: {},
    totalDurationMinutes: 0,
  };
  for (const activity of activities) {
    if (activity.status === 'skipped') continue;
    const durationMinutes = (activity.metrics.durationSeconds ?? 0) / 60;
    summary.countByType[activity.activityType] =
      (summary.countByType[activity.activityType] ?? 0) + 1;
    summary.durationMinutesByType[activity.activityType] =
      (summary.durationMinutesByType[activity.activityType] ?? 0) + durationMinutes;
    summary.totalDurationMinutes += durationMinutes;
  }
  return summary;
}
