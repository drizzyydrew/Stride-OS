import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import { buildWorkoutInstanceId, synthesizeWorkoutInstanceId } from '../utils/workoutInstance';
import {
  addExercise as addExerciseReducer,
  addSet as addSetReducer,
  duplicateSet as duplicateSetReducer,
  editSet as editSetReducer,
  ensureSessionShape,
  removeExercise as removeExerciseReducer,
  removeSet as removeSetReducer,
  reorderExercise as reorderExerciseReducer,
  skipExercise as skipExerciseReducer,
  substituteExercise as substituteExerciseReducer,
  toggleSetCompleted as toggleSetCompletedReducer,
  toggleSetWarmup as toggleSetWarmupReducer,
  type ActiveSetEntry,
  type ActiveStrengthExercise,
  type ActiveStrengthSession as BaseActiveStrengthSession,
  type AddExerciseInput,
  type BandLevel,
  type EquipmentType,
} from '../utils/strengthSession';

export type { ActiveSetEntry, ActiveStrengthExercise, AddExerciseInput, BandLevel, EquipmentType } from '../utils/strengthSession';

// Which screen a live strength session belongs to — kept here (not in the
// pure strengthSession.ts reducer module) because it's navigation/UI
// concern, not session-data shape.
export type ActiveStrengthSource = 'training_block' | 'preset' | 'custom';

export type ActiveStrengthSession = BaseActiveStrengthSession & { source: ActiveStrengthSource };

// Loose exercise shape accepted by startSession — training_block/preset
// launch sites don't have setEntries/equipmentType yet; ensureSessionShape
// synthesizes them from sets/reps/equipment, exactly like legacy-draft
// rehydrate does below.
export type StartSessionExerciseInput = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  equipment: string[];
  notes?: string;
  equipmentType?: EquipmentType;
  setEntries?: ActiveSetEntry[];
};

type StartSessionInput = {
  source: ActiveStrengthSource;
  workoutId: string;
  workoutName: string;
  plannedDurationMin: number;
  exercises: StartSessionExerciseInput[];
  // Present when launched against a scheduled session (Do My Own Workout) —
  // used to link the finished Activity and drive substitution classification.
  scheduledSessionId?: string;
  scheduledCategory?: string;
  workoutInstanceId?: string;
};

