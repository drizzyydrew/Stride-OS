// ─── GPS Background Location Task ────────────────────────────────────────────
//
// Defines the TaskManager background task for continuous GPS tracking.
// Must be called at module level (outside components), typically imported
// in app/_layout.tsx so the task is registered before any navigation.

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useActiveRunStore } from '../store/activeRunStore';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';

export const BACKGROUND_LOCATION_TASK = 'STRIDE_BACKGROUND_LOCATION';

type LocationTaskData = {
  locations: Location.LocationObject[];
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[GPS]', error.message);
    return;
  }
  await waitForPersistedStoreHydration(useActiveRunStore);
  if (!useActiveRunStore.getState().isActive) return;
  const { locations } = data as LocationTaskData;
  const addUpdate = useActiveRunStore.getState().addLocationUpdate;
  locations.forEach(loc => addUpdate(loc));
});

const RUN_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy:         Location.Accuracy.BestForNavigation,
  timeInterval:     1000,
  distanceInterval: 5,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Stride is tracking your run',
    notificationBody:  'GPS active',
  },
};

export async function startLocationTracking(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to track a GPS run.');
  }

  const bgStatus = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus.status !== 'granted') {
    throw new Error('Background location is required so GPS tracking continues when the screen locks.');
  }

  const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (already) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, RUN_LOCATION_OPTIONS);
}

export async function resumeRunLocationTrackingIfPermitted(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  if (foreground.status !== 'granted' || background.status !== 'granted') return false;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, RUN_LOCATION_OPTIONS);
  return true;
}

export async function stopLocationTracking(): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (already) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
