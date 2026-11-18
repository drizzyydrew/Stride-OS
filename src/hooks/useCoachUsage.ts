import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchCoachUsage } from '../lib/aiCoach';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../lib/localDataOwner';
import { useAuthStore } from '../store/authStore';
import { createCoachUsageMonitor } from '../utils/coachUsageMonitor';

export function useCoachUsage(enabled: boolean, sending: boolean) {
  const owner = useAuthStore(s => s.user?.id);
  const access = useAuthStore(s => s.localAccessStatus);
  const monitor = useMemo(() => createCoachUsageMonitor({
    read: fetchCoachUsage, capture: () => captureOwnerLease(true),
    isCurrent: lease => ownerLeaseIsCurrent(lease, true),
  }), []);
  const state = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, monitor.getSnapshot);
  const focused = useRef(false);
  const wasSending = useRef(false);

  useEffect(() => getLocalDataOwner()?.onLeaseInvalidated(() => monitor.clear()), [monitor]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (!enabled) { monitor.clear(); return () => { focused.current = false; }; }
    const refresh = () => { if (AppState.currentState === 'active' && !sending) void monitor.refresh(); };
    refresh();
    // A timed-out send can finish reserving on the server after client cleanup.
    const followUp = wasSending.current && !sending ? setTimeout(refresh, 8_000) : null;
    wasSending.current = sending;
    const poll = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') refresh(); else monitor.cancel();
    });
    return () => { focused.current = false; if (followUp) clearTimeout(followUp); clearInterval(poll); subscription.remove(); monitor.cancel(); };
  }, [enabled, sending, owner, access, monitor]));

  // The server's UTC reset is independent of the phone's timezone. A timer also
  // refreshes a page left open over midnight, without showing yesterday as today.
  useEffect(() => {
    if (!enabled || sending || !state.usage) return;
    const wait = Date.parse(state.usage.resetsAt) - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => { if (focused.current && AppState.currentState === 'active') void monitor.refresh(); }, wait + 50);
    return () => clearTimeout(timer);
  }, [enabled, sending, state.usage, monitor]);

  const valid = state.lease && ownerLeaseIsCurrent(state.lease, true);
  return { ...state, usage: valid ? state.usage : null,
    status: valid ? state.status : 'unavailable' as const,
    refresh: monitor.refresh };
}
