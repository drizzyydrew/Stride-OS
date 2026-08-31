export type StrengthAchievementId =
  | 'first_strength_session'
  | 'strength_10_sessions'
  | 'strength_25_sessions'
  | 'strength_50_sessions'
  | 'strength_100_sessions'
  | 'strength_6_weeks_consistent'
  | 'strength_12_weeks_consistent'
  | 'strength_run_week_completed'
  | 'first_structured_workout'
  | 'prehab_resilience_block';

export type StrengthAchievementGlyph =
  | 'sessionDumbbell'
  | 'consistentWeeks'
  | 'strengthRunWeek'
  | 'structuredWorkout'
  | 'prehabResilience';

export type StrengthAchievementBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type StrengthAchievementDefinition = {
  id: StrengthAchievementId;
  slug: string;
  title: string;
  compactTitle: string;
  titleLines: readonly string[];
  badgeNumber?: string;
  badgeUnit?: string;
  glyph: StrengthAchievementGlyph;
  description: string;
  criteria: string;
  threshold: number;
  thresholdUnit: 'sessions' | 'weeks' | 'count';
  unitBehavior: 'count' | 'weeks';
  ruleKind: 'strength_count' | 'strength_consistency' | 'strength_run_week' | 'first' | 'prehab_resilience';
  sportApplicability: readonly string[];
  tier: number;
  includeInGlobalRegistry: boolean;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
  shareOpaqueSvgPath: string;
  shareOpaquePngPath: string;
};

function assetPath(slug: string, variant: 'unlocked' | 'locked' | 'transparent' | 'opaque', ext: 'svg' | 'png'): string {
  return `assets/achievements/strength/strength-${slug}-${variant}.${ext}`;
}

