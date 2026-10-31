export const AI_CONSENT_KEY = 'strideos-ai-sharing-v1';
export const AI_DISCLOSURE_VERSION = 1;

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type State = { owner: string | null; allowed: boolean; ready: boolean; saving: boolean; error: boolean; revision: number };

export function createAiConsent(storage: Storage) {
  let state: State = { owner: null, allowed: false, ready: false, saving: false, error: false, revision: 0 };
  let generation = 0;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: Partial<State>) => {
    state = { ...state, ...next, revision: state.revision + 1 };
    listeners.forEach(listener => listener());
  };
  const enqueue = (action: () => Promise<void>) => {
    const task = writes.then(action);
    writes = task.catch(() => undefined);
    return task;
  };
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async setOwner(owner: string | null) {
      const token = ++generation;
      publish({ owner, allowed: false, ready: false, saving: false, error: false });
      try {
        if (!owner) {
          await enqueue(() => storage.removeItem(AI_CONSENT_KEY));
          if (token === generation) publish({ ready: true });
          return;
        }
        await writes;
        const raw = await storage.getItem(AI_CONSENT_KEY);
        const value = raw ? JSON.parse(raw) : null;
        if (token !== generation) return;
        publish({ ready: true, allowed: value?.version === AI_DISCLOSURE_VERSION && value?.owner === owner && value?.allowed === true });
      } catch {
        if (token === generation) publish({ ready: true, error: true, allowed: false });
      }
    },
    async setAllowed(allowed: boolean) {
      if (!state.owner || !state.ready) return;
      const owner = state.owner;
      const token = ++generation;
      publish({ allowed: false, saving: true, error: false });
      try {
        await enqueue(() => storage.setItem(AI_CONSENT_KEY, JSON.stringify({ version: AI_DISCLOSURE_VERSION, owner, allowed })));
        if (token === generation) publish({ allowed, saving: false });
      } catch {
        await enqueue(async () => { if (token === generation) await storage.removeItem(AI_CONSENT_KEY); }).catch(() => undefined);
        if (token === generation) publish({ allowed: false, saving: false, error: true });
      }
    },
  };
}
