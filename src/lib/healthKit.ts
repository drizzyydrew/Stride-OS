// ─── Apple HealthKit Integration ─────────────────────────────────────────────
//
// Requires: @kingstinct/react-native-healthkit (native module — needs EAS/TestFlight).
// Guarded with try/catch so the app runs on Expo Go without crashing.
//
// Actual testing requires a signed iOS build.

import { Platform } from 'react-native';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { Activity, ActivityCoordinate, ActivityMetrics, ActivityType, CadenceSample, HeartRateSample, PowerSample } from '../types/activity';
import { decodeHealthDistanceEvidence, HealthDistanceReadError } from '../utils/healthDistanceImport';
import { downsampleCoordinates, healthKitQuantity, healthKitRecordingIdentity, healthKitRecordingMetadata, type HealthKitWorkoutCandidate } from '../utils/healthKitImport';

type HealthKitModule = {
  default?: HealthKitModule;
  isHealthDataAvailable?: () => boolean;
  isHealthDataAvailableAsync?: () => Promise<boolean>;
  isObjectTypeAvailable?: (identifier: string) => boolean;
  requestAuthorization?: (request: {
    toRead?: readonly string[];
    toShare?: readonly string[];
  }) => Promise<boolean>;
  authorizationStatusFor?: (identifier: string) => number;
  queryQuantitySamples?: (
    identifier: string,
    options: {
      ascending?: boolean;
      limit?: number;
      unit?: string;
      filter?: {
        workout?: HealthWorkoutProxy;
        date?: {
          startDate: Date;
          endDate: Date;
        };
      };
    },
  ) => Promise<readonly {
    uuid?: string;
    quantity?: number;
    value?: number;
    startDate?: Date | string;
    endDate?: Date | string;
    sourceRevision?: { source?: { bundleIdentifier?: string } };
    metadata?: Record<string, unknown>;
  }[]>;
  saveWorkoutSample?: (
    workoutActivityType: number,
    quantities: readonly unknown[],
    startDate: Date,
    endDate: Date,
    totals?: { distance?: number; energyBurned?: number },
    metadata?: Record<string, unknown>,
  ) => Promise<unknown>;
  queryWorkoutSamples?: (options: {
    filter?: {
      uuid?: string;
      date?: {
        startDate: Date;
        endDate: Date;
      };
    };
    limit: number;
    ascending?: boolean;
  }) => Promise<readonly HealthWorkoutProxy[]>;
  WorkoutActivityType?: {
    cycling?: number;
    walking?: number;
    running?: number;
    hiking?: number;
    swimming?: number;
    highIntensityIntervalTraining?: number;
    mindAndBody?: number;
    functionalStrengthTraining?: number;
    traditionalStrengthTraining?: number;
    flexibility?: number;
    elliptical?: number;
    rowing?: number;
    stairClimbing?: number;
    downhillSkiing?: number;
    crossCountrySkiing?: number;
    snowboarding?: number;
    mixedCardio?: number;
    other?: number;
  };
  WorkoutEventType?: { pause: number; resume: number; motionPaused: number; motionResumed: number };
};

type HealthQuantity = { quantity?: number; value?: number; unit?: string } | number;
type HealthWorkoutProxy = {
  uuid?: string;
  id?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  duration?: { quantity?: number; value?: number; unit?: string } | number;
  workoutActivityType?: number;
  totalDistance?: { quantity?: number; value?: number; unit?: string };
  totalEnergyBurned?: { quantity?: number; value?: number; unit?: string };
  sourceRevision?: {
    source?: { bundleIdentifier?: string; name?: string; toJSON?: () => { bundleIdentifier?: string; name?: string } };
    productType?: string;
    version?: string;
  };
  device?: { name?: string; manufacturer?: string; model?: string };
  metadata?: Record<string, unknown>;
  events?: readonly { type: number; startDate: Date | string; endDate: Date | string }[];
  toJSON?: () => HealthWorkoutProxy;
  getWorkoutRoutes?: () => Promise<readonly unknown[]>;
  getStatistic?: (identifier: string, unit?: string) => Promise<{ averageQuantity?: HealthQuantity; maximumQuantity?: HealthQuantity; sumQuantity?: HealthQuantity } | undefined>;
};

