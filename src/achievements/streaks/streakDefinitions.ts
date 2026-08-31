import {
  STREAK_HEAT_COLORS,
  type StreakHeatColorTokens,
  type StreakHeatTokenName,
} from './streakTokens';

export type StreakBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type StreakHeatTier = {
  minDays: number;
  maxDays?: number;
  token: StreakHeatTokenName;
  label: string;
  rangeLabel: string;
};

export type StreakMilestoneDays = 7 | 30 | 50 | 75 | 100 | 150 | 200 | 250 | 300 | 365;

export type StreakMilestoneDefinition = {
  id: string;
  slug: string;
  displayName: string;
  thresholdDays: StreakMilestoneDays;
  milestoneLabel: string;
  badgeText: string;
  subtitle: string;
  tier: number;
  heatTier: StreakHeatTier;
  heatToken: StreakHeatTokenName;
  colors: StreakHeatColorTokens;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  dominantHeatColor: string;
  shareAssetPaths: {
    cleanDark: string;
    overlay: string;
  };
  shareTransparentPngPath: string;
  shareOpaquePngPath: string;
  sortOrder: number;
};

export const STREAK_HEAT_TIERS: StreakHeatTier[] = [
  { minDays: 1, maxDays: 10, token: 'streakHeatGreen', label: 'Ember', rangeLabel: '1 - 10 days' },
  { minDays: 11, maxDays: 50, token: 'streakHeatYellow', label: 'Kindle', rangeLabel: '11 - 50 days' },
  { minDays: 51, maxDays: 100, token: 'streakHeatOrange', label: 'Blaze', rangeLabel: '51 - 100 days' },
  { minDays: 101, maxDays: 150, token: 'streakHeatRedOrange', label: 'Inferno', rangeLabel: '101 - 150 days' },
  { minDays: 151, maxDays: 200, token: 'streakHeatHotPink', label: 'Phoenix', rangeLabel: '151 - 200 days' },
  { minDays: 201, maxDays: 250, token: 'streakHeatViolet', label: 'Violet Flame', rangeLabel: '201 - 250 days' },
  { minDays: 251, maxDays: 300, token: 'streakHeatBlue', label: 'Blue Flame', rangeLabel: '251 - 300 days' },
  { minDays: 301, maxDays: 364, token: 'streakHeatBlueWhite', label: 'White Hot', rangeLabel: '301 - 364 days' },
  { minDays: 365, token: 'streakHeatWhiteHot', label: 'Eternal Flame', rangeLabel: '365+ days' },
];

const SPECIALTY_COPY: Record<StreakMilestoneDays, { id: string; subtitle: string }> = {
  7: { id: 'streak_1_week', subtitle: 'Consistent Start' },
  30: { id: 'streak_30_day', subtitle: 'Dedicated' },
  50: { id: 'streak_50_day', subtitle: 'On Track' },
  75: { id: 'streak_75_day', subtitle: 'Unstoppable' },
  100: { id: 'streak_100_day', subtitle: 'On Fire' },
  150: { id: 'streak_150_day', subtitle: 'Relentless' },
  200: { id: 'streak_200_day', subtitle: 'Phoenix Rising' },
  250: { id: 'streak_250_day', subtitle: 'Legendary' },
  300: { id: 'streak_300_day', subtitle: 'Blue Flame' },
  365: { id: 'streak_365_day', subtitle: 'One Year' },
};

export const STREAK_SPECIALTY_DAYS = [7, 30, 50, 75, 100, 150, 200, 250, 300, 365] as const;

export function streakHeatTierForDays(days: number): StreakHeatTier {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  return STREAK_HEAT_TIERS.find(tier => safeDays >= tier.minDays && (tier.maxDays === undefined || safeDays <= tier.maxDays))
    ?? STREAK_HEAT_TIERS[STREAK_HEAT_TIERS.length - 1]!;
}

export function streakMilestoneSlug(days: number): string {
  return `${days}-day`;
}

export const STREAK_MILESTONE_DEFINITIONS: StreakMilestoneDefinition[] = STREAK_SPECIALTY_DAYS.map((days, index) => {
  const heatTier = streakHeatTierForDays(days);
  const colors = STREAK_HEAT_COLORS[heatTier.token];
  const slug = streakMilestoneSlug(days);
  const copy = SPECIALTY_COPY[days];
  return {
    id: copy.id,
    slug,
    displayName: `${days}-Day Streak`,
    thresholdDays: days,
    milestoneLabel: `${days} days`,
    badgeText: String(days),
    subtitle: copy.subtitle,
    tier: index + 1,
    heatTier,
    heatToken: heatTier.token,
    colors,
    artworkPath: `assets/achievements/streaks/streak-${slug}-unlocked.svg`,
    lockedArtworkPath: `assets/achievements/streaks/streak-${slug}-locked.svg`,
    unlockedPngPath: `assets/achievements/streaks/streak-${slug}-unlocked.png`,
    lockedPngPath: `assets/achievements/streaks/streak-${slug}-locked.png`,
    dominantHeatColor: colors.primary,
    shareAssetPaths: {
      cleanDark: `assets/achievements/streaks/streak-${slug}-opaque.svg`,
      overlay: `assets/achievements/streaks/streak-${slug}-transparent.svg`,
    },
    shareTransparentPngPath: `assets/achievements/streaks/streak-${slug}-transparent.png`,
    shareOpaquePngPath: `assets/achievements/streaks/streak-${slug}-opaque.png`,
    sortOrder: index + 1,
  };
});

export const STREAK_MILESTONE_BY_ID = Object.fromEntries(
  STREAK_MILESTONE_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<string, StreakMilestoneDefinition>;

export function streakDefinitionFromAchievementId(id: string): StreakMilestoneDefinition | null {
  return STREAK_MILESTONE_BY_ID[id] ?? null;
}
