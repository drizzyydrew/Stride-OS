import {
  LIFETIME_DISTANCE_RUNNING_TIER_COLORS,
  LIFETIME_DISTANCE_RUNNING_TIER_NAMES,
  type LifetimeDistanceRunningColorTokens,
  type LifetimeDistanceRunningTierTokenName,
} from './lifetimeDistanceRunningTokens';
import {
  LIFETIME_DISTANCE_RUNNING_THRESHOLDS_MILES,
  lifetimeRunningMilestoneId,
  lifetimeRunningMilestoneSlug,
  lifetimeRunningMilesToMeters,
  type LifetimeDistanceRunningMilestone,
} from './lifetimeDistanceRunningThresholds';

export type { LifetimeDistanceRunningMilestone } from './lifetimeDistanceRunningThresholds';

export type LifetimeDistanceRunningBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type LifetimeDistanceRunningDefinition = {
  id: `lifetime_run_${string}_mi`;
  slug: string;
  thresholdMiles: LifetimeDistanceRunningMilestone;
  thresholdMeters: number;
  tier: number;
  tierToken: LifetimeDistanceRunningTierTokenName;
  colors: LifetimeDistanceRunningColorTokens;
  milestoneLabel: string;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
  shareOpaqueSvgPath: string;
  shareOpaquePngPath: string;
};

function displayMiles(miles: number): string {
  return miles.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export const LIFETIME_DISTANCE_RUNNING_DEFINITIONS: LifetimeDistanceRunningDefinition[] =
  LIFETIME_DISTANCE_RUNNING_THRESHOLDS_MILES.map((miles, index) => {
    const tierToken = LIFETIME_DISTANCE_RUNNING_TIER_NAMES[index];
    const slug = lifetimeRunningMilestoneSlug(miles);
    return {
      id: lifetimeRunningMilestoneId(miles),
      slug,
      thresholdMiles: miles,
      thresholdMeters: lifetimeRunningMilesToMeters(miles),
      tier: index + 1,
      tierToken,
      colors: LIFETIME_DISTANCE_RUNNING_TIER_COLORS[tierToken],
      milestoneLabel: displayMiles(miles),
      artworkPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-unlocked.svg`,
      lockedArtworkPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-locked.svg`,
      unlockedPngPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-unlocked.png`,
      lockedPngPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-locked.png`,
      shareTransparentSvgPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-transparent.svg`,
      shareTransparentPngPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-transparent.png`,
      shareOpaqueSvgPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-opaque.svg`,
      shareOpaquePngPath: `assets/achievements/lifetime-distance-running/lifetime-run-${slug}-opaque.png`,
    };
  });

export const LIFETIME_DISTANCE_RUNNING_BY_ID = Object.fromEntries(
  LIFETIME_DISTANCE_RUNNING_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<LifetimeDistanceRunningDefinition['id'], LifetimeDistanceRunningDefinition>;

export const LIFETIME_DISTANCE_RUNNING_BY_MILESTONE = Object.fromEntries(
  LIFETIME_DISTANCE_RUNNING_DEFINITIONS.map(definition => [definition.thresholdMiles, definition]),
) as Record<number, LifetimeDistanceRunningDefinition>;

export function lifetimeDistanceRunningDefinitionFromId(id: string): LifetimeDistanceRunningDefinition | null {
  return id in LIFETIME_DISTANCE_RUNNING_BY_ID
    ? LIFETIME_DISTANCE_RUNNING_BY_ID[id as LifetimeDistanceRunningDefinition['id']]
    : null;
}
