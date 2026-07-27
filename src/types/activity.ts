export const ACTIVITY_TYPES = [
  'running',
  'walking',
  'cycling',
  'indoor_cycling',
  'swimming',
  'hiking',
  'downhill_skiing',
  'cross_country_skiing',
  'snowboarding',
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

// Richer, athlete-facing classification of how a completion relates to what
// was scheduled. `ActivityStatus` remains the coarse back-compat field every
// existing screen already reads; `completionClassification` is optional and
// additive. See activityStatusForClassification() in activityCompletion.ts
// for the back-compat mapping.
export type CompletionClassification =
  | 'completed_as_prescribed'
  | 'modified'
  | 'equivalent_substitute'
  | 'partial'
  | 'completed_other_activity'
  | 'stopped_early'
  | 'skipped';

// How a completed activity's distance was determined. Never inferred from HR
// or power; never a fabricated GPS route for indoor sessions.
export type DistanceSource =
  | 'gps'
  | 'treadmill_reported'
  | 'foot_pod'
  | 'prescribed_estimate'
  | 'confirmed_speed_estimate'
  | 'equipment_display'
  | 'manual_entry'
  | 'health_import'
  | 'trainer_reported'
  | 'wheel_sensor'
  | 'virtual'
  | 'unavailable';

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

export type HeartRateSample = {
  timestamp: number;
  bpm: number;
  source: 'healthkit';
};

// A completion-time summary, not a promise of continuous sensor coverage.
// `averageReliable: false` intentionally means averageHeartRateBpm is absent.
export type HeartRateSummary = {
  source: 'healthkit';
  sampleCount: number;
  coverageSeconds: number;
  sessionSeconds: number;
  coverageRatio: number;
  largestGapSeconds: number;
  averageReliable: boolean;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  zoneSeconds?: HeartRateZoneSeconds;
};

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
  heartRateSummary?: HeartRateSummary;
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
  // Indoor cycling only: whatever the trainer/bike's resistance control showed
  // (a level number or a free-text setting) — never used to derive distance.
  resistanceLevel?: string;
  runWalkIntervals?: RunWalkInterval[];
  routeId?: string;
  routeCoordinates?: ActivityCoordinate[];
  distanceSource?: DistanceSource;
  // Preserved when the athlete later corrects the final distance (e.g. from
  // a treadmill's displayed reading) so the original estimate isn't lost.
  originalEstimatedDistanceMiles?: number;

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
    volumeKg?: number; // legacy combined figure — superseded by the honest split below
    // Honest split summary (src/utils/strengthSummary.ts) — deliberately no
    // single combined "volume" number. Band and bodyweight work are never
    // converted into externalLoadVolumeLb.
    externalLoadVolumeLb?: number;
    bandSetsCount?: number;
    bodyweightSetsCount?: number;
    totalHoldSeconds?: number;
    averageRpe?: number;
    warmupSetsCount?: number;
    // Exact per-exercise/set execution when the active strength session
    // supplied it. Legacy records simply leave this absent.
    exercises?: import('./strength').CompletedExercise[];
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
  shoeId?: string;
  gearIds?: string[];
  completionClassification?: CompletionClassification;
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
