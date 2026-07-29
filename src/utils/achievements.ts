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
  | 'quality_earned';

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  criteria: string;
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

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const completed = activities
    .filter(activity => activity.status !== 'skipped')
    .sort((a, b) => a.startTime - b.startTime);
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