let Health: HealthKitModule | null = null;
const SHARING_AUTHORIZED = 2;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';

const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierDistanceDownhillSnowSports',
  'HKQuantityTypeIdentifierCyclingCadence',
  'HKQuantityTypeIdentifierRunningPower',
  'HKQuantityTypeIdentifierRunningGroundContactTime',
  'HKQuantityTypeIdentifierRunningStrideLength',
  'HKQuantityTypeIdentifierRunningVerticalOscillation',
  'HKQuantityTypeIdentifierRunningSpeed',
  'HKQuantityTypeIdentifierCyclingPower',
  'HKWorkoutRouteTypeIdentifier',
  WORKOUT_TYPE,
] as const;

const SHARE_TYPES = [
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  // Routes: lets StrideOS save GPS routes with workouts. HealthKit shares this
  // grant with the Apple Watch app, which records routes when the phone can't.
  'HKWorkoutRouteTypeIdentifier',
  WORKOUT_TYPE,
] as const;

try {
  // Dynamic require so the app doesn't crash on Expo Go / Android
  const healthModule = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  Health = {
    ...(healthModule.default ?? healthModule),
    // v14's default export contains methods, but its sport enum is named-only.
    WorkoutActivityType: healthModule.WorkoutActivityType ?? healthModule.default?.WorkoutActivityType,
    WorkoutEventType: healthModule.WorkoutEventType ?? healthModule.default?.WorkoutEventType,
  };
} catch {
  // Native HealthKit module is not available in this build
}

export async function isAppleHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !Health) return false;

  try {
    if (Health.isHealthDataAvailableAsync) {
      return Boolean(await Health.isHealthDataAvailableAsync());
    }
    return Boolean(Health.isHealthDataAvailable?.());
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (!Health) return false;
  const available = await isAppleHealthAvailable();
  if (!available) return false;

  return Boolean(await Health.requestAuthorization?.({
    toRead:  READ_TYPES.filter(healthTypeAvailable),
    toShare: SHARE_TYPES.filter(healthTypeAvailable),
  }));
}

function healthTypeAvailable(identifier: string): boolean {
  try {
    if (Health?.isObjectTypeAvailable) return Health.isObjectTypeAvailable(identifier);
    // Older native bridges lack the capability probe; preserve iOS 16 reads
    // without requesting cycling types that first appeared in iOS 17.
    if (identifier === 'HKQuantityTypeIdentifierCyclingPower' || identifier === 'HKQuantityTypeIdentifierCyclingCadence') {
      return Number.parseInt(String(Platform.Version), 10) >= 17;
    }
    return true;
  } catch { return false; }
}

export async function getAppleHealthWriteStatus(): Promise<boolean> {
  if (!Health) return false;
  const available = await isAppleHealthAvailable();
  if (!available) return false;

  try {
    return Health.authorizationStatusFor?.(WORKOUT_TYPE) === SHARING_AUTHORIZED;
  } catch {
    return false;
  }
}

export type HealthHeartRateSample = { bpm: number; sampledAt: number };

