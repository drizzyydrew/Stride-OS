import { Text, View } from 'react-native';
import { GoalField, GoalPicker } from '../goals/GoalLifecycleCard';
import type { ActivityRaceResult } from '../../types/activity';
import { useColors } from '../../theme/useColors';

export type RaceResultKindInput = 'none' | ActivityRaceResult['kind'];

export default function RaceResultFields({ kind, distanceKey, finishTime, customDistance, customUnit,
  onKindChange, onDistanceChange, onFinishTimeChange, onCustomDistanceChange, onCustomUnitChange }: {
  kind: RaceResultKindInput;
  distanceKey: ActivityRaceResult['distanceKey'];
  finishTime: string;
  customDistance: string;
  customUnit: 'mi' | 'km';
  onKindChange: (value: RaceResultKindInput) => void;
  onDistanceChange: (value: ActivityRaceResult['distanceKey']) => void;
  onFinishTimeChange: (value: string) => void;
  onCustomDistanceChange: (value: string) => void;
  onCustomUnitChange: (value: 'mi' | 'km') => void;
}) {
  const C = useColors();
  return <View style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 15, padding: 14, marginVertical: 12, gap: 14 }}>
    <Text accessibilityRole="header" style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>Race or time-trial result</Text>
    <GoalPicker<RaceResultKindInput> label="Performance type" value={kind} onChange={onKindChange} options={[
      { value: 'none', label: 'Regular training' },
      { value: 'race', label: 'Completed race' },
      { value: 'time_trial', label: 'Completed time trial' },
    ]} />
    {kind !== 'none' ? <>
      <GoalPicker<ActivityRaceResult['distanceKey']> label="Event distance" value={distanceKey} onChange={onDistanceChange} options={[
        { value: '5k', label: '5K' }, { value: '10k', label: '10K' },
        { value: 'half_marathon', label: 'Half Marathon' }, { value: 'marathon', label: 'Marathon' },
        { value: '1_mile', label: '1 Mile' }, { value: '800m', label: '800m' },
        { value: 'custom', label: 'Other distance' },
      ]} />
      {distanceKey === 'custom' ? <>
        <GoalField label="Event distance value" value={customDistance} onChange={onCustomDistanceChange} placeholder="Enter course distance" />
        <GoalPicker<'mi' | 'km'> label="Event distance units" value={customUnit} onChange={onCustomUnitChange} options={[
          { value: 'mi', label: 'Miles' }, { value: 'km', label: 'Kilometers' },
        ]} />
      </> : null}
      <GoalField label="Elapsed finish time" value={finishTime} onChange={onFinishTimeChange} placeholder="MM:SS or H:MM:SS" />
      <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 19 }}>
        Use the full finish time, including stops, and the event distance. This result updates personal bests, VDOT, training paces, and race predictions. Recorded GPS distance and active time stay separate.
      </Text>
    </> : null}
  </View>;
}
