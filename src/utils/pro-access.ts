import { normalizeSupportingGoals } from './trainingGoals';
import type { TrainingGoalType, RacePriority } from '../types/plan';
import type { RaceDistance } from '../types/training';
import { isValidDateOnly } from './dateOnly';

export type ProAccessStatus = 'included' | 'active' | 'checking' | 'inactive' | 'unavailable' | 'signed-out';
export type ProFeature = 'personalized-plans' | 'week-rebuild';
export type ProAccess = { status: ProAccessStatus; allowed: boolean; message: string };

/** Access never changes, deletes, or hides an athlete's existing training. */
export function evaluateProAccess(input: {
  billingEnabled: boolean;
  billingConfigured: boolean;
  owner: string | null;
  localAccess: boolean;
  online: boolean;
  membershipOwner: string | null;
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
}): ProAccess {
  if (!input.billingEnabled) return { status: 'included', allowed: true, message: '' };
  if (!input.owner || !input.localAccess) return { status: 'signed-out', allowed: false, message: 'Sign in with the account that owns this training history.' };
  if (!input.billingConfigured || !input.online) return { status: 'unavailable', allowed: false, message: 'Connect to the internet to verify membership before creating personalized training. Your saved plans and activities remain available.' };
  if (input.error && input.membershipOwner === input.owner) return { status: 'unavailable', allowed: false, message: 'Membership could not be verified. Retry online. Your saved plans and activities remain available.' };
  if (input.membershipOwner !== input.owner || input.isLoading) return { status: 'checking', allowed: false, message: 'Checking your membership…' };
  return input.isPro
    ? { status: 'active', allowed: true, message: '' }
    : { status: 'inactive', allowed: false, message: 'Personalized plans and automatic week rebuilding are included with StrideOS Pro. Your existing plans and history remain available.' };
}

export function adaptationNeedsPro(overlays: ReadonlyArray<{ action: string }>, requiresPro?: 'week-rebuild'): boolean {
  // Rest, reducing intensity, skipping, manual moves, and reverting stay free.
  return requiresPro === 'week-rebuild' || overlays.some(overlay => overlay.action === 'rebuild_week');
}

export function onboardingTrainingChoice(input: { billingEnabled: boolean; hasExistingPlan: boolean; proAllowed: boolean }): 'preserve' | 'structured' | 'open' {
  if (input.hasExistingPlan) return 'preserve';
  return !input.billingEnabled || input.proAllowed ? 'structured' : 'open';
}

/** A route hint can restore setup inputs, never activate a plan or replace one. */
export function onboardingGoalDraft(input: {
  source: unknown; openTraining: boolean; hasProgrammedBefore: boolean; today: string;
  data: { secondaryGoalTypes?: TrainingGoalType[]; goalType?: TrainingGoalType; raceName?: string; raceDate?: string; raceDistance?: RaceDistance; racePriority?: RacePriority };
}): { secondaryGoalTypes?: TrainingGoalType[]; goalType: TrainingGoalType; title: string; raceName: string; raceDate?: string; distance: RaceDistance; priority: RacePriority } | null {
  if (input.source !== 'onboarding' || !input.openTraining || input.hasProgrammedBefore) return null;
  const { data } = input;
  const goalType = ['race_prep', 'general_running', 'get_faster', 'general_strength', 'hybrid'].includes(data.goalType ?? '') ? data.goalType! : 'general_running';
  const raceName = typeof data.raceName === 'string' ? data.raceName : '';
  const raceDate = data.raceDate && isValidDateOnly(data.raceDate) && data.raceDate >= input.today ? data.raceDate : undefined;
  const distance = ['5k', '10k', 'half_marathon', 'marathon'].includes(data.raceDistance ?? '') ? data.raceDistance! : '5k';
  const priority = ['A', 'B', 'tune_up'].includes(data.racePriority ?? '') ? data.racePriority! : 'A';
  const secondaryGoalTypes = normalizeSupportingGoals(goalType, data.secondaryGoalTypes);
  return { goalType, ...(secondaryGoalTypes.length ? { secondaryGoalTypes } : {}), title: goalType === 'race_prep' ? raceName : '', raceName, raceDate, distance, priority };
}
