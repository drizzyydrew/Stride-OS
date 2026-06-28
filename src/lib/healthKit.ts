// ─── Apple HealthKit Integration ─────────────────────────────────────────────
//
// Requires: react-native-health (native module — needs EAS custom dev client).
// Guarded with try/catch so the app runs on Expo Go without crashing.
//
// Actual testing requires a signed iOS build.

import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { AppleHealthKit } from 'react-native-health';

let Health: AppleHealthKit | null = null;
const SHARING_AUTHORIZED = 2;

try {
  // Dynamic require so the app doesn't crash on Expo Go / Android
  const healthModule = require('react-native-health');
  Health = healthModule.default ?? healthModule.HealthKit ?? healthModule;
} catch {
  // react-native-health not available in this build
}

export async function isAppleHealthAvailable(): Promise<boolean> {
  if (!Health) return false;

  return new Promise(resolve => {
    Health!.isAvailable((_error: object, available: boolean) => resolve(Boolean(available)));
  });
}

function healthPermissions() {
  if (!Health) return null;
  return {
    permissions: {
      read: [
        Health.Constants.Permissions.HeartRate,
        Health.Constants.Permissions.RestingHeartRate,
        Health.Constants.Permissions.HeartRateVariability,
        Health.Constants.Permissions.SleepAnalysis,
        Health.Constants.Permissions.ActiveEnergyBurned,
        Health.Constants.Permissions.StepCount,
        Health.Constants.Permissions.DistanceWalkingRunning,
        Health.Constants.Permissions.Workout,
      ],
      write: [
        Health.Constants.Permissions.Workout,
        Health.Constants.Permissions.ActiveEnergyBurned,
        Health.Constants.Permissions.DistanceWalkingRunning,
      ],
    },
  };
}

export async function requestPermissions(): Promise<boolean> {
  if (!Health) return false;
  const available = await isAppleHealthAvailable();
  if (!available) return false;

  const permissions = healthPermissions();
  if (!permissions) return false;

  return new Promise(resolve => {
    Health!.initHealthKit(permissions, (err: string) => resolve(!err));
  });
}

export async function getAppleHealthWriteStatus(): Promise<boolean> {
  if (!Health) return false;
  const available = await isAppleHealthAvailable();
  if (!available) return false;

  const permissions = healthPermissions();
  if (!permissions) return false;

  return new Promise(resolve => {
    Health!.getAuthStatus(permissions, (_err, result) => {
      const writeStatuses = result?.permissions?.write ?? [];
      resolve(writeStatuses.length > 0 && writeStatuses.every(status => status === SHARING_AUTHORIZED));
    });
  });
}

export async function getLatestHeartRateBpm(maxAgeMinutes = 10): Promise<number | null> {
  if (!Health) return null;
  const available = await isAppleHealthAvailable();
  if (!available) return null;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - maxAgeMinutes * 60 * 1000);

  return new Promise(resolve => {
    const api = Health as unknown as {
      getHeartRateSamples?: (
        options: Record<string, unknown>,
        callback: (error: unknown, results?: Array<{ value?: number }>) => void,
      ) => void;
    };

    if (!api.getHeartRateSamples) {
      resolve(null);
      return;
    }

    api.getHeartRateSamples(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'bpm',
        ascending: false,
        limit: 1,
      },
      (_error, results) => {
        const value = results?.[0]?.value;
        resolve(typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null);
      },
    );
  });
}

export async function writeWorkout(workout: CompletedWorkoutRecord): Promise<void> {
  if (!Health) return;

  const durationMin = workout.actualDurationMinutes ?? workout.durationMinutes;
  const startDate = new Date(workout.timestamp - durationMin * 60 * 1000);
  const endDate   = new Date(workout.timestamp);

  const options = {
    type:         Health.Constants.Activities.Running,
    startDate:    startDate.toISOString(),
    endDate:      endDate.toISOString(),
    distance:     (workout.actualDistanceMiles ?? workout.estimatedDistanceMiles) * 1609.344,
    distanceUnit: 'meter',
    energyBurned: Math.round(workout.estimatedLoad * 1.05),
  };

  return new Promise((resolve, reject) => {
    Health!.saveWorkout(options, (err: string) => err ? reject(err) : resolve());
  });
}

export async function writeStrengthSession(session: StrengthLogRecord): Promise<void> {
  if (!Health) return;

  const durationMin = session.actualDuration ?? session.plannedDuration;
  const startDate   = new Date(session.timestamp - durationMin * 60 * 1000);
  const endDate     = new Date(session.timestamp);

  const options = {
    type:      Health.Constants.Activities.FunctionalStrengthTraining,
    startDate: startDate.toISOString(),
    endDate:   endDate.toISOString(),
  };

  return new Promise((resolve, reject) => {
    Health!.saveWorkout(options, (err: string) => err ? reject(err) : resolve());
  });
}
