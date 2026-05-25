import type { CompletedWorkoutRecord } from '../../types/training';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ACWRResult = {
  acute:   number;   // average daily load over last 7 days
  chronic: number;   // average daily load over last 42 days
  acwr:    number;   // acute / chronic ratio
};

// Computes ATL / CTL / ACWR from real completion history.
// Falls back to ratio 1.0 (neutral) when chronic history is absent.
export function calculateACWR(history: CompletedWorkoutRecord[]): ACWRResult {
  const now    = Date.now();
  const last7  = history.filter(r => now - r.timestamp <=  7 * DAY_MS);
  const last42 = history.filter(r => now - r.timestamp <= 42 * DAY_MS);

  const acute   = last7.length  === 0 ? 0
    : last7.reduce((s, r)  => s + r.estimatedLoad, 0) / 7;

  const chronic = last42.length === 0 ? 0
    : last42.reduce((s, r) => s + r.estimatedLoad, 0) / 42;

  const acwr = chronic === 0 ? 1.0 : acute / chronic;

  return {
    acute:   Math.round(acute   * 10) / 10,
    chronic: Math.round(chronic * 10) / 10,
    acwr:    Math.round(acwr    * 100) / 100,
  };
}
