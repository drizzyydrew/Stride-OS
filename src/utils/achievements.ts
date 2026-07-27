import type { Activity } from '../types/activity';

export type AchievementId =
  | 'long_run_builder'
  | 'easy_means_easy'
  | 'strong_strides'
  | 'recovery_master'
  | 'consistency'
  | 'smart_adjustment'
  | 'back_in_rhythm'
  | 'balanced_training';

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
};

export const HEALTHY_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'long_run_builder', title: 'Long Run Builder', description: 'Completed a meaningful longer aerobic session.' },
  { id: 'easy_means_easy', title: 'Easy Means Easy', description: 'Kept an easy session controlled.' },
  { id: 'strong_strides', title: 'Strong Strides', description: 'Supported running with strength work.' },
  { id: 'recovery_master', title: 'Recovery Master', description: 'Used recovery as part of the plan.' },
  { id: 'consistency', title: 'Consistency', description: 'Logged regular training across the week.' },
  { id: 'smart_adjustment', title: 'Smart Adjustment', description: 'Adjusted a workout instead of forcing the original.' },
  { id: 'back_in_rhythm', title: 'Back in Rhythm', description: 'Returned with a completed session after time away.' },
  { id: 'balanced_training', title: 'Balanced Training', description: 'Mixed endurance and strength without chasing only one signal.' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateAchievements(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  now = Date.now(),
): AchievementId[] {
  const completed = activities
    .filter(activity => activity.status !== 'skipped')
    .sort((a, b) => a.startTime - b.startTime);
  const awards = new Set<AchievementId>(existing);
  const last7 = completed.filter(activity => now - activity.startTime <= 7 * DAY_MS);

  if (completed.some(activity => activity.activityType === 'running' && (activity.metrics.durationSeconds ?? 0) >= 45 * 60)) {
    awards.add('long_run_builder');
  }
  if (completed.some(activity => activity.activityType === 'running' && activity.rpe !== undefined && activity.rpe <= 4)) {
    awards.add('easy_means_easy');
  }
  if (completed.some(activity => activity.activityType === 'strength')) {
    awards.add('strong_strides');
  }
  if (completed.some(activity => activity.activityType === 'mobility' || activity.subtype === 'recovery')) {
    awards.add('recovery_master');
  }
  if (new Set(last7.map(activity => new Date(activity.startTime).toDateString())).size >= 3) {
    awards.add('consistency');
  }
  if (completed.some(activity => activity.completionClassification === 'modified' || activity.completionClassification === 'equivalent_substitute')) {
    awards.add('smart_adjustment');
  }
  if (completed.length >= 2) {
    const gaps = completed.slice(1).map((activity, index) => activity.startTime - completed[index].startTime);
    if (gaps.some(gap => gap >= 7 * DAY_MS)) awards.add('back_in_rhythm');
  }
  if (
    last7.some(activity => ['running', 'walking'].includes(activity.activityType))
    && last7.some(activity => activity.activityType === 'strength')
  ) {
    awards.add('balanced_training');
  }

  return [...awards];
}
