import { useEffect } from 'react';
import { AppState } from 'react-native';

import { reconcileRaceCalibration } from '../../lib/raceCalibration';
import { useActivityStore } from '../../store/activityStore';
import { useAthleteStore } from '../../store/athleteStore';
import { useCustomWorkoutStore } from '../../store/customWorkoutStore';
import { useGoalArchiveStore } from '../../store/goalArchiveStore';
import { useProfileStore } from '../../store/profileStore';

/** Derived local training intelligence. Never starts a sensor or a workout. */
export default function RaceCalibrationReconciler() {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let retryAfter = 0;
    const refresh = () => {
      if (!active || AppState.currentState !== 'active') return;
      if (timer) clearTimeout(timer);
      // Store changes often arrive as a completion batch; read its final state.
      timer = setTimeout(() => {
        timer = null;
        if (active && AppState.currentState === 'active') void reconcileRaceCalibration().then(() => {
          failures = 0;
          retryAfter = 0;
        }).catch(() => {
          // Persist middleware can publish before its disk write rejects.
          // Cancel that self-triggered refresh and retry with a bounded backoff.
          failures++;
          retryAfter = Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(failures - 1, 6));
          refresh();
        });
      }, Math.max(50, retryAfter - Date.now()));
    };
    const stops = [useActivityStore, useAthleteStore, useCustomWorkoutStore, useGoalArchiveStore, useProfileStore]
      .map(store => store.subscribe(refresh));
    const hydrationStops = [useAthleteStore, useCustomWorkoutStore, useProfileStore]
      .map(store => store.persist.onFinishHydration(refresh));
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    // Daily freshness also advances when the app remains open across midnight.
    const clock = setInterval(refresh, 60_000);
    refresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      stops.forEach(stop => stop());
      hydrationStops.forEach(stop => stop());
      foreground.remove();
      clearInterval(clock);
    };
  }, []);
  return null;
}
