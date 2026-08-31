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
import { RUN_LEVEL_DEFINITIONS } from '../achievements/runLevels/runLevelDefinitions';
import { LIFETIME_DISTANCE_CYCLING_DEFINITIONS } from '../achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';
import {
  formatLifetimeCyclingDistanceMeters,
  formatLifetimeCyclingMilestoneTarget,
  formatLifetimeCyclingRemainingMeters,
  lifetimeDistanceCyclingDefinitionFromAchievementId,
  lifetimeCyclingAchievementAccessibilityLabel,
} from '../achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingUtils';
import { LIFETIME_DISTANCE_RUNNING_DEFINITIONS } from '../achievements/lifetimeDistanceRunning/lifetimeDistanceRunningDefinitions';
import {
  formatLifetimeRunningDistanceMeters,
  formatLifetimeRunningMilestoneTarget,
  formatLifetimeRunningRemainingMeters,
  lifetimeDistanceRunningDefinitionFromAchievementId,
  lifetimeRunningAchievementAccessibilityLabel,
} from '../achievements/lifetimeDistanceRunning/lifetimeDistanceRunningUtils';
import { WEEKLY_DISTANCE_DEFINITIONS } from '../achievements/weeklyDistance/weeklyDistanceDefinitions';
import {
  formatWeeklyDistanceMeters,
  formatWeeklyDistanceRemainingMeters,
  weeklyDistanceAchievementAccessibilityLabel,
  weeklyDistanceDefinitionFromAchievementId,
} from '../achievements/weeklyDistance/weeklyDistanceUtils';
import { streakDefinitionFromAchievementId } from '../achievements/streaks/streakDefinitions';
import { streakAchievementAccessibilityLabel } from '../achievements/streaks/streakUtils';
import { FIRST_ACHIEVEMENT_DEFINITIONS } from '../achievements/firsts/firstsDefinitions';
import {
  firstAchievementAccessibilityLabel,
  firstAchievementDefinitionFromAchievementId,
  firstAchievementSupportValue,
} from '../achievements/firsts/firstsUtils';
import { STRENGTH_COLORS } from '../achievements/strength/strengthTokens';
import { STRENGTH_REGISTRY_DEFINITIONS } from '../achievements/strength/strengthDefinitions';
import {
  strengthAchievementAccessibilityLabel,
  strengthAchievementDefinitionFromAchievementId,
  strengthAchievementSupportValue,
} from '../achievements/strength/strengthUtils';
import { RECOVERY_COLORS } from '../achievements/recovery/recoveryTokens';
import { RECOVERY_ACHIEVEMENT_DEFINITIONS } from '../achievements/recovery/recoveryDefinitions';
import {
  recoveryAchievementAccessibilityLabel,
  recoveryAchievementDefinitionFromAchievementId,
  recoveryAchievementProgressText,
  recoveryAchievementSupportValue,
} from '../achievements/recovery/recoveryUtils';

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