type ActiveStrengthSessionStore = {
  session: ActiveStrengthSession | null;
  completionRequestedAt: number | null;
  startSession: (session: StartSessionInput) => void;
  pause: () => void;
  resume: () => void;
  setExerciseRpe: (exerciseId: string, rpe: number) => void;
  setExerciseLoad: (exerciseId: string, load: string) => void;
  completeExercise: (exerciseId: string) => void;
  uncompleteExercise: (exerciseId: string) => void;
  goToExercise: (index: number) => void;
  requestCompletion: () => void;
  clearCompletionRequest: () => void;
  clearSession: () => void;

  // ── Exercise-level ops (add-as-you-go, substitution, skip, reorder) ──────
  addExercise: (input: AddExerciseInput) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  substituteExercise: (exerciseId: string, replacement: AddExerciseInput) => void;
  skipExercise: (exerciseId: string, skipped?: boolean) => void;

  // ── Set-level ops ─────────────────────────────────────────────────────────
  addSet: (exerciseId: string, template?: Partial<Omit<ActiveSetEntry, 'id'>>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  duplicateSet: (exerciseId: string, setId: string) => void;
  editSet: (exerciseId: string, setId: string, patch: Partial<Omit<ActiveSetEntry, 'id'>>) => void;
  toggleSetWarmup: (exerciseId: string, setId: string, isWarmup?: boolean) => void;
  toggleSetCompleted: (exerciseId: string, setId: string, completed?: boolean) => void;
};

export function activeStrengthElapsedSeconds(session: ActiveStrengthSession | null, now = Date.now()): number {
  if (!session) return 0;
  const currentPause = session.status === 'paused' && session.pausedAt ? now - session.pausedAt : 0;
  return Math.max(0, Math.floor((now - session.startedAt - session.pausedDurationMs - currentPause) / 1000));
}

export const useActiveStrengthSessionStore = create<ActiveStrengthSessionStore>()(
  persist(
    (set, get) => {
      // Every set/exercise op is a no-op when there's no active session, and
      // a pure transform of it otherwise — mirrors the existing pause/resume
      // style used by the actions below.
      const withSession = (fn: (session: ActiveStrengthSession) => ActiveStrengthSession) => {
        const session = get().session;
        if (!session) return;
        set({ session: fn(session) });
      };

      return {
      session: null,
      completionRequestedAt: null,
      startSession: input => {
        const now = Date.now();
        const shaped = ensureSessionShape({ exercises: input.exercises });
        set({
          session: {
            ...input,
            exercises: shaped.exercises,
            currentExerciseIndex: 0,
            completedExerciseIds: [],
            rpeByExercise: {},
            loadByExercise: {},
            startedAt: now,
            pausedAt: null,
            pausedDurationMs: 0,
            status: 'active',
            workoutInstanceId: input.workoutInstanceId ?? buildWorkoutInstanceId(input.workoutId ?? null, now),
          },
          completionRequestedAt: null,
        });
      },
      pause: () => set(state => state.session?.status === 'active'
        ? { session: { ...state.session, status: 'paused', pausedAt: Date.now() } }
        : state),
      resume: () => set(state => {
        if (!state.session || state.session.status !== 'paused') return state;
        const pausedFor = state.session.pausedAt ? Date.now() - state.session.pausedAt : 0;
        return {
          session: {
            ...state.session,
            status: 'active',
            pausedAt: null,
            pausedDurationMs: state.session.pausedDurationMs + pausedFor,
          },
        };
      }),
      setExerciseRpe: (exerciseId, rpe) => set(state => state.session ? ({
        session: {
          ...state.session,
          rpeByExercise: { ...state.session.rpeByExercise, [exerciseId]: Math.max(1, Math.min(10, Math.round(rpe))) },
        },
      }) : state),
      setExerciseLoad: (exerciseId, load) => set(state => state.session ? ({
        session: {
          ...state.session,
          loadByExercise: { ...state.session.loadByExercise, [exerciseId]: load },
        },
      }) : state),
      completeExercise: exerciseId => set(state => {
        if (!state.session) return state;
        const completed = state.session.completedExerciseIds.includes(exerciseId)
          ? state.session.completedExerciseIds
          : [...state.session.completedExerciseIds, exerciseId];
        const nextIndex = state.session.exercises.findIndex((exercise, index) =>
          index > state.session!.currentExerciseIndex && !completed.includes(exercise.id));
        return {
          session: {
            ...state.session,
            completedExerciseIds: completed,
            currentExerciseIndex: nextIndex >= 0 ? nextIndex : state.session.currentExerciseIndex,
          },
        };
      }),
      uncompleteExercise: exerciseId => set(state => state.session ? ({
        session: {
          ...state.session,
          completedExerciseIds: state.session.completedExerciseIds.filter(id => id !== exerciseId),
        },
      }) : state),
      goToExercise: index => set(state => state.session ? ({
        session: {
          ...state.session,
          currentExerciseIndex: Math.max(0, Math.min(state.session.exercises.length - 1, index)),
        },
      }) : state),
      requestCompletion: () => set(state => state.session ? ({ completionRequestedAt: Date.now() }) : state),
      clearCompletionRequest: () => set({ completionRequestedAt: null }),
      clearSession: () => set({ session: null, completionRequestedAt: null }),

      addExercise: input => withSession(session => ({ ...session, ...addExerciseReducer(session, input) })),
      removeExercise: exerciseId => withSession(session => ({ ...session, ...removeExerciseReducer(session, exerciseId) })),
      reorderExercise: (exerciseId, direction) => withSession(session => ({ ...session, ...reorderExerciseReducer(session, exerciseId, direction) })),
      substituteExercise: (exerciseId, replacement) => withSession(session => ({ ...session, ...substituteExerciseReducer(session, exerciseId, replacement) })),
      skipExercise: (exerciseId, skipped) => withSession(session => ({ ...session, ...skipExerciseReducer(session, exerciseId, skipped) })),

      addSet: (exerciseId, template) => withSession(session => ({ ...session, ...addSetReducer(session, exerciseId, template) })),
      removeSet: (exerciseId, setId) => withSession(session => ({ ...session, ...removeSetReducer(session, exerciseId, setId) })),
      duplicateSet: (exerciseId, setId) => withSession(session => ({ ...session, ...duplicateSetReducer(session, exerciseId, setId) })),
      editSet: (exerciseId, setId, patch) => withSession(session => ({ ...session, ...editSetReducer(session, exerciseId, setId, patch) })),
      toggleSetWarmup: (exerciseId, setId, isWarmup) => withSession(session => ({ ...session, ...toggleSetWarmupReducer(session, exerciseId, setId, isWarmup) })),
      toggleSetCompleted: (exerciseId, setId, completed) => withSession(session => ({ ...session, ...toggleSetCompletedReducer(session, exerciseId, setId, completed) })),
      };
    },
    {
      name: 'active-strength-session-v1',
      storage: createAppJSONStorage(),
      partialize: state => ({ session: state.session, completionRequestedAt: state.completionRequestedAt }),
      merge: (persisted, current) => {
        const p = persisted as Partial<ActiveStrengthSessionStore> | undefined;
        let session = p?.session ?? current.session;
        if (session) {
          // Legacy drafts (predating per-set structure) get setEntries/
          // equipmentType synthesized from their sets/reps/equipment —
          // exactly like the old save-time synthesis did, just moved to
          // rehydrate time so it only ever needs to run once.
          session = { ...session, ...ensureSessionShape(session) };
        }
        if (session && !session.workoutInstanceId) {
          session = {
            ...session,
            workoutInstanceId: synthesizeWorkoutInstanceId({
              scheduledSessionId: session.workoutId ?? null,
              startedAtMs: session.startedAt,
            }) ?? buildWorkoutInstanceId(session.workoutId ?? null, session.startedAt ?? Date.now()),
          };
        }
        return { ...current, ...p, session };
      },
    },
  ),
);
