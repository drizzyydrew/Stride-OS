import type { CoachUsage } from './coachUsage';
import type { OwnerLease } from '../lib/localDataOwner';

export type CoachUsageState = {
  usage: CoachUsage | null;
  lease: OwnerLease | null;
  status: 'loading' | 'current' | 'unavailable';
  checkedAt: number | null;
};

/** In-memory only, with sequence and owner fences around every async read. */
export function createCoachUsageMonitor(deps: {
  read: (signal: AbortSignal) => Promise<CoachUsage>;
  capture: () => OwnerLease | null;
  isCurrent: (lease: OwnerLease) => boolean;
}) {
  let state: CoachUsageState = { usage: null, lease: null, status: 'loading', checkedAt: null };
  let sequence = 0;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (value: CoachUsageState) => { state = value; listeners.forEach(listener => listener()); };
  function cancel() { sequence++; controller?.abort(); controller = null; }
  function clear() { cancel(); publish({ usage: null, lease: null, status: 'unavailable', checkedAt: null }); }
  async function refresh() {
    cancel();
    const lease = deps.capture();
    if (!lease) { clear(); return; }
    const request = sequence;
    const current = () => sequence === request && deps.isCurrent(lease);
    const previous = state.lease && deps.isCurrent(state.lease) ? state : null;
    publish({ usage: previous?.usage ?? null, lease, status: 'loading', checkedAt: previous?.checkedAt ?? null });
    const abort = new AbortController();
    controller = abort;
    const timeout = setTimeout(() => {
      abort.abort();
      if (current()) publish({ ...state, status: 'unavailable' });
    }, 10_000);
    try {
      const usage = await deps.read(abort.signal);
      if (current() && !abort.signal.aborted) publish({ usage, lease, status: 'current', checkedAt: Date.now() });
      else if (current()) publish({ ...state, status: 'unavailable' });
    } catch {
      if (current()) publish({ ...state, status: 'unavailable' });
    } finally { clearTimeout(timeout); if (sequence === request) controller = null; }
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    refresh, cancel, clear,
  };
}
