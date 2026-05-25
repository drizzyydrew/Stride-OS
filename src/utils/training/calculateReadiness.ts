import type { ReadinessState } from '../../types/training';

// Derives a ReadinessState from the athlete's current fatigue and recovery.
// Net readiness = recovery − fatigue × 0.5.
export function calculateReadiness(
  fatigueScore:  number,
  recoveryScore: number,
): ReadinessState {
  const net = recoveryScore - fatigueScore * 0.5;

  let readinessLabel:       ReadinessState['readinessLabel'];
  let recommendedIntensity: ReadinessState['recommendedIntensity'];

  if (net >= 50) {
    readinessLabel       = 'high';
    recommendedIntensity = 'hard';
  } else if (net >= 25) {
    readinessLabel       = 'moderate';
    recommendedIntensity = 'moderate';
  } else {
    readinessLabel       = 'low';
    recommendedIntensity = net < 10 ? 'recovery' : 'easy';
  }

  return { recoveryScore, fatigueScore, readinessLabel, recommendedIntensity };
}
