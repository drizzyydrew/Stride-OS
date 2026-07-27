import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import type { RecalculationDecisionSnapshot } from '../utils/training/recalculationDecisionSnapshot';
import type { TrainingOutlook } from '../utils/trainingOutlook';

export type RecalculationStatus = 'idle' | 'running' | 'success' | 'error';

export type RecalculationSummary = {
  acute: number;
  chronic: number;
  acwr: number;
};

type RecalculationStore = {
  lastRunAt: number | null;
  status: RecalculationStatus;
  error?: string;
  lastReason?: string;
  lastAcute?: number;
  lastChronic?: number;
  lastAcwr?: number;
  decisionSnapshot?: RecalculationDecisionSnapshot;
  trainingOutlook?: TrainingOutlook;
  begin: (reason: string) => void;
  succeed: (summary?: RecalculationSummary, decisionSnapshot?: RecalculationDecisionSnapshot, trainingOutlook?: TrainingOutlook) => void;
  fail: (error: string) => void;
};

export const useRecalculationStore = create<RecalculationStore>()(
  persist(
    set => ({
      lastRunAt: null,
      status: 'idle',
      error: undefined,
      lastReason: undefined,
      lastAcute: undefined,
      lastChronic: undefined,
      lastAcwr: undefined,
      decisionSnapshot: undefined,
      trainingOutlook: undefined,

      begin: reason => set({ status: 'running', lastReason: reason, error: undefined }),

      succeed: (summary, decisionSnapshot, trainingOutlook) => set({
        status: 'success',
        lastRunAt: Date.now(),
        error: undefined,
        ...(summary ? { lastAcute: summary.acute, lastChronic: summary.chronic, lastAcwr: summary.acwr } : {}),
        ...(decisionSnapshot ? { decisionSnapshot } : {}),
        ...(trainingOutlook ? { trainingOutlook } : {}),
      }),

      fail: error => set({ status: 'error', lastRunAt: Date.now(), error }),
    }),
    {
      name: 'recalculation-store',
      version: 1,
      storage: createAppJSONStorage(),
      partialize: state => ({
        lastRunAt: state.lastRunAt,
        // A run that was interrupted mid-flight (app killed) should not
        // persist as permanently "running" — the next launch treats it as
        // idle rather than showing a stuck spinner state forever.
        status: state.status === 'running' ? 'idle' : state.status,
        error: state.error,
        lastReason: state.lastReason,
        lastAcute: state.lastAcute,
        lastChronic: state.lastChronic,
        lastAcwr: state.lastAcwr,
        decisionSnapshot: state.decisionSnapshot,
        trainingOutlook: state.trainingOutlook,
      }),
    },
  ),
);
