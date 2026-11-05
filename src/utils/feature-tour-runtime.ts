import type { FeatureTourRect } from './featureTours';

export type FeatureTourTargetHandle = {
  measure: () => Promise<FeatureTourRect | null>;
  reveal?: (current: () => boolean) => Promise<void>;
  /** Only safe navigation/disclosure actions, never workout starts or saves. */
  activate?: () => void;
};

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
async function bounded<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation().catch(() => fallback),
      new Promise<T>(resolve => { timeout = setTimeout(() => resolve(fallback), 250); })]);
  } finally { if (timeout) clearTimeout(timeout); }
}

/** Wait for a real mounted target, reveal its scroll position, then measure it.
 * Native layout callbacks may never arrive: every attempt is bounded and a
 * dismissed/superseded step cannot publish an outline or navigate afterward.
 */
export async function locateFeatureTourTarget(options: {
  prepare?: () => void;
  find: () => FeatureTourTargetHandle | undefined;
  current: () => boolean;
  visible: (rect: FeatureTourRect) => boolean;
  pause?: (milliseconds: number) => Promise<void>;
}): Promise<FeatureTourRect | null> {
  if (!options.current()) return null;
  try { options.prepare?.(); } catch { return null; }
  const pause = options.pause ?? wait;
  for (let attempt = 0; attempt < 8 && options.current(); attempt += 1) {
    const target = options.find();
    if (target) {
      if (target.reveal) await bounded(() => target.reveal!(options.current), undefined);
      if (!options.current()) return null;
      await pause(60);
      if (!options.current()) return null;
      const rect = await bounded(target.measure, null);
      if (!options.current()) return null;
      if (rect && options.visible(rect)) return rect;
    }
    await pause(60);
  }
  return null;
}