function titleCase(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function baseDef(input: Omit<AchievementDefinitionV2, 'shareCardEligibility' | 'repeatability' | 'originalArtwork'> & Partial<Pick<AchievementDefinitionV2, 'shareCardEligibility' | 'repeatability'>>): AchievementDefinitionV2 {
  return {
    shareCardEligibility: input.shareCardEligibility ?? true,
    repeatability: input.repeatability ?? 'once',
    originalArtwork: true,
    ...input,
  };
}

export const ACHIEVEMENT_SYSTEM_REGISTRY: AchievementDefinitionV2[] = [
  ...RUN_LEVEL_DEFINITIONS.map(level => baseDef({
    id: level.id,
    family: 'run_levels',
    category: 'run_level',
    title: level.title,
    description: 'Lifetime running progression on the StrideOS run path.',
    criteria: level.thresholdMeters === 0 ? 'Start the StrideOS run path.' : `Reach ${formatDistance(level.thresholdMeters / M_PER_MI, 'imperial')} of lifetime running distance.`,
    ruleKind: 'run_level',
    unitBehavior: 'unit_sensitive_distance',
    threshold: level.thresholdMeters,
    thresholdUnit: 'meters',
    sportApplicability: ['running'],
    artworkKey: `run-level-${level.slug}`,
    artworkPath: level.artworkPath,
    lockedArtworkPath: level.lockedArtworkPath,
    shareArtPath: level.shareOpaquePngPath,
    shareOverlayPath: level.shareTransparentPngPath,
    period: 'lifetime',
    tier: level.tier,
    dominantColor: level.colors.outer,
    sourceNotes: 'Original StrideOS Run Level vector system derived from the approved badge reference image.',
  })),
  ...FIRST_ACHIEVEMENT_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'firsts',
    category: 'firsts',
    title: definition.title,
    shortTitle: definition.compactTitle,
    description: definition.description,
    criteria: definition.criteria,
    ruleKind: 'first',
    unitBehavior: definition.unitBehavior,
    threshold: definition.threshold,
    thresholdUnit: definition.thresholdUnit,
    sportApplicability: [...definition.sportApplicability],
    artworkKey: `firsts-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: 'one_time',
    tier: definition.tier,
    dominantColor: '#DCC0A7',
    sourceNotes: 'Original StrideOS Firsts hexagon vector system derived from the approved badge reference image.',
  })),
  ...LIFETIME_DISTANCE_RUNNING_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'lifetime_running',
    category: 'lifetime_running',
    title: `${definition.milestoneLabel} Mile Run Lifetime`,
    shortTitle: `${definition.milestoneLabel} mi`,
    description: 'Cumulative lifetime running distance.',
    criteria: `Reach ${definition.milestoneLabel} miles of completed running.`,
    ruleKind: 'lifetime_distance',
    unitBehavior: 'unit_sensitive_distance',
    threshold: definition.thresholdMeters,
    thresholdUnit: 'meters',
    sportApplicability: ['running'],
    artworkKey: `lifetime-running-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: 'lifetime',
    tier: definition.tier,
    dominantColor: definition.colors.primary,
    sourceNotes: 'Original StrideOS Lifetime Distance - Running diamond vector system derived from the approved badge reference image.',
  })),
  ...LIFETIME_DISTANCE_CYCLING_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'lifetime_cycling',
    category: 'lifetime_cycling',
    title: `${definition.milestoneLabel} Mile Cycling Lifetime`,
    shortTitle: `${definition.milestoneLabel} mi`,
    description: 'Cumulative lifetime cycling distance.',
    criteria: `Reach ${definition.milestoneLabel} miles of completed cycling.`,
    ruleKind: 'lifetime_distance',
    unitBehavior: 'unit_sensitive_distance',
    threshold: definition.thresholdMeters,
    thresholdUnit: 'meters',
    sportApplicability: ['cycling', 'indoor_cycling'],
    artworkKey: `lifetime-cycling-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: 'lifetime',
    tier: definition.tier,
    dominantColor: definition.colors.primary,
    sourceNotes: 'Original StrideOS Lifetime Distance - Cycling diamond vector system derived from the approved badge reference image.',
  })),
  ...WEEKLY_DISTANCE_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'weekly_distance',
    category: 'weekly_distance',
    title: `${definition.milestoneLabel} Per Week`,
    shortTitle: definition.milestoneLabel,
    description: `Complete ${definition.thresholdKm} kilometers in one reporting week.`,
    criteria: `Complete ${definition.milestoneLabel} in a canonical local reporting week.`,
    ruleKind: 'weekly_distance',
    unitBehavior: 'fixed_k_identity',
    threshold: definition.thresholdMeters,
    thresholdUnit: 'meters',
    sportApplicability: ['running'],
    artworkKey: `weekly-distance-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: 'weekly',
    tier: definition.tier,
    dominantColor: definition.colors.primary,
    sourceNotes: 'Original StrideOS Weekly Distance fixed-K hexagon vector system derived from the approved badge reference image.',
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
  ...STRENGTH_REGISTRY_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'strength',
    category: 'strength',
    title: definition.title,
    shortTitle: definition.compactTitle,
    description: definition.description,
    criteria: definition.criteria,
    ruleKind: definition.ruleKind,
    unitBehavior: definition.unitBehavior,
    threshold: definition.threshold,
    thresholdUnit: definition.thresholdUnit,
    sportApplicability: [...definition.sportApplicability],
    artworkKey: `strength-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: definition.ruleKind === 'strength_count' ? 'lifetime' : 'rolling',
    tier: definition.tier,
    dominantColor: STRENGTH_COLORS.primary,
    sourceNotes: 'Original StrideOS Strength hexagon vector system derived from the approved badge reference image; session-count badges share one canonical dumbbell glyph.',
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
    unitBehavior: 'days',
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
  ...RECOVERY_ACHIEVEMENT_DEFINITIONS.map(definition => baseDef({
    id: definition.id,
    family: 'recovery',
    category: 'recovery',
    title: definition.title,
    shortTitle: definition.compactTitle,
    description: definition.description,
    criteria: definition.criteria,
    ruleKind: 'recovery',
    unitBehavior: definition.unitBehavior,
    threshold: definition.threshold,
    thresholdUnit: definition.thresholdUnit,
    sportApplicability: [...definition.sportApplicability],
    artworkKey: `recovery-${definition.slug}`,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.shareOpaquePngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    period: 'rolling',
    tier: definition.tier,
    dominantColor: RECOVERY_COLORS.primary,
    sourceNotes: 'Original StrideOS Recovery / Readiness hexagon vector system derived from the approved badge reference image.',
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

function displayRunLevelDistance(meters: number, units: UnitSystem): string {
  if (units === 'metric') return `${Math.round(meters / M_PER_KM).toLocaleString()} km`;
  return `${Math.round(meters / M_PER_MI).toLocaleString()} mi`;
}

export function formatAchievementSupportValue(def: AchievementDefinitionV2, units: UnitSystem): string {
  if (def.family === 'run_levels') return displayRunLevelDistance(def.threshold, units);
  if (def.family === 'lifetime_running') {
    const lifetimeRun = lifetimeDistanceRunningDefinitionFromAchievementId(def.id);
    return lifetimeRun
      ? formatLifetimeRunningMilestoneTarget(lifetimeRun.thresholdMiles, units)
      : formatLifetimeRunningDistanceMeters(def.threshold, units);
  }
  if (def.family === 'lifetime_cycling') {
    const lifetimeCycling = lifetimeDistanceCyclingDefinitionFromAchievementId(def.id);
    return lifetimeCycling
      ? formatLifetimeCyclingMilestoneTarget(lifetimeCycling.thresholdMiles, units)
      : formatLifetimeCyclingDistanceMeters(def.threshold, units);
  }
  if (def.family === 'weekly_distance') return formatWeeklyDistanceMeters(def.threshold, units);
  if (def.family === 'firsts') {
    const first = firstAchievementDefinitionFromAchievementId(def.id);
    if (first) return firstAchievementSupportValue(first, units);
  }
  if (def.family === 'strength') {
    const strength = strengthAchievementDefinitionFromAchievementId(def.id);
    if (strength) return strengthAchievementSupportValue(strength);
  }
  if (def.family === 'recovery') {
    const recovery = recoveryAchievementDefinitionFromAchievementId(def.id);
    if (recovery) return recoveryAchievementSupportValue(recovery);
  }
  return displayValue(def.threshold, def, units);
}

function displayAchievementProgressValue(value: number, def: AchievementDefinitionV2, units: UnitSystem): string {
  if (def.family === 'run_levels') return displayRunLevelDistance(value, units);
  if (def.family === 'lifetime_running') return formatLifetimeRunningDistanceMeters(value, units);
  if (def.family === 'lifetime_cycling') return formatLifetimeCyclingDistanceMeters(value, units);
  if (def.family === 'weekly_distance') return formatWeeklyDistanceMeters(value, units);
  return displayValue(value, def, units);
}

function achievementAccessibilityLabel(
  def: AchievementDefinitionV2,
  state: EvaluatedAchievement['state'],
  complete: boolean,
  remaining: number,
  remainingText: string,
  progressPercentage: number,
  units: UnitSystem,
): string {
  if (def.family === 'lifetime_running') {
    const lifetimeRun = lifetimeDistanceRunningDefinitionFromAchievementId(def.id);
    if (lifetimeRun) return lifetimeRunningAchievementAccessibilityLabel(lifetimeRun, state, units, remaining);
  }
  if (def.family === 'lifetime_cycling') {
    const lifetimeCycling = lifetimeDistanceCyclingDefinitionFromAchievementId(def.id);
    if (lifetimeCycling) return lifetimeCyclingAchievementAccessibilityLabel(lifetimeCycling, state, units, remaining);
  }
  if (def.family === 'weekly_distance') {
    const weeklyDistance = weeklyDistanceDefinitionFromAchievementId(def.id);
    if (weeklyDistance) return weeklyDistanceAchievementAccessibilityLabel(weeklyDistance, state, units, remaining);
  }
  if (def.family === 'streaks') {
    const streak = streakDefinitionFromAchievementId(def.id);
    if (streak) return streakAchievementAccessibilityLabel(streak.thresholdDays, complete ? 'earned' : 'locked', remaining, streak.subtitle);
  }
  if (def.family === 'firsts') {
    const first = firstAchievementDefinitionFromAchievementId(def.id);
    if (first) return firstAchievementAccessibilityLabel(first, complete ? 'earned' : 'locked', units);
  }
  if (def.family === 'strength') {
    const strength = strengthAchievementDefinitionFromAchievementId(def.id);
    if (strength) return strengthAchievementAccessibilityLabel(strength, complete ? 'earned' : 'locked', remaining);
  }
  if (def.family === 'recovery') {
    const recovery = recoveryAchievementDefinitionFromAchievementId(def.id);
    if (recovery) return recoveryAchievementAccessibilityLabel(recovery, complete ? 'earned' : 'locked', remaining);
  }
  return `${def.title} achievement. ${complete ? 'Earned' : `Locked. ${remainingText}`}. Progress ${Math.round(progressPercentage * 100)} percent.`;
}

function evaluateFirst(def: AchievementDefinitionV2, ctx: EvaluationContext): DefinitionEvaluationResult {
  const first = progressDate(ctx.completed, activity => {
    if (def.id === 'first_activity') return true;
    if (def.id === 'first_run') return activity.activityType === 'running';
    if (def.id === 'first_walk') return activity.activityType === 'walking';
    if (def.id === 'first_run_walk') return activity.subtype === 'run_walk' || Boolean(activity.metrics.runWalkIntervals?.length);
    if (def.id === 'first_strength_workout') return activity.activityType === 'strength';
    if (def.id === 'first_ride') return isRide(activity);
    if (def.id === 'first_mobility_workout') return activity.activityType === 'mobility';
    if (def.id === 'first_5k' || def.id === 'first_10k' || def.id === 'first_half_marathon' || def.id === 'first_marathon') {
      return isRun(activity) && distanceMeters(activity) >= def.threshold;
    }
    if (def.id === 'first_route_completed') return hasRoute(activity);
    if (def.id === 'first_structured_workout') return isStructured(activity);
    if (def.id === 'first_adapted_workout') {
      return ['modified', 'equivalent_substitute', 'partial', 'stopped_early'].includes(activity.completionClassification ?? '');
    }
    return false;
  });
  if (def.id === 'first_movement_lab_analysis') {
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
    const recoveryDefinition = def.family === 'recovery'
      ? recoveryAchievementDefinitionFromAchievementId(def.id)
      : null;
    const state: EvaluatedAchievement['state'] = complete
      ? ctx.existingAwards.has(def.id) && result.achievedAt && result.achievedAt > (ctx.existingAwards.get(def.id) ?? 0)
        ? 'newly_earned'
        : 'earned'
      : 'locked';
    const remainingText = def.family === 'run_levels' && remaining > 0
      ? `${displayRunLevelDistance(remaining, ctx.input.units)} to ${def.title}`
      : def.family === 'lifetime_running' && remaining > 0
        ? `${formatLifetimeRunningRemainingMeters(remaining, ctx.input.units)} remaining`
      : def.family === 'lifetime_cycling' && remaining > 0
        ? `${formatLifetimeCyclingRemainingMeters(remaining, ctx.input.units)} remaining`
      : def.family === 'weekly_distance' && remaining > 0
        ? `${formatWeeklyDistanceRemainingMeters(remaining, ctx.input.units)} remaining this week`
      : recoveryDefinition && remaining > 0
        ? recoveryAchievementProgressText(recoveryDefinition, current)
      : remaining === 0
        ? 'Ready to unlock'
        : `${displayAchievementProgressValue(remaining, def, ctx.input.units)} remaining`;
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
      displayProgress: displayAchievementProgressValue(current, def, ctx.input.units),
      displayTarget: formatAchievementSupportValue(def, ctx.input.units),
      displayRemaining: remainingText,
      accessibilityLabel: achievementAccessibilityLabel(def, state, complete, remaining, remainingText, progressPercentage, ctx.input.units),
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
