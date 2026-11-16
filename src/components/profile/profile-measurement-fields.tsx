import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet, Host, Picker, RNHostView } from '@expo/ui';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { formatDateOnly, parseDateOnlyDisplay, timestampToDateOnly } from '../../utils/dateOnly';
import { birthDatePickerValue, formatProfileHeight, formatProfileWeight, heightFromParts, heightParts,
  weightDigits, weightFromDigits, type MeasurementDraft, type MeasurementField } from '../../utils/profileMeasurements';
import type { MeasurementSaveResult } from '../../lib/profileMeasurementEditing';

export type MeasurementValues = { dateOfBirth?: string | null; age: number; heightCm: number; weightKg?: number };
export type MeasurementSave = (draft: MeasurementDraft) => Promise<MeasurementSaveResult>;
type Props = { values: MeasurementValues; units: 'imperial' | 'metric'; createSave: () => MeasurementSave | null;
  subscribeInvalidation?: (close: () => void) => () => void };
const labels = { dateOfBirth: 'Date of birth', heightCm: 'Height', weightKg: 'Weight' };
const range = (length: number) => Array.from({ length }, (_, i) => i);

function Wheel({ label, showLabel = true, value, values, onChange, disabled }: {
  label: string; showLabel?: boolean; value: number; values: number[]; onChange: (value: number) => void; disabled: boolean;
}) {
  const C = useColors(); const mode = useThemeMode();
  return <View style={{ flex: 1, minWidth: 0 }} accessibilityLabel={label}>
    {showLabel ? <Text style={[s.wheelLabel, { color: C.textMuted }]}>{label}</Text> : null}
    <Host colorScheme={mode} seedColor={C.primary} style={{ width: '100%', height: 180 }}>
      <Picker appearance="wheel" selectedValue={value} onValueChange={onChange} enabled={!disabled} testID={`measurement-${label}`}>
        {values.map(number => <Picker.Item key={number} value={number} label={String(number)} />)}
      </Picker>
    </Host>
  </View>;
}

/** Values are canonical cm/kg throughout a session. Rendering a rounded wheel
 * selection never commits it; only an explicit selection followed by Save can. */