function makeDefinition(
  input: Omit<StrengthAchievementDefinition, 'artworkPath' | 'lockedArtworkPath' | 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentSvgPath' | 'shareTransparentPngPath' | 'shareOpaqueSvgPath' | 'shareOpaquePngPath'>,
): StrengthAchievementDefinition {
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

export const STRENGTH_ACHIEVEMENT_DEFINITIONS: StrengthAchievementDefinition[] = [
  makeDefinition({
    id: 'first_strength_session',
    slug: 'first-strength-session',
    title: 'First Strength Session',
    compactTitle: 'First Strength',
    titleLines: ['FIRST STRENGTH', 'SESSION'],
    glyph: 'sessionDumbbell',
    description: 'Complete your first qualifying strength session.',
    criteria: 'Complete one qualifying strength workout.',
    threshold: 1,
    thresholdUnit: 'sessions',
    unitBehavior: 'count',
    ruleKind: 'strength_count',
    sportApplicability: ['strength'],
    tier: 1,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_10_sessions',
    slug: '10-sessions',
    title: '10 Strength Sessions',
    compactTitle: '10 Sessions',
    titleLines: ['SESSIONS'],
    badgeNumber: '10',
    badgeUnit: 'SESSIONS',
    glyph: 'sessionDumbbell',
    description: 'Complete 10 strength sessions.',
    criteria: 'Complete 10 qualifying strength workouts.',
    threshold: 10,
    thresholdUnit: 'sessions',
    unitBehavior: 'count',
    ruleKind: 'strength_count',
    sportApplicability: ['strength'],
    tier: 2,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_25_sessions',
    slug: '25-sessions',
    title: '25 Strength Sessions',
    compactTitle: '25 Sessions',
    titleLines: ['SESSIONS'],
    badgeNumber: '25',
    badgeUnit: 'SESSIONS',
    glyph: 'sessionDumbbell',
    description: 'Complete 25 strength sessions.',
    criteria: 'Complete 25 qualifying strength workouts.',
    threshold: 25,
    thresholdUnit: 'sessions',
    unitBehavior: 'count',
    ruleKind: 'strength_count',
    sportApplicability: ['strength'],
    tier: 3,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_50_sessions',
    slug: '50-sessions',
    title: '50 Strength Sessions',
    compactTitle: '50 Sessions',
    titleLines: ['SESSIONS'],
    badgeNumber: '50',
    badgeUnit: 'SESSIONS',
    glyph: 'sessionDumbbell',
    description: 'Complete 50 strength sessions.',
    criteria: 'Complete 50 qualifying strength workouts.',
    threshold: 50,
    thresholdUnit: 'sessions',
    unitBehavior: 'count',
    ruleKind: 'strength_count',
    sportApplicability: ['strength'],
    tier: 4,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_100_sessions',
    slug: '100-sessions',
    title: '100 Strength Sessions',
    compactTitle: '100 Sessions',
    titleLines: ['SESSIONS'],
    badgeNumber: '100',
    badgeUnit: 'SESSIONS',
    glyph: 'sessionDumbbell',
    description: 'Complete 100 strength sessions.',
    criteria: 'Complete 100 qualifying strength workouts.',
    threshold: 100,
    thresholdUnit: 'sessions',
    unitBehavior: 'count',
    ruleKind: 'strength_count',
    sportApplicability: ['strength'],
    tier: 5,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_6_weeks_consistent',
    slug: '6-weeks-consistent',
    title: '6 Weeks Consistent Strength',
    compactTitle: '6 Weeks Strong',
    titleLines: ['6 WEEKS', 'STRONG'],
    badgeNumber: '6',
    badgeUnit: 'TOTAL',
    glyph: 'consistentWeeks',
    description: 'Complete strength training across six consistent weeks.',
    criteria: 'Meet the canonical strength consistency requirement for six weeks.',
    threshold: 6,
    thresholdUnit: 'weeks',
    unitBehavior: 'weeks',
    ruleKind: 'strength_consistency',
    sportApplicability: ['strength'],
    tier: 6,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_12_weeks_consistent',
    slug: '12-weeks-consistent',
    title: '12 Weeks Consistent Strength',
    compactTitle: '12 Weeks Strong',
    titleLines: ['12 WEEKS', 'STRONG'],
    badgeNumber: '12',
    badgeUnit: 'TOTAL',
    glyph: 'consistentWeeks',
    description: 'Complete strength training across twelve consistent weeks.',
    criteria: 'Meet the canonical strength consistency requirement for twelve weeks.',
    threshold: 12,
    thresholdUnit: 'weeks',
    unitBehavior: 'weeks',
    ruleKind: 'strength_consistency',
    sportApplicability: ['strength'],
    tier: 7,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'strength_run_week_completed',
    slug: 'strength-run-week',
    title: 'Strength + Run Week',
    compactTitle: 'Strength + Run',
    titleLines: ['STRENGTH + RUN', 'WEEK'],
    glyph: 'strengthRunWeek',
    description: 'Complete running and strength in the same canonical training week.',
    criteria: 'Complete at least one qualifying run and one qualifying strength workout in the same canonical week.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    ruleKind: 'strength_run_week',
    sportApplicability: ['running', 'strength'],
    tier: 8,
    includeInGlobalRegistry: true,
  }),
  makeDefinition({
    id: 'first_structured_workout',
    slug: 'first-structured-workout',
    title: 'First Structured Workout',
    compactTitle: 'Structured',
    titleLines: ['FIRST STRUCTURED', 'WORKOUT'],
    glyph: 'structuredWorkout',
    description: 'Complete your first structured workout.',
    criteria: 'Complete a workout with a scheduled or interval/block structure.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    ruleKind: 'first',
    sportApplicability: ['running', 'walking', 'cycling', 'strength', 'mobility'],
    tier: 9,
    includeInGlobalRegistry: false,
  }),
  makeDefinition({
    id: 'prehab_resilience_block',
    slug: 'prehab-resilience',
    title: 'Prehab & Resilience',
    compactTitle: 'Prehab',
    titleLines: ['PREHAB &', 'RESILIENCE'],
    glyph: 'prehabResilience',
    description: 'Complete a prehab or resilience block.',
    criteria: 'Complete a canonical prehab, resilience, mobility, or stability-focused block.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    ruleKind: 'prehab_resilience',
    sportApplicability: ['strength', 'mobility', 'recovery'],
    tier: 10,
    includeInGlobalRegistry: true,
  }),
];

export const STRENGTH_REGISTRY_DEFINITIONS = STRENGTH_ACHIEVEMENT_DEFINITIONS.filter(
  definition => definition.includeInGlobalRegistry,
);

export const STRENGTH_ACHIEVEMENT_BY_ID = Object.fromEntries(
  STRENGTH_ACHIEVEMENT_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<StrengthAchievementId, StrengthAchievementDefinition>;

export function strengthAchievementDefinitionFromId(id: string): StrengthAchievementDefinition | null {
  return id in STRENGTH_ACHIEVEMENT_BY_ID
    ? STRENGTH_ACHIEVEMENT_BY_ID[id as StrengthAchievementId]
    : null;
}