export async function getLatestHeartRateSample(maxAgeMinutes = 10): Promise<HealthHeartRateSample | null> {
  if (!Health) return null;
  const available = await isAppleHealthAvailable();
  if (!available) return null;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - maxAgeMinutes * 60 * 1000);

  try {
    const samples = await Health.queryQuantitySamples?.(
      'HKQuantityTypeIdentifierHeartRate',
      {
        ascending: false,
        limit:     1,
        unit:      'count/min',
        filter:    {
          date: {
            startDate,
            endDate,
          },
        },
      },
    );

    const sample = samples?.[0];
    const value = sample?.quantity ?? sample?.value;
    const sourceDate = sample?.startDate ?? sample?.endDate;
    const sampledAt = sourceDate instanceof Date ? sourceDate.getTime() : Date.parse(sourceDate ?? '');
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(sampledAt)) return null;
    if (sampledAt < startDate.getTime() || sampledAt > endDate.getTime() + 5_000) return null;
    return { bpm: Math.round(value), sampledAt };
  } catch {
    return null;
  }
}

export async function getLatestHeartRateBpm(maxAgeMinutes = 10): Promise<number | null> {
  return (await getLatestHeartRateSample(maxAgeMinutes))?.bpm ?? null;
}

/** Reads only samples associated with this exact HealthKit workout, not overlapping sessions. */
export async function getHealthKitWorkoutTelemetry(workoutUuid: string): Promise<{
  rawHeartRateSamples: HeartRateSample[];
  cadenceSamples: CadenceSample[];
  powerSamples: PowerSample[];
  metrics?: HealthKitWorkoutCandidate['metricsSummary'];
}> {
  const empty = { rawHeartRateSamples: [], cadenceSamples: [], powerSamples: [] };
  if (!workoutUuid || !Health?.queryWorkoutSamples || !Health.queryQuantitySamples || !await isAppleHealthAvailable()) return empty;
  const workouts = await Health.queryWorkoutSamples({ filter: { uuid: workoutUuid }, limit: 1, ascending: false }).catch(() => []);
  const workout = workouts[0];
  if (!workout) return empty;
  const startedAt = dateMs(workout.startDate);
  const endedAt = dateMs(workout.endDate);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return empty;
  const result: { rawHeartRateSamples: HeartRateSample[]; cadenceSamples: CadenceSample[]; powerSamples: PowerSample[] } = { ...empty };
  const type = mapWorkoutActivityType(workout.workoutActivityType);
  const requests = [
    { id: 'HKQuantityTypeIdentifierHeartRate', unit: 'count/min' },
    ...(type === 'cycling' ? [{ id: 'HKQuantityTypeIdentifierCyclingCadence', unit: 'count/min' }, { id: 'HKQuantityTypeIdentifierCyclingPower', unit: 'W' }] : []),
    ...(type === 'running' ? [{ id: 'HKQuantityTypeIdentifierRunningPower', unit: 'W' }] : []),
  ];
  for (const request of requests) {
    if (!healthTypeAvailable(request.id)) continue;
    const samples = await Health.queryQuantitySamples(request.id, { unit: request.unit, ascending: true, limit: 86_400, filter: { workout } }).catch(() => []);
    for (const sample of samples) {
      const timestamp = dateMs(sample.endDate ?? sample.startDate);
      const value = sample.quantity ?? sample.value;
      if (!Number.isFinite(timestamp) || timestamp < startedAt || timestamp > endedAt || typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
      if (request.id === 'HKQuantityTypeIdentifierHeartRate' && value > 0) result.rawHeartRateSamples.push({ timestamp, bpm: value, source: 'healthkit' });
      if (request.id === 'HKQuantityTypeIdentifierCyclingCadence') result.cadenceSamples.push({ timestamp, kind: 'cycling', cadenceRpm: value, source: 'healthkit' });
      // Transport alone cannot establish derivation for arbitrary third-party
      // power records. Only Apple's known workout stream is classified here.
      const apple = sample.sourceRevision?.source?.bundleIdentifier?.startsWith('com.apple.')
        && sample.metadata?.HKWasUserEntered !== true;
      if (request.unit === 'W' && apple) result.powerSamples.push({ timestamp, watts: value,
        sport: type === 'running' ? 'running' : 'cycling', source: 'healthkit',
        kind: type === 'running' ? 'device_estimated' : 'measured' });
    }
  }
  return { ...result, metrics: await workoutMetricSummaries(workout, type) };
}

async function workoutMetricSummaries(proxy: HealthWorkoutProxy, type: ActivityType | null): Promise<NonNullable<HealthKitWorkoutCandidate['metricsSummary']>> {
  const metrics: NonNullable<HealthKitWorkoutCandidate['metricsSummary']> = {};
  if (!proxy.getStatistic || !type) return metrics;
  async function statistic(identifier: string, unit: string) {
    if (!healthTypeAvailable(identifier)) return undefined;
    return proxy.getStatistic?.(identifier, unit).catch(() => undefined);
  }
  if (['running', 'walking', 'hiking', 'ski_touring', 'snowboard_touring'].includes(type)) {
    const steps = quantity((await statistic('HKQuantityTypeIdentifierStepCount', 'count'))?.sumQuantity);
    if (steps != null && steps >= 0) metrics.stepCount = steps;
  }
  if (type === 'cycling' || type === 'indoor_cycling') {
    const cadence = quantity((await statistic('HKQuantityTypeIdentifierCyclingCadence', 'count/min'))?.averageQuantity);
    if (cadence != null && cadence >= 0) metrics.cadenceRpm = cadence;
  }
  if (type === 'running') {
    const ground = quantity((await statistic('HKQuantityTypeIdentifierRunningGroundContactTime', 'ms'))?.averageQuantity);
    const stride = quantity((await statistic('HKQuantityTypeIdentifierRunningStrideLength', 'm'))?.averageQuantity);
    const vertical = quantity((await statistic('HKQuantityTypeIdentifierRunningVerticalOscillation', 'm'))?.averageQuantity);
    const speed = await statistic('HKQuantityTypeIdentifierRunningSpeed', 'm/s');
    const dynamics: NonNullable<ActivityMetrics['runningDynamics']> = {};
    if (ground != null && ground >= 0) dynamics.averageGroundContactTimeMs = ground;
    if (stride != null && stride >= 0) dynamics.averageStrideLengthMeters = stride;
    if (vertical != null && vertical >= 0) dynamics.averageVerticalOscillationMeters = vertical;
    if (Object.keys(dynamics).length) metrics.runningDynamics = dynamics;
    const average = quantity(speed?.averageQuantity);
    const maximum = quantity(speed?.maximumQuantity);
    if (average != null || maximum != null) metrics.speed = {
      averageMetersPerSecond: average != null && average >= 0 ? average : undefined,
      maximumMetersPerSecond: maximum != null && maximum >= 0 ? maximum : undefined,
    };
  }
  return metrics;
}

export async function getRecentHealthKitWorkoutCandidates(days = 30): Promise<HealthKitWorkoutCandidate[]> {
  return getHealthKitWorkoutHistory({ days, limit: 100 });
}

/**
 * Apple Health workout history for restoring the Activity log: every workout
 * in range (from StrideOS, the StrideOS watch app, Apple Workout, …), with
 * GPS routes when requested.
 */
type HealthWorkoutHistoryOptions = {
  days: number;
  limit: number;
  includeRoutes?: boolean;
  metadataOnly?: boolean;
  distanceOnly?: boolean;
  uuid?: string;
  onReadPhase?: (phase: 'details' | 'route' | 'metrics') => void;
  onProgress?: (processed: number, total: number) => void;
};

export type HealthWorkoutHistoryResult = {
  candidates: HealthKitWorkoutCandidate[];
  sampleCount: number;
  skippedCount: number;
};

export async function getHealthKitWorkoutHistory(options: HealthWorkoutHistoryOptions): Promise<HealthKitWorkoutCandidate[]> {
  return (await readHealthKitWorkoutHistory(options)).candidates;
}

export async function readHealthKitWorkoutHistory(options: HealthWorkoutHistoryOptions): Promise<HealthWorkoutHistoryResult> {
  if (!Health?.queryWorkoutSamples || typeof Health.WorkoutActivityType?.running !== 'number') {
    throw new Error('Apple Health workout reading is unavailable in this build. Update StrideOS and retry.');
  }
  const available = await isAppleHealthAvailable();
  if (!available) throw new Error('Apple Health is unavailable right now. Unlock your iPhone and retry.');

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - Math.max(1, options.days) * 24 * 60 * 60 * 1000);
  const samples = await Health.queryWorkoutSamples({
    limit: options.limit,
    ascending: false,
    filter: options.uuid ? { uuid: options.uuid } : { date: { startDate, endDate } },
  }).catch(() => {
    throw new Error('Apple Health workouts could not be read. Unlock your iPhone and retry. Your saved history has not been changed.');
  });

  const candidates: HealthKitWorkoutCandidate[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const proxy = samples[index]!;
    const read: { phase: 'details' | 'route' | 'metrics'; callbackFailure?: { error: unknown } } = { phase: 'details' };
    try {
      const raw = typeof proxy.toJSON === 'function' ? proxy.toJSON() : proxy;
      const candidate = await candidateFromWorkoutProxy(raw, proxy, Boolean(options.includeRoutes), options.metadataOnly,
        next => {
          read.phase = next;
          try { options.onReadPhase?.(next); }
          catch (error) { read.callbackFailure = { error }; throw error; }
        }, Boolean(options.uuid), Boolean(options.uuid && options.distanceOnly));
      if (candidate) candidates.push(candidate);
    } catch (error) {
      if (read.callbackFailure) throw read.callbackFailure.error;
      if (error instanceof HealthDistanceReadError) throw new HealthDistanceReadError(error.code);
      throw new Error(`An Apple Health workout could not be read safely (${read.phase}). Your saved activities have not been changed. ${read.phase === 'route' ? 'Check Workout Routes read access in Apple Health and retry the same selection.' : 'Retry the same selection.'}`);
    }
    options.onProgress?.(index + 1, samples.length);
  }
  return { candidates, sampleCount: samples.length, skippedCount: samples.length - candidates.length };
}

