import {
  WEEKLY_DISTANCE_TIER_COLORS,
  WEEKLY_DISTANCE_TIER_NAMES,
  type WeeklyDistanceColorTokens,
  type WeeklyDistanceTierTokenName,
} from './weeklyDistanceTokens';
import {
  WEEKLY_DISTANCE_KM_THRESHOLDS,
  weeklyDistanceKilometersToMeters,
  weeklyDistanceMilestoneId,
  weeklyDistanceMilestoneSlug,
  type WeeklyDistanceMilestoneKm,
} from './weeklyDistanceThresholds';

export type { WeeklyDistanceMilestoneKm } from './weeklyDistanceThresholds';

export type WeeklyDistanceBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type WeeklyDistanceDefinition = {
  id: `weekly_${number}k`;
  slug: `${number}k`;
  thresholdKm: WeeklyDistanceMilestoneKm;
  thresholdMeters: number;
  tier: number;
  tierToken: WeeklyDistanceTierTokenName;
  colors: WeeklyDistanceColorTokens;
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

export const WEEKLY_DISTANCE_DEFINITIONS: WeeklyDistanceDefinition[] =
  WEEKLY_DISTANCE_KM_THRESHOLDS.map((kilometers, index) => {
    const tierToken = WEEKLY_DISTANCE_TIER_NAMES[index];
    const slug = weeklyDistanceMilestoneSlug(kilometers);
    return {
      id: weeklyDistanceMilestoneId(kilometers),
      slug,
      thresholdKm: kilometers,
      thresholdMeters: weeklyDistanceKilometersToMeters(kilometers),
      tier: index + 1,
      tierToken,
      colors: WEEKLY_DISTANCE_TIER_COLORS[tierToken],
      milestoneLabel: `${kilometers}K` as `${number}K`,
      artworkPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-unlocked.svg`,
      lockedArtworkPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-locked.svg`,
      unlockedPngPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-unlocked.png`,
      lockedPngPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-locked.png`,
      shareTransparentSvgPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-transparent.svg`,
      shareTransparentPngPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-transparent.png`,
      shareOpaqueSvgPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-opaque.svg`,
      shareOpaquePngPath: `assets/achievements/weekly-distance/weekly-distance-${slug}-opaque.png`,
    };
  });

export const WEEKLY_DISTANCE_BY_ID = Object.fromEntries(
  WEEKLY_DISTANCE_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<WeeklyDistanceDefinition['id'], WeeklyDistanceDefinition>;

export const WEEKLY_DISTANCE_BY_KM = Object.fromEntries(
  WEEKLY_DISTANCE_DEFINITIONS.map(definition => [definition.thresholdKm, definition]),
) as Record<number, WeeklyDistanceDefinition>;

export function weeklyDistanceDefinitionFromId(id: string): WeeklyDistanceDefinition | null {
  return id in WEEKLY_DISTANCE_BY_ID
    ? WEEKLY_DISTANCE_BY_ID[id as WeeklyDistanceDefinition['id']]
    : null;
}
