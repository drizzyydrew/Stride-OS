import type { ReadinessInputs } from '../types/readiness';

const SCALE_MIN = 1;
const SCALE_MAX = 5;

// Sleep quality, energy, motivation, and training willingness raise readiness
// directly. Stress and soreness are inverted before averaging since a higher
// value there means worse readiness. All six inputs are weighted equally.
export function calculateReadinessScore(inputs: ReadinessInputs): number {
  const invert = (v: number) => SCALE_MIN + SCALE_MAX - v;
  const values = [
    inputs.sleepQuality,
    inputs.energy,
    inputs.motivation,
    inputs.trainingWillingness,
    invert(inputs.stress),
    invert(inputs.soreness),
  ];
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const score = Math.round(((avg - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100);
  return Math.max(0, Math.min(100, score));
}

export type ReadinessTier = 'high' | 'moderate' | 'low';

export function readinessTier(score: number): ReadinessTier {
  if (score >= 75) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

export const READINESS_INTERPRETATION: Record<ReadinessTier, { label: string; message: string }> = {
  high:     { label: 'HIGH',     message: 'Proceed as planned.' },
  moderate: { label: 'MODERATE', message: 'Modify if needed.' },
  low:      { label: 'LOW',      message: 'Recovery recommended.' },
};
