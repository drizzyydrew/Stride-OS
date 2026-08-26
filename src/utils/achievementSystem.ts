import type { UnitSystem } from '../store/settingsStore';
import type { Activity } from '../types/activity';
import type { AssessmentResult } from '../types/assessment';
import type { DailyReadiness } from '../types/readiness';
import {
  CUMULATIVE_ELEVATION_ACHIEVEMENTS,
  STREAK_ACHIEVEMENTS,
  calculateCumulativeElevationAchievements,
  calculateStreakAchievements,
  type AchievementAwardReference,
  type AchievementCategory,
  type AchievementId,
} from './achievements';
import { formatDistance, formatPaceSecPerMile } from '../lib/units';
import { formatDuration, formatElevationMeters } from './activitySummary';
import type { ScheduledSession } from './scheduledSessions';

const M_PER_MI = 1609.344;
const M_PER_KM = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type AchievementFamily =
  | 'recent'
  | 'run_levels'
  | 'firsts'
  | 'personal_records'
  | 'lifetime_running'
  | 'lifetime_cycling'
  | 'weekly_distance'
  | 'monthly_challenges'
  | 'elevation'
  | 'strength'
  | 'streaks'
  | 'recovery'
  | 'challenges';

export type AchievementUnitBehavior =
  | 'unit_sensitive_distance'
  | 'unit_sensitive_elevation'
  | 'unit_sensitive_pace'
  | 'fixed_k_identity'
  | 'race_distance_class'
  | 'count'
  | 'days'
  | 'weeks'
  | 'months'
  | 'none';

export type AchievementPeriod =
  | 'lifetime'
  | 'weekly'
  | 'monthly'
  | 'seasonal'
  | 'one_time'
  | 'rolling'
  | 'current_streak';

export type AchievementRuleKind =
  | 'first'
  | 'lifetime_distance'
  | 'weekly_distance'
  | 'monthly_distance'
  | 'cumulative_elevation'
  | 'run_level'
  | 'strength_count'
  | 'strength_consistency'
  | 'strength_run_week'
  | 'prehab_resilience'
  | 'streak'
  | 'recovery'
  | 'challenge';

export type AchievementDefinitionV2 = {
  id: AchievementId;
  family: AchievementFamily;
  category: AchievementCategory;
  title: string;
  shortTitle?: string;
  description: string;
  criteria: string;
  ruleKind: AchievementRuleKind;
  unitBehavior: AchievementUnitBehavior;
  threshold: number;
  thresholdUnit: 'meters' | 'feet' | 'days' | 'weeks' | 'sessions' | 'count' | 'months' | 'none';
  sportApplicability: string[];
  artworkKey: string;
  artworkPath: string;
  lockedArtworkPath?: string;
  shareArtPath?: string;
  shareOverlayPath?: string;
  shareCardEligibility: boolean;
  repeatability: 'once' | 'periodic';
  period: AchievementPeriod;
  tier?: number;
  dominantColor: string;
  originalArtwork: true;
  sourceNotes?: string;
};

export type EvaluatedAchievement = AchievementDefinitionV2 & {
  state: 'locked' | 'earned' | 'newly_earned' | 'current';
  achievedDate?: number;
  achievedActivityId?: string;
  supportingActivityIds: string[];
  currentProgress: number;
  targetProgress: number;
  remaining: number;
  progressPercentage: number;
  displayProgress: string;
  displayTarget: string;
  displayRemaining: string;
  accessibilityLabel: string;
  currentPeriodKey?: string;
};

export type AchievementEvaluationInput = {
  activities: readonly Activity[];
  units: UnitSystem;
  awarded?: readonly AchievementAwardReference[];
  now?: number;
  scheduledSessions?: readonly ScheduledSession[];
  readinessHistory?: readonly DailyReadiness[];
  assessmentResults?: readonly AssessmentResult[];
  checkInDates?: readonly string[];
};

type EvaluationContext = {
  input: Required<Omit<AchievementEvaluationInput, 'readinessHistory' | 'assessmentResults' | 'checkInDates'>> & {
    readinessHistory: readonly DailyReadiness[];
    assessmentResults: readonly AssessmentResult[];
    checkInDates: readonly string[];
  };
  completed: Activity[];
  existingAwards: Map<AchievementId, number>;
};

type DefinitionEvaluationResult = {
  complete: boolean;
  current: number;
  achievedAt?: number;
  activityId?: string;
  ids: string[];
  currentPeriodKey?: string;
};

function mi(miles: number): number {
  return miles * M_PER_MI;
}

function km(kilometers: number): number {
  return kilometers * M_PER_KM;
}

