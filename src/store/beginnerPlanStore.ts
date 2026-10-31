import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getAppStorage } from './persistStorage';
import { ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';

import type { GeneratedBeginnerPlan } from '../types/beginnerPlan';
import { repeatBeginnerWeek } from '../utils/beginnerPlans';

type BeginnerPlanStore = {
  schemaVersion: 2;
  activePlan: GeneratedBeginnerPlan | null;
  setActivePlan: (plan: GeneratedBeginnerPlan) => void;
  repeatWeek: (sourceWeekNumber: number) => void;
  clearFuturePlan: () => void;
};

let writes: Promise<unknown> = Promise.resolve();
function serializeWrite<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work);
  writes = next.catch(() => undefined);
  return next;
}
const beginnerStorage = createJSONStorage(() => ({
  getItem: (key: string) => getAppStorage().getItem(key),
  setItem: (key: string, value: string) => serializeWrite(async () => { await getAppStorage().setItem(key, value); }).catch(() => undefined),
  removeItem: (key: string) => serializeWrite(async () => { await getAppStorage().removeItem(key); }),
}));

export const useBeginnerPlanStore = create<BeginnerPlanStore>()(
  persist(
    set => ({
      schemaVersion: 2,
      activePlan: null,
      setActivePlan: activePlan => set({ activePlan }),
      repeatWeek: sourceWeekNumber => set(state => ({
        activePlan: state.activePlan
          ? repeatBeginnerWeek(state.activePlan, sourceWeekNumber)
          : null,
      })),
      clearFuturePlan: () => set({ activePlan: null }),
    }),
    {
      name: 'beginner-plan-store',
      version: 2,
      storage: beginnerStorage,
      merge: (persisted, current) => {
        const saved = persisted as Partial<BeginnerPlanStore> | undefined;
        const savedPlan = saved?.activePlan as (GeneratedBeginnerPlan & { completionGoal?: GeneratedBeginnerPlan['completionGoal'] }) | null | undefined;
        return {
          ...current,
          ...saved,
          schemaVersion: 2,
          activePlan: savedPlan
            ? {
              ...savedPlan,
              completionGoal: savedPlan.completionGoal ?? 'complete_distance',
              adaptationAudit: Array.isArray(savedPlan.adaptationAudit) ? savedPlan.adaptationAudit : [],
            }
            : null,
        };
      },
    },
  ),
);

export async function saveBeginnerPlanChoice(plan: GeneratedBeginnerPlan | null, lease: OwnerLease,
  stillCurrent: () => boolean = () => true): Promise<void> {
  await serializeWrite(async () => {
    if (!ownerLeaseIsCurrent(lease) || !stillCurrent() || !useBeginnerPlanStore.persist.hasHydrated()) throw new Error('Beginner path is not ready to save');
    const previous = useBeginnerPlanStore.getState().activePlan;
    const encoded = JSON.stringify({ state: { schemaVersion: 2, activePlan: plan }, version: 2 });
    const storage = getAppStorage();
    await storage.setItem('beginner-plan-store', encoded);
    if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the beginner path');
    const saved = await storage.getItemOnce('beginner-plan-store');
    if (!ownerLeaseIsCurrent(lease) || saved !== encoded) throw new Error('Beginner path save could not be confirmed. Please retry.');
    if (!stillCurrent() || useBeginnerPlanStore.getState().activePlan !== previous) {
      if (ownerLeaseIsCurrent(lease) && useBeginnerPlanStore.getState().activePlan === previous) {
        await storage.setItem('beginner-plan-store', JSON.stringify({ state: { schemaVersion: 2, activePlan: previous }, version: 2 }));
      }
      throw new Error('Training changed while saving the beginner path. Please retry.');
    }
    useBeginnerPlanStore.setState({ activePlan: plan });
  });
}
