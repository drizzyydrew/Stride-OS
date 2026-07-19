import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ActiveStrengthSource = 'training_block' | 'preset';

export type ActiveStrengthExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  equipment: string[];
  notes?: string;
};

export type ActiveStrengthSession = {
  source: ActiveStrengthSource;
  workoutId: string;
  workoutName: string;
  plannedDurationMin: number;
  exercises: ActiveStrengthExercise[];
  currentExerciseIndex: number;
  completedExerciseIds: string[];
  rpeByExercise: Record<string, number>;
  loadByExercise: Record<string, string>;
  startedAt: number;
  pausedAt: number | null;
  pausedDurationMs: number;
  status: 'active' | 'paused';
};

type ActiveStrengthSessionStore = {
  session: ActiveStrengthSession | null;
  completionRequestedAt: number | null;
  startSession: (session: Omit<ActiveStrengthSession, 'currentExerciseIndex' | 'completedExerciseIds' | 'rpeByExercise' | 'loadByExercise' | 'startedAt' | 'pausedAt' | 'pausedDurationMs' | 'status'>) => void;
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
};

export function activeStrengthElapsedSeconds(session: ActiveStrengthSession | null, now = Date.now()): number {
  if (!session) return 0;
  const currentPause = session.status === 'paused' && session.pausedAt ? now - session.pausedAt : 0;
  return Math.max(0, Math.floor((now - session.startedAt - session.pausedDurationMs - currentPause) / 1000));
}

export const useActiveStrengthSessionStore = create<ActiveStrengthSessionStore>()(
  persist(
    set => ({
      session: null,
      completionRequestedAt: null,
      startSession: input => set({
        session: {
          ...input,
          currentExerciseIndex: 0,
          completedExerciseIds: [],
          rpeByExercise: {},
          loadByExercise: {},
          startedAt: Date.now(),
          pausedAt: null,
          pausedDurationMs: 0,
          status: 'active',
        },
        completionRequestedAt: null,
      }),
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
    }),
    {
      name: 'active-strength-session-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ session: state.session, completionRequestedAt: state.completionRequestedAt }),
    },
  ),
);
