import type { TrainingGoalType } from '../types/plan';

export const TRAINING_GOAL_LABELS: Record<TrainingGoalType, string> = {
  general_running: 'Running', get_faster: 'Get faster', general_strength: 'Strength', race_prep: 'Race preparation', hybrid: 'Hybrid · running and strength',
};
export const SUPPORTING_GOALS = ['general_running', 'get_faster', 'general_strength', 'hybrid'] as const;
export type SupportingGoal = typeof SUPPORTING_GOALS[number];

/** Persisted older or malformed arrays cannot silently create extra plans. */
export function normalizeSupportingGoals(primary: TrainingGoalType, value: unknown): SupportingGoal[] {
  return Array.isArray(value) ? [...new Set(value.filter((goal): goal is SupportingGoal =>
    SUPPORTING_GOALS.includes(goal as SupportingGoal) && goal !== primary))].slice(0, 2) : [];
}
export function validateSupportingGoals(primary: TrainingGoalType, value: unknown): SupportingGoal[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2 || value.some(goal => !SUPPORTING_GOALS.includes(goal as SupportingGoal)
    || goal === primary) || new Set(value).size !== value.length) {
    throw new Error('Choose one primary goal and up to two different supporting goals. Make race preparation primary to add its event and date.');
  }
  return value as SupportingGoal[];
}

/** One recovery budget. Extra preferences change emphasis, never add plans. */
export function trainingGoalBlend(primary: TrainingGoalType, supporting?: readonly TrainingGoalType[]) {
  const secondary = normalizeSupportingGoals(primary, supporting);
  const goals = [primary, ...secondary];
  const speed = goals.includes('get_faster');
  const strength = goals.includes('general_strength') || goals.includes('hybrid');
  const runningGoal: TrainingGoalType = primary !== 'race_prep' && speed ? 'get_faster' : primary;
  return { primary, secondary, runningGoal, speedSupport: speed, strengthSupport: strength,
    hybridBalance: primary === 'hybrid' || (strength && goals.some(goal => goal !== 'general_strength')),
    summary: [TRAINING_GOAL_LABELS[primary], ...secondary.map(goal => TRAINING_GOAL_LABELS[goal])].join(' + '),
    note: secondary.length ? `Primary: ${TRAINING_GOAL_LABELS[primary]}. Supporting: ${secondary.map(goal => TRAINING_GOAL_LABELS[goal]).join(', ')}. One shared schedule and recovery budget; no extra sessions are added for extra goals.${secondary.includes('general_running') ? ' Repeatable easy running already serves the supporting running goal.' : ''}${primary === 'general_strength' && speed ? ' Strength remains the main focus; speed work uses a limited existing run slot after actual preparation. Lower-body work may be reduced around that faster session.' : ''}` : '',
  };
}
