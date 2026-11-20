import ExerciseMuscleTags from './ExerciseMuscleTags';
import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView, Switch } from '@expo/ui';
import { GoalAction, GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { MOBILITY_EXERCISES } from '../../constants/mobilityBank';
import { getExerciseAdjustment, type ExerciseAdjustmentReason } from '../../utils/exerciseAdaptation';
import type { MobilityExercise } from '../../types/mobility';

const REASONS = [{ value: 'too_easy', label: 'Too easy' }, { value: 'too_hard', label: 'Too hard today' },
  { value: 'dislike', label: 'Prefer a different movement' }, { value: 'equipment', label: 'Setup unavailable' }] as const;

export default function MobilityExerciseAdjustment({ exercise, onChange }: {
  exercise: MobilityExercise; onChange: (reason: ExerciseAdjustmentReason, alternativeId?: string) => void;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ExerciseAdjustmentReason>('too_hard');
  const [alternative, setAlternative] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const advice = getExerciseAdjustment({ exercise, reason, candidates: MOBILITY_EXERCISES });
  const copy = { color: C.textMuted, fontSize: 13, lineHeight: 20 };
  return <View><ExerciseMuscleTags exercise={exercise} /><Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
    <Collapsible label="Adjust this movement" labelStyle={{ color: C.primary, fontSize: 14 * fontScale, fontWeight: '600' }} isOpen={open} onOpenChange={setOpen}>
      {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12 }}>
        <GoalPicker label="What would help?" value={reason} options={REASONS} onChange={value => { setReason(value); setAlternative(''); setConfirmed(false); }} />
        <Text style={copy}>{advice.guidance}</Text>
        {reason === 'too_easy' || reason === 'too_hard' ? <GoalAction label={reason === 'too_easy' ? 'Slightly extend remaining target' : 'Reduce remaining target'} onPress={() => onChange(reason)} secondary /> : null}
        {advice.options.length ? <>
          <GoalPicker label="Same-purpose alternative" value={alternative} onChange={value => { setAlternative(value); setConfirmed(false); }}
            options={[{ value: '', label: 'Keep current movement' }, ...advice.options.map(item => ({ value: item.id, label: item.name }))]} />
          {alternative ? <>
            <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
              <Switch label="I can use this setup comfortably" value={confirmed} onValueChange={setConfirmed} />
            </Host>
            <GoalAction label="Use for remaining work" disabled={!confirmed} onPress={() => onChange(reason, alternative)} secondary />
          </> : null}
        </> : <Text style={copy}>{advice.fallback}</Text>}
        <Text style={copy}>Changes apply to this workout. Work already performed is kept in the completion notes.</Text>
      </View></RNHostView> : null}
    </Collapsible>
  </Host></View>;
}
