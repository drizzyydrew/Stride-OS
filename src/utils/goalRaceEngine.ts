// ─── Goal Race Engine ─────────────────────────────────────────────────────────
//
// Maps onboarding goal selections to the goalRace string used throughout the app.
// The goalRace string is matched by workoutGenerator.matchRaceProfile() for pace zones.
// Non-race goals fall back to the DEFAULT_PROFILE in workoutGenerator (generic pacing).

import type { GoalType } from '../store/onboardingStore';
import type { StandardDistance } from '../types/athlete';

// ─── Build a canonical goalRace string from onboarding inputs ─────────────────

export function buildGoalRaceLabel(
  primaryGoal:   GoalType,
  goalRaceLabel: string,
  prDistance?:   StandardDistance | null,
  prTimeSeconds?: number,
): string {
  // If user entered a custom race label, use it
  if (goalRaceLabel.trim()) return goalRaceLabel.trim();

  // Otherwise derive from primaryGoal
  switch (primaryGoal) {
    case 'marathon':          return 'Marathon Training';
    case 'half_marathon':     return 'Half Marathon Training';
    case '10k':               return '10K Training';
    case '5k':                return '5K Training';
    case 'general_fitness':   return 'General Fitness';
    case 'health':            return 'Run for Health';
    case 'return_to_running': return 'Return to Running';
    default:                  return 'Run Training';
  }
}

// ─── User-facing goal headline for the Running screen ─────────────────────────

export function goalHeadline(goalRace: string, primaryGoal?: GoalType): string {
  if (primaryGoal === 'general_fitness') return 'General Fitness';
  if (primaryGoal === 'health')          return 'Run for Health';
  if (primaryGoal === 'return_to_running') return 'Return to Running';
  return goalRace;
}

// ─── Weekly focus description per goal type ────────────────────────────────────

export function weeklyFocusLabel(primaryGoal?: GoalType): string {
  switch (primaryGoal) {
    case 'marathon':
    case 'half_marathon':     return 'Race-specific aerobic development';
    case '10k':
    case '5k':                return 'Speed-endurance and threshold work';
    case 'general_fitness':   return 'Consistent aerobic base building';
    case 'health':            return 'Comfortable aerobic activity';
    case 'return_to_running': return 'Gradual load reintroduction';
    default:                  return 'Structured aerobic training';
  }
}
