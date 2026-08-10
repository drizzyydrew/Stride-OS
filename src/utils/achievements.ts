import type { Activity } from '../types/activity';

export type AchievementId =
  | 'long_run_builder'
  | 'easy_means_easy'
  | 'strong_strides'
  | 'recovery_master'
  | 'consistency'
  | 'smart_adjustment'
  | 'back_in_rhythm'
  | 'consistency_wins'
  | 'smart_progression'
  | 'listened_to_your_body'
  | 'back_on_track'
  | 'balanced_training'
  | 'foundation_builder'
  | 'strength_supports_running'
  | 'deload_done_right'
  | 'quality_earned'
  | 'pr_longest_run'
  | 'pr_farthest_run'
  | 'pr_fastest_1k'
  | 'pr_fastest_mile'
  | 'pr_fastest_5k'
  | 'pr_fastest_10k'
  | 'pr_longest_ride'
  | 'pr_highest_ride_elevation'
  | 'monthly_run_10k'
  | 'monthly_run_25k'
  | 'monthly_run_50k'
  | 'monthly_run_75k'
  | 'monthly_run_100k'
  | 'monthly_run_125k'
  | 'monthly_run_150k'
  | 'monthly_run_175k'
  | 'monthly_run_200k'
  | 'three_training_days_week'
  | 'three_week_consistency'
  | 'four_week_consistency'
  | 'six_week_consistency'
  | 'three_month_consistency'
  | 'six_month_consistency'
  | 'stride_level_starter'
  | 'stride_level_pacesetter'
  | 'stride_level_builder'
  | 'stride_level_endurer'
  | 'stride_level_advancer'
  | 'stride_level_elite'
  | 'stride_level_icon'
  | 'challenge_25k_month'
  | 'challenge_50k_month'
  | 'challenge_100k_month'
  | 'challenge_four_week_consistency'
  | 'challenge_strength_run_balance';

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  criteria: string;
  category?: AchievementCategory;
};

export type AchievementCategory =
  | 'healthy_progress'
  | 'personal_record'
  | 'monthly_distance'
  | 'consistency'
  | 'training_quality'
  | 'challenge'
  | 'stride_level';

export type PersonalRecord = {
  id: AchievementId;
  title: string;
  activityId: string;
  activityType: Activity['activityType'];
  value: number;
  unit: 'seconds' | 'meters';
  achievedAt: number;
  evidence: string;
};

export type MonthlyDistanceMilestone = {
  id: AchievementId;
  monthKey: string;
  thresholdMeters: number;
  distanceMeters: number;
  activityIds: string[];
};

export type ChallengeDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  category: 'monthly_distance' | 'consistency' | 'balance';
  thresholdMeters?: number;
  requiredWeeks?: number;
};

export type ChallengeProgress = {
  definition: ChallengeDefinition;
  progress: number;
  target: number;
  complete: boolean;
  supportingActivityIds: string[];
};

export type StrideLevel = {
  id: AchievementId;
  title: string;
  tier: number;
  thresholdMeters: number;
  cumulativeMeters: number;
  complete: boolean;
};

export type AchievementHubModel = {
  definitions: AchievementDefinition[];
  personalRecords: PersonalRecord[];
  monthlyMilestones: MonthlyDistanceMilestone[];
  consistencyAwards: AchievementAward[];
  challengeProgress: ChallengeProgress[];
  strideLevels: StrideLevel[];
  shareable: AchievementDefinition[];
};

