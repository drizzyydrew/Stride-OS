import { type ChallengeColorTokenName } from './challengesTokens';

export type ChallengeAchievementId =
  | 'challenge_august_base_builder'
  | 'challenge_september_consistency'
  | 'challenge_winter_strength_block'
  | 'challenge_spring_mileage_build'
  | 'challenge_summer_long_run'
  | 'challenge_elevation_month'
  | 'challenge_5k_month'
  | 'weekly_25k'
  | 'monthly_run_50k'
  | 'monthly_run_100k'
  | 'monthly_run_150k'
  | 'monthly_run_200k'
  | 'strength_run_week_completed'
  | 'recovery_check_in_streak';

export type ChallengeAchievementGlyph =
  | 'augustBaseBuilder'
  | 'septemberConsistency'
  | 'winterStrengthBlock'
  | 'springMileageBuild'
  | 'summerLongRun'
  | 'elevationMonth'
  | 'numericBadge'
  | 'strengthRun'
  | 'recoveryConsistency';

export type ChallengeBadgeState =
  | 'unlocked'
  | 'locked'
  | 'transparent';

export type ChallengeBadgeInputState =
  | ChallengeBadgeState
  | 'share-opaque'
  | 'share-transparent';

export function normalizeChallengeBadgeState(state?: ChallengeBadgeInputState): ChallengeBadgeState {
  if (state === 'locked') return 'locked';
  if (state === 'transparent' || state === 'share-transparent') return 'transparent';
  return 'unlocked';
}

export type ChallengeAchievementDefinition = {
  id: ChallengeAchievementId;
  slug: string;
  title: string;
  compactTitle: string;
  titleLines: readonly string[];
  badgeNumber?: string;
  badgeUnit?: string;
  glyph: ChallengeAchievementGlyph;
  colorToken: ChallengeColorTokenName;
  description: string;
  criteria: string;
  tier: number;
  /** false when this badge re-presents an achievement canonically owned by another family (reused id) — excluded from ACHIEVEMENT_SYSTEM_REGISTRY to avoid duplicate ids. */
  includeInGlobalRegistry: boolean;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
};

function assetPath(slug: string, variant: 'unlocked' | 'locked' | 'transparent', ext: 'svg' | 'png'): string {
  return `assets/achievements/challenges/challenges-${slug}-${variant}.${ext}`;
}

function makeDefinition(
  input: Omit<ChallengeAchievementDefinition, 'artworkPath' | 'lockedArtworkPath' | 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentSvgPath' | 'shareTransparentPngPath'>,
): ChallengeAchievementDefinition {
  return {
    ...input,
    artworkPath: assetPath(input.slug, 'unlocked', 'svg'),
    lockedArtworkPath: assetPath(input.slug, 'locked', 'svg'),
    unlockedPngPath: assetPath(input.slug, 'unlocked', 'png'),
    lockedPngPath: assetPath(input.slug, 'locked', 'png'),
    shareTransparentSvgPath: assetPath(input.slug, 'transparent', 'svg'),
    shareTransparentPngPath: assetPath(input.slug, 'transparent', 'png'),
  };
}

