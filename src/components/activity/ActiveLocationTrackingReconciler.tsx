import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { resumeActivityLocationTrackingIfPermitted } from '../../lib/activityGpsTracking';
import { waitForActiveSessionStores } from '../../lib/activeSessionCoordinator';
import { resumeRunLocationTrackingIfPermitted } from '../../lib/gpsTracking';
import { useActiveActivityStore } from '../../store/activeActivityStore';
import { useActiveRunStore } from '../../store/activeRunStore';

async function reconcileActiveLocationTracking() {
  if (Platform.OS === 'web') return;
  await waitForActiveSessionStores();

  const run = useActiveRunStore.getState();
  if (run.isActive && run.environment === 'outdoor') {
    await resumeRunLocationTrackingIfPermitted().catch(error => {
      console.warn('[GPS resume]', error);
    });
  }

  const activity = useActiveActivityStore.getState();
  if (activity.isActive && activity.subtype === 'outdoor') {
    await resumeActivityLocationTrackingIfPermitted().catch(error => {
      console.warn('[Activity GPS resume]', error);
    });
  }
}

export default function ActiveLocationTrackingReconciler() {
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (!cancelled) void reconcileActiveLocationTracking();
    };

    run();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return null;
}
