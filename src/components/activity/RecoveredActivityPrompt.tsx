import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { router, useSegments } from 'expo-router';

import { ColdLaunchActivityRecovery, type RecoveredActivity } from '../../lib/coldLaunchActivityRecovery';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { getPendingRunControlCommand } from '../../lib/runLiveActivity';
import { recoverRunEndCommands } from '../../lib/watchRunCompletion';
import { completeWatchActivityEnd, recoverOutdoorCompletions } from '../../lib/outdoorCompletion';
import { activeRunElapsedSeconds, useActiveRunStore } from '../../store/activeRunStore';
import { useActiveActivityStore } from '../../store/activeActivityStore';
import { useActiveIndoorRideStore } from '../../store/activeIndoorRideStore';
import { useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { useActivityStore } from '../../store/activityStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { recoverStrideWatchControlIdentity } from '../../../modules/stride-watch-connectivity/src';

// This instance survives auth-gate remounts within the same process. Signing
// back in or returning from the lock screen does not create a new launch.
const recovery = new ColdLaunchActivityRecovery(Date.now());

function readActivity(): RecoveredActivity | null {
  const run = useActiveRunStore.getState();
  const outdoor = useActiveActivityStore.getState();
  const ride = useActiveIndoorRideStore.getState();
  const strength = useActiveStrengthSessionStore.getState().session;
  if ([run.isActive, outdoor.isActive, ride.isActive, Boolean(strength)].filter(Boolean).length !== 1) return null;
  if (run.isActive && run.workoutInstanceId && run.startTime != null) {
    return {
      domain: 'running', workoutInstanceId: run.workoutInstanceId, startedAt: run.startTime,
      name: run.environment === 'indoor' ? 'Treadmill run' : 'Run', route: '/(tabs)/training',
      ending: run.completionRequestedAt != null,
      alreadySaved: useWorkoutStore.getState().history.some(record => record.workoutInstanceId === run.workoutInstanceId && record.actualEndTime != null),
      mayDiscardOnStop: activeRunElapsedSeconds(run) < 300,
    };
  }
  if (outdoor.isActive && outdoor.workoutInstanceId && outdoor.startedAt != null) {
    return {
      domain: 'outdoor', workoutInstanceId: outdoor.workoutInstanceId, startedAt: outdoor.startedAt,
      name: 'Outdoor activity', route: '/(tabs)/activity/start',
      ending: outdoor.completionRequestedAt != null,
      alreadySaved: useActivityStore.getState().activities.some(activity => activity.workoutInstanceId === outdoor.workoutInstanceId && activity.endTime != null),
      mayDiscardOnStop: false,
    };
  }
  return null;
}

function canNavigateAfterStop(activity: RecoveredActivity) {
  const run = useActiveRunStore.getState();
  const outdoor = useActiveActivityStore.getState();
  if (useActiveIndoorRideStore.getState().isActive || useActiveStrengthSessionStore.getState().session) return false;
  if (run.isActive && (activity.domain !== 'running' || run.workoutInstanceId !== activity.workoutInstanceId || run.startTime !== activity.startedAt)) return false;
  if (outdoor.isActive && (activity.domain !== 'outdoor' || outdoor.workoutInstanceId !== activity.workoutInstanceId || outdoor.startedAt !== activity.startedAt)) return false;
  return true;
}

type HydratedStore = { persist: { hasHydrated: () => boolean; onFinishHydration: (callback: () => void) => () => void } };

function waitForHydration(store: HydratedStore) {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
    if (store.persist.hasHydrated()) { unsubscribe(); resolve(); }
  });
}

/** Choice for a retained run/outdoor activity on cold launch, after owner and history recovery. */
export default function RecoveredActivityPrompt() {
  const segments = useSegments();
  const onboardingComplete = useOnboardingStore(state => state.onboardingComplete);
  const routeReady = segments[0] === '(tabs)' && onboardingComplete;
  useEffect(() => {
    if (Platform.OS === 'web' || !routeReady) return undefined;
    let cancelled = false;
    const consider = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const decision = await recovery.prepare({
          waitForHydration: () => Promise.all([
            useActiveRunStore, useActiveActivityStore, useActiveIndoorRideStore,
            useActiveStrengthSessionStore, useActivityStore, useWorkoutStore,
          ].map(waitForHydration)).then(() => undefined),
          captureOwner: captureOwnerLease,
          ownerIsCurrent: ownerLeaseIsCurrent,
          readActivity,
          recoverPendingStops: async () => { await recoverRunEndCommands(); await recoverOutdoorCompletions(); },
          hasPendingNativeStop: activity => {
            const command = getPendingRunControlCommand();
            return command?.action === 'stop' && (command.workoutInstanceId ?? command.sessionId) === activity.workoutInstanceId;
          },
          complete: (activity, endedAt) => completeWatchActivityEnd({ workoutInstanceId: activity.workoutInstanceId, endedAt }),
          canNavigateAfterStop,
          navigate: activity => router.push(activity.route as never),
          now: Date.now,
        });
        if (cancelled || !decision || AppState.currentState !== 'active' || !recovery.claimPresentation(decision)) return;
        const finish = (allowShortDiscard = false) => {
          if (cancelled) return;
          void decision.stop({ allowShortDiscard }).catch(() => {
            if (!cancelled && decision.isOwnerCurrent()) Alert.alert('Activity not yet saved', 'Your recording is retained. Return to its controls to review or retry finishing it.');
          });
        };
        const resume = () => {
          if (cancelled || !decision.isOwnerCurrent()) return;
          const current = readActivity();
          if (!current || current.domain !== decision.activity.domain
            || current.workoutInstanceId !== decision.activity.workoutInstanceId
            || current.startedAt !== decision.activity.startedAt || current.ending || current.alreadySaved) return;
          if (current.domain === 'outdoor' || useActiveRunStore.getState().environment === 'outdoor') {
            // Discover only the existing Watch tuple. Resume never starts a
            // Watch workout or replays an earlier automatic pause decision.
            recoverStrideWatchControlIdentity(current.workoutInstanceId);
          }
          decision.resume();
        };
        Alert.alert('Activity still open', `${decision.activity.name} is still open. Resume to return to its controls, or stop to finish it.`, [
          { text: 'Resume activity', onPress: resume },
          { text: 'Stop activity', onPress: () => {
            if (cancelled) return;
            if (decision.requiresDiscardConfirmation()) {
              Alert.alert('Short recording', 'Runs under five active minutes are discarded when stopped. Continue this recording, or stop it anyway?', [
                { text: 'Continue recording', style: 'cancel', onPress: resume },
                { text: 'Stop anyway', style: 'destructive', onPress: () => finish(true) },
              ], { cancelable: false });
            } else finish();
          } },
        ], { cancelable: false });
      } catch {
        // Failed hydration or pending-Stop recovery must leave the recording and
        // its existing retry path intact, never offer an unsafe resume/discard.
      }
    };
    void consider();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void consider(); });
    return () => { cancelled = true; subscription.remove(); };
  }, [routeReady]);
  return null;
}
