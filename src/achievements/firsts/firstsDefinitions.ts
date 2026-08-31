import type { UnitSystem } from '../../store/settingsStore';

export type FirstAchievementId =
  | 'first_activity'
  | 'first_run'
  | 'first_walk'
  | 'first_run_walk'
  | 'first_ride'
  | 'first_mobility_workout'
  | 'first_5k'
  | 'first_10k'
  | 'first_half_marathon'
  | 'first_marathon'
  | 'first_route_completed'
  | 'first_structured_workout'
  | 'first_adapted_workout'
  | 'first_strength_workout'
  | 'first_movement_lab_analysis';

export type FirstAchievementGlyph =
  | 'journey'
  | 'run'
  | 'walk'
  | 'runWalk'
  | 'ride'
  | 'mobility'
  | 'race5k'
  | 'race10k'
  | 'halfMarathon'
  | 'marathon'
  | 'route'
  | 'structured'
  | 'adapted'
  | 'strength'
  | 'movementLab';

export type FirstAchievementBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type FirstAchievementDefinition = {
  id: FirstAchievementId;
  slug: string;
  title: string;
  compactTitle: string;
  titleLines: readonly string[];
  glyph: FirstAchievementGlyph;
  description: string;
  criteria: string;
  threshold: number;
  thresholdUnit: 'meters' | 'count';
  unitBehavior: 'count' | 'fixed_k_identity' | 'race_distance_class';
  sportApplicability: readonly string[];
  tier: number;
  shieldLabel?: (units: UnitSystem) => string;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
  shareOpaqueSvgPath: string;
  shareOpaquePngPath: string;
};

const M_PER_MI = 1609.344;
const M_PER_KM = 1000;

function assetPath(slug: string, variant: 'unlocked' | 'locked' | 'transparent' | 'opaque', ext: 'svg' | 'png'): string {
  return `assets/achievements/firsts/firsts-${slug}-${variant}.${ext}`;
}

function makeDefinition(
  input: Omit<FirstAchievementDefinition, 'artworkPath' | 'lockedArtworkPath' | 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentSvgPath' | 'shareTransparentPngPath' | 'shareOpaqueSvgPath' | 'shareOpaquePngPath'>,
): FirstAchievementDefinition {
  return {
    ...input,
    artworkPath: assetPath(input.slug, 'unlocked', 'svg'),
    lockedArtworkPath: assetPath(input.slug, 'locked', 'svg'),
    unlockedPngPath: assetPath(input.slug, 'unlocked', 'png'),
    lockedPngPath: assetPath(input.slug, 'locked', 'png'),
    shareTransparentSvgPath: assetPath(input.slug, 'transparent', 'svg'),
    shareTransparentPngPath: assetPath(input.slug, 'transparent', 'png'),
    shareOpaqueSvgPath: assetPath(input.slug, 'opaque', 'svg'),
    shareOpaquePngPath: assetPath(input.slug, 'opaque', 'png'),
  };
}

