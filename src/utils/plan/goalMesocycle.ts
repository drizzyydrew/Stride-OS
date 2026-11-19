import type { TrainingPhase } from '../../types/training';
import type { TrainingGoalType } from '../../types/plan';
import { getWeekInBlock, shouldApplyDeload } from '../training/deloadModel';

export type GoalMesocycle = {
  blockNumber: number;
  weekInBlock: number;
  loadingWeek: number;
  focus: string;
  doseStage: 'practice' | 'develop' | 'review' | 'recover';
  recovery: boolean;
};

/** A six-week exercise-practice block and the existing 3:1 load/recovery
 * microcycle are separate clocks. Neither clock earns a load increase. */
export function getGoalMesocycle(currentWeek: number, phase: TrainingPhase, goalType: TrainingGoalType): GoalMesocycle {
  const week = Math.max(1, Math.floor(Number.isFinite(currentWeek) ? currentWeek : 1));
  const blockNumber = Math.floor((week - 1) / 6) + 1;
  const weekInBlock = ((week - 1) % 6) + 1;
  const recovery = ['recovery', 'transition', 'taper'].includes(phase) || shouldApplyDeload(week, phase);
  const goalFocus = goalType === 'general_strength' ? 'Strength skill and progressive resistance; aerobic work supports recovery'
    : goalType === 'hybrid' ? 'Combined running and strength; protect the current priority and total recovery demand'
    : goalType === 'race_prep' ? 'Race-specific capacity built on repeatable easy training'
    : 'Aerobic consistency followed by gradually earned faster running';
  return {
    blockNumber, weekInBlock, loadingWeek: getWeekInBlock(week), recovery,
    focus: recovery ? 'Reduce demand and retain useful practice; do not make up missed work' : goalFocus,
    doseStage: recovery ? 'recover' : weekInBlock <= 2 ? 'practice' : weekInBlock === 6 ? 'review' : 'develop',
  };
}
