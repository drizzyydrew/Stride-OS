import type { StateStorage } from 'zustand/middleware';

// ─── Hydration-safe storage ──────────────────────────────────────────────────
//
// zustand's persist middleware writes the whole store on EVERY change, even
// when loading the saved copy failed. After a reboot, iOS keeps app files
// encrypted until the first unlock; if the app is woken in the background
// before that (e.g. by queued Apple Watch messages), every read fails, the
// stores stay at their empty defaults, and the next change used to write
// those defaults over the athlete's real history. That wiped all training
// data once (Build 90).
//
// Rules enforced here, for every persisted store:
// 1. A key is never written until it has been read successfully (value or a
//    genuine "no data yet"). Writes before that are dropped, never persisted.
// 2. A failed read is retried until the data becomes readable, so hydration
//    completes with the real saved data instead of giving up.

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const RETRY_DELAYS_MS = [250, 500, 1000, 2000];

export type HydrationSafeStorage = StateStorage & {
  getItemOnce: (key: string) => Promise<string | null>;
  isKeyReadable: (key: string) => boolean;
  droppedWriteCount: (key: string) => number;
};

export function createHydrationSafeStorage(
  base: Storage,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): HydrationSafeStorage {
  const readable = new Set<string>();
  const dropped = new Map<string, number>();

  async function readWithRetry(key: string): Promise<string | null> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const value = await base.getItem(key);
        readable.add(key);
        return value;
      } catch {
        // Protected data unavailable (device locked since boot) or a transient
        // I/O failure: keep waiting rather than hydrating with empty defaults.
        await wait(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!);
      }
    }
  }

  return {
    getItem: key => readWithRetry(key),
    getItemOnce: async key => {
      if (!readable.has(key)) throw new Error('Saved data has not been read safely; unlock the device and retry');
      return base.getItem(key);
    },
    setItem: async (key, value) => {
      if (!readable.has(key)) {
        dropped.set(key, (dropped.get(key) ?? 0) + 1);
        return;
      }
      await base.setItem(key, value);
    },
    removeItem: async key => {
      if (!readable.has(key)) return;
      await base.removeItem(key);
    },
    isKeyReadable: key => readable.has(key),
    droppedWriteCount: key => dropped.get(key) ?? 0,
  };
}