export const HEALTHY_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'consistency_wins', title: 'Consistency Wins', description: 'Completed planned training consistently.', criteria: 'At least three completed training days in the last seven days.' },
  { id: 'long_run_builder', title: 'Long Run Builder', description: 'Built long-run durability gradually.', criteria: 'Complete a running session of at least 45 minutes without a skipped status.' },
  { id: 'recovery_master', title: 'Recovery Master', description: 'Used recovery appropriately.', criteria: 'Complete recovery, mobility, or active recovery work.' },
  { id: 'smart_progression', title: 'Smart Progression', description: 'Progressed without a large workload spike.', criteria: 'Complete at least four recent sessions while the seven-day load trend stays controlled.' },
  { id: 'strong_strides', title: 'Strong Strides', description: 'Completed running-economy or stride sessions appropriately.', criteria: 'Complete running-economy, strides, or coordinated strength support work.' },
  { id: 'foundation_builder', title: 'Foundation Builder', description: 'Completed an aerobic foundation phase.', criteria: 'Complete a foundation-focused session or foundation block work.' },
  { id: 'strength_supports_running', title: 'Strength Supports Running', description: 'Completed coordinated strength work.', criteria: 'Complete strength work alongside running or walking in the same seven-day period.' },
  { id: 'listened_to_your_body', title: 'Listened to Your Body', description: 'Used an appropriate adjustment instead of forcing training.', criteria: 'Log a modified, partial, stopped-early, or equivalent-substitute completion.' },
  { id: 'back_on_track', title: 'Back on Track', description: 'Returned consistently after an interruption.', criteria: 'Complete training after a gap of at least seven days.' },
  { id: 'deload_done_right', title: 'Deload Done Right', description: 'Completed a deload and returned appropriately.', criteria: 'Complete recovery-oriented work or lower-load training after a demanding period.' },
  { id: 'balanced_training', title: 'Balanced Training', description: 'Maintained appropriate hard/easy separation.', criteria: 'Complete endurance and strength/support work in the same week without rewarding excess volume.' },
  { id: 'quality_earned', title: 'Quality Earned', description: 'Reached appropriate eligibility before adding quality work.', criteria: 'Complete a controlled quality session after recent consistency exists.' },
  { id: 'easy_means_easy', title: 'Easy Means Easy', description: 'Kept an easy session controlled.', criteria: 'Complete an easy run at RPE 4 or lower.' },
];

export const PERSONAL_RECORD_DEFINITIONS: AchievementDefinition[] = [
  { id: 'pr_longest_run', title: 'Longest Run', description: 'Most time in one completed run.', criteria: 'Longest completed running duration.', category: 'personal_record' },
  { id: 'pr_farthest_run', title: 'Farthest Run', description: 'Most distance in one completed run.', criteria: 'Farthest completed running distance.', category: 'personal_record' },
  { id: 'pr_fastest_1k', title: 'Fastest 1K', description: 'Fastest valid continuous 1K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_mile', title: 'Fastest Mile', description: 'Fastest valid continuous mile effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_5k', title: 'Fastest 5K', description: 'Fastest valid continuous 5K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_10k', title: 'Fastest 10K', description: 'Fastest valid continuous 10K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_longest_ride', title: 'Longest Ride', description: 'Farthest completed cycling activity.', criteria: 'Farthest completed ride with legitimate distance.', category: 'personal_record' },
  { id: 'pr_highest_ride_elevation', title: 'Highest Ride Climb', description: 'Most elevation gain in a completed ride.', criteria: 'Highest stored elevation gain for cycling.', category: 'personal_record' },
];

export const MONTHLY_DISTANCE_THRESHOLDS_KM = [10, 25, 50, 75, 100, 125, 150, 175, 200] as const;

const MONTHLY_DISTANCE_IDS: Record<number, AchievementId> = {
  10: 'monthly_run_10k',
  25: 'monthly_run_25k',
  50: 'monthly_run_50k',
  75: 'monthly_run_75k',
  100: 'monthly_run_100k',
  125: 'monthly_run_125k',
  150: 'monthly_run_150k',
  175: 'monthly_run_175k',
  200: 'monthly_run_200k',
};

