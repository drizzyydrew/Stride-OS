import type { GoalIntent, GoalProfileId } from '../types/goalIntent';
import type { TrainingGoalType } from '../types/plan';
import { isValidDateOnly } from './dateOnly';
export const GOAL_PROFILE_LABELS: Record<GoalProfileId, string> = {
 running: 'Running', get_faster: 'Get faster', race_prep: 'Prepare for a race', hybrid: 'Hybrid · running and strength',
 aerobic_base: 'Build an aerobic base', run_farther: 'Run farther', general_fitness: 'General fitness',
 get_stronger: 'Get stronger', build_muscle: 'Build muscle', power: 'Power', hiking: 'Hiking',
 downhill_skiing: 'Downhill skiing', snowboarding: 'Snowboarding', cross_country_skiing: 'Cross-country skiing', mountaineering: 'Mountaineering',
};
export const GOAL_PROFILE_OPTIONS = Object.entries(GOAL_PROFILE_LABELS).map(([value, label]) => ({ value: value as GoalProfileId, label }));
export const OUTDOOR_PROFILES: readonly GoalProfileId[] = ['hiking', 'downhill_skiing', 'snowboarding', 'cross_country_skiing', 'mountaineering'];
export function validateGoalIntent(value: GoalIntent | undefined): GoalIntent | undefined {
 if (value === undefined) return undefined;
 if (!value || value.version !== 1 || !Array.isArray(value.priorities) || value.priorities.length < 1 || value.priorities.length > 3
  || new Set(value.priorities).size !== value.priorities.length || value.priorities.some(id => !Object.prototype.hasOwnProperty.call(GOAL_PROFILE_LABELS, id))
  || value.priorities.slice(1).includes('race_prep')
  || value.season !== undefined && !['general', 'off_season', 'in_season'].includes(value.season)
  || value.eventDate !== undefined && !isValidDateOnly(value.eventDate)) throw new Error('Choose one primary goal and up to two different supporting goals, with a valid season and event date.');
 return { version: 1, priorities: [...value.priorities], ...(value.season ? { season: value.season } : {}),
  ...(value.eventDate ? { eventDate: value.eventDate, eventName: value.eventName?.trim() || undefined } : {}) };
}
export function legacyGoalForProfile(profile: GoalProfileId): TrainingGoalType {
 if (profile === 'get_faster' || profile === 'race_prep' || profile === 'hybrid') return profile;
 if (['get_stronger', 'build_muscle', 'power'].includes(profile)) return 'general_strength';
 if (OUTDOOR_PROFILES.includes(profile) || profile === 'general_fitness') return 'hybrid';
 return 'general_running';
}
export function profileForLegacyGoal(goal: TrainingGoalType): GoalProfileId {
 return goal === 'general_running' ? 'running' : goal === 'general_strength' ? 'get_stronger' : goal;
}
export function legacySupportingForIntent(intent: GoalIntent): TrainingGoalType[] {
 const primary = legacyGoalForProfile(intent.priorities[0]!);
 return [...new Set(intent.priorities.slice(1).map(legacyGoalForProfile))].filter(goal => goal !== primary && goal !== 'race_prep').slice(0, 2);
}
export function intentPriorityNote(intent: GoalIntent): string {
 return `${intent.priorities.map((id, index) => `${index + 1}. ${GOAL_PROFILE_LABELS[id]}`).join(' → ')}. One shared time and recovery budget; readiness comes first, and lower-priority work yields first.`;
}

/** Supporting speed may receive one earned quality session unless the primary explicitly requires easy-only or a different sport. */
export function intentAllowsRunningQuality(intent: GoalIntent): boolean {
 const primary = intent.priorities[0]!;
 if (primary === 'aerobic_base') return false;
 if (OUTDOOR_PROFILES.includes(primary)) return intent.priorities.slice(1).find(profile => ['running', 'aerobic_base', 'run_farther', 'get_faster'].includes(profile)) === 'get_faster';
 return ['running', 'get_faster', 'race_prep', 'hybrid'].includes(primary) || intent.priorities.includes('get_faster');
}
export function normalizeGoalIntent(value: unknown): GoalIntent | undefined {
 try { return validateGoalIntent(value as GoalIntent | undefined); } catch { return undefined; }
}
