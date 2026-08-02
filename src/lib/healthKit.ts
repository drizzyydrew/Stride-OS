// ─── Apple HealthKit Integration ─────────────────────────────────────────────
//
// Requires: @kingstinct/react-native-healthkit (native module — needs EAS/TestFlight).
// Guarded with try/catch so the app runs on Expo Go without crashing.
//
// Actual testing requires a signed iOS build.

import { Platform } from 'react-native';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { ActivityType } from '../types/activity';
import type { HealthKitWorkoutCandidate } from '../utils/healthKitImport';

type HealthKitModule = {
  default?: HealthKitModule;
  isHealthDataAvailable?: () => boolean;
  isHealthDataAvailableAsync?: () => Promise<boolean>;
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
        date?: {
          startDate: Date;
          endDate: Date;
        };
      };
    },
  ) => Promise<readonly {
    quantity?: number;
    value?: number;
    startDate?: Date | string;
    endDate?: Date | string;
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
  };
};

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
    source?: { bundleIdentifier?: string; name?: string };
    productType?: string;
    version?: string;
  };
  device?: { name?: string; manufacturer?: string; model?: string };
  metadata?: Record<string, unknown>;
  toJSON?: () => HealthWorkoutProxy;
  getWorkoutRoutes?: () => Promise<readonly unknown[]>;
  getStatistic?: (identifier: string, unit?: string) => Promise<{ averageQuantity?: number; maximumQuantity?: number; sumQuantity?: number } | undefined>;
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
  'HKWorkoutRouteTypeIdentifier',
  WORKOUT_TYPE,
] as const;

const SHARE_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  WORKOUT_TYPE,
] as const;

try {
  // Dynamic require so the app doesn't crash on Expo Go / Android
  const healthModule = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  Health = healthModule.default ?? healthModule;
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
    toRead:  READ_TYPES,
    toShare: SHARE_TYPES,
  }));
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

export async function getRecentHealthKitWorkoutCandidates(days = 30): Promise<HealthKitWorkoutCandidate[]> {
  if (!Health?.queryWorkoutSamples) return [];
  const available = await isAppleHealthAvailable();
  if (!available) return [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const samples = await Health.queryWorkoutSamples({
    limit: 100,
    ascending: false,
    filter: { date: { startDate, endDate } },
  }).catch(() => []);

  const candidates: HealthKitWorkoutCandidate[] = [];
  for (const proxy of samples) {
    const raw = typeof proxy.toJSON === 'function' ? proxy.toJSON() : proxy;
    const candidate = await candidateFromWorkoutProxy(raw, proxy).catch(() => null);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export async function writeWorkout(workout: CompletedWorkoutRecord): Promise<void> {
  if (!Health) return;

  const durationMin = workout.actualDurationMinutes ?? workout.durationMinutes;
  const startDate = new Date(workout.timestamp - durationMin * 60 * 1000);
  const endDate   = new Date(workout.timestamp);

  const activityType = Health.WorkoutActivityType?.running;
  if (typeof activityType !== 'number') return;

  const totals = {
    distance:     (workout.actualDistanceMiles ?? workout.estimatedDistanceMiles) * 1609.344,
    energyBurned: Math.round(workout.estimatedLoad * 1.05),
  };

  await Health.saveWorkoutSample?.(activityType, [], startDate, endDate, totals, {
    HKMetadataKeyWorkoutBrandName: 'StrideOS',
    StrideOSWorkoutId: workout.id,
  });
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

async function candidateFromWorkoutProxy(raw: HealthWorkoutProxy, proxy: HealthWorkoutProxy): Promise<HealthKitWorkoutCandidate | null> {
  const startTime = dateMs(raw.startDate);
  const endTime = dateMs(raw.endDate);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return null;
  const type = mapWorkoutActivityType(raw.workoutActivityType);
  if (!type) return null;
  const durationSeconds = durationToSeconds(raw.duration, endTime - startTime);
  const source = raw.sourceRevision?.source;
  const routes = typeof proxy.getWorkoutRoutes === 'function'
    ? await proxy.getWorkoutRoutes().catch(() => [])
    : [];
  const heartRateStats = typeof proxy.getStatistic === 'function'
    ? await proxy.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min').catch(() => undefined)
    : undefined;
  return {
    uuid: raw.uuid ?? raw.id ?? `${source?.bundleIdentifier ?? 'unknown'}:${startTime}:${endTime}`,
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
    averageHeartRateBpm: numberOrUndefined(heartRateStats?.averageQuantity),
    maximumHeartRateBpm: numberOrUndefined(heartRateStats?.maximumQuantity),
    routeAvailable: routes.length > 0,
    importedByStrideOS: raw.metadata?.HKMetadataKeyWorkoutBrandName === 'StrideOS'
      || typeof raw.metadata?.StrideOSWorkoutId === 'string'
      || typeof raw.metadata?.StrideOSStrengthSessionId === 'string',
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
  if (typeof value === 'number') return numberOrUndefined(value);
  const raw = value?.quantity ?? value?.value;
  return numberOrUndefined(raw);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapWorkoutActivityType(value: number | undefined): ActivityType | null {
  if (!Health?.WorkoutActivityType || typeof value !== 'number') return null;
  const types = Health.WorkoutActivityType;
  if (value === types.running) return 'running';
  if (value === types.walking) return 'walking';
  if (value === types.cycling) return 'cycling';
  if (value === types.hiking) return 'hiking';
  if (value === types.swimming) return 'swimming';
  if (value === types.functionalStrengthTraining || value === types.traditionalStrengthTraining) return 'strength';
  if (value === types.mindAndBody) return 'mobility';
  if (value === types.highIntensityIntervalTraining) return 'hiit';
  return null;
}