export async function getHealthKitWorkoutByUuid(uuid: string, onReadPhase?: HealthWorkoutHistoryOptions['onReadPhase'],
  options: { includeRoutes?: boolean; distanceOnly?: boolean } = {}): Promise<HealthKitWorkoutCandidate> {
  // The native bridge drops an invalid UUID predicate, which would broaden the query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error('Select a workout with a valid Apple Health identifier.');
  }
  const result = await readHealthKitWorkoutHistory({ days: 1, limit: 2, uuid,
    includeRoutes: !options.distanceOnly && options.includeRoutes !== false, distanceOnly: options.distanceOnly, onReadPhase });
  if (result.sampleCount !== 1 || result.candidates.length !== 1 || result.candidates[0]!.uuid !== uuid) {
    throw new Error('Apple Health did not return the exact selected workout. Check read access and retry. No activity has been replaced.');
  }
  return result.candidates[0]!;
}

function routeCoordinatesFrom(routes: readonly unknown[], retainAll = false): ActivityCoordinate[] {
  const points: ActivityCoordinate[] = [];
  for (const route of routes) {
    const locations = (route as { locations?: readonly Record<string, unknown>[] })?.locations ?? [];
    for (const location of locations) {
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      const timestamp = dateMs(location.date as string | Date | undefined);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestamp)) continue;
      const altitude = Number(location.altitude);
      const accuracy = Number(location.horizontalAccuracy);
      points.push({
        latitude,
        longitude,
        timestamp,
        altitudeMeters: Number.isFinite(altitude) ? altitude : undefined,
        horizontalAccuracyMeters: Number.isFinite(accuracy) ? accuracy : undefined,
      });
      if (retainAll && points.length > 200_000) throw new Error('This route exceeds the safe import size.');
    }
  }
  points.sort((a, b) => a.timestamp - b.timestamp);
  if (retainAll && JSON.stringify(points).length > 16_000_000) throw new Error('This route exceeds the safe import size.');
  return retainAll ? points : downsampleCoordinates(points);
}

