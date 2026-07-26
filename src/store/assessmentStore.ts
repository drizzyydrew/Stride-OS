// ─── Assessment Store ─────────────────────────────────────────────────────────
//
// Persists strength/movement field test results.
// Computation lives in src/utils/assessmentEngine.ts.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AssessmentResult, AssessmentTestKey } from '../types/assessment';
import { getDueTests, getAssessmentRiskFlags, assessmentMovementCapacityScore } from '../utils/assessmentEngine';

type AssessmentStore = {
  results: AssessmentResult[];

  addResult:    (result: Omit<AssessmentResult, 'id'>) => void;
  updateResult: (id: string, patch: Partial<AssessmentResult>) => void;
  deleteResult: (id: string) => void;

  // Queries
  getLatestForTest: (key: AssessmentTestKey) => AssessmentResult | undefined;
  getLatestAll:     () => AssessmentResult[];
  getDueTests:      () => AssessmentTestKey[];
  getRiskFlags:     () => string[];
  getMovementCapacityScore: () => number;
};

export const useAssessmentStore = create<AssessmentStore>()(
  persist(
    (set, get) => ({
      results: [],

      addResult: (partial) => {
        const id = `asr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        set(state => ({ results: [...state.results, { ...partial, id }] }));
      },

      updateResult: (id, patch) =>
        set(state => ({
          results: state.results.map(r => r.id === id ? { ...r, ...patch } : r),
        })),

      deleteResult: (id) =>
        set(state => ({ results: state.results.filter(r => r.id !== id) })),

      getLatestForTest: (key) => {
        const matching = get().results.filter(r => r.testKey === key);
        return matching.sort((a, b) => b.testedAt - a.testedAt)[0];
      },

      getLatestAll: () => {
        const latestByKey = new Map<AssessmentTestKey, AssessmentResult>();
        for (const r of get().results) {
          const prev = latestByKey.get(r.testKey);
          if (!prev || r.testedAt > prev.testedAt) latestByKey.set(r.testKey, r);
        }
        return [...latestByKey.values()];
      },

      getDueTests: () => getDueTests(get().results),

      getRiskFlags: () => getAssessmentRiskFlags(get().getLatestAll()),

      getMovementCapacityScore: () =>
        assessmentMovementCapacityScore(get().getLatestAll()),
    }),
    {
      name:    'assessment-store',
      storage: createAppJSONStorage(),
    },
  ),
);