export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  { id: 'challenge_25k_month', title: '25K Month', description: 'Complete 25 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 25_000 },
  { id: 'challenge_50k_month', title: '50K Month', description: 'Complete 50 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 50_000 },
  { id: 'challenge_100k_month', title: '100K Month', description: 'Complete 100 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 100_000 },
  { id: 'challenge_four_week_consistency', title: 'Four-Week Consistency', description: 'Complete appropriate training in four consecutive weeks.', category: 'consistency', requiredWeeks: 4 },
  { id: 'challenge_strength_run_balance', title: 'Strength + Run Balance', description: 'Pair running or walking with strength support in the same week.', category: 'balance', requiredWeeks: 1 },
];

export const STRIDE_LEVEL_DEFINITIONS: Omit<StrideLevel, 'cumulativeMeters' | 'complete'>[] = [
  { id: 'stride_level_starter', title: 'Starter', tier: 1, thresholdMeters: 0 },
  { id: 'stride_level_pacesetter', title: 'Pacesetter', tier: 2, thresholdMeters: 50_000 },
  { id: 'stride_level_builder', title: 'Builder', tier: 3, thresholdMeters: 150_000 },
  { id: 'stride_level_endurer', title: 'Endurer', tier: 4, thresholdMeters: 400_000 },
  { id: 'stride_level_advancer', title: 'Advancer', tier: 5, thresholdMeters: 800_000 },
  { id: 'stride_level_elite', title: 'Elite', tier: 6, thresholdMeters: 1_600_000 },
  { id: 'stride_level_icon', title: 'Icon', tier: 7, thresholdMeters: 3_200_000 },
];

export const BUILD57_ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...HEALTHY_ACHIEVEMENTS.map(item => ({ ...item, category: item.category ?? 'healthy_progress' as const })),
  ...PERSONAL_RECORD_DEFINITIONS,
  ...MONTHLY_DISTANCE_THRESHOLDS_KM.map(km => ({
    id: MONTHLY_DISTANCE_IDS[km],
    title: `${km}K Month`,
    description: `${km} kilometers completed in one calendar month.`,
    criteria: 'Sum completed running distance by calendar month using canonical meters.',
    category: 'monthly_distance' as const,
  })),
  { id: 'three_training_days_week', title: 'Three Training Days', description: 'Three completed training days in a calendar week.', criteria: 'Three distinct completed training dates in the same week.', category: 'consistency' },
  { id: 'three_week_consistency', title: '3-Week Consistency', description: 'Appropriate training consistency for three consecutive weeks.', criteria: 'At least three completed training days in each of three consecutive weeks.', category: 'consistency' },
  { id: 'four_week_consistency', title: '4-Week Consistency', description: 'Appropriate training consistency for four consecutive weeks.', criteria: 'At least three completed training days in each of four consecutive weeks.', category: 'consistency' },
  { id: 'six_week_consistency', title: '6-Week Consistency', description: 'Appropriate training consistency for six consecutive weeks.', criteria: 'At least three completed training days in each of six consecutive weeks.', category: 'consistency' },
  { id: 'three_month_consistency', title: '3-Month Consistency', description: 'Sustained training rhythm for three months.', criteria: 'At least three completed training days in each of twelve consecutive weeks.', category: 'consistency' },
  { id: 'six_month_consistency', title: '6-Month Consistency', description: 'Sustained training rhythm for six months.', criteria: 'At least three completed training days in each of twenty-four consecutive weeks.', category: 'consistency' },
  ...STRIDE_LEVEL_DEFINITIONS.map(level => ({
    id: level.id,
    title: `Stride Level: ${level.title}`,
    description: 'Long-term distance progression on the Stride Path.',
    criteria: `Reach ${Math.round(level.thresholdMeters / 1000)} kilometers of cumulative running, walking, hiking, or cycling distance.`,
    category: 'stride_level' as const,
  })),
  ...CHALLENGE_DEFINITIONS.map(challenge => ({
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    criteria: challenge.category === 'monthly_distance'
      ? `Complete ${Math.round((challenge.thresholdMeters ?? 0) / 1000)} kilometers in a month.`
      : challenge.description,
    category: 'challenge' as const,
  })),
];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function completedActivities(activities: readonly Activity[]): Activity[] {
  return activities
    .filter(activity => activity.status !== 'skipped')
    .sort((a, b) => a.startTime - b.startTime);
}

function distanceMeters(activity: Activity): number {
  const value = activity.metrics.distanceMeters ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function durationSeconds(activity: Activity): number {
  const value = activity.metrics.durationSeconds ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function monthKey(timeMs: number): string {
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(timeMs: number): string {
  const date = new Date(timeMs);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function bestBy<T>(items: readonly T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const next = score(item);
    if (next > bestScore) {
      best = item;
      bestScore = next;
    }
  }
  return best;
}

function addRecord(records: PersonalRecord[], record: PersonalRecord | null): void {
  if (record) records.push(record);
}

export function calculatePersonalRecords(activities: readonly Activity[]): PersonalRecord[] {
  const completed = completedActivities(activities);
  const runs = completed.filter(activity => activity.activityType === 'running');
  const rides = completed.filter(activity => activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling');
  const records: PersonalRecord[] = [];
  const longestRun = bestBy(runs, durationSeconds);
  addRecord(records, longestRun && durationSeconds(longestRun) > 0 ? {
    id: 'pr_longest_run',
    title: 'Longest Run',
    activityId: longestRun.id,
    activityType: longestRun.activityType,
    value: durationSeconds(longestRun),
    unit: 'seconds',
    achievedAt: longestRun.startTime,
    evidence: 'completed running duration',
  } : null);
  const farthestRun = bestBy(runs, distanceMeters);
  addRecord(records, farthestRun && distanceMeters(farthestRun) > 0 ? {
    id: 'pr_farthest_run',
    title: 'Farthest Run',
    activityId: farthestRun.id,
    activityType: farthestRun.activityType,
    value: distanceMeters(farthestRun),
    unit: 'meters',
    achievedAt: farthestRun.startTime,
    evidence: 'completed running distance',
  } : null);
  const longestRide = bestBy(rides, distanceMeters);
  addRecord(records, longestRide && distanceMeters(longestRide) > 0 ? {
    id: 'pr_longest_ride',
    title: 'Longest Ride',
    activityId: longestRide.id,
    activityType: longestRide.activityType,
    value: distanceMeters(longestRide),
    unit: 'meters',
    achievedAt: longestRide.startTime,
    evidence: 'completed cycling distance',
  } : null);
  const climbingRide = bestBy(rides, activity => activity.metrics.elevationGainMeters ?? 0);
  addRecord(records, climbingRide && (climbingRide.metrics.elevationGainMeters ?? 0) > 0 ? {
    id: 'pr_highest_ride_elevation',
    title: 'Highest Ride Climb',
    activityId: climbingRide.id,
    activityType: climbingRide.activityType,
    value: climbingRide.metrics.elevationGainMeters ?? 0,
    unit: 'meters',
    achievedAt: climbingRide.startTime,
    evidence: 'stored cycling elevation gain',
  } : null);
  return records;
}

export function calculateMonthlyDistanceMilestones(activities: readonly Activity[]): MonthlyDistanceMilestone[] {
  const byMonth = new Map<string, { distanceMeters: number; activityIds: string[] }>();
  for (const activity of completedActivities(activities)) {
    if (activity.activityType !== 'running') continue;
    const distance = distanceMeters(activity);
    if (distance <= 0) continue;
    const key = monthKey(activity.startTime);
    const current = byMonth.get(key) ?? { distanceMeters: 0, activityIds: [] };
    current.distanceMeters += distance;
    current.activityIds.push(activity.id);
    byMonth.set(key, current);
  }
  const milestones: MonthlyDistanceMilestone[] = [];
  for (const [key, value] of byMonth) {
    for (const km of MONTHLY_DISTANCE_THRESHOLDS_KM) {
      const thresholdMeters = km * 1000;
      if (value.distanceMeters >= thresholdMeters) {
        milestones.push({
          id: MONTHLY_DISTANCE_IDS[km],
          monthKey: key,
          thresholdMeters,
          distanceMeters: value.distanceMeters,
          activityIds: value.activityIds,
        });
      }
    }
  }
  return milestones.sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.thresholdMeters - b.thresholdMeters);
}

function completedTrainingDaysByWeek(activities: readonly Activity[]): Map<string, Set<string>> {
  const weeks = new Map<string, Set<string>>();
  for (const activity of completedActivities(activities)) {
    const date = new Date(activity.startTime);
    const dateKey = date.toDateString();
    const key = weekKey(activity.startTime);
    const days = weeks.get(key) ?? new Set<string>();
    days.add(dateKey);
    weeks.set(key, days);
  }
  return weeks;
}

function latestConsecutiveQualifiedWeeks(activities: readonly Activity[], now: number): number {
  const weeks = completedTrainingDaysByWeek(activities);
  let count = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (count < 60) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if ((weeks.get(key)?.size ?? 0) < 3) break;
    count += 1;
    cursor.setTime(cursor.getTime() - WEEK_MS);
  }
  return count;
}

export function calculateConsistencyAwards(
  activities: readonly Activity[],
  now = Date.now(),
): AchievementAward[] {
  const awards: AchievementAward[] = [];
  const weekCount = latestConsecutiveQualifiedWeeks(activities, now);
  const ids: [AchievementId, number][] = [
    ['three_week_consistency', 3],
    ['four_week_consistency', 4],
    ['six_week_consistency', 6],
    ['three_month_consistency', 12],
    ['six_month_consistency', 24],
  ];
  const recentIds = completedActivities(activities)
    .filter(activity => now - activity.startTime <= Math.max(weekCount, 1) * WEEK_MS)
    .map(activity => activity.id);
  if (completedTrainingDaysByWeek(activities).size && [...completedTrainingDaysByWeek(activities).values()].some(days => days.size >= 3)) {
    awards.push({ id: 'three_training_days_week', supportingActivityIds: recentIds.slice(0, 6), supportingSessionIds: [] });
  }
  for (const [id, threshold] of ids) {
    if (weekCount >= threshold) {
      awards.push({ id, supportingActivityIds: recentIds.slice(0, 20), supportingSessionIds: [] });
    }
  }
  return awards;
}

export function calculateStrideLevels(activities: readonly Activity[]): StrideLevel[] {
  const cumulativeMeters = completedActivities(activities)
    .filter(activity => ['running', 'walking', 'hiking', 'cycling', 'indoor_cycling'].includes(activity.activityType))
    .reduce((sum, activity) => sum + distanceMeters(activity), 0);
  return STRIDE_LEVEL_DEFINITIONS.map(level => ({
    ...level,
    cumulativeMeters,
    complete: cumulativeMeters >= level.thresholdMeters,
  }));
}

export function calculateChallengeProgress(
  activities: readonly Activity[],
  now = Date.now(),
): ChallengeProgress[] {
  const currentMonth = monthKey(now);
  const currentMonthRuns = completedActivities(activities)
    .filter(activity => activity.activityType === 'running' && monthKey(activity.startTime) === currentMonth);
  const currentMonthDistance = currentMonthRuns.reduce((sum, activity) => sum + distanceMeters(activity), 0);
  const consistencyWeeks = latestConsecutiveQualifiedWeeks(activities, now);
  const recent = completedActivities(activities).filter(activity => now - activity.startTime <= WEEK_MS);
  const hasBalance = recent.some(activity => ['running', 'walking'].includes(activity.activityType))
    && recent.some(activity => activity.activityType === 'strength');
  return CHALLENGE_DEFINITIONS.map(definition => {
    if (definition.category === 'monthly_distance') {
      const target = definition.thresholdMeters ?? 0;
      return {
        definition,
        progress: Math.min(currentMonthDistance, target),
        target,
        complete: currentMonthDistance >= target,
        supportingActivityIds: currentMonthRuns.map(activity => activity.id),
      };
    }
    if (definition.category === 'consistency') {
      const target = definition.requiredWeeks ?? 1;
      return {
        definition,
        progress: Math.min(consistencyWeeks, target),
        target,
        complete: consistencyWeeks >= target,
        supportingActivityIds: recent.map(activity => activity.id),
      };
    }
    return {
      definition,
      progress: hasBalance ? 1 : 0,
      target: 1,
      complete: hasBalance,
      supportingActivityIds: recent.map(activity => activity.id),
    };
  });
}

export function buildAchievementHubModel(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  now = Date.now(),
): AchievementHubModel {
  const healthyAwards = evaluateAchievementAwards(activities, existing, now);
  const personalRecords = calculatePersonalRecords(activities);
  const monthlyMilestones = calculateMonthlyDistanceMilestones(activities);
  const consistencyAwards = calculateConsistencyAwards(activities, now);
  const challengeProgress = calculateChallengeProgress(activities, now);
  const strideLevels = calculateStrideLevels(activities);
  const earnedIds = new Set<AchievementId>([
    ...healthyAwards.map(item => item.id),
    ...personalRecords.map(item => item.id),
    ...monthlyMilestones.map(item => item.id),
    ...consistencyAwards.map(item => item.id),
    ...challengeProgress.filter(item => item.complete).map(item => item.definition.id),
    ...strideLevels.filter(item => item.complete).map(item => item.id),
  ]);
  return {
    definitions: BUILD57_ACHIEVEMENT_DEFINITIONS,
    personalRecords,
    monthlyMilestones,
    consistencyAwards,
    challengeProgress,
    strideLevels,
    shareable: BUILD57_ACHIEVEMENT_DEFINITIONS.filter(item => earnedIds.has(item.id)),
  };
}

export function evaluateAchievements(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  now = Date.now(),
): AchievementId[] {
  return evaluateAchievementAwards(activities, existing, now).map(award => award.id);
}

export type AchievementAward = {
  id: AchievementId;
  supportingActivityIds: string[];
  supportingSessionIds: string[];
};

export function evaluateAchievementAwards(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  now = Date.now(),
): AchievementAward[] {
  const completed = completedActivities(activities);
  const awards = new Set<AchievementId>(existing);
  const support = new Map<AchievementId, AchievementAward>();
  const last7 = completed.filter(activity => now - activity.startTime <= 7 * DAY_MS);
  const award = (id: AchievementId, matches: readonly Activity[]) => {
    awards.add(id);
    if (existing.includes(id)) return;
    support.set(id, {
      id,
      supportingActivityIds: matches.map(activity => activity.id),
      supportingSessionIds: matches.map(activity => activity.scheduledSessionId).filter((value): value is string => Boolean(value)),
    });
  };

  const longRun = completed.find(activity => activity.activityType === 'running' && (activity.metrics.durationSeconds ?? 0) >= 45 * 60);
  if (longRun) {
    award('long_run_builder', [longRun]);
  }
  const easy = completed.find(activity => activity.activityType === 'running' && activity.rpe !== undefined && activity.rpe <= 4);
  if (easy) {
    award('easy_means_easy', [easy]);
  }
  const strength = completed.find(activity => activity.activityType === 'strength');
  if (strength) {
    award('strong_strides', [strength]);
  }
  const recovery = completed.find(activity => activity.activityType === 'mobility' || activity.subtype === 'recovery');
  if (recovery) {
    award('recovery_master', [recovery]);
    award('deload_done_right', [recovery]);
  }
  const foundation = completed.find(activity => /foundation|base/i.test(`${activity.notes ?? ''} ${activity.scheduledSessionId ?? ''}`));
  if (foundation) {
    award('foundation_builder', [foundation]);
  }
  if (new Set(last7.map(activity => new Date(activity.startTime).toDateString())).size >= 3) {
    award('consistency_wins', last7.slice(0, 3));
  }
  const adjusted = completed.find(activity => ['modified', 'partial', 'stopped_early', 'equivalent_substitute'].includes(activity.completionClassification ?? ''));
  if (adjusted) {
    award('listened_to_your_body', [adjusted]);
  }
  if (completed.length >= 2) {
    const gaps = completed.slice(1).map((activity, index) => activity.startTime - completed[index].startTime);
    const gapIndex = gaps.findIndex(gap => gap >= 7 * DAY_MS);
    if (gapIndex >= 0) award('back_on_track', [completed[gapIndex + 1]]);
  }
  if (
    last7.some(activity => ['running', 'walking'].includes(activity.activityType))
    && last7.some(activity => activity.activityType === 'strength')
  ) {
    award('balanced_training', last7.filter(activity => ['running', 'walking', 'strength'].includes(activity.activityType)).slice(0, 3));
    award('strength_supports_running', last7.filter(activity => ['running', 'walking', 'strength'].includes(activity.activityType)).slice(0, 3));
  }
  if (last7.length >= 4) {
    award('smart_progression', last7.slice(0, 4));
  }
  const quality = completed.find(activity => /stride|quality|interval|tempo/i.test(`${activity.notes ?? ''} ${activity.subtype ?? ''}`));
  if (quality && last7.length >= 3) {
    award('quality_earned', [quality]);
  }

  return [...awards].map(id => support.get(id) ?? { id, supportingActivityIds: [], supportingSessionIds: [] });
}