export const FIRST_ACHIEVEMENT_DEFINITIONS: FirstAchievementDefinition[] = [
  makeDefinition({
    id: 'first_activity',
    slug: 'first-activity',
    title: 'First Activity',
    compactTitle: 'Activity',
    titleLines: ['FIRST ACTIVITY'],
    glyph: 'journey',
    description: 'Complete your first valid StrideOS activity.',
    criteria: 'Complete any supported canonical activity.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running', 'walking', 'cycling', 'strength', 'mobility'],
    tier: 1,
  }),
  makeDefinition({
    id: 'first_run',
    slug: 'first-run',
    title: 'First Run',
    compactTitle: 'Run',
    titleLines: ['FIRST RUN'],
    glyph: 'run',
    description: 'Complete your first run.',
    criteria: 'Complete a qualifying running activity.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running'],
    tier: 2,
  }),
  makeDefinition({
    id: 'first_walk',
    slug: 'first-walk',
    title: 'First Walk',
    compactTitle: 'Walk',
    titleLines: ['FIRST WALK'],
    glyph: 'walk',
    description: 'Complete your first walk.',
    criteria: 'Complete a qualifying walking activity.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['walking'],
    tier: 3,
  }),
  makeDefinition({
    id: 'first_run_walk',
    slug: 'first-run-walk',
    title: 'First Run/Walk',
    compactTitle: 'Run/Walk',
    titleLines: ['FIRST RUN/WALK'],
    glyph: 'runWalk',
    description: 'Complete your first run/walk session.',
    criteria: 'Complete a run/walk activity or structured run/walk workout.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running', 'walking'],
    tier: 4,
  }),
  makeDefinition({
    id: 'first_ride',
    slug: 'first-ride',
    title: 'First Ride',
    compactTitle: 'Ride',
    titleLines: ['FIRST RIDE'],
    glyph: 'ride',
    description: 'Complete your first ride.',
    criteria: 'Complete a qualifying cycling activity.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['cycling', 'indoor_cycling'],
    tier: 5,
  }),
  makeDefinition({
    id: 'first_mobility_workout',
    slug: 'first-mobility-workout',
    title: 'First Mobility Workout',
    compactTitle: 'Mobility',
    titleLines: ['FIRST MOBILITY', 'WORKOUT'],
    glyph: 'mobility',
    description: 'Complete your first mobility workout.',
    criteria: 'Complete a qualifying mobility workout.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['mobility'],
    tier: 6,
  }),
  makeDefinition({
    id: 'first_5k',
    slug: 'first-5k',
    title: 'First 5K',
    compactTitle: '5K',
    titleLines: ['FIRST 5K'],
    glyph: 'race5k',
    description: 'Complete your first 5K.',
    criteria: 'Complete one qualifying run of at least 5K.',
    threshold: 5 * M_PER_KM,
    thresholdUnit: 'meters',
    unitBehavior: 'fixed_k_identity',
    sportApplicability: ['running'],
    tier: 7,
    shieldLabel: () => '5K',
  }),
  makeDefinition({
    id: 'first_10k',
    slug: 'first-10k',
    title: 'First 10K',
    compactTitle: '10K',
    titleLines: ['FIRST 10K'],
    glyph: 'race10k',
    description: 'Complete your first 10K.',
    criteria: 'Complete one qualifying run of at least 10K.',
    threshold: 10 * M_PER_KM,
    thresholdUnit: 'meters',
    unitBehavior: 'fixed_k_identity',
    sportApplicability: ['running'],
    tier: 8,
    shieldLabel: () => '10K',
  }),
  makeDefinition({
    id: 'first_half_marathon',
    slug: 'first-half-marathon',
    title: 'First Half Marathon',
    compactTitle: 'Half Marathon',
    titleLines: ['FIRST HALF', 'MARATHON'],
    glyph: 'halfMarathon',
    description: 'Complete your first half marathon.',
    criteria: 'Complete one qualifying run of at least half-marathon distance.',
    threshold: 13.1094 * M_PER_MI,
    thresholdUnit: 'meters',
    unitBehavior: 'race_distance_class',
    sportApplicability: ['running'],
    tier: 9,
    shieldLabel: units => units === 'metric' ? '21.1' : '13.1',
  }),
  makeDefinition({
    id: 'first_marathon',
    slug: 'first-marathon',
    title: 'First Marathon',
    compactTitle: 'Marathon',
    titleLines: ['FIRST MARATHON'],
    glyph: 'marathon',
    description: 'Complete your first marathon.',
    criteria: 'Complete one qualifying run of at least marathon distance.',
    threshold: 26.2188 * M_PER_MI,
    thresholdUnit: 'meters',
    unitBehavior: 'race_distance_class',
    sportApplicability: ['running'],
    tier: 10,
    shieldLabel: units => units === 'metric' ? '42.2' : '26.2',
  }),
  makeDefinition({
    id: 'first_route_completed',
    slug: 'first-route-completed',
    title: 'First Route Completed',
    compactTitle: 'Route',
    titleLines: ['FIRST ROUTE', 'COMPLETED'],
    glyph: 'route',
    description: 'Complete your first saved or planned route.',
    criteria: 'Complete an activity linked to a saved route or usable route trace.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running', 'walking', 'cycling'],
    tier: 11,
  }),
  makeDefinition({
    id: 'first_structured_workout',
    slug: 'first-structured-workout',
    title: 'First Structured Workout',
    compactTitle: 'Structured',
    titleLines: ['FIRST STRUCTURED', 'WORKOUT'],
    glyph: 'structured',
    description: 'Complete your first structured workout.',
    criteria: 'Complete a workout with a scheduled or interval/block structure.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running', 'walking', 'cycling', 'strength', 'mobility'],
    tier: 12,
  }),
  makeDefinition({
    id: 'first_adapted_workout',
    slug: 'first-adapted-workout',
    title: 'First Adapted Workout',
    compactTitle: 'Adapted',
    titleLines: ['FIRST ADAPTED', 'WORKOUT'],
    glyph: 'adapted',
    description: 'Complete your first adapted workout.',
    criteria: 'Complete a deliberately modified, adapted, partial, or equivalent substitute workout.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['running', 'walking', 'cycling', 'strength', 'mobility'],
    tier: 13,
  }),
  makeDefinition({
    id: 'first_strength_workout',
    slug: 'first-strength-workout',
    title: 'First Strength Workout',
    compactTitle: 'Strength',
    titleLines: ['FIRST STRENGTH', 'WORKOUT'],
    glyph: 'strength',
    description: 'Complete your first strength workout.',
    criteria: 'Complete a qualifying strength workout.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['strength'],
    tier: 14,
  }),
  makeDefinition({
    id: 'first_movement_lab_analysis',
    slug: 'first-movement-lab-analysis',
    title: 'First Movement Lab Analysis',
    compactTitle: 'Movement Lab',
    titleLines: ['FIRST MOVEMENT', 'LAB ANALYSIS'],
    glyph: 'movementLab',
    description: 'Complete your first Movement Lab analysis.',
    criteria: 'Save a completed Movement Lab assessment or analysis.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    sportApplicability: ['movement_lab'],
    tier: 15,
  }),
];

export const FIRST_ACHIEVEMENT_BY_ID = Object.fromEntries(
  FIRST_ACHIEVEMENT_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<FirstAchievementId, FirstAchievementDefinition>;

export function firstAchievementDefinitionFromId(id: string): FirstAchievementDefinition | null {
  return id in FIRST_ACHIEVEMENT_BY_ID
    ? FIRST_ACHIEVEMENT_BY_ID[id as FirstAchievementId]
    : null;
}
