import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { useActiveActivityStore } from '../store/activeActivityStore';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';

export const ACTIVITY_LOCATION_TASK = 'STRIDE_ACTIVITY_BACKGROUND_LOCATION';

let trackingOperation: Promise<unknown> = Promise.resolve();
function serializeTracking<T>(operation: () => Promise<T>): Promise<T> {
  const result = trackingOperation.then(operation);
  trackingOperation = result.catch(() => undefined);
  return result;
}

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
    // 0 = a fix every second even when stationary (auto-pause needs samples
    // while stopped); movement noise is filtered in appendTrackingPoint.
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: activity.activityType === 'cycling'
      ? Location.ActivityType.OtherNavigation
      : Location.ActivityType.Fitness,
  };
}

export async function startActivityLocationTracking(): Promise<void> {
  return serializeTracking(async () => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Location permission is required to track this activity.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Background location is required so tracking can continue when the screen locks.');
  }
  if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, activityLocationOptions());
  });
}

export async function resumeActivityLocationTrackingIfPermitted(): Promise<boolean> {
  return serializeTracking(async () => {
  if (useActiveActivityStore.getState().completionRequestedAt != null) return false;
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  if (foreground.status !== 'granted' || background.status !== 'granted') return false;
  if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, activityLocationOptions());
  return true;
  });
}

export async function stopActivityLocationTracking(): Promise<void> {
  await stopActivityLocationTrackingWhen(() => true);
}

export async function stopActivityLocationTrackingWhen(isCurrent: () => boolean): Promise<boolean> {
  return serializeTracking(async () => {
  if (!isCurrent()) return false;
  const started = await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
  if (!isCurrent()) return false;
  if (started) {
    await Location.stopLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
  }
  return isCurrent();
  });
}