export async function writeWorkout(workout: CompletedWorkoutRecord & { workoutInstanceId?: string }): Promise<void> {
  if (!Health) return;

  const durationMin = workout.actualDurationMinutes ?? workout.durationMinutes;
  const startDate = new Date(workout.timestamp - durationMin * 60 * 1000);
  const endDate   = new Date(workout.timestamp);

  const activityType = Health.WorkoutActivityType?.running;
  if (typeof activityType !== 'number') return;

  // Only write a distance total when we have a real, finite, positive value —
  // never NaN. estimatedLoad is a TSS-analog (training load), NOT kilocalories,
  // so we deliberately do NOT write it as energyBurned; publishing a fabricated
  // calorie figure into Apple Health would mislead the user and other apps.
  const distanceMiles = workout.actualDistanceMiles ?? workout.estimatedDistanceMiles;
  const totals: { distance?: number; energyBurned?: number } = {};
  if (Number.isFinite(distanceMiles) && distanceMiles > 0) {
    totals.distance = distanceMiles * 1609.344;
  }

  await Health.saveWorkoutSample?.(activityType, [], startDate, endDate, totals, {
    HKMetadataKeyWorkoutBrandName: 'StrideOS',
    ...healthKitRecordingMetadata({ strideOSWorkoutId: workout.id, workoutInstanceId: workout.workoutInstanceId }),
  });
}

