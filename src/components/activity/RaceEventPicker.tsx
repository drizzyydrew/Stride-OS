import { View } from 'react-native';
import { GoalMessage, GoalPicker, goalDate } from '../goals/GoalLifecycleCard';
import type { RaceEventSnapshot } from '../../types/raceLink';
import { displayLabel } from '../../utils/displayLabels';

export type RaceEventPickerProps = {
  value: string | null;
  onChange: (event: RaceEventSnapshot | null) => void;
  events: readonly RaceEventSnapshot[];
  disabled?: boolean;
  label?: string;
};

export default function RaceEventPicker({ value, onChange, events, disabled = false, label = 'Race' }: RaceEventPickerProps) {
  const selected = events.find(event => event.id === value);
  return <View style={{ width: '100%', minWidth: 0, gap: 8 }}>
    <GoalPicker label={label} value={selected?.id ?? ''} disabled={disabled}
      onChange={id => onChange(events.find(event => event.id === id) ?? null)}
      options={[{ value: '', label: 'No race selected' }, ...events.map(event => ({ value: event.id,
        label: `${event.name} · ${goalDate(event.date)} · ${displayLabel(event.distance)}` }))]} />
    {selected ? <GoalMessage>{selected.name}{'\n'}{goalDate(selected.date)} · {displayLabel(selected.distance)}</GoalMessage> : null}
  </View>;
}