export default function ProfileMeasurementFields({ values, units, createSave, subscribeInvalidation }: Props) {
  const C = useColors(); const mode = useThemeMode();
  const [session, setSession] = useState<{ draft: MeasurementDraft; save: MeasurementSave } | null>(null);
  const [editingUnits, setEditingUnits] = useState(units);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setEditingUnits(units); }, [units]);
  useEffect(() => subscribeInvalidation?.(() => { setSession(null); setMessage('Your account changed. Reopen the measurement picker.'); }), [subscribeInvalidation]);
  const imp = editingUnits === 'imperial';
  function open(field: MeasurementField) {
    const save = createSave();
    if (!save) { setMessage('Reopen your profile after this account finishes loading.'); return; }
    setEditingUnits(units); setMessage('');
    setSession({ save, draft: { field, value: values[field] ?? null, changed: false } });
  }
  function change(value: MeasurementDraft['value']) {
    if (busyRef.current) return;
    setMessage(''); setSession(previous => previous ? { ...previous, draft: { ...previous.draft, value, changed: true } } : null);
  }
  async function save() {
    if (!session || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const result = await session.save(session.draft);
      if (!mounted.current) return;
      if (result.status === 'saved' || result.status === 'unchanged') { setSession(null); setMessage(''); }
      else setMessage(result.message);
    } catch { if (mounted.current) setMessage('This change could not be saved. Keep the picker open and retry.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  const draft = session?.draft;
  const numeric = typeof draft?.value === 'number' ? draft.value : draft?.field === 'heightCm' ? 175 : 70;
  const height = heightParts(numeric, imp);
  const digits = weightDigits(numeric, imp);
  const body = <View style={s.sheetBody}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
      <Text accessibilityRole="header" style={[s.title, { color: C.text }]}>{draft ? labels[draft.field] : ''}</Text>
      {draft?.field === 'dateOfBirth' ? <>
        {Platform.OS === 'web' ? <TextInput accessibilityLabel="Date of birth, month/day/year" placeholder="MM/DD/YYYY"
          defaultValue={formatDateOnly(typeof draft.value === 'string' ? draft.value : null)}
          style={[s.dateInput, { color: C.text, borderColor: C.border }]}
          onChangeText={text => change(parseDateOnlyDisplay(text) ?? text)} />
          : <DateTimePicker mode="date" display="inline" value={birthDatePickerValue(typeof draft.value === 'string' ? draft.value : null)}
            maximumDate={new Date()} minimumDate={new Date(new Date().getFullYear() - 119, 0, 1, 12)}
            themeVariant={mode} accentColor={C.primary} disabled={busy}
            onValueChange={(_event, date) => change(timestampToDateOnly(date.getTime()))} />}
        <Text style={[s.copy, { color: C.textMuted }]}>{Platform.OS === 'web' ? 'Enter month/day/year.' : 'Select the month and year in the calendar, then choose your day.'} Date of birth stays on this device and may be included in your device backup. It is excluded from StrideOS cloud sync and coaching messages.</Text>
        {!values.dateOfBirth ? <Text style={[s.copy, { color: C.textMuted }]}>No date has been saved. Your existing age is kept until you select a date.</Text> : null}
        {values.dateOfBirth ? <Pressable style={s.action} disabled={busy} onPress={() => change(null)} accessibilityRole="button">
          <Text style={{ color: C.primary }}>Remove date of birth</Text>
        </Pressable> : null}
      </> : <>
        <View style={s.actions}>
          {(['imperial', 'metric'] as const).map(option => <Pressable key={option} style={[s.action, { borderColor: C.border, borderWidth: 1 }]}
            accessibilityRole="button" accessibilityState={{ selected: editingUnits === option }} disabled={busy} onPress={() => setEditingUnits(option)}>
            <Text style={{ color: editingUnits === option ? C.primary : C.textMuted }}>{option === 'imperial' ? 'Imperial' : 'Metric'}</Text>
          </Pressable>)}
        </View>
        <View style={s.wheels}>
          {draft?.field === 'heightCm' ? <>
            <Wheel label={imp ? 'Feet' : 'Meters'} value={height[0]} values={imp ? range(9) : range(3)} disabled={busy}
              onChange={major => change(heightFromParts(major, height[1], imp))} />
            <Wheel label={imp ? 'Inches' : 'Centimeters'} value={height[1]} values={range(imp ? 12 : 100)} disabled={busy}
              onChange={minor => change(heightFromParts(height[0], minor, imp))} />
          </> : digits.map((value, index) => <Wheel key={index} label={['Hundreds', 'Tens', 'Ones'][index]} showLabel={false} value={value} values={range(10)} disabled={busy}
            onChange={number => { const next = [...digits]; next[index] = number; change(weightFromDigits(next, imp)); }} />)}
        </View>
        <Text style={[s.selection, { color: C.text }]}>{draft?.field === 'heightCm' ? formatProfileHeight(numeric, imp) : formatProfileWeight(numeric, imp)}</Text>
      </>}
      {message ? <Text accessibilityRole="alert" style={[s.copy, { color: C.critical }]}>{message}</Text> : null}
      <View style={s.actions}>
        <Pressable accessibilityRole="button" disabled={busy} style={s.action} onPress={() => { setSession(null); setMessage(''); }}><Text style={{ color: C.textMuted }}>Cancel</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy || (draft?.field === 'dateOfBirth' && !draft.changed && !values.dateOfBirth)}
          style={[s.action, { backgroundColor: C.primary, opacity: busy || (draft?.field === 'dateOfBirth' && !draft.changed && !values.dateOfBirth) ? 0.5 : 1 }]}
          onPress={() => { void save(); }}><Text style={{ color: C.onPrimary, fontWeight: '700' }}>{busy ? 'Saving…' : 'Save'}</Text></Pressable>
      </View>
    </ScrollView>
  </View>;
  return <View style={{ gap: 10, marginTop: 4 }}>
    {(Object.keys(labels) as MeasurementField[]).map(field => <View key={field} style={s.row}>
      <Text style={[s.label, { color: C.textMuted }]}>{labels[field]}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${labels[field].toLowerCase()}`} style={[s.value, { borderColor: C.border, backgroundColor: C.cardAlt }]}
        onPress={() => open(field)}><Text style={{ color: C.text, textAlign: 'right' }}>{field === 'dateOfBirth' ? formatDateOnly(values.dateOfBirth) || 'Not added' : field === 'heightCm' ? formatProfileHeight(values.heightCm, units === 'imperial') : formatProfileWeight(values.weightKg, units === 'imperial')}</Text></Pressable>
    </View>)}
    {!values.dateOfBirth ? <Text style={[s.copy, { color: C.textDim }]}>Saved age: {values.age} years</Text> : null}
    {!session && message ? <Text accessibilityRole="alert" style={[s.copy, { color: C.critical }]}>{message}</Text> : null}
    <Host colorScheme={mode} seedColor={C.primary}>
      <BottomSheet isPresented={!!session} onDismiss={() => { if (!busyRef.current) { setSession(null); setMessage(''); } }} snapPoints={['full']}
        contentPadding={16} containerColor={C.card}>
        <RNHostView>{body}</RNHostView>
      </BottomSheet>
    </Host>
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, label: { flex: 1, minWidth: 0, fontSize: 14 },
  value: { flex: 1.4, minWidth: 0, minHeight: 44, borderWidth: 1, borderRadius: 10, padding: 10, justifyContent: 'center' },
  sheetBody: { flex: 1, width: '100%' }, title: { fontSize: 22, fontWeight: '700' }, copy: { fontSize: 13, lineHeight: 20 },
  wheels: { flexDirection: 'row', width: '100%', gap: 4 }, wheelLabel: { textAlign: 'center', fontSize: 13 },
  selection: { textAlign: 'center', fontSize: 20, fontWeight: '600' }, actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dateInput: { minHeight: 44, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
});
