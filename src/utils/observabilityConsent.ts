export type ObservabilityConsent = {
  owner: string | null;
  ready: boolean;
  usage: boolean;
  diagnostics: boolean;
  saving: boolean;
  error: boolean;
};

export const OBSERVABILITY_CONSENT_KEY = 'strideos-observability-consent-v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown>; removeItem: (key: string) => Promise<unknown> };
const initial = (): ObservabilityConsent => ({ owner: null, ready: false, usage: false, diagnostics: false, saving: false, error: false });

export function createObservabilityConsent(storage: Storage) {
  let state = initial();
  let revision = 0;
  let desired = { usage: false, diagnostics: false };
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: ObservabilityConsent) => { state = next; listeners.forEach(listener => listener()); };
  const enqueue = (work: () => Promise<void>) => { queue = queue.then(work).catch(() => {}); return queue; };
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setOwner(owner: string | null) {
      const attempt = ++revision;
      desired = { usage: false, diagnostics: false };
      publish({ ...initial(), owner });
      return enqueue(async () => {
        try {
          if (!owner) {
            await storage.removeItem(OBSERVABILITY_CONSENT_KEY);
            if (attempt === revision) publish({ ...initial(), ready: true });
            return;
          }
          const raw = await storage.getItem(OBSERVABILITY_CONSENT_KEY);
          const saved: unknown = raw ? JSON.parse(raw) : null;
          const record = saved as Record<string, unknown> | null;
          const valid = record && record.version === 1 && record.owner === owner
            && typeof record.usage === 'boolean' && typeof record.diagnostics === 'boolean';
          if (attempt !== revision) return;
          desired = valid ? { usage: record.usage as boolean, diagnostics: record.diagnostics as boolean } : desired;
          publish({ ...initial(), owner, ready: true, ...desired });
        } catch {
          if (attempt === revision) publish({ ...initial(), owner, ready: true, error: true });
        }
      });
    },
    setConsent(key: 'usage' | 'diagnostics', enabled: boolean) {
      if (!state.ready || !state.owner) return Promise.resolve();
      const attempt = ++revision;
      const owner = state.owner;
      desired = { ...desired, [key]: enabled === true };
      const next = { ...desired };
      // Revocation takes effect before storage or SDK cleanup can finish.
      publish({ ...state, ...(enabled ? {} : { [key]: false }), saving: true, error: false });
      return enqueue(async () => {
        try {
          await storage.setItem(OBSERVABILITY_CONSENT_KEY, JSON.stringify({ version: 1, owner, ...next }));
          if (attempt === revision) publish({ ...state, ...next, saving: false, error: false });
        } catch {
          try { await storage.removeItem(OBSERVABILITY_CONSENT_KEY); } catch { /* Remain off in this session if storage is unavailable. */ }
          if (attempt === revision) {
            desired = { usage: false, diagnostics: false };
            publish({ ...state, ...desired, saving: false, error: true });
          }
        }
      });
    },
  };
}
