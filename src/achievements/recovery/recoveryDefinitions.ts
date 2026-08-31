export type RecoveryAchievementId =
  | 'recovery_week_completed'
  | 'recovery_sleep_consistency'
  | 'recovery_smart_rest_day'
  | 'recovery_readiness_respected'
  | 'recovery_symptoms_reported_early'
  | 'recovery_check_in_streak'
  | 'recovery_returned_gradually';

export type RecoveryAchievementGlyph =
  | 'recoveryWeek'
  | 'sleepCycle'
  | 'smartRest'
  | 'readinessHammock'
  | 'symptomsSignal'
  | 'checkInRipples'
  | 'returnedGradually';

export type RecoveryAchievementBadgeState =
  | 'unlocked'
  | 'locked'
  | 'share-transparent'
  | 'share-opaque';

export type RecoveryProgressKind = 'binary' | 'days' | 'nights' | 'checkIns';

export type RecoveryAchievementDefinition = {
  id: RecoveryAchievementId;
  slug: string;
  title: string;
  compactTitle: string;
  titleLines: readonly string[];
  glyph: RecoveryAchievementGlyph;
  description: string;
  criteria: string;
  lockedCopy: string;
  threshold: number;
  thresholdUnit: 'days' | 'count';
  unitBehavior: 'days' | 'count';
  progressKind: RecoveryProgressKind;
  sportApplicability: readonly string[];
  tier: number;
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
  return `assets/achievements/recovery/recovery-${slug}-${variant}.${ext}`;
}

function makeDefinition(
  input: Omit<RecoveryAchievementDefinition, 'artworkPath' | 'lockedArtworkPath' | 'unlockedPngPath' | 'lockedPngPath' | 'shareTransparentSvgPath' | 'shareTransparentPngPath' | 'shareOpaqueSvgPath' | 'shareOpaquePngPath'>,
): RecoveryAchievementDefinition {
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

export const RECOVERY_ACHIEVEMENT_DEFINITIONS: RecoveryAchievementDefinition[] = [
  makeDefinition({
    id: 'recovery_week_completed',
    slug: 'week-completed',
    title: 'Recovery Week Completed',
    compactTitle: 'Recovery Week',
    titleLines: ['RECOVERY WEEK', 'COMPLETED'],
    glyph: 'recoveryWeek',
    description: 'Complete a week with recovery work respected.',
    criteria: 'Complete a canonical recovery or deload week behavior.',
    lockedCopy: 'Complete a recovery week.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    progressKind: 'binary',
    sportApplicability: ['mobility', 'recovery', 'scheduled_training'],
    tier: 1,
  }),
  makeDefinition({
    id: 'recovery_sleep_consistency',
    slug: 'sleep-consistency',
    title: 'Sleep Consistency Achieved',
    compactTitle: 'Sleep Consistency',
    titleLines: ['SLEEP CONSISTENCY', 'ACHIEVED'],
    glyph: 'sleepCycle',
    description: 'Log consistent sleep data across seven nights.',
    criteria: 'Log seven consecutive nights with sleep data.',
    lockedCopy: 'Log consistent sleep check-ins.',
    threshold: 7,
    thresholdUnit: 'days',
    unitBehavior: 'days',
    progressKind: 'nights',
    sportApplicability: ['readiness', 'recovery'],
    tier: 2,
  }),
  makeDefinition({
    id: 'recovery_smart_rest_day',
    slug: 'smart-rest-day',
    title: 'Smart Rest Day',
    compactTitle: 'Smart Rest',
    titleLines: ['SMART REST DAY'],
    glyph: 'smartRest',
    description: 'Respect a planned or appropriate rest day.',
    criteria: 'Respect a planned rest, recovery, taper, or deload day.',
    lockedCopy: 'Respect a planned rest day.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    progressKind: 'binary',
    sportApplicability: ['scheduled_training', 'recovery'],
    tier: 3,
  }),
  makeDefinition({
    id: 'recovery_readiness_respected',
    slug: 'readiness-respected',
    title: 'Readiness Respected',
    compactTitle: 'Readiness',
    titleLines: ['READINESS', 'RESPECTED'],
    glyph: 'readinessHammock',
    description: 'Use readiness feedback to adapt training appropriately.',
    criteria: 'Complete an approved modified, partial, or equivalent-substitute session when readiness calls for it.',
    lockedCopy: 'Respect readiness guidance.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    progressKind: 'binary',
    sportApplicability: ['readiness', 'scheduled_training'],
    tier: 4,
  }),
  makeDefinition({
    id: 'recovery_symptoms_reported_early',
    slug: 'symptoms-reported-early',
    title: 'Symptoms Reported Early',
    compactTitle: 'Symptoms',
    titleLines: ['SYMPTOMS', 'REPORTED EARLY'],
    glyph: 'symptomsSignal',
    description: 'Report symptoms early so training can adapt.',
    criteria: 'Use the symptom reporting workflow before forcing training.',
    lockedCopy: 'Report symptoms early when needed.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    progressKind: 'binary',
    sportApplicability: ['readiness', 'recovery'],
    tier: 5,
  }),
  makeDefinition({
    id: 'recovery_check_in_streak',
    slug: 'check-in-streak',
    title: 'Check-In Streak',
    compactTitle: 'Check-In Streak',
    titleLines: ['CHECK-IN', 'STREAK'],
    glyph: 'checkInRipples',
    description: 'Complete seven consecutive readiness check-ins.',
    criteria: 'Complete seven consecutive recovery or readiness check-ins.',
    lockedCopy: 'Complete recovery check-ins consistently.',
    threshold: 7,
    thresholdUnit: 'days',
    unitBehavior: 'days',
    progressKind: 'checkIns',
    sportApplicability: ['readiness', 'recovery'],
    tier: 6,
  }),
  makeDefinition({
    id: 'recovery_returned_gradually',
    slug: 'returned-gradually',
    title: 'Returned Gradually',
    compactTitle: 'Returned Gradually',
    titleLines: ['RETURNED', 'GRADUALLY'],
    glyph: 'returnedGradually',
    description: 'Return with controlled training after an interruption.',
    criteria: 'Resume with a controlled effort after a training gap.',
    lockedCopy: 'Return gradually after a gap.',
    threshold: 1,
    thresholdUnit: 'count',
    unitBehavior: 'count',
    progressKind: 'binary',
    sportApplicability: ['recovery', 'scheduled_training'],
    tier: 7,
  }),
];

export const RECOVERY_ACHIEVEMENT_BY_ID = Object.fromEntries(
  RECOVERY_ACHIEVEMENT_DEFINITIONS.map(definition => [definition.id, definition]),
) as Record<RecoveryAchievementId, RecoveryAchievementDefinition>;

export function recoveryAchievementDefinitionFromId(id: string): RecoveryAchievementDefinition | null {
  return id in RECOVERY_ACHIEVEMENT_BY_ID
    ? RECOVERY_ACHIEVEMENT_BY_ID[id as RecoveryAchievementId]
    : null;
}
