import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';
import {
  completedTourStatus,
  getFeatureTour,
  skippedTourStatus,
  type FeatureTourId,
  type FeatureTourStatus,
} from '../utils/featureTours';
import { recordFeatureTourEvent } from '../utils/featureTourEvents';

type FeatureTourState = {
  tourStatus: Partial<Record<FeatureTourId, FeatureTourStatus>>;
  replayRequests: Partial<Record<FeatureTourId, number>>;
  markCompleted: (tourId: FeatureTourId) => void;
  markSkipped: (tourId: FeatureTourId) => void;
  requestReplay: (tourId: FeatureTourId) => void;
  consumeReplay: (tourId: FeatureTourId) => void;
  resetTour: (tourId: FeatureTourId) => void;
};

export const useFeatureTourStore = create<FeatureTourState>()(
  persist(
    (set, get) => ({
      tourStatus: {},
      replayRequests: {},
      markCompleted: (tourId) => {
        const tour = getFeatureTour(tourId);
        set(state => ({
          tourStatus: {
            ...state.tourStatus,
            [tourId]: completedTourStatus(tour),
          },
        }));
        recordFeatureTourEvent({
          name: 'feature_tour_completed',
          tourId,
          tourVersion: tour.version,
        });
      },
      markSkipped: (tourId) => {
        const tour = getFeatureTour(tourId);
        set(state => ({
          tourStatus: {
            ...state.tourStatus,
            [tourId]: skippedTourStatus(tour),
          },
        }));
        recordFeatureTourEvent({
          name: 'feature_tour_skipped',
          tourId,
          tourVersion: tour.version,
        });
      },
      requestReplay: (tourId) => {
        const tour = getFeatureTour(tourId);
        set(state => ({
          replayRequests: {
            ...state.replayRequests,
            [tourId]: Date.now(),
          },
        }));
        recordFeatureTourEvent({
          name: 'feature_tour_replayed',
          tourId,
          tourVersion: tour.version,
          entrySource: 'manual',
        });
      },
      consumeReplay: (tourId) => {
        const requests = { ...get().replayRequests };
        delete requests[tourId];
        set({ replayRequests: requests });
      },
      resetTour: (tourId) => {
        const status = { ...get().tourStatus };
        const requests = { ...get().replayRequests };
        delete status[tourId];
        delete requests[tourId];
        set({ tourStatus: status, replayRequests: requests });
      },
    }),
    {
      name: 'feature-tour-store',
      storage: createAppJSONStorage(),
      partialize: state => ({
        tourStatus: state.tourStatus,
        replayRequests: state.replayRequests,
      }),
    },
  ),
);