/**
 * Saves a completed StrideOS activity to Apple Health, with its GPS route when
 * one was recorded. Apple Health then holds a second copy of the athlete's
 * history (the Activity-log restore reads it back).
 */
export async function writeActivityToHealth(activity: Activity): Promise<boolean> {
  if (!Health?.saveWorkoutSample) return false;
  const types = Health.WorkoutActivityType;
  const map: Partial<Record<ActivityType, number | undefined>> = {
    running: types?.running,
    walking: types?.walking,
    hiking: types?.hiking,
    cycling: types?.cycling,
    indoor_cycling: types?.cycling,
    swimming: types?.swimming,
    hiit: types?.highIntensityIntervalTraining,
    strength: types?.traditionalStrengthTraining ?? types?.functionalStrengthTraining,
    mobility: types?.flexibility ?? types?.mindAndBody,
    elliptical: types?.elliptical,
    rowing: types?.rowing,
    stair_climbing: types?.stairClimbing,
    downhill_skiing: types?.downhillSkiing,
    cross_country_skiing: types?.crossCountrySkiing,
    snowboarding: types?.snowboarding,
    // Touring is stored as hiking with explicit sport metadata; never downhill distance.
    ski_touring: types?.hiking,
    snowboard_touring: types?.hiking,
    mixed_modal: types?.mixedCardio,
  };
  const activityType = map[activity.activityType] ?? types?.other;
  if (typeof activityType !== 'number') return false;

  const durationSeconds = activity.metrics.durationSeconds ?? 0;
  const startDate = new Date(activity.startTime);
  const endDate = new Date(activity.endTime ?? activity.startTime + durationSeconds * 1000);
  if (!(endDate.getTime() > startDate.getTime())) return false;

  const totals: { distance?: number; energyBurned?: number } = {};
  const distance = activity.metrics.distanceMeters;
  if (typeof distance === 'number' && Number.isFinite(distance) && distance > 0) totals.distance = distance;
  const calories = activity.metrics.estimatedCalories;
  if (typeof calories === 'number' && Number.isFinite(calories) && calories > 0) totals.energyBurned = calories;

  const saved = await Health.saveWorkoutSample(activityType, [], startDate, endDate, totals, {
    HKMetadataKeyWorkoutBrandName: 'StrideOS',
    ...healthKitRecordingMetadata({ strideOSActivityId: activity.id, strideOSWorkoutId: activity.legacyWorkoutId,
      workoutInstanceId: activity.workoutInstanceId ?? activity.healthKit?.workoutInstanceId }),
    StrideOSSport: activity.activityType,
  }) as { saveWorkoutRoute?: (locations: readonly unknown[]) => Promise<boolean> } | undefined;

  const route = activity.metrics.routeCoordinates ?? [];
  if (route.length >= 2 && typeof saved?.saveWorkoutRoute === 'function') {
    await saved.saveWorkoutRoute(route.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitudeMeters ?? 0,
      date: new Date(point.timestamp),
      horizontalAccuracy: point.horizontalAccuracyMeters ?? 10,
      verticalAccuracy: 10,
      course: -1,
      speed: -1,
    }))).catch(() => false);
  }
  return true;
}

