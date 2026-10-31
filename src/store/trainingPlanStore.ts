// ─── Training Plan Store ────────────────────────────────────────────────────
//
// Persists the athlete's goal type, program start date, and race calendar.
// This is the anchor for the macro planner (src/utils/plan/macroPlanner.ts):
// every derived week number and phase comes from `programStartDate` + `races`,
// never from a manually-advanced counter.
//
// Migration note: existing users (pre-Build 33) get `ensureInitialized()`
// called once from the tabs layout with inferred defaults so their derived
// `currentWeek` lines up with `athleteStore.currentWeek` (both = 1) and
// existing completion keys (`w1_…`) keep matching.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getAppStorage } from './persistStorage';
import { ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';

import type { TrainingGoalType, Race } from '../types/plan';
import type { ActivePresetGoal, GeneratedBeginnerPlan } from '../types/beginnerPlan';

function uid(): string {
  return `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

let writes: Promise<unknown> = Promise.resolve();
function serializeWrite<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work);
  writes = next.catch(() => undefined);
  return next;
}
const planStorage = createJSONStorage(() => ({
  getItem: (key: string) => getAppStorage().getItem(key),
  // Explicit saves below surface failures; automatic middleware writes must not
  // create unhandled rejections while those saves perform their own readback.
  setItem: (key: string, value: string) => serializeWrite(async () => { await getAppStorage().setItem(key, value); }).catch(() => undefined),
  removeItem: (key: string) => serializeWrite(async () => { await getAppStorage().removeItem(key); }),
}));

type TrainingPlanState = {
  goalType:          TrainingGoalType;
  programStartDate:  string | null;
  races:             Race[];
  activePresetGoal:  ActivePresetGoal | null;
  activePresetPlan: GeneratedBeginnerPlan | null;
  initialized:       boolean;
  trainingMode: 'structured' | 'open';
  goalBlockId: string | null;
  goalTitle: string | null;
  goalEndDate: string | null;
  goalRaceId: string | null;
  programmingStartedAt: number | null;
  pendingArchiveId: string | null;
  revision: number;
  lastTransitionId: string | null;
  beginGoal: (goal: { goalType: TrainingGoalType; title: string; startDate: string; endDate: string; race?: Omit<Race, 'id'> }) => void;
  retireBlock: (archiveId: string, expectedRevision: number) => void;
  continueOpen: () => void;

  setGoalType:         (goalType: TrainingGoalType) => void;
  setProgramStartDate: (date: string) => void;
  addRace:             (race: Omit<Race, 'id'>) => string;
  updateRace:          (id: string, patch: Partial<Omit<Race, 'id'>>) => void;
  removeRace:          (id: string) => void;
  setActivePresetGoal: (goal: ActivePresetGoal) => void;
  clearActivePresetGoal: () => void;

  // Sets goalType/programStartDate ONLY if not already initialized, then
  // marks initialized. Safe to call on every launch — no-op after first run.
  ensureInitialized: (defaults: { goalType: TrainingGoalType; programStartDate: string }) => void;
};

type GoalChoice = Parameters<TrainingPlanState['beginGoal']>[0];
function goalChoicePatch(state: TrainingPlanState, goal: GoalChoice): Partial<TrainingPlanState> {
  const race = goal.race ? { ...goal.race, id: uid() } : null;
  return {
    goalType: goal.goalType, programStartDate: goal.startDate,
    goalTitle: goal.title, goalEndDate: goal.endDate, goalRaceId: race?.id ?? null,
    programmingStartedAt: Date.now(), goalBlockId: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    trainingMode: 'structured', activePresetGoal: null, activePresetPlan: null, pendingArchiveId: null,
    initialized: true, revision: state.revision + 1,
    races: race ? [...state.races, race] : state.races,
  };
}

export const useTrainingPlanStore = create<TrainingPlanState>()(
  persist(
    (set, get) => ({
      goalType:         'general_running',
      programStartDate: null,
      races:            [],
      activePresetGoal: null,
      activePresetPlan: null,
      initialized:      false,
      trainingMode: 'structured',
      goalBlockId: null,
      goalTitle: null,
      goalEndDate: null,
      goalRaceId: null,
      programmingStartedAt: null,
      pendingArchiveId: null,
      revision: 0,
      lastTransitionId: null,

      beginGoal: goal => set(state => goalChoicePatch(state, goal)),
      // The coordinator has confirmed the archive on disk before retiring it.
      retireBlock: (archiveId, expectedRevision) => set(state => state.revision === expectedRevision
        ? { trainingMode: 'open', pendingArchiveId: archiveId, revision: state.revision + 1 }
        : {}),
      continueOpen: () => set(state => ({ trainingMode: 'open', pendingArchiveId: null, revision: state.revision + 1 })),

      setGoalType: (goalType) => set(state => ({ goalType, trainingMode: 'structured', goalBlockId: null, goalRaceId: null, goalTitle: null, goalEndDate: null, activePresetGoal: null, programmingStartedAt: Date.now(), pendingArchiveId: null, revision: state.revision + 1 })),
      setProgramStartDate: (date) => set(state => ({ programStartDate: date, revision: state.revision + 1 })),

      addRace: (race) => {
        const id = uid();
        set(state => ({ races: [...state.races, { ...race, id }], revision: state.revision + 1 }));
        return id;
      },

      updateRace: (id, patch) =>
        set(state => ({
          races: state.races.map(r => r.id === id ? { ...r, ...patch } : r),
          revision: state.revision + 1,
        })),

      removeRace: (id) =>
        set(state => ({ races: state.races.filter(r => r.id !== id), revision: state.revision + 1 })),

      setActivePresetGoal: (activePresetGoal) => set(state => ({ activePresetGoal, activePresetPlan: null, trainingMode: 'structured', goalBlockId: null, goalRaceId: null, goalTitle: null, goalEndDate: null, programmingStartedAt: Date.now(), pendingArchiveId: null, revision: state.revision + 1 })),

      // Clearing a goal intentionally affects only future goal programming.
      // Completed activity, readiness, analytics, and workout history live in
      // their own persisted stores and are never removed here.
      clearActivePresetGoal: () => set(state => ({ activePresetGoal: null, activePresetPlan: null, revision: state.revision + 1 })),

      ensureInitialized: (defaults) => {
        if (get().initialized) return;
        set({
          goalType:         defaults.goalType,
          programStartDate: defaults.programStartDate,
          initialized:      true,
        });
      },
    }),
    {
      name:    'training-plan-store',
      storage: planStorage,
      merge: (persisted, current) => {
        const state = persisted as Partial<TrainingPlanState> | undefined;
        return {
          ...current,
          ...state,
          goalType:         state?.goalType         ?? current.goalType,
          programStartDate: state?.programStartDate ?? current.programStartDate,
          races:            state?.races             ?? current.races,
          activePresetGoal: state?.activePresetGoal  ?? current.activePresetGoal,
          initialized:      state?.initialized       ?? current.initialized,
          trainingMode: state?.trainingMode === 'open' ? 'open' : 'structured',
          revision: Number.isSafeInteger(state?.revision) ? state!.revision! : 0,
        };
      },
    },
  ),
);

/** Confirm explicit goal choices without touching any workout/history store. */
export async function persistTrainingPlanChanges(lease: OwnerLease): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const revision = await serializeWrite(async () => {
      if (!ownerLeaseIsCurrent(lease) || !useTrainingPlanStore.persist.hasHydrated()) throw new Error('Training settings are not ready for this account');
      const state = useTrainingPlanStore.getState();
      const encoded = JSON.stringify({ state, version: 0 });
      const storage = getAppStorage();
      await storage.setItem('training-plan-store', encoded);
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the goal');
      const saved = await (storage.getItemOnce ? storage.getItemOnce('training-plan-store') : storage.getItem('training-plan-store'));
      if (!ownerLeaseIsCurrent(lease) || saved !== encoded) throw new Error('Goal save could not be confirmed. Please retry.');
      return state.revision;
    });
    if (useTrainingPlanStore.getState().revision === revision) return;
  }
  throw new Error('Training settings changed while saving. Please retry.');
}

/** Stage choices on disk before publishing them. Retrying a failed save therefore
 * cannot mistake its uncommitted draft for another completed/abandoned block. */
export async function saveTrainingPlanChoice(lease: OwnerLease,
  choice: GoalChoice | { beginner: ActivePresetGoal; plan: GeneratedBeginnerPlan; startDate: string } | { open: true },
  stillCurrent: () => boolean = () => true, transitionId?: string): Promise<void> {
  await serializeWrite(async () => {
    if (!ownerLeaseIsCurrent(lease) || !stillCurrent() || !useTrainingPlanStore.persist.hasHydrated()) throw new Error('Training choice is not ready to save');
    if ('beginner' in choice && (choice.plan.id !== choice.beginner.planId || choice.plan.startDate !== choice.startDate
      || choice.plan.targetDate !== choice.beginner.targetDate)) throw new Error('Beginner path and active goal must identify the same saved plan');
    const previous = useTrainingPlanStore.getState();
    const patch: Partial<TrainingPlanState> = 'open' in choice
      ? { trainingMode: 'open', pendingArchiveId: null, revision: previous.revision + 1 }
      : 'beginner' in choice ? {
      // Pointer and complete prescription are one durable record. The legacy
      // beginner store is only a compatibility cache, never a second authority.
      activePresetGoal: choice.beginner, activePresetPlan: choice.plan, programStartDate: choice.startDate,
      goalType: 'general_running',
      trainingMode: 'structured', goalBlockId: null, goalRaceId: null, goalTitle: null, goalEndDate: null,
      programmingStartedAt: previous.activePresetGoal?.planId === choice.plan.id ? previous.programmingStartedAt : Date.now(), pendingArchiveId: null, revision: previous.revision + 1,
    } : goalChoicePatch(previous, choice);
    const candidate = { ...previous, ...patch, lastTransitionId: transitionId ?? previous.lastTransitionId };
    const encoded = JSON.stringify({ state: candidate, version: 0 });
    const storage = getAppStorage();
    await storage.setItem('training-plan-store', encoded);
    if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while saving the goal');
    const saved = await storage.getItemOnce('training-plan-store');
    if (!ownerLeaseIsCurrent(lease) || saved !== encoded) throw new Error('Goal save could not be confirmed. Please retry.');
    if (!stillCurrent() || useTrainingPlanStore.getState().revision !== previous.revision) {
      // Restore only this owner's unchanged source. Concurrent edits are queued
      // behind us and retain their own write; no other account is published.
      if (ownerLeaseIsCurrent(lease) && useTrainingPlanStore.getState().revision === previous.revision) {
        await storage.setItem('training-plan-store', JSON.stringify({ state: previous, version: 0 }));
      }
      throw new Error('Training changed while saving. Please retry.');
    }
    useTrainingPlanStore.setState(candidate);
  });
}

/** Recover only a recorded transition, never adopt arbitrary disk state or methods. */
export async function recoverTrainingPlanChoice(transitionId: string, lease: OwnerLease,
  stillCurrent: () => boolean): Promise<boolean> {
  return serializeWrite(async () => {
    if (!ownerLeaseIsCurrent(lease) || !stillCurrent()) return false;
    const raw = await getAppStorage().getItemOnce('training-plan-store');
    if (!ownerLeaseIsCurrent(lease) || !stillCurrent()) return false;
    if (!raw) return false;
    const candidate = JSON.parse(raw)?.state as Partial<TrainingPlanState> | undefined;
    const current = useTrainingPlanStore.getState();
    if (candidate?.lastTransitionId !== transitionId || !Number.isSafeInteger(candidate.revision)
      || candidate.revision! < current.revision) return false;
    if (!['open', 'structured'].includes(candidate.trainingMode!) || !Array.isArray(candidate.races)
      || (candidate.activePresetPlan && candidate.activePresetGoal?.planId !== candidate.activePresetPlan.id)) throw new Error('Saved training transition is inconsistent; history was retained');
    if (current.lastTransitionId !== transitionId) {
      const fields = ['goalType', 'programStartDate', 'races', 'activePresetGoal', 'activePresetPlan', 'initialized',
        'trainingMode', 'goalBlockId', 'goalTitle', 'goalEndDate', 'goalRaceId', 'programmingStartedAt',
        'pendingArchiveId', 'revision', 'lastTransitionId'] as const;
      useTrainingPlanStore.setState(Object.fromEntries(fields.map(field => [field, candidate[field]])));
    }
    return true;
  });
}
