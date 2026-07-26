// ─── Apple HealthKit Integration ─────────────────────────────────────────────
//
// Requires: @kingstinct/react-native-healthkit (native module — needs EAS/TestFlight).
// Guarded with try/catch so the app runs on Expo Go without crashing.
//
// Actual testing requires a signed iOS build.

import { Platform } from 'react-native';
import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';

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
  WorkoutActivityType?: {
    running?: number;
    functionalStrengthTraining?: number;
    traditionalStrengthTraining?: number;
  };
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
  WORKOUT_TYPE,
] as const;

const SHARE_TYPES = [
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
  });
}
