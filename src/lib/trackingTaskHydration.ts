type PersistedStore = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
};

export function waitForPersistedStoreHydration(
  store: PersistedStore,
  timeoutMs = 2_000,
): Promise<boolean> {
  if (store.persist.hasHydrated()) return Promise.resolve(true);

  return new Promise(resolve => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (hydrated: boolean) => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      clearTimeout(timer);
      resolve(hydrated);
    };

    timer = setTimeout(() => finish(store.persist.hasHydrated()), timeoutMs);
    unsubscribe = store.persist.onFinishHydration(() => finish(true));
  });
}