export async function writeStrengthSession(session: StrengthLogRecord): Promise<void> {
  if (!Health) return;

  const durationMin = session.actualDuration ?? session.plannedDuration;
  const startDate   = new Date(session.timestamp - durationMin * 60 * 1000);
  const endDate     = new Date(session.timestamp);

  const activityType = Health.WorkoutActivityType?.functionalStrengthTraining
    ?? Health.WorkoutActivityType?.traditionalStrengthTraining;
  if (typeof activityType !== 'number') return;

  await Health.saveWorkoutSample?.(activityType, [], startDate, endDate, undefined, {
    HKMetadataKeyWorkoutBrandName: 'StrideOS',
    StrideOSStrengthSessionId: session.id,
  });
}

async function candidateFromWorkoutProxy(raw: HealthWorkoutProxy, proxy: HealthWorkoutProxy, includeRoutes = false, metadataOnly = false,
  onReadPhase?: HealthWorkoutHistoryOptions['onReadPhase'], selectedWorkout = false, distanceOnly = false): Promise<HealthKitWorkoutCandidate | null> {
  onReadPhase?.('details');
  const workoutUuid = raw.uuid ?? raw.id;
  if (typeof workoutUuid !== 'string' || !workoutUuid.trim()) return null;
  const startTime = dateMs(raw.startDate);
  const endTime = dateMs(raw.endDate);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return null;
  const touring = raw.metadata?.StrideOSSport;
  const type = touring === 'ski_touring' || touring === 'snowboard_touring' ? touring : mapWorkoutActivityType(raw.workoutActivityType);
  if (!type) return null;
  const durationSeconds = durationToSeconds(raw.duration, endTime - startTime);
  const sourceProxy = raw.sourceRevision?.source;
  // Nitro's inherited `name` is "SourceProxy", not HKSource.name; use its serializer.
  const source = typeof sourceProxy?.toJSON === 'function' ? sourceProxy.toJSON() : sourceProxy;
  const candidate: HealthKitWorkoutCandidate = {
    uuid: workoutUuid,
    sourceBundleIdentifier: source?.bundleIdentifier ?? 'unknown',
    sourceName: source?.name,
    deviceName: raw.device?.name ?? raw.sourceRevision?.productType,
    deviceManufacturer: raw.device?.manufacturer,
    startTime,
    endTime,
    activityType: type,
    durationSeconds,
    distanceMeters: quantity(raw.totalDistance),
    energyKcal: quantity(raw.totalEnergyBurned),
    ...healthKitRecordingIdentity(raw.metadata),
    importedByStrideOS: raw.metadata?.HKMetadataKeyWorkoutBrandName === 'StrideOS'
      || typeof raw.metadata?.StrideOSWorkoutInstanceId === 'string'
      || typeof raw.metadata?.StrideOSWorkoutId === 'string'
      || typeof raw.metadata?.StrideOSStrengthSessionId === 'string'
      || typeof raw.metadata?.StrideOSActivityId === 'string',
  };
  // A selection list must not fetch every historical route and sensor summary.
  if (metadataOnly) return candidate;
  onReadPhase?.('route');
  const readRoutes = includeRoutes && !distanceOnly;
  const routes = readRoutes && typeof proxy.getWorkoutRoutes === 'function'
    ? await proxy.getWorkoutRoutes()
    : [];
  onReadPhase?.('metrics');
  const heartRateStats = !distanceOnly && typeof proxy.getStatistic === 'function'
    ? await proxy.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min').catch(() => undefined)
    : undefined;
  const metricsSummary = distanceOnly ? undefined : await workoutMetricSummaries(proxy, type);
  const distanceIdentifier = ['running', 'walking', 'hiking'].includes(type) ? 'HKQuantityTypeIdentifierDistanceWalkingRunning'
    : type === 'cycling' ? 'HKQuantityTypeIdentifierDistanceCycling' : undefined;
  let healthKitDistance: ActivityMetrics['healthKitDistance'];
  if (selectedWorkout && distanceIdentifier && Health?.queryQuantitySamples && healthTypeAvailable(distanceIdentifier)) {
    // limit: 0 means all samples in this installed bridge. Never query by date alone.
    let samples;
    try {
      samples = await Health.queryQuantitySamples(distanceIdentifier, { unit: 'm', ascending: true, limit: 0, filter: { workout: proxy } });
    } catch {
      throw new HealthDistanceReadError('DISTANCE_QUERY_FAILED');
    }
    healthKitDistance = decodeHealthDistanceEvidence(samples, candidate, raw.events ?? [], Health.WorkoutEventType);
  }
  const snowDistance = !distanceOnly && (type === 'downhill_skiing' || type === 'snowboarding') && proxy.getStatistic
    && healthTypeAvailable('HKQuantityTypeIdentifierDistanceDownhillSnowSports')
    ? await proxy.getStatistic('HKQuantityTypeIdentifierDistanceDownhillSnowSports', 'm').catch(() => undefined) : undefined;
  return {
    ...candidate,
    distanceMeters: quantity(snowDistance?.sumQuantity) ?? candidate.distanceMeters,
    averageHeartRateBpm: quantity(heartRateStats?.averageQuantity),
    maximumHeartRateBpm: quantity(heartRateStats?.maximumQuantity),
    metricsSummary,
    healthKitDistance,
    routeAvailable: readRoutes ? routes.length > 0 : undefined,
    routeCoordinates: includeRoutes && routes.length > 0 ? routeCoordinatesFrom(routes, selectedWorkout) : undefined,
  };
}

