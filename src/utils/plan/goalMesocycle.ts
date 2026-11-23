import type { TrainingPhase } from '../../types/training';
import type { GoalIntent } from '../../types/goalIntent';
import { GOAL_PROFILE_LABELS, intentPriorityNote } from '../goalIntent';
import type { TrainingGoalType } from '../../types/plan';
import { getWeekInBlock, shouldApplyDeload } from '../training/deloadModel';

export type GoalMesocycle = {
  blockNumber: number;
  weekInBlock: number;
  loadingWeek: number;
  focus: string;
  doseStage: 'practice' | 'develop' | 'review' | 'recover';
  recovery: boolean;
  strengthLoading?: 'accumulation' | 'intensification' | 'recovery';
};

/** A six-week exercise-practice block and the existing 3:1 load/recovery
 * microcycle are separate clocks. Neither clock earns a load increase. */
export function getGoalMesocycle(currentWeek: number, phase: TrainingPhase, goalType: TrainingGoalType, intent?: GoalIntent): GoalMesocycle {
  const week = Math.max(1, Math.floor(Number.isFinite(currentWeek) ? currentWeek : 1));
  const blockNumber = Math.floor((week - 1) / 6) + 1;
  const weekInBlock = ((week - 1) % 6) + 1;
  const recovery = ['recovery', 'transition', 'taper'].includes(phase) || shouldApplyDeload(week, phase);
  // KILO-informed phase intent is a coaching choice for strength-first goals,
  // not permission to progress by date or to remove the existing recovery week.
  const strengthLoading = goalType === 'general_strength'
    ? recovery ? 'recovery' as const : weekInBlock <= 3 ? 'accumulation' as const : 'intensification' as const
    : undefined;
  const goalFocus = goalType === 'general_strength' ? 'Strength skill and progressive resistance; aerobic work supports recovery'
    : goalType === 'hybrid' ? 'Combined running and strength; protect the current priority and total recovery demand'
    : goalType === 'get_faster' ? 'Running speed built from repeatable easy training, relaxed accelerations and gradually tolerated faster work'
    : goalType === 'race_prep' ? 'Race-specific capacity built on repeatable easy training'
    : 'Aerobic consistency followed by gradually earned faster running';
  const specificFocus = intent ? `${GOAL_PROFILE_LABELS[intent.priorities[0]!]} · ${intent.season === 'in_season' ? 'Maintain useful capacity around actual sport practice; reduce supporting fatigue' : intent.season === 'off_season' ? 'Build general capacity before event-specific preparation' : 'Repeat goal-specific work, then progress from actual response'}. ${intentPriorityNote(intent)}` : undefined;
  return {
    blockNumber, weekInBlock, loadingWeek: getWeekInBlock(week), recovery,
    focus: recovery ? 'Reduce demand and retain useful practice; do not make up missed work'
      : specificFocus ? specificFocus
      : strengthLoading === 'accumulation' ? `${goalFocus}. Accumulation: repeatable moderate-load practice and capacity before heavier work`
      : strengthLoading === 'intensification' ? `${goalFocus}. Intensification: earn heavier main-lift work with fewer repetitions; keep supporting work manageable`
      : goalFocus,
    ...(strengthLoading ? { strengthLoading } : {}),
    doseStage: recovery ? 'recover' : weekInBlock <= 2 ? 'practice' : weekInBlock === 6 ? 'review' : 'develop',
  };
}
