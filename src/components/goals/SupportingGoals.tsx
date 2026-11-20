import { Text, View } from 'react-native';
import { GoalPicker } from './GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import type { TrainingGoalType } from '../../types/plan';
import { normalizeSupportingGoals, SUPPORTING_GOALS, TRAINING_GOAL_LABELS } from '../../utils/trainingGoals';

export default function SupportingGoals({ primary, value, onChange, disabled = false }: {
  primary: TrainingGoalType; value?: TrainingGoalType[]; onChange: (value: TrainingGoalType[]) => void; disabled?: boolean;
}) {
  const C = useColors();
  const selected = normalizeSupportingGoals(primary, value);
  return <View style={{ gap: 12, width: '100%', minWidth: 0 }}>
    <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>Optional: add up to two supporting goals. Your primary goal sets the priority; all goals share your available time and recovery. A race must be the primary goal to set its event and date.</Text>
    {[0, 1].map(index => <GoalPicker key={index} label={`Supporting goal ${index + 1} · optional`} disabled={disabled}
      value={selected[index] ?? 'none'} options={[{ value: 'none', label: 'None' }, ...SUPPORTING_GOALS
        .filter(goal => goal !== primary && (goal === selected[index] || !selected.includes(goal)))
        .map(goal => ({ value: goal, label: TRAINING_GOAL_LABELS[goal] }))]}
      onChange={next => {
        const changed = [...selected];
        if (next === 'none') changed.splice(index, 1); else changed[index] = next as typeof selected[number];
        onChange(normalizeSupportingGoals(primary, changed));
      }} />)}
  </View>;
}
