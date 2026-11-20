import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Button, Checkbox, Collapsible, Column, Host, Text as NativeText } from '@expo/ui';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { displayLabel } from '../../utils/displayLabels';
import { copyWorkoutLibraryFilters, emptyWorkoutLibraryFilters, libraryFilterCount, toggleLibraryFilter, type WorkoutLibraryFilters as Filters } from '../../utils/workoutLibraryFilters';

type Option = { value: string; label: string };
type Props = { value: Filters; onApply: (value: Filters) => void; categories: Option[]; muscles: string[]; equipment?: string[] };
const MAX_MINUTES = [10, 15, 20, 30, 45, 60, 90];

/** Draft choices never change results until Apply; closing without Apply discards them. */
export default function WorkoutLibraryFilters({ value, onApply, categories, muscles, equipment = [] }: Props) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => copyWorkoutLibraryFilters(value));
  const changeOpen = (next: boolean) => { setDraft(copyWorkoutLibraryFilters(value)); setOpen(next); };
  const group = (key: 'categories' | 'muscles' | 'equipment', label: string, options: Option[]) => options.length ? <Column spacing={5}>
    <NativeText textStyle={{ color: C.text, fontWeight: '600', fontSize: 14 * fontScale }}>{label}</NativeText>
    {options.map(option => <Checkbox key={option.value} testID={`library-${key}-${option.value}`} label={option.label}
      value={draft[key].includes(option.value)} onValueChange={checked => setDraft(current => ({ ...current, [key]: toggleLibraryFilter(current[key], option.value, checked) }))} />)}
  </Column> : null;
  return <View style={{ marginBottom: 12, padding: 12, borderWidth: 1, borderRadius: 14, borderColor: C.border, backgroundColor: C.card }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label={`Filters${libraryFilterCount(value) ? ` · ${libraryFilterCount(value)} applied` : ''}`} labelStyle={{ color: C.primary, fontSize: 14 * fontScale, fontWeight: '600' }} isOpen={open} onOpenChange={changeOpen}>
        {open ? <Column spacing={15}>
          <NativeText textStyle={{ color: C.textMuted, fontSize: 12 * fontScale }}>Match every selected muscle and equipment tag across the workout; any selected category. Time is an inclusive maximum.</NativeText>
          {group('categories', 'Categories', categories)}
          {group('muscles', 'Target muscles / areas', muscles.map(value => ({ value, label: displayLabel(value) })))}
          {group('equipment', 'Uses equipment (may need additional equipment)', equipment.map(value => ({ value, label: displayLabel(value) })))}
          <Column spacing={5}>
            <NativeText textStyle={{ color: C.text, fontWeight: '600', fontSize: 14 * fontScale }}>Maximum workout time</NativeText>
            <Checkbox label="Any duration" value={draft.maxMinutes == null} onValueChange={() => setDraft(current => ({ ...current, maxMinutes: null }))} />
            {MAX_MINUTES.map(minutes => <Checkbox key={minutes} testID={`library-max-${minutes}`} label={`${minutes} minutes or less`} value={draft.maxMinutes === minutes}
              onValueChange={checked => setDraft(current => ({ ...current, maxMinutes: checked ? minutes : current.maxMinutes === minutes ? null : current.maxMinutes }))} />)}
          </Column>
          <Button label="Clear choices" variant="text" onPress={() => setDraft(emptyWorkoutLibraryFilters())} />
          <Button label="Apply filters" testID="library-apply" onPress={() => { onApply(copyWorkoutLibraryFilters(draft)); setOpen(false); }} />
          <Button label="Cancel" variant="text" onPress={() => changeOpen(false)} />
        </Column> : null}
      </Collapsible>
    </Host>
  </View>;
}

export function LibraryViewSelector({ value, onChange, recommendedCount, allLabel }: {
  value: 'recommended' | 'all'; onChange: (value: 'recommended' | 'all') => void; recommendedCount: number; allLabel: string;
}) {
  const C = useColors();
  const mode = useThemeMode();
  return <View style={{ marginBottom: 12 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%' }}>
      <Column spacing={8}>
        <Button label={`Recommended for you (${recommendedCount})${value === 'recommended' ? ' · selected' : ''}`} variant={value === 'recommended' ? 'filled' : 'outlined'} onPress={() => onChange('recommended')} />
        <Button label={`${allLabel}${value === 'all' ? ' · selected' : ''}`} variant={value === 'all' ? 'filled' : 'outlined'} onPress={() => onChange('all')} />
      </Column>
    </Host>
  </View>;
}
