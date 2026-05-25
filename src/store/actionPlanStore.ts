import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Action IDs are week-scoped ('w{week}_...') so completion state automatically
// becomes irrelevant when currentWeek advances — no pruning needed.

type ActionPlanStore = {
  completedActionIds: string[];
  dismissedActionIds: string[];

  completeAction: (id: string) => void;
  dismissAction:  (id: string) => void;
  isCompleted:    (id: string) => boolean;
  isDismissed:    (id: string) => boolean;
};

export const useActionPlanStore = create<ActionPlanStore>()(
  persist(
    (set, get) => ({
      completedActionIds: [],
      dismissedActionIds: [],

      completeAction: (id) =>
        set(state => ({
          completedActionIds: state.completedActionIds.includes(id)
            ? state.completedActionIds
            : [...state.completedActionIds, id],
        })),

      dismissAction: (id) =>
        set(state => ({
          dismissedActionIds: state.dismissedActionIds.includes(id)
            ? state.dismissedActionIds
            : [...state.dismissedActionIds, id],
        })),

      isCompleted: (id) => get().completedActionIds.includes(id),
      isDismissed: (id) => get().dismissedActionIds.includes(id),
    }),
    {
      name:    'action-plan-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedActionIds: state.completedActionIds,
        dismissedActionIds: state.dismissedActionIds,
      }),
    },
  ),
);
