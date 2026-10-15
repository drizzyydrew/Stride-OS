import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { recoverRunEndCommands } from '../../lib/watchRunCompletion';
import { recoverOutdoorCompletions } from '../../lib/outdoorCompletion';

/** Mount once at root, beside WatchWorkoutBridge. No navigation or new recording. */
export default function RunCompletionRecovery() {
  const access = useAuthStore(state => state.localAccessStatus);
  useEffect(() => {
    const recover = () => {
      void recoverRunEndCommands().catch(error => console.warn('[Run End recovery]', error instanceof Error ? error.message : 'Retry retained'));
      void recoverOutdoorCompletions().catch(error => console.warn('[Outdoor End recovery]', error instanceof Error ? error.message : 'Retry retained'));
    };
    recover();
    const timer = setInterval(recover, 5_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') recover(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [access]);
  return null;
}
