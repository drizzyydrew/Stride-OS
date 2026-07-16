export const ACTIVITY_TYPES = [
  'running',
  'walking',
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
  'strength',
  'mobility',
  'other',
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];

export type ActivitySubtype =
  | 'outdoor'
  | 'indoor'
  | 'treadmill'
  | 'run_walk'
  | 'pool'
  | 'open_water'
  | 'road'
  | 'mountain'
  | 'stationary'
  | 'crossfit'
  | 'recovery'
  | 'general'
  | string;

export type ActivitySource =
  | 'tracked'
  | 'manual'
  | 'training_plan'
  | 'healthkit'
  | 'strava'
  | 'legacy_import';

export type ActivityStatus = 'completed' | 'skipped' | 'partial';

export type ActivityFilter =
  | 'all'
  | 'running'
  | 'walking'
  | 'cycling'
  | 'swimming'
  | 'hiking'
  | 'skiing'
  | 'strength'
  | 'mobility'
  | 'hiit_mixed'
  | 'other';

export type ActivityCoordinate = {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitudeMeters?: number;
  horizontalAccuracyMeters?: number;
};

export type HeartRateZoneSeconds = Partial<Record<1 | 2 | 3 | 4 | 5, number>>;

export type RunWalkInterval = {
  kind: 'run' | 'walk';
  durationSeconds: number;
  completedSeconds?: number;
};

export type ActivityMetrics = {
  durationSeconds?: number;
  elapsedTimeSeconds?: number;
  activeTimeSeconds?: number;
  distanceMeters?: number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  heartRateZoneSeconds?: HeartRateZoneSeconds;
  estimatedCalories?: number;

  pace?: {
    currentSecondsPerKilometer?: number;
    averageSecondsPerKilometer?: number;
    splitsSecondsPerKilometer?: number[];
  };
  speed?: {
    currentMetersPerSecond?: number;
    averageMetersPerSecond?: number;
    maximumMetersPerSecond?: number;
  };
  cadenceRpm?: number;
  cyclingPowerWatts?: number;
  runWalkIntervals?: RunWalkInterval[];
  routeId?: string;
  routeCoordinates?: ActivityCoordinate[];

  swimming?: {
    environment: 'pool' | 'open_water';
    distanceUnit: 'yd' | 'm';
    laps?: number;
    strokeType?: string;
    paceSecondsPer100?: number;
  };
  skiing?: {
    descentMeters?: number;
  };
  mixedModal?: {
    rounds?: number;
    workIntervals?: number;
    strengthComponent?: string;
  };
  strength?: {
    exerciseCount?: number;
    sets?: number;
    reps?: number;
    volumeKg?: number;
  };
};

export type ActivityLoadDimensions = {
  method: 'session_rpe' | 'heart_rate_zones' | 'estimated';
  wholeBody: number;
  running: number;
  walking: number;
  strength: number;
  crossTraining: number;
  impactBearing: number;
  nonImpactAerobic: number;
  confidence: 'high' | 'moderate' | 'low';
};

export type ActivityLiveState = {
  activityId?: string;
  state: 'inactive' | 'active' | 'paused' | 'ending';
  updatedAt: number;
};

export type Activity = {
  id: string;
  activityType: ActivityType;
  subtype?: ActivitySubtype;
  source: ActivitySource;
  status: ActivityStatus;
  scheduled: boolean;
  associatedTrainingBlockId?: string;
  associatedGoalId?: string;
  scheduledSessionId?: string;
  startTime: number;
  endTime?: number;
  rpe?: number;
  notes?: string;
  symptoms?: string[];
  indoor: boolean;
  metrics: ActivityMetrics;
  trainingLoad: ActivityLoadDimensions;
  liveActivity?: ActivityLiveState;
  legacyWorkoutId?: string;
  createdAt: number;
  updatedAt: number;
};

export type ActivityDraft = Omit<
  Activity,
  'id' | 'createdAt' | 'updatedAt' | 'trainingLoad'
> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  trainingLoad?: ActivityLoadDimensions;
};

