import {
  MONTHLY_DISTANCE_TIER_COLORS,
  MONTHLY_DISTANCE_TIER_NAMES,
  type MonthlyDistanceColorTokens,
  type MonthlyDistanceTierTokenName,
} from './monthlyDistanceTokens';
import {
  MONTHLY_DISTANCE_KM_THRESHOLDS,
  monthlyDistanceKilometersToMeters,
  monthlyDistanceMilestoneId,
  monthlyDistanceMilestoneSlug,
  type MonthlyDistanceMilestoneKm,
} from './monthlyDistanceThresholds';

export type { MonthlyDistanceMilestoneKm } from './monthlyDistanceThresholds';

export type MonthlyDistanceBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type MonthlyDistanceDefinition = {
  id: `monthly_run_${number}k`;
  slug: `${number}k`;
  thresholdKm: MonthlyDistanceMilestoneKm;
  thresholdMeters: number;
  tier: number;
  tierToken: MonthlyDistanceTierTokenName;
  colors: MonthlyDistanceColorTokens;
  milestoneLabel: `${number}K`;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
  shareOpaqueSvgPath: string;
  shareOpaquePngPath: string;
};

export const MONTHLY_DISTANCE_DEFINITIONS: MonthlyDistanceDefinition[] =
  MONTHLY_DISTANCE_KM_THRESHOLDS.map((kilometers, index) => {
    const tierToken = MONTHLY_DISTANCE_TIER_NAMES[index];
    const slug = monthlyDistanceMilestoneSlug(kilometers);
    return {
      id: monthlyDistanceMilestoneId(kilometers),
      slug,
      thresholdKm: kilometers,
      thresholdMeters: monthlyDistanceKilometersToMeters(kilometers),
      tier: index + 1,
      tierToken,
      colors: MONTHLY_DISTANCE_TIER_COLORS[tierToken],
      milestoneLabel: `${kilometers}K` as `${number}K`,
      artworkPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-unlocked.svg`,
      lockedArtworkPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-locked.svg`,
      unlockedPngPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-unlocked.png`,
      lockedPngPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-locked.png`,
      shareTransparentSvgPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-transparent.svg`,
      shareTransparentPngPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-transparent.png`,
      shareOpaqueSvgPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-opaque.svg`,
      shareOpaquePngPath: `assets/achievements/monthly-distance/monthly-distance-${slug}-opaque.png`,
    };
  });

export const MONTHLY_DISTANCE_BY_ID = Object.fromEntries(
  MONTHLY_DISTANCE_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<MonthlyDistanceDefinition['id'], MonthlyDistanceDefinition>;

export const MONTHLY_DISTANCE_BY_KM = Object.fromEntries(
  MONTHLY_DISTANCE_DEFINITIONS.map(definition => [definition.thresholdKm, definition]),
) as Record<number, MonthlyDistanceDefinition>;

export function monthlyDistanceDefinitionFromId(id: string): MonthlyDistanceDefinition | null {
  return id in MONTHLY_DISTANCE_BY_ID
    ? MONTHLY_DISTANCE_BY_ID[id as MonthlyDistanceDefinition['id']]
    : null;
}
