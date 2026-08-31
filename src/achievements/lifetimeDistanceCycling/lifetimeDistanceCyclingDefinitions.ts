import {
  LIFETIME_DISTANCE_CYCLING_TIER_COLORS,
  LIFETIME_DISTANCE_CYCLING_TIER_NAMES,
  type LifetimeDistanceCyclingColorTokens,
  type LifetimeDistanceCyclingTierTokenName,
} from './lifetimeDistanceCyclingTokens';
import {
  LIFETIME_DISTANCE_CYCLING_THRESHOLDS_MILES,
  lifetimeCyclingMilestoneId,
  lifetimeCyclingMilestoneSlug,
  lifetimeCyclingMilesToMeters,
  type LifetimeDistanceCyclingMilestone,
} from './lifetimeDistanceCyclingThresholds';

export type { LifetimeDistanceCyclingMilestone } from './lifetimeDistanceCyclingThresholds';

export type LifetimeDistanceCyclingBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type LifetimeDistanceCyclingDefinition = {
  id: `lifetime_cycle_${string}_mi`;
  slug: string;
  thresholdMiles: LifetimeDistanceCyclingMilestone;
  thresholdMeters: number;
  tier: number;
  tierToken: LifetimeDistanceCyclingTierTokenName;
  colors: LifetimeDistanceCyclingColorTokens;
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

export const LIFETIME_DISTANCE_CYCLING_DEFINITIONS: LifetimeDistanceCyclingDefinition[] =
  LIFETIME_DISTANCE_CYCLING_THRESHOLDS_MILES.map((miles, index) => {
    const tierToken = LIFETIME_DISTANCE_CYCLING_TIER_NAMES[index];
    const slug = lifetimeCyclingMilestoneSlug(miles);
    return {
      id: lifetimeCyclingMilestoneId(miles),
      slug,
      thresholdMiles: miles,
      thresholdMeters: lifetimeCyclingMilesToMeters(miles),
      tier: index + 1,
      tierToken,
      colors: LIFETIME_DISTANCE_CYCLING_TIER_COLORS[tierToken],
      milestoneLabel: displayMiles(miles),
      artworkPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-unlocked.svg`,
      lockedArtworkPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-locked.svg`,
      unlockedPngPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-unlocked.png`,
      lockedPngPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-locked.png`,
      shareTransparentSvgPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-transparent.svg`,
      shareTransparentPngPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-transparent.png`,
      shareOpaqueSvgPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-opaque.svg`,
      shareOpaquePngPath: `assets/achievements/lifetime-distance-cycling/lifetime-cycle-${slug}-opaque.png`,
    };
  });

export const LIFETIME_DISTANCE_CYCLING_BY_ID = Object.fromEntries(
  LIFETIME_DISTANCE_CYCLING_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<LifetimeDistanceCyclingDefinition['id'], LifetimeDistanceCyclingDefinition>;

export const LIFETIME_DISTANCE_CYCLING_BY_MILESTONE = Object.fromEntries(
  LIFETIME_DISTANCE_CYCLING_DEFINITIONS.map(definition => [definition.thresholdMiles, definition]),
) as Record<number, LifetimeDistanceCyclingDefinition>;

export function lifetimeDistanceCyclingDefinitionFromId(id: string): LifetimeDistanceCyclingDefinition | null {
  return id in LIFETIME_DISTANCE_CYCLING_BY_ID
    ? LIFETIME_DISTANCE_CYCLING_BY_ID[id as LifetimeDistanceCyclingDefinition['id']]
    : null;
}
