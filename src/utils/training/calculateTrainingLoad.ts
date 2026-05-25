import type { WorkoutIntensity } from '../../types/training';

// TSS-analog: duration × intensity factor.
// Produces a dimensionless load score comparable across workout types.
const INTENSITY_FACTOR: Record<WorkoutIntensity, number> = {
  rest:      0,
  very_easy: 0.40,
  easy:      0.70,
  moderate:  1.00,
  hard:      1.35,
  max:       1.70,
};

export function calculateTrainingLoad(
  durationMinutes: number,
  intensity:       WorkoutIntensity,
): number {
  return Math.round(durationMinutes * INTENSITY_FACTOR[intensity]);
}
