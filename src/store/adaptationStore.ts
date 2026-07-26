import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import type { AdaptationResult } from '../types/adaptation';
import {
  serializeConfirmedAdaptations,
  type AdaptationPreview,
  type ConfirmedAdaptation,
} from '../utils/adaptationWorkflow';

// Persists one AdaptationResult per training week, keyed by "w{weekNumber}".
// The Training and Today screens call getAdaptation(week) on every render;
// if an adaptation exists they display adapted workouts, otherwise the canonical plan.
// Adaptations are recomputed explicitly (via the Training screen's "Adapt" button)
// so the athlete sees a stable plan for the week — changes don't flicker as
// physiological scores shift day-to-day.

type AdaptationStore = {
  schemaVersion: 2;
  adaptations: Record<string, AdaptationResult>;
  /** Unconfirmed plans are review-only and never affect the schedule. */
  previews: Record<string, AdaptationPreview | undefined>;
  /** One confirmed, replayable overlay set per canonical week key. */
  confirmed: Record<string, ConfirmedAdaptation | undefined>;
  /** Append-only audit records; replacing a week does not rewrite history. */
  auditHistory: ConfirmedAdaptation[];

  setAdaptation:   (week: number, result: AdaptationResult) => void;
  clearAdaptation: (week: number) => void;
  getAdaptation:   (week: number) => AdaptationResult | undefined;
  setPreview: (preview: AdaptationPreview) => void;
  clearPreview: (weekKey: string) => void;
  confirmPreview: (weekKey: string, confirmedAt?: number) => ConfirmedAdaptation | null;
  clearConfirmed: (weekKey: string) => void;
  getConfirmed: (weekKey: string) => ConfirmedAdaptation | undefined;
};

export const ADAPTATION_STORE_VERSION = 2;

export const useAdaptationStore = create<AdaptationStore>()(
  persist(
    (set, get) => ({
      schemaVersion: ADAPTATION_STORE_VERSION,
      adaptations: {},
      previews: {},
      confirmed: {},
      auditHistory: [],

      setAdaptation: (week, result) =>
        set(state => ({
          adaptations: { ...state.adaptations, [`w${week}`]: result },
        })),

      clearAdaptation: (week) =>
        set(state => {
          const next = { ...state.adaptations };
          delete next[`w${week}`];
          return { adaptations: next };
        }),

      getAdaptation: (week) => get().adaptations[`w${week}`],

      setPreview: preview => set(state => ({
        previews: { ...state.previews, [preview.weekKey]: preview },
      })),

      clearPreview: weekKey => set(state => {
        const previews = { ...state.previews };
        delete previews[weekKey];
        return { previews };
      }),

      confirmPreview: (weekKey, confirmedAt = Date.now()) => {
        const preview = get().previews[weekKey];
        if (!preview || preview.conflicts.length > 0) return null;
        const confirmed: ConfirmedAdaptation = {
          ...preview,
          confirmedAt,
          confirmation: 'confirmed',
        };
        set(state => {
          const previews = { ...state.previews };
          delete previews[weekKey];
          return {
            previews,
            confirmed: { ...state.confirmed, [weekKey]: confirmed },
            auditHistory: [...state.auditHistory, confirmed],
          };
        });
        return confirmed;
      },

      clearConfirmed: weekKey => set(state => {
        const confirmed = { ...state.confirmed };
        delete confirmed[weekKey];
        return { confirmed };
      }),

      getConfirmed: weekKey => get().confirmed[weekKey],
    }),
    {
      name:    'adaptation-store',
      version: ADAPTATION_STORE_VERSION,
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        schemaVersion: ADAPTATION_STORE_VERSION,
        adaptations: state.adaptations,
        previews: state.previews,
        confirmed: state.confirmed,
        auditHistory: state.auditHistory,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AdaptationStore> | undefined;
        const confirmed = serializeConfirmedAdaptations(saved?.confirmed);
        const auditHistory = Array.isArray(saved?.auditHistory)
          ? saved.auditHistory.filter(item => item?.confirmation === 'confirmed')
          : [];
        return {
          ...current,
          ...saved,
          schemaVersion: ADAPTATION_STORE_VERSION,
          adaptations: saved?.adaptations ?? {},
          previews: saved?.previews ?? {},
          confirmed,
          auditHistory,
        };
      },
    },
  ),
);
