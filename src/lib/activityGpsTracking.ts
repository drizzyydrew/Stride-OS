import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { useActiveActivityStore } from '../store/activeActivityStore';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';

export const ACTIVITY_LOCATION_TASK = 'STRIDE_ACTIVITY_BACKGROUND_LOCATION';

TaskManager.defineTask(ACTIVITY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[Activity GPS]', error.message);
    return;
  }
  await waitForPersistedStoreHydration(useActiveActivityStore);
  const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
  locations.forEach(location => {
    const state = useActiveActivityStore.getState();
    if (!state.isActive) return;
    const activeSeconds = state.startedAt
      ? Math.max(0, (location.timestamp - state.startedAt - state.pausedDurationMs) / 1000)
      : 0;
    useActiveActivityStore.getState().addLocation(location, activeSeconds);
  });
});

function activityLocationOptions(): Location.LocationTaskOptions {
  const activity = useActiveActivityStore.getState();
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: activity.activityType === 'cycling' ? 8 : 4,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: activity.activityType === 'cycling'
      ? Location.ActivityType.OtherNavigation
      : Location.ActivityType.Fitness,
  };
}

export async function startActivityLocationTracking(): Promise<void> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Location permission is required to track this activity.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Background location is required so tracking can continue when the screen locks.');
  }
  if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, activityLocationOptions());
}

export async function resumeActivityLocationTrackingIfPermitted(): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  if (foreground.status !== 'granted' || background.status !== 'granted') return false;
  if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, activityLocationOptions());
  return true;
}

export async function stopActivityLocationTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
  }
}