function titleCase(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

const RUN_LEVELS: Array<[AchievementId, string, number, string]> = [
  ['run_level_foundation', 'Foundation', 0, '#F3F1EB'],
  ['run_level_rhythm', 'Rhythm', 50_000, '#B7835F'],
  ['run_level_momentum', 'Momentum', 150_000, '#8B9C7C'],
  ['run_level_durability', 'Durability', 400_000, '#94A0A6'],
  ['run_level_engine', 'Engine', 800_000, '#5F7998'],
  ['run_level_peak', 'Peak', 1_600_000, '#6E4B36'],
  ['run_level_summit', 'Summit', 3_200_000, '#DCC9B1'],
];

const FIRSTS: Array<[AchievementId, string, number, AchievementUnitBehavior, string]> = [
  ['first_activity', 'First Activity', 1, 'count', 'Complete any activity.'],
  ['first_run', 'First Run', 1, 'count', 'Complete a run.'],
  ['first_walk', 'First Walk', 1, 'count', 'Complete a walk.'],
  ['first_run_walk', 'First Run/Walk', 1, 'count', 'Complete a run/walk session.'],
  ['first_strength_session', 'First Strength Session', 1, 'count', 'Complete a strength session.'],
  ['first_ride', 'First Ride', 1, 'count', 'Complete a ride.'],
  ['first_treadmill_run', 'First Treadmill Run', 1, 'count', 'Complete a treadmill run.'],
  ['first_5k', 'First 5K', km(5), 'fixed_k_identity', 'Complete one running activity of at least 5K.'],
  ['first_10k', 'First 10K', km(10), 'fixed_k_identity', 'Complete one running activity of at least 10K.'],
  ['first_half_marathon', 'First Half Marathon', mi(13.1094), 'race_distance_class', 'Complete one half-marathon distance run.'],
  ['first_marathon', 'First Marathon', mi(26.2188), 'race_distance_class', 'Complete one marathon distance run.'],
  ['first_route_completed', 'First Route Completed', 1, 'count', 'Complete an activity with a recorded route.'],
  ['first_structured_workout', 'First Structured Workout', 1, 'count', 'Complete a structured or scheduled workout.'],
  ['first_adapted_week', 'First Adapted Week', 1, 'count', 'Complete an approved adapted week or equivalent substitute.'],
  ['first_movement_lab_assessment', 'First Movement Lab Assessment', 1, 'count', 'Complete a Movement Lab assessment.'],
];

const LIFETIME_RUNNING_MI = [1, 5, 10, 26.2, 50, 100, 250, 500, 1000, 10000] as const;
const LIFETIME_CYCLING_MI = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
const WEEKLY_DISTANCE_KM = [5, 10, 15, 25, 30, 50, 75, 100] as const;

const STRENGTH_DEFS: Array<[AchievementId, string, AchievementRuleKind, number, AchievementUnitBehavior, string]> = [
  ['strength_10_sessions', '10 Strength Sessions', 'strength_count', 10, 'count', 'Complete 10 strength sessions.'],
  ['strength_25_sessions', '25 Strength Sessions', 'strength_count', 25, 'count', 'Complete 25 strength sessions.'],
  ['strength_50_sessions', '50 Strength Sessions', 'strength_count', 50, 'count', 'Complete 50 strength sessions.'],
  ['strength_100_sessions', '100 Strength Sessions', 'strength_count', 100, 'count', 'Complete 100 strength sessions.'],
  ['strength_6_weeks_consistent', '6 Weeks Consistent Strength', 'strength_consistency', 6, 'weeks', 'Complete strength training in six consistent weeks.'],
  ['strength_12_weeks_consistent', '12 Weeks Consistent Strength', 'strength_consistency', 12, 'weeks', 'Complete strength training in twelve consistent weeks.'],
  ['strength_run_week_completed', 'Strength + Run Week Completed', 'strength_run_week', 1, 'count', 'Complete running and strength in the same week.'],
  ['prehab_resilience_block', 'Prehab & Resilience Block', 'prehab_resilience', 1, 'count', 'Complete a resilience or mobility-focused block.'],
];

const RECOVERY_DEFS: Array<[AchievementId, string, number, string]> = [
  ['recovery_check_in_streak', 'Check-In Streak', 7, 'Complete seven consecutive readiness check-ins.'],
  ['recovery_week_completed', 'Recovery Week Completed', 1, 'Complete a week with recovery work respected.'],
  ['recovery_sleep_consistency', 'Sleep Consistency', 7, 'Log seven days of consistent sleep data.'],
  ['recovery_smart_rest_day', 'Smart Rest Day', 1, 'Respect a planned rest or recovery day.'],
  ['recovery_readiness_respected', 'Readiness Respected', 1, 'Modify training appropriately when readiness calls for it.'],
  ['recovery_symptoms_reported_early', 'Symptoms Reported Early', 1, 'Report symptoms early so training can adapt.'],
  ['recovery_returned_gradually', 'Returned Gradually', 1, 'Return with controlled training after an interruption.'],
];

const CHALLENGE_DEFS: Array<[AchievementId, string, AchievementRuleKind, number, AchievementUnitBehavior, string, string]> = [
  ['challenge_august_base_builder', 'August Base Builder', 'challenge', 1, 'count', 'Complete consistent base work in August.', '#C56B3E'],
  ['challenge_september_consistency', 'September Consistency Challenge', 'challenge', 1, 'count', 'Complete consistent training in September.', '#5F9A95'],
  ['challenge_winter_strength_block', 'Winter Strength Block', 'challenge', 1, 'count', 'Complete winter strength work.', '#5F7998'],
  ['challenge_spring_mileage_build', 'Spring Mileage Build', 'challenge', 1, 'count', 'Build spring mileage progressively.', '#8B9C7C'],
  ['challenge_summer_long_run', 'Summer Long Run Challenge', 'challenge', 1, 'count', 'Complete summer long-run work.', '#D8775F'],
  ['challenge_5k_month', '5K Month', 'monthly_distance', km(5), 'fixed_k_identity', 'Complete 5K in a calendar month.', '#C05DA8'],
  ['challenge_25k_week', '25K Week', 'weekly_distance', km(25), 'fixed_k_identity', 'Complete 25K in a reporting week.', '#657DB5'],
  ['challenge_50k_month', '50K Month', 'monthly_distance', km(50), 'fixed_k_identity', 'Complete 50K in a calendar month.', '#2E9A98'],
  ['challenge_100k_month', '100K Month', 'monthly_distance', km(100), 'fixed_k_identity', 'Complete 100K in a calendar month.', '#D99A38'],
  ['challenge_elevation_month', 'Elevation Month', 'challenge', 914.4, 'unit_sensitive_elevation', 'Gain 3,000 ft of elevation in a calendar month.', '#7D5DB4'],
  ['challenge_strength_run', 'Strength + Run Challenge', 'strength_run_week', 1, 'count', 'Pair strength and running in one week.', '#B85483'],
  ['challenge_four_week_foundation', 'Four-Week Foundation Challenge', 'strength_consistency', 4, 'weeks', 'Complete four weeks of consistent foundation work.', '#4E8AAE'],
  ['challenge_recovery_consistency', 'Recovery Consistency Challenge', 'recovery', 1, 'count', 'Keep recovery behaviors consistent.', '#879B6F'],
];

function baseDef(input: Omit<AchievementDefinitionV2, 'shareCardEligibility' | 'repeatability' | 'originalArtwork'> & Partial<Pick<AchievementDefinitionV2, 'shareCardEligibility' | 'repeatability'>>): AchievementDefinitionV2 {
  return {
    shareCardEligibility: input.shareCardEligibility ?? true,
    repeatability: input.repeatability ?? 'once',
    originalArtwork: true,
    ...input,
  };
}

export const ACHIEVEMENT_SYSTEM_REGISTRY: AchievementDefinitionV2[] = [
  ...RUN_LEVELS.map(([id, title, threshold, color], index) => baseDef({
    id,
    family: 'run_levels',
    category: 'run_level',
    title,
    description: 'Lifetime running progression on the StrideOS run path.',
    criteria: threshold === 0 ? 'Start the StrideOS run path.' : `Reach ${formatDistance(threshold / M_PER_MI, 'imperial')} of lifetime running distance.`,
    ruleKind: 'run_level',
    unitBehavior: 'unit_sensitive_distance',
    threshold,
    thresholdUnit: 'meters',
    sportApplicability: ['running'],
    artworkKey: `run-level-${index + 1}`,
    artworkPath: `assets/achievements/system/run-levels/${id}.svg`,
    lockedArtworkPath: `assets/achievements/system/run-levels/${id}-locked.svg`,
    period: 'lifetime',
    tier: index + 1,
    dominantColor: color,
  })),
  ...FIRSTS.map(([id, title, threshold, unitBehavior, criteria], index) => baseDef({
    id,
    family: 'firsts',
    category: 'firsts',
    title,
    shortTitle: title.replace(/^First /, ''),
    description: criteria,
    criteria,
    ruleKind: 'first',
    unitBehavior,
    threshold,
    thresholdUnit: threshold > 1 && typeof threshold === 'number' ? 'meters' : 'count',
    sportApplicability: ['running', 'walking', 'cycling', 'strength', 'mobility'],
    artworkKey: `firsts-${index + 1}`,
    artworkPath: `assets/achievements/system/firsts/${id}.svg`,
    lockedArtworkPath: `assets/achievements/system/firsts/${id}-locked.svg`,
    period: 'one_time',
    tier: index + 1,
    dominantColor: '#B7835F',
  })),
  ...LIFETIME_RUNNING_MI.map((miles, index) => baseDef({
    id: `lifetime_run_${String(miles).replace('.', '_')}_mi`,
    family: 'lifetime_running',
    category: 'lifetime_running',
    title: `${miles.toLocaleString()} Mile Run Lifetime`,
    shortTitle: `${miles.toLocaleString()} mi`,
    description: 'Cumulative lifetime running distance.',
    criteria: `Reach ${miles.toLocaleString()} miles of completed running.`,
    ruleKind: 'lifetime_distance',
    unitBehavior: 'unit_sensitive_distance',
    threshold: mi(miles),
    thresholdUnit: 'meters',
    sportApplicability: ['running'],
    artworkKey: `lifetime-running-${index + 1}`,
    artworkPath: `assets/achievements/system/lifetime-running/lifetime-run-${String(miles).replace('.', '-')}.svg`,
    lockedArtworkPath: `assets/achievements/system/lifetime-running/lifetime-run-${String(miles).replace('.', '-')}-locked.svg`,
    period: 'lifetime',
    tier: index + 1,
    dominantColor: ['#879B6F', '#2E9A98', '#4E8AAE', '#7D5DB4', '#C95D4A', '#5F7998', '#6653A6', '#8B4FA3', '#C65136', '#D99A38'][index] ?? '#DCC9B1',
  })),
  ...LIFETIME_CYCLING_MI.map((miles, index) => baseDef({
    id: `lifetime_cycle_${String(miles).replace('.', '_')}_mi`,
    family: 'lifetime_cycling',
    category: 'lifetime_cycling',
    title: `${miles.toLocaleString()} Mile Cycling Lifetime`,
    shortTitle: `${miles.toLocaleString()} mi`,
    description: 'Cumulative lifetime cycling distance.',
    criteria: `Reach ${miles.toLocaleString()} miles of completed cycling.`,
    ruleKind: 'lifetime_distance',
    unitBehavior: 'unit_sensitive_distance',
    threshold: mi(miles),
    thresholdUnit: 'meters',
    sportApplicability: ['cycling', 'indoor_cycling'],
    artworkKey: `lifetime-cycling-${index + 1}`,
    artworkPath: `assets/achievements/system/lifetime-cycling/lifetime-cycle-${String(miles).replace('.', '-')}.svg`,
    lockedArtworkPath: `assets/achievements/system/lifetime-cycling/lifetime-cycle-${String(miles).replace('.', '-')}-locked.svg`,
    period: 'lifetime',
    tier: index + 1,
    dominantColor: ['#879B6F', '#2E9A98', '#4E8AAE', '#7D5DB4', '#D99A38', '#2E9A98', '#657DB5', '#8B4FA3', '#D99A38'][index] ?? '#DCC9B1',
  })),
  ...WEEKLY_DISTANCE_KM.map((kilometers, index) => baseDef({
    id: `weekly_${kilometers}k`,
    family: 'weekly_distance',
    category: 'weekly_distance',
    title: `${kilometers}K Week`,
    shortTitle: `${kilometers}K`,
    description: `Complete ${kilometers} kilometers in one reporting week.`,
    criteria: `Complete ${kilometers}K in a canonical local reporting week.`,
    ruleKind: 'weekly_distance',
    unitBehavior: 'fixed_k_identity',
    threshold: km(kilometers),
    thresholdUnit: 'meters',
    sportApplicability: ['running', 'walking'],
    artworkKey: `weekly-distance-${index + 1}`,
    artworkPath: `assets/achievements/system/weekly-distance/weekly-${kilometers}k.svg`,
    lockedArtworkPath: `assets/achievements/system/weekly-distance/weekly-${kilometers}k-locked.svg`,
    period: 'weekly',
    tier: index + 1,
    dominantColor: ['#879B6F', '#2E9A98', '#657DB5', '#9A5BAE', '#5F7998', '#6E8FA6', '#C65136', '#D99A38'][index] ?? '#DCC9B1',
  })),
  ...CUMULATIVE_ELEVATION_ACHIEVEMENTS.map(item => baseDef({
    id: item.id,
    family: 'elevation',
    category: 'cumulative_elevation',
    title: item.displayName,
    description: `${item.displayName} cumulative elevation gain milestone.`,
    criteria: `Reach ${item.imperialDisplay} of eligible cumulative elevation gain.`,
    ruleKind: 'cumulative_elevation',
    unitBehavior: 'unit_sensitive_elevation',
    threshold: item.thresholdMeters,
    thresholdUnit: 'meters',
    sportApplicability: ['running', 'walking', 'hiking', 'cycling'],
    artworkKey: `elevation-${item.slug}`,
    artworkPath: item.artworkPath,
    lockedArtworkPath: item.thumbnailPath,
    shareArtPath: item.shareAssetPaths.photographic,
    shareOverlayPath: item.shareAssetPaths.overlay,
    period: 'lifetime',
    tier: item.sortOrder,
    dominantColor: '#DCC9B1',
    sourceNotes: `${item.authoritativeSource}; ${item.measurementDescriptor}; original StrideOS artwork.`,
  })),
  ...STRENGTH_DEFS.map(([id, title, ruleKind, threshold, unitBehavior, criteria], index) => baseDef({
    id,
    family: 'strength',
    category: 'strength',
    title,
    description: criteria,
    criteria,
    ruleKind,
    unitBehavior,
    threshold,
    thresholdUnit: unitBehavior === 'weeks' ? 'weeks' : 'sessions',
    sportApplicability: ['strength', 'running'],
    artworkKey: `strength-${index + 1}`,
    artworkPath: `assets/achievements/system/strength/${id}.svg`,
    lockedArtworkPath: `assets/achievements/system/strength/${id}-locked.svg`,
    period: ruleKind === 'strength_count' ? 'lifetime' : 'rolling',
    tier: index + 1,
    dominantColor: '#94A0A6',
  })),
  ...STREAK_ACHIEVEMENTS.map(item => baseDef({
    id: item.id,
    family: 'streaks',
    category: 'streak',
    title: item.displayName,
    shortTitle: item.milestoneLabel,
    description: "Consistency built by following the athlete's actual training schedule.",
    criteria: `Maintain schedule adherence for ${item.milestoneLabel}; planned rest, recovery, taper, and approved adaptations preserve the streak.`,
    ruleKind: 'streak',
    unitBehavior: item.id === 'streak_6_month' ? 'months' : 'days',
    threshold: item.thresholdDays,
    thresholdUnit: 'days',
    sportApplicability: ['scheduled_training'],
    artworkKey: `streak-${item.slug}`,
    artworkPath: item.artworkPath,
    lockedArtworkPath: item.lockedArtworkPath,
    shareArtPath: item.shareAssetPaths.cleanDark,
    shareOverlayPath: item.shareAssetPaths.overlay,
    period: 'current_streak',
    tier: item.tier,
    dominantColor: item.dominantHeatColor,
  })),
  ...RECOVERY_DEFS.map(([id, title, threshold, criteria], index) => baseDef({
    id,
    family: 'recovery',
    category: 'recovery',
    title,
    description: criteria,
    criteria,
    ruleKind: 'recovery',
    unitBehavior: ['recovery_check_in_streak', 'recovery_sleep_consistency'].includes(id) ? 'days' : 'count',
    threshold,
    thresholdUnit: ['recovery_check_in_streak', 'recovery_sleep_consistency'].includes(id) ? 'days' : 'count',
    sportApplicability: ['recovery', 'readiness', 'mobility'],
    artworkKey: `recovery-${index + 1}`,
    artworkPath: `assets/achievements/system/recovery/${id}.svg`,
    lockedArtworkPath: `assets/achievements/system/recovery/${id}-locked.svg`,
    period: 'rolling',
    tier: index + 1,
    dominantColor: '#8B9C7C',
  })),
  ...CHALLENGE_DEFS.map(([id, title, ruleKind, threshold, unitBehavior, criteria, color], index) => baseDef({
    id,
    family: 'challenges',
    category: 'challenges',
    title,
    description: criteria,
    criteria,
    ruleKind,
    unitBehavior,
    threshold,
    thresholdUnit: unitBehavior === 'unit_sensitive_elevation' ? 'meters' : ruleKind.includes('distance') ? 'meters' : unitBehavior === 'weeks' ? 'weeks' : 'count',
    sportApplicability: ['running', 'strength', 'recovery'],
    artworkKey: `challenge-${index + 1}`,
    artworkPath: `assets/achievements/system/challenges/${id}.svg`,
    lockedArtworkPath: `assets/achievements/system/challenges/${id}-locked.svg`,
    period: id.includes('month') ? 'monthly' : id.includes('week') ? 'weekly' : 'seasonal',
    tier: index + 1,
    dominantColor: color,
  })),
];

export const ACHIEVEMENT_SYSTEM_CATEGORY_LABELS: Record<AchievementFamily, string> = {
  recent: 'Recently Earned',
  run_levels: 'Run Levels',
  firsts: 'Firsts',
  personal_records: 'Personal Records',
  lifetime_running: 'Lifetime Distance - Running',
  lifetime_cycling: 'Lifetime Distance - Cycling',
  weekly_distance: 'Weekly Distance',
  monthly_challenges: 'Monthly / Challenges',
  elevation: 'Cumulative Elevation',
  strength: 'Strength',
  streaks: 'Streaks',
  recovery: 'Recovery',
  challenges: 'Challenges',
};

function completedActivities(activities: readonly Activity[]): Activity[] {
  const seenHealthKit = new Set<string>();
  const trackedTimes = activities
    .filter(activity => activity.source === 'tracked')
    .map(activity => `${activity.startTime}:${activity.endTime ?? activity.startTime}`);
  return activities
    .filter(activity => activity.status !== 'skipped' && activity.completionClassification !== 'skipped')
    .filter(activity => {
      const uuid = activity.healthKit?.workoutUuid;
      if (!uuid) return true;
      const key = `${activity.healthKit?.sourceBundleIdentifier ?? ''}:${uuid}`;
      if (seenHealthKit.has(key)) return false;
      seenHealthKit.add(key);
      if (!activity.healthKit?.importedByStrideOS) return true;
      return !trackedTimes.some(time => {
        const [start, end] = time.split(':').map(Number);
        return Math.abs(activity.startTime - start) < 30_000
          && Math.abs((activity.endTime ?? activity.startTime) - end) < 30_000;
      });
    })
    .sort((a, b) => a.startTime - b.startTime);
}

function awardedAt(item: AchievementAwardReference): number | undefined {
  return typeof item === 'string' ? undefined : item.awardedAt;
}

function awardId(item: AchievementAwardReference): AchievementId {
  return typeof item === 'string' ? item : item.id;
}

function localDateKey(timeMs: number): string {
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekKey(timeMs: number): string {
  const date = new Date(timeMs);
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDateKey(monday.getTime());
}

function monthKey(timeMs: number): string {
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isRun(activity: Activity): boolean {
  return activity.activityType === 'running' || activity.subtype === 'run_walk';
}

function isRide(activity: Activity): boolean {
  return activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling';
}

function distanceMeters(activity: Activity): number {
  const value = activity.metrics.distanceMeters ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function hasRoute(activity: Activity): boolean {
  return (activity.metrics.routeCoordinates?.length ?? 0) >= 2 || Boolean(activity.metrics.routeId);
}

function isStructured(activity: Activity): boolean {
  return Boolean(activity.scheduledSessionId || activity.metrics.runWalkIntervals?.length || activity.workoutKit);
}

function progressDate(candidates: readonly Activity[], predicate: (activity: Activity) => boolean): Activity | null {
  return candidates.find(predicate) ?? null;
}

function cumulativeCrossing(
  activities: readonly Activity[],
  target: number,
  predicate: (activity: Activity) => boolean,
  metric: (activity: Activity) => number,
): { complete: boolean; current: number; activity?: Activity; ids: string[] } {
  let current = 0;
  const ids: string[] = [];
  for (const activity of activities) {
    if (!predicate(activity)) continue;
    const amount = metric(activity);
    if (amount <= 0) continue;
    current += amount;
    ids.push(activity.id);
    if (current >= target) return { complete: true, current, activity, ids: [...ids] };
  }
  return { complete: false, current, ids };
}

function sumByPeriod(
  activities: readonly Activity[],
  keyFor: (timeMs: number) => string,
  predicate: (activity: Activity) => boolean,
  metric: (activity: Activity) => number,
): Map<string, { value: number; ids: string[]; achievedAt: number }> {
  const periods = new Map<string, { value: number; ids: string[]; achievedAt: number }>();
  for (const activity of activities) {
    if (!predicate(activity)) continue;
    const amount = metric(activity);
    if (amount <= 0) continue;
    const key = keyFor(activity.startTime);
    const current = periods.get(key) ?? { value: 0, ids: [], achievedAt: activity.startTime };
    current.value += amount;
    current.ids.push(activity.id);
    current.achievedAt = Math.max(current.achievedAt, activity.startTime);
    periods.set(key, current);
  }
  return periods;
}

function countConsecutivePeriodKeys(keys: readonly string[]): number {
  const sorted = [...new Set(keys)].sort();
  if (!sorted.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1]).getTime();
    const next = new Date(sorted[index]).getTime();
    if (Math.round((next - previous) / WEEK_MS) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function longestDateStreak(dateKeys: readonly string[]): number {
  const sorted = [...new Set(dateKeys)].sort();
  if (!sorted.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1]).getTime();
    const next = new Date(sorted[index]).getTime();
    if (Math.round((next - previous) / DAY_MS) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

function displayValue(value: number, def: AchievementDefinitionV2, units: UnitSystem): string {
  if (def.unitBehavior === 'unit_sensitive_distance' || def.unitBehavior === 'race_distance_class') {
    return formatDistance(value / M_PER_MI, units);
  }
  if (def.unitBehavior === 'unit_sensitive_elevation') {
    return formatElevationMeters(value, units);
  }
  if (def.unitBehavior === 'fixed_k_identity') {
    return `${Math.round(value / M_PER_KM).toLocaleString()}K`;
  }
  if (def.unitBehavior === 'days') return `${Math.round(value)} days`;
  if (def.unitBehavior === 'weeks') return `${Math.round(value)} weeks`;
  if (def.unitBehavior === 'months') return value >= 183 ? '6 months' : `${Math.round(value)} days`;
  if (def.thresholdUnit === 'sessions') return `${Math.round(value)} sessions`;
  return `${Math.round(value).toLocaleString()}`;
}

export function formatAchievementSupportValue(def: AchievementDefinitionV2, units: UnitSystem): string {
  if (def.id === 'first_half_marathon') return units === 'metric' ? '21.1 km' : '13.1 mi';
  if (def.id === 'first_marathon') return units === 'metric' ? '42.2 km' : '26.2 mi';
  return displayValue(def.threshold, def, units);
}

function evaluateFirst(def: AchievementDefinitionV2, ctx: EvaluationContext): DefinitionEvaluationResult {
  const first = progressDate(ctx.completed, activity => {
    if (def.id === 'first_activity') return true;
    if (def.id === 'first_run') return activity.activityType === 'running';
    if (def.id === 'first_walk') return activity.activityType === 'walking';
    if (def.id === 'first_run_walk') return activity.subtype === 'run_walk' || Boolean(activity.metrics.runWalkIntervals?.length);
    if (def.id === 'first_strength_session') return activity.activityType === 'strength';
    if (def.id === 'first_ride') return isRide(activity);
    if (def.id === 'first_treadmill_run') return activity.activityType === 'running' && (activity.indoor || activity.subtype === 'treadmill' || activity.metrics.distanceSource === 'treadmill_reported');
    if (def.id === 'first_5k' || def.id === 'first_10k' || def.id === 'first_half_marathon' || def.id === 'first_marathon') {
      return isRun(activity) && distanceMeters(activity) >= def.threshold;
    }
    if (def.id === 'first_route_completed') return hasRoute(activity);
    if (def.id === 'first_structured_workout') return isStructured(activity);
    if (def.id === 'first_adapted_week') {
      return ['modified', 'equivalent_substitute', 'partial', 'stopped_early'].includes(activity.completionClassification ?? '');
    }
    return false;
  });
  if (def.id === 'first_movement_lab_assessment') {
    const firstAssessment = [...ctx.input.assessmentResults].sort((a, b) => a.testedAt - b.testedAt)[0];
    return {
      complete: Boolean(firstAssessment),
      current: firstAssessment ? 1 : 0,
      achievedAt: firstAssessment?.testedAt,
      activityId: undefined,
      ids: [],
    };
  }
  const maxActivityDistance = def.thresholdUnit === 'meters'
    ? Math.max(0, ...ctx.completed.filter(isRun).map(distanceMeters))
    : 0;
  return {
    complete: Boolean(first),
    current: first ? def.threshold : Math.min(maxActivityDistance || 0, def.threshold),
    achievedAt: first?.startTime,
    activityId: first?.id,
    ids: first ? [first.id] : [],
  };
}

function evaluateDefinition(def: AchievementDefinitionV2, ctx: EvaluationContext): DefinitionEvaluationResult {
  if (def.ruleKind === 'first') return evaluateFirst(def, ctx);
  if (def.ruleKind === 'run_level') {
    const result = cumulativeCrossing(ctx.completed, def.threshold, isRun, distanceMeters);
    return { ...result, achievedAt: def.threshold === 0 ? ctx.input.now : result.activity?.startTime, activityId: result.activity?.id };
  }
  if (def.ruleKind === 'lifetime_distance') {
    const isCycling = def.family === 'lifetime_cycling';
    const result = cumulativeCrossing(ctx.completed, def.threshold, isCycling ? isRide : isRun, distanceMeters);
    return { ...result, achievedAt: result.activity?.startTime, activityId: result.activity?.id };
  }
  if (def.ruleKind === 'weekly_distance') {
    const periods = sumByPeriod(ctx.completed, weekKey, isRun, distanceMeters);
    const best = [...periods.entries()].sort((a, b) => b[1].value - a[1].value)[0];
    return {
      complete: (best?.[1].value ?? 0) >= def.threshold,
      current: best?.[1].value ?? 0,
      achievedAt: best && best[1].value >= def.threshold ? best[1].achievedAt : undefined,
      ids: best?.[1].ids ?? [],
      currentPeriodKey: best?.[0],
    };
  }
  if (def.ruleKind === 'monthly_distance') {
    const periods = sumByPeriod(ctx.completed, monthKey, isRun, distanceMeters);
    const best = [...periods.entries()].sort((a, b) => b[1].value - a[1].value)[0];
    return {
      complete: (best?.[1].value ?? 0) >= def.threshold,
      current: best?.[1].value ?? 0,
      achievedAt: best && best[1].value >= def.threshold ? best[1].achievedAt : undefined,
      ids: best?.[1].ids ?? [],
      currentPeriodKey: best?.[0],
    };
  }
  if (def.ruleKind === 'cumulative_elevation') {
    const item = calculateCumulativeElevationAchievements(ctx.input.activities).find(achievement => achievement.id === def.id);
    return {
      complete: Boolean(item?.complete),
      current: item?.cumulativeMeters ?? 0,
      achievedAt: item?.unlockedAt,
      ids: item?.supportingActivityIds ?? [],
    };
  }
  if (def.ruleKind === 'streak') {
    const item = calculateStreakAchievements(ctx.input.activities, {
      now: ctx.input.now,
      scheduledSessions: ctx.input.scheduledSessions,
    }, ctx.input.awarded).achievements.find(achievement => achievement.id === def.id);
    return {
      complete: Boolean(item?.complete),
      current: item?.currentStreakDays ?? 0,
      achievedAt: item?.unlockedAt,
      ids: item?.supportingActivityIds ?? [],
    };
  }
  if (def.ruleKind === 'strength_count') {
    const result = cumulativeCrossing(ctx.completed, def.threshold, activity => activity.activityType === 'strength', () => 1);
    return { ...result, achievedAt: result.activity?.startTime, activityId: result.activity?.id };
  }
  if (def.ruleKind === 'strength_consistency') {
    const weeks = ctx.completed.filter(activity => activity.activityType === 'strength').map(activity => weekKey(activity.startTime));
    const current = countConsecutivePeriodKeys(weeks);
    const latest = ctx.completed.filter(activity => activity.activityType === 'strength').at(-1);
    return { complete: current >= def.threshold, current, achievedAt: current >= def.threshold ? latest?.startTime : undefined, ids: ctx.completed.filter(activity => activity.activityType === 'strength').map(activity => activity.id) };
  }
  if (def.ruleKind === 'strength_run_week') {
    const weeks = new Map<string, Activity[]>();
    ctx.completed.forEach(activity => weeks.set(weekKey(activity.startTime), [...(weeks.get(weekKey(activity.startTime)) ?? []), activity]));
    const match = [...weeks.entries()].find(([, activities]) => activities.some(isRun) && activities.some(activity => activity.activityType === 'strength'));
    return {
      complete: Boolean(match),
      current: match ? 1 : 0,
      achievedAt: match ? Math.max(...match[1].map(activity => activity.startTime)) : undefined,
      ids: match?.[1].filter(activity => isRun(activity) || activity.activityType === 'strength').map(activity => activity.id) ?? [],
    };
  }
  if (def.ruleKind === 'prehab_resilience') {
    const match = ctx.completed.find(activity => activity.activityType === 'mobility' || /prehab|resilience|mobility|stability/i.test(activity.notes ?? ''));
    return { complete: Boolean(match), current: match ? 1 : 0, achievedAt: match?.startTime, activityId: match?.id, ids: match ? [match.id] : [] };
  }
  if (def.ruleKind === 'recovery') return evaluateRecovery(def, ctx);
  if (def.ruleKind === 'challenge') return evaluateChallenge(def, ctx);
  return { complete: false, current: 0, ids: [] };
}

function evaluateRecovery(def: AchievementDefinitionV2, ctx: EvaluationContext) {
  const readinessDates = ctx.input.readinessHistory.map(item => item.date);
  const checkInStreak = longestDateStreak([...readinessDates, ...ctx.input.checkInDates]);
  if (def.id === 'recovery_check_in_streak') {
    return { complete: checkInStreak >= def.threshold, current: checkInStreak, ids: [] };
  }
  if (def.id === 'recovery_sleep_consistency') {
    const sleepDates = ctx.input.readinessHistory.filter(item => (item.sleepMinutesTotal ?? 0) > 0).map(item => item.date);
    const current = longestDateStreak(sleepDates);
    return { complete: current >= def.threshold, current, ids: [] };
  }
  if (def.id === 'recovery_week_completed') {
    const recovery = ctx.completed.find(activity => activity.activityType === 'mobility' || activity.subtype === 'recovery');
    return { complete: Boolean(recovery), current: recovery ? 1 : 0, achievedAt: recovery?.startTime, activityId: recovery?.id, ids: recovery ? [recovery.id] : [] };
  }
  if (def.id === 'recovery_smart_rest_day') {
    const preserved = ctx.input.scheduledSessions.find(session => session.activityType === 'rest' || /rest|recovery|taper|deload/i.test(`${session.title} ${session.purpose} ${session.adaptationReason ?? ''}`));
    return { complete: Boolean(preserved), current: preserved ? 1 : 0, achievedAt: preserved ? new Date(`${preserved.date}T12:00:00`).getTime() : undefined, ids: [] };
  }
  if (def.id === 'recovery_readiness_respected') {
    const adjusted = ctx.completed.find(activity => ['modified', 'equivalent_substitute', 'partial', 'stopped_early'].includes(activity.completionClassification ?? ''));
    return { complete: Boolean(adjusted), current: adjusted ? 1 : 0, achievedAt: adjusted?.startTime, activityId: adjusted?.id, ids: adjusted ? [adjusted.id] : [] };
  }
  if (def.id === 'recovery_symptoms_reported_early') {
    const symptoms = ctx.completed.find(activity => (activity.symptoms?.length ?? 0) > 0);
    return { complete: Boolean(symptoms), current: symptoms ? 1 : 0, achievedAt: symptoms?.startTime, activityId: symptoms?.id, ids: symptoms ? [symptoms.id] : [] };
  }
  if (def.id === 'recovery_returned_gradually') {
    for (let index = 1; index < ctx.completed.length; index += 1) {
      const previous = ctx.completed[index - 1];
      const next = ctx.completed[index];
      if (next.startTime - previous.startTime >= 7 * DAY_MS && (next.rpe ?? 4) <= 5) {
        return { complete: true, current: 1, achievedAt: next.startTime, activityId: next.id, ids: [next.id] };
      }
    }
  }
  return { complete: false, current: Math.min(checkInStreak, def.threshold), ids: [] };
}

function evaluateChallenge(def: AchievementDefinitionV2, ctx: EvaluationContext) {
  const month = new Date(ctx.input.now).getMonth();
  const seasonalMonth: Record<AchievementId, number[]> = {
    challenge_august_base_builder: [7],
    challenge_september_consistency: [8],
    challenge_winter_strength_block: [11, 0, 1],
    challenge_spring_mileage_build: [2, 3, 4],
    challenge_summer_long_run: [5, 6, 7],
  };
  if (seasonalMonth[def.id]) {
    const inSeason = seasonalMonth[def.id].includes(month);
    const periodActivities = ctx.completed.filter(activity => seasonalMonth[def.id].includes(new Date(activity.startTime).getMonth()));
    const complete = inSeason && periodActivities.length >= 3;
    return { complete, current: Math.min(periodActivities.length, 3), achievedAt: complete ? periodActivities.at(-1)?.startTime : undefined, ids: periodActivities.map(activity => activity.id) };
  }
  if (def.id === 'challenge_elevation_month') {
    const periods = sumByPeriod(ctx.completed, monthKey, () => true, activity => activity.metrics.elevationGainMeters ?? 0);
    const best = [...periods.entries()].sort((a, b) => b[1].value - a[1].value)[0];
    return { complete: (best?.[1].value ?? 0) >= def.threshold, current: best?.[1].value ?? 0, achievedAt: best?.[1].achievedAt, ids: best?.[1].ids ?? [] };
  }
  return { complete: false, current: 0, ids: [] };
}

export function evaluateAchievementSystem(input: AchievementEvaluationInput): EvaluatedAchievement[] {
  const ctx: EvaluationContext = {
    input: {
      activities: input.activities,
      units: input.units,
      awarded: input.awarded ?? [],
      now: input.now ?? Date.now(),
      scheduledSessions: input.scheduledSessions ?? [],
      readinessHistory: input.readinessHistory ?? [],
      assessmentResults: input.assessmentResults ?? [],
      checkInDates: input.checkInDates ?? [],
    },
    completed: completedActivities(input.activities),
    existingAwards: new Map((input.awarded ?? []).map(item => [awardId(item), awardedAt(item) ?? 0])),
  };

  return ACHIEVEMENT_SYSTEM_REGISTRY.map(def => {
    const result = evaluateDefinition(def, ctx);
    const achievedDate = result.achievedAt ?? (ctx.existingAwards.get(def.id) || undefined);
    const complete = Boolean(result.complete || achievedDate);
    const current = Math.max(0, Math.min(result.current ?? 0, Math.max(def.threshold, result.current ?? 0)));
    const target = Math.max(1, def.threshold);
    const remaining = Math.max(0, def.threshold - current);
    const progressPercentage = Math.max(0, Math.min(1, current / target));
    const state: EvaluatedAchievement['state'] = complete
      ? ctx.existingAwards.has(def.id) && result.achievedAt && result.achievedAt > (ctx.existingAwards.get(def.id) ?? 0)
        ? 'newly_earned'
        : 'earned'
      : 'locked';
    const remainingText = remaining === 0 ? 'Ready to unlock' : `${displayValue(remaining, def, ctx.input.units)} remaining`;
    return {
      ...def,
      state,
      achievedDate,
      achievedActivityId: result.activityId,
      supportingActivityIds: result.ids ?? [],
      currentProgress: current,
      targetProgress: def.threshold,
      remaining,
      progressPercentage,
      displayProgress: displayValue(current, def, ctx.input.units),
      displayTarget: formatAchievementSupportValue(def, ctx.input.units),
      displayRemaining: remainingText,
      accessibilityLabel: `${def.title} achievement. ${complete ? 'Earned' : `Locked. ${remainingText}`}. Progress ${Math.round(progressPercentage * 100)} percent.`,
      currentPeriodKey: result.currentPeriodKey,
    };
  });
}

export function getAchievementDefinition(id: AchievementId): AchievementDefinitionV2 | undefined {
  return ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === id);
}

export function auditAchievementRegistry(definitions: readonly AchievementDefinitionV2[] = ACHIEVEMENT_SYSTEM_REGISTRY): {
  total: number;
  uniqueIds: number;
  duplicateIds: AchievementId[];
  uniqueArtworkKeys: number;
} {
  const counts = new Map<AchievementId, number>();
  const artwork = new Set<string>();
  definitions.forEach(def => {
    counts.set(def.id, (counts.get(def.id) ?? 0) + 1);
    artwork.add(def.artworkKey);
  });
  return {
    total: definitions.length,
    uniqueIds: counts.size,
    duplicateIds: [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    uniqueArtworkKeys: artwork.size,
  };
}

export function achievementShareAllowed(achievement: EvaluatedAchievement): boolean {
  return achievement.shareCardEligibility && achievement.state !== 'locked';
}

export function achievementActivityMetricPreview(activity: Activity, units: UnitSystem): string[] {
  const metrics: string[] = [];
  if ((activity.metrics.distanceMeters ?? 0) > 0) metrics.push(formatDistance((activity.metrics.distanceMeters ?? 0) / M_PER_MI, units));
  if ((activity.metrics.durationSeconds ?? 0) > 0) metrics.push(formatDuration(activity.metrics.durationSeconds));
  if ((activity.metrics.pace?.averageSecondsPerKilometer ?? 0) > 0) metrics.push(formatPaceSecPerMile((activity.metrics.pace?.averageSecondsPerKilometer ?? 0) * 1.609344, units));
  if ((activity.metrics.elevationGainMeters ?? 0) > 0) metrics.push(formatElevationMeters(activity.metrics.elevationGainMeters, units));
  return metrics;
}

export function achievementFamilyLabel(family: AchievementFamily): string {
  return ACHIEVEMENT_SYSTEM_CATEGORY_LABELS[family] ?? titleCase(family);
}
