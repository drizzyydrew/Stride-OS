import { Text, View } from 'react-native';
import { GoalPicker } from './GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import type { GoalProfileId } from '../../types/goalIntent';
import { GOAL_PROFILE_OPTIONS } from '../../utils/goalIntent';
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

/** Ordered profile goals use one shared schedule, never three additive plans. */
export function ProfileSupportingGoals({ primary, value, onChange, disabled = false }: {
 primary: GoalProfileId; value: GoalProfileId[]; onChange: (goals: GoalProfileId[]) => void; disabled?: boolean;
}) {
 const C = useColors();
 const selected = [...new Set(value)].filter(profile => profile !== primary && profile !== 'race_prep').slice(0, 2);
 return <View style={{ gap: 12, minWidth: 0 }}>
  <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>Primary first, then secondary, then tertiary. All goals share your time and recovery. Supporting work yields first when goals conflict; readiness always comes first.</Text>
  {[0, 1].map(index => <GoalPicker key={index} label={index === 0 ? 'Secondary goal · optional' : 'Tertiary goal · optional'} disabled={disabled}
   value={selected[index] ?? 'none'} options={[{ value: 'none', label: 'None' }, ...GOAL_PROFILE_OPTIONS.filter(option => option.value !== primary && option.value !== 'race_prep' && (!selected.includes(option.value) || option.value === selected[index]))]}
   onChange={next => { const changed = [...selected]; if (next === 'none') changed.splice(index, 1); else changed[index] = next as GoalProfileId; onChange(changed.filter(Boolean)); }} />)}
 </View>;
}