function dateMs(value: Date | string | undefined): number {
  if (value instanceof Date) return value.getTime();
  return Date.parse(value ?? '');
}

function durationToSeconds(value: HealthWorkoutProxy['duration'], fallbackMs: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const quantityValue = quantity(value);
  if (quantityValue != null) return Math.max(0, Math.round(quantityValue));
  return Math.max(0, Math.round(fallbackMs / 1000));
}

function quantity(value: { quantity?: number; value?: number; unit?: string } | number | undefined): number | undefined {
  return healthKitQuantity(value);
}

function mapWorkoutActivityType(value: number | undefined): ActivityType | null {
  if (!Health?.WorkoutActivityType || typeof value !== 'number') return null;
  const types = Health.WorkoutActivityType;
  if (value === types.running) return 'running';
  if (value === types.walking) return 'walking';
  if (value === types.cycling) return 'cycling';
  if (value === types.hiking) return 'hiking';
  if (value === types.downhillSkiing) return 'downhill_skiing';
  if (value === types.crossCountrySkiing) return 'cross_country_skiing';
  if (value === types.snowboarding) return 'snowboarding';
  if (value === types.swimming) return 'swimming';
  if (value === types.functionalStrengthTraining || value === types.traditionalStrengthTraining) return 'strength';
  if (value === types.mindAndBody) return 'mobility';
  if (value === types.highIntensityIntervalTraining) return 'hiit';
  return null;
}
