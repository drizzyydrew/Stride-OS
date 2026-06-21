// ─── Apple HealthKit Integration ─────────────────────────────────────────────
//
// Requires: react-native-health (native module — needs EAS custom dev client).
// Guarded with try/catch so the app runs on Expo Go without crashing.
//
// Actual testing requires a signed iOS build.

import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';

let Health: typeof import('react-native-health') | null = null;

try {
  // Dynamic require so the app doesn't crash on Expo Go / Android
  Health = require('react-native-health');
} catch {
  // react-native-health not available in this build
}

export async function requestPermissions(): Promise<boolean> {
  if (!Health) return false;

  const permissions = {
    permissions: {
      read: [
        Health.Constants.Permissions.HeartRate,
        Health.Constants.Permissions.ActiveEnergyBurned,
        Health.Constants.Permissions.StepCount,
      ],
      write: [
        Health.Constants.Permissions.Workout,
        Health.Constants.Permissions.ActiveEnergyBurned,
      ],
    },
  };

  return new Promise(resolve => {
    Health!.initHealthKit(permissions, (err) => resolve(!err));
  });
}

export async function writeWorkout(workout: CompletedWorkoutRecord): Promise<void> {
  if (!Health) return;

  const startDate = new Date(workout.timestamp - workout.durationMinutes * 60 * 1000);
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
    Health!.saveWorkout(options, (err) => err ? reject(err) : resolve());
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
    Health!.saveWorkout(options, (err) => err ? reject(err) : resolve());
  });
}
