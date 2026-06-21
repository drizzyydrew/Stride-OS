// ─── GPS Background Location Task ────────────────────────────────────────────
//
// Defines the TaskManager background task for continuous GPS tracking.
// Must be called at module level (outside components), typically imported
// in app/_layout.tsx so the task is registered before any navigation.

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useActiveRunStore } from '../store/activeRunStore';

export const BACKGROUND_LOCATION_TASK = 'STRIDE_BACKGROUND_LOCATION';

type LocationTaskData = {
  locations: Location.LocationObject[];
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[GPS]', error.message);
    return;
  }
  const { locations } = data as LocationTaskData;
  const addUpdate = useActiveRunStore.getState().addLocationUpdate;
  locations.forEach(loc => addUpdate(loc));
});

export async function startLocationTracking(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  const bgStatus = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus.status !== 'granted') return;

  const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (already) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy:         Location.Accuracy.BestForNavigation,
    timeInterval:     1000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Stride is tracking your run',
      notificationBody:  'GPS active',
    },
  });
}

export async function stopLocationTracking(): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (already) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