export const CHALLENGE_ACHIEVEMENT_DEFINITIONS: ChallengeAchievementDefinition[] = [
  makeDefinition({
    id: 'challenge_august_base_builder',
    slug: 'august-base-builder',
    title: 'August Base Builder',
    compactTitle: 'August Base',
    titleLines: ['AUGUST', 'BASE BUILDER'],
    glyph: 'augustBaseBuilder',
    colorToken: 'challengeAugust',
    description: 'Build an aerobic base across August.',
    criteria: 'Complete at least three activities in August.',
    tier: 1,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_september_consistency',
    slug: 'september-consistency',
    title: 'September Consistency Challenge',
    compactTitle: 'September',
    titleLines: ['SEPTEMBER', 'CONSISTENCY'],
    glyph: 'septemberConsistency',
    colorToken: 'challengeSeptember',
    description: 'Stay consistent with training across September.',
    criteria: 'Complete at least three activities in September.',
    tier: 2,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_winter_strength_block',
    slug: 'winter-strength-block',
    title: 'Winter Strength Block',
    compactTitle: 'Winter Strength',
    titleLines: ['WINTER', 'STRENGTH BLOCK'],
    glyph: 'winterStrengthBlock',
    colorToken: 'challengeWinter',
    description: 'Keep training through the winter months.',
    criteria: 'Complete at least three activities across December, January, or February.',
    tier: 3,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_spring_mileage_build',
    slug: 'spring-mileage-build',
    title: 'Spring Mileage Build',
    compactTitle: 'Spring Build',
    titleLines: ['SPRING', 'MILEAGE BUILD'],
    glyph: 'springMileageBuild',
    colorToken: 'challengeSpring',
    description: 'Build mileage through the spring months.',
    criteria: 'Complete at least three activities across March, April, or May.',
    tier: 4,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_summer_long_run',
    slug: 'summer-long-run',
    title: 'Summer Long Run Challenge',
    compactTitle: 'Summer Long Run',
    titleLines: ['SUMMER', 'LONG RUN'],
    glyph: 'summerLongRun',
    colorToken: 'challengeSummer',
    description: 'Build long-run endurance through the summer.',
    criteria: 'Complete at least three activities across June, July, or August.',
    tier: 5,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_elevation_month',
    slug: 'elevation-month',
    title: 'Elevation Month',
    compactTitle: 'Elevation Month',
    titleLines: ['ELEVATION', 'MONTH'],
    glyph: 'elevationMonth',
    colorToken: 'challengeElevation',
    description: 'Climb more than any other calendar month.',
    criteria: 'Threshold pending product confirmation — this Challenge is not yet earnable.',
    tier: 6,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'challenge_5k_month',
    slug: '5k-month',
    title: '5K Month',
    compactTitle: '5K Month',
    titleLines: ['5K', 'MONTH'],
    badgeNumber: '5K',
    badgeUnit: 'MONTH',
    glyph: 'numericBadge',
    colorToken: 'challenge5kMonth',
    description: 'Complete 5 kilometers of running within a calendar month.',
    criteria: 'Run at least 5 kilometers total within a calendar month.',
    tier: 7,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'weekly_25k',
    slug: '25k-week',
    title: '25K Week',
    compactTitle: '25K Week',
    titleLines: ['25K', 'WEEK'],
    badgeNumber: '25K',
    badgeUnit: 'WEEK',
    glyph: 'numericBadge',
    colorToken: 'challenge25kWeek',
    description: 'Complete 25 kilometers of running within a reporting week.',
    criteria: 'Same criteria as the canonical Weekly Distance 25K achievement — Challenges presentation only.',
    tier: 8,
    includeInGlobalRegistry: false,
  }),
  makeDefinition({
    id: 'monthly_run_50k',
    slug: '50k-month',
    title: '50K Month',
    compactTitle: '50K Month',
    titleLines: ['50K', 'MONTH'],
    badgeNumber: '50K',
    badgeUnit: 'MONTH',
    glyph: 'numericBadge',
    colorToken: 'challenge50kMonth',
    description: 'Complete 50 kilometers of running within a calendar month.',
    criteria: 'Same criteria as the canonical Monthly Distance 50K achievement — Challenges presentation only.',
    tier: 9,
    includeInGlobalRegistry: false,
  }),
  makeDefinition({
    id: 'monthly_run_100k',
    slug: '100k-month',
    title: '100K Month',
    compactTitle: '100K Month',
    titleLines: ['100K', 'MONTH'],
    badgeNumber: '100K',
    badgeUnit: 'MONTH',
    glyph: 'numericBadge',
    colorToken: 'challenge100kMonth',
    description: 'Complete 100 kilometers of running within a calendar month.',
    criteria: 'Same criteria as the canonical Monthly Distance 100K achievement — Challenges presentation only.',
    tier: 10,
    includeInGlobalRegistry: false,
  }),
  makeDefinition({
    id: 'strength_run_week_completed',
    slug: 'strength-run',
    title: 'Strength + Run Challenge',
    compactTitle: 'Strength + Run',
    titleLines: ['STRENGTH + RUN', 'CHALLENGE'],
    glyph: 'strengthRun',
    colorToken: 'challengeStrengthRun',
    description: 'Pair running and strength training in the same week.',
    criteria: 'Same criteria as the canonical Strength + Run Week achievement — Challenges presentation only.',
    tier: 11,
    includeInGlobalRegistry: false,
  }),
  makeDefinition({
    id: 'recovery_check_in_streak',
    slug: 'recovery-consistency',
    title: 'Recovery Consistency Challenge',
    compactTitle: 'Recovery Consistency',
    titleLines: ['RECOVERY', 'CONSISTENCY'],
    glyph: 'recoveryConsistency',
    colorToken: 'challengeRecovery',
    description: 'Stay consistent with recovery check-ins.',
    criteria: 'Same criteria as the canonical Recovery Check-In Streak achievement — Challenges presentation only.',
    tier: 12,
    includeInGlobalRegistry: false,
  }),
];

// Additional presentations reuse Monthly awards. The legacy 5K ID remains
// addressable and earnable under its existing rule, but is not in this gallery.
export const CHALLENGE_PRESENTATION_DEFINITIONS: ChallengeAchievementDefinition[] = [
  ...CHALLENGE_ACHIEVEMENT_DEFINITIONS.filter(definition => !['challenge_5k_month', 'strength_run_week_completed', 'recovery_check_in_streak'].includes(definition.id)),
  ...([150, 200] as const).map(kilometers => makeDefinition({
    id: `monthly_run_${kilometers}k`,
    slug: `${kilometers}k-month`,
    title: `${kilometers}K Month`,
    compactTitle: `${kilometers}K Month`,
    titleLines: [`${kilometers}K`, 'MONTH'],
    badgeNumber: `${kilometers}K`,
    badgeUnit: 'MONTH',
    glyph: 'numericBadge',
    colorToken: kilometers === 150 ? 'challenge150kMonth' : 'challenge200kMonth',
    description: `Complete ${kilometers} kilometers of running within a calendar month.`,
    criteria: `Same criteria as the canonical Monthly Distance ${kilometers}K achievement — Challenges presentation only.`,
    tier: kilometers === 150 ? 11 : 12,
    includeInGlobalRegistry: false,
  })),
  ...CHALLENGE_ACHIEVEMENT_DEFINITIONS.filter(definition => definition.id === 'strength_run_week_completed' || definition.id === 'recovery_check_in_streak'),
];

export const CHALLENGE_ACHIEVEMENT_BY_ID = Object.fromEntries(
  [...CHALLENGE_ACHIEVEMENT_DEFINITIONS, ...CHALLENGE_PRESENTATION_DEFINITIONS].map(definition => [definition.id, definition]),
) as Record<ChallengeAchievementId, ChallengeAchievementDefinition>;

export const CHALLENGE_REGISTRY_DEFINITIONS = CHALLENGE_ACHIEVEMENT_DEFINITIONS.filter(
  definition => definition.includeInGlobalRegistry,
);

export function challengeAchievementDefinitionFromId(id: string): ChallengeAchievementDefinition | null {
  return id in CHALLENGE_ACHIEVEMENT_BY_ID
    ? CHALLENGE_ACHIEVEMENT_BY_ID[id as ChallengeAchievementId]
    : null;
}
