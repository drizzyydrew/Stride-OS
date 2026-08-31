import type { UnitSystem } from '../../store/settingsStore';
import {
  STREAK_HEAT_TIERS,
  STREAK_MILESTONE_DEFINITIONS,
  type StreakHeatTier,
  type StreakMilestoneDefinition,
} from './streakDefinitions';

export type CurrentStreakSummary = {
  days: number;
  heatTier: StreakHeatTier;
  nextMilestone: StreakMilestoneDefinition | null;
  daysRemaining: number;
  progressRatio: number;
  accessibilityLabel: string;
};

export function streakAchievementAccessibilityLabel(
  days: number,
  state: 'earned' | 'locked',
  remainingDays = 0,
  subtitle?: string,
): string {
  if (state === 'earned') {
    return days === 365 && subtitle
      ? `365-day streak achievement. ${subtitle}. Unlocked.`
      : `${days}-day streak achievement. Unlocked.`;
  }
  return `${days}-day streak achievement. Locked. ${Math.max(0, Math.ceil(remainingDays))} days remaining.`;
}

export function currentStreakAccessibilityLabel(summary: CurrentStreakSummary): string {
  const next = summary.nextMilestone
    ? `${summary.daysRemaining} days until ${summary.nextMilestone.thresholdDays}-day milestone.`
    : 'Maximum milestone achieved.';
  return `Current streak, ${summary.days} days. ${summary.heatTier.label} heat tier. ${next}`;
}

export function nextStreakMilestone(days: number): StreakMilestoneDefinition | null {
  return STREAK_MILESTONE_DEFINITIONS.find(definition => days < definition.thresholdDays) ?? null;
}

export function streakProgressRatio(days: number): number {
  const next = nextStreakMilestone(days);
  if (!next) return 1;
  const previous = [...STREAK_MILESTONE_DEFINITIONS]
    .reverse()
    .find(definition => days >= definition.thresholdDays);
  const base = previous?.thresholdDays ?? 0;
  const denominator = Math.max(1, next.thresholdDays - base);
  return Math.max(0, Math.min(1, (days - base) / denominator));
}

export function buildCurrentStreakSummary(days: number): CurrentStreakSummary {
  const safeDays = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
  const heatTier = STREAK_HEAT_TIERS.find(tier => Math.max(1, safeDays) >= tier.minDays && (tier.maxDays === undefined || Math.max(1, safeDays) <= tier.maxDays))
    ?? STREAK_HEAT_TIERS[0]!;
  const nextMilestone = nextStreakMilestone(safeDays);
  const daysRemaining = nextMilestone ? Math.max(0, nextMilestone.thresholdDays - safeDays) : 0;
  const summary: CurrentStreakSummary = {
    days: safeDays,
    heatTier,
    nextMilestone,
    daysRemaining,
    progressRatio: streakProgressRatio(safeDays),
    accessibilityLabel: '',
  };
  return {
    ...summary,
    accessibilityLabel: currentStreakAccessibilityLabel(summary),
  };
}

export function formatStreakRemaining(daysRemaining: number): string {
  const safe = Math.max(0, Math.ceil(daysRemaining));
  return safe === 1 ? '1 day remaining' : `${safe} days remaining`;
}

export function streakProgressCopy(days: number, unitSystem?: UnitSystem): string {
  const summary = buildCurrentStreakSummary(days);
  if (!summary.nextMilestone) return unitSystem === 'metric' ? '365-day milestone achieved' : '365-day milestone achieved';
  return `${summary.daysRemaining} days until ${summary.nextMilestone.thresholdDays}`;
}
