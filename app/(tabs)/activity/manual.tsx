import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useActivityStore } from '../../../src/store/activityStore';
import { useColors } from '../../../src/theme/useColors';
import type { ActivityType } from '../../../src/types/activity';

const TYPES: { type: ActivityType; label: string }[] = [
  { type: 'walking', label: 'Walk' },
  { type: 'indoor_cycling', label: 'Indoor Cycle' },
  { type: 'cycling', label: 'Cycling' },
  { type: 'swimming', label: 'Swimming' },
  { type: 'hiking', label: 'Hiking' },
  { type: 'downhill_skiing', label: 'Downhill Ski' },
  { type: 'cross_country_skiing', label: 'XC Ski' },
  { type: 'elliptical', label: 'Elliptical' },
  { type: 'rowing', label: 'Rowing' },
  { type: 'stair_climbing', label: 'Stairs' },
  { type: 'hiit', label: 'HIIT' },
  { type: 'mixed_modal', label: 'CrossFit / Mixed' },
  { type: 'other', label: 'Other' },
];

function numeric(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function ManualActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const addActivity = useActivityStore(state => state.addActivity);
  const [activityType, setActivityType] = useState<ActivityType>('walking');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [distance, setDistance] = useState('');
  const [averageHr, setAverageHr] = useState('');
  const [maximumHr, setMaximumHr] = useState('');
  const [rpe, setRpe] = useState('5');
  const [laps, setLaps] = useState('');
  const [cadence, setCadence] = useState('');
  const [power, setPower] = useState('');
  const [rounds, setRounds] = useState('');
  const [notes, setNotes] = useState('');
  const [pool, setPool] = useState(true);

  const isSwim = activityType === 'swimming';
  const isBike = activityType === 'cycling' || activityType === 'indoor_cycling';
  const isMixed = activityType === 'hiit' || activityType === 'mixed_modal';

  function save() {
    const minutes = numeric(durationMinutes) ?? 1;
    addActivity({
      activityType,
      subtype: isSwim ? (pool ? 'pool' : 'open_water') : activityType === 'indoor_cycling' ? 'stationary' : 'general',
      source: 'manual',
      status: 'completed',
      scheduled: false,
      startTime: Date.now() - minutes * 60_000,
      endTime: Date.now(),
      rpe: Math.max(1, Math.min(10, numeric(rpe) ?? 5)),
      notes: notes.trim() || undefined,
      indoor: activityType === 'indoor_cycling' || activityType === 'elliptical' || activityType === 'rowing' || activityType === 'stair_climbing' || (isSwim && pool),
      metrics: {
        durationSeconds: minutes * 60,
        elapsedTimeSeconds: minutes * 60,
        activeTimeSeconds: minutes * 60,
        distanceMeters: numeric(distance) ? numeric(distance)! * 1609.344 : undefined,
        averageHeartRateBpm: numeric(averageHr),
        maximumHeartRateBpm: numeric(maximumHr),
        cadenceRpm: isBike ? numeric(cadence) : undefined,
        cyclingPowerWatts: isBike ? numeric(power) : undefined,
        swimming: isSwim ? {
          environment: pool ? 'pool' : 'open_water',
          distanceUnit: 'yd',
          laps: numeric(laps),
        } : undefined,
        mixedModal: isMixed ? { rounds: numeric(rounds) } : undefined,
      },
    });
    router.replace('/(tabs)/activity' as never);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          eyebrow="QUICK ENTRY"
          title="Log Activity"
          onBack={() => router.back()}
          right={(
            <TouchableOpacity onPress={save} style={[s.saveButton, { backgroundColor: C.primary }]}>
              <Text style={[s.saveText, { color: C.onPrimary }]}>Save</Text>
            </TouchableOpacity>
          )}
        />
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={[s.label, { color: C.textDim }]}>ACTIVITY</Text>
          <View style={s.pills}>
            {TYPES.map(item => (
              <TouchableOpacity
                key={item.type}
                onPress={() => setActivityType(item.type)}
                style={[s.pill, {
                  backgroundColor: item.type === activityType ? C.primaryDim : C.card,
                  borderColor: item.type === activityType ? C.primary : C.border,
                }]}
              >
                <Text style={[s.pillText, { color: item.type === activityType ? C.primary : C.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isSwim ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.row}>
                <View>
                  <Text style={[s.fieldTitle, { color: C.text }]}>Pool swim</Text>
                  <Text style={[s.helper, { color: C.textMuted }]}>Turn off for open water.</Text>
                </View>
                <Switch value={pool} onValueChange={setPool} trackColor={{ true: C.primary }} />
              </View>
            </View>
          ) : null}

          <View style={s.grid}>
            <Field label="Duration" value={durationMinutes} onChange={setDurationMinutes} suffix="min" />
            <Field label="Distance" value={distance} onChange={setDistance} suffix="mi" optional />
            <Field label="Average HR" value={averageHr} onChange={setAverageHr} suffix="bpm" optional />
            <Field label="Maximum HR" value={maximumHr} onChange={setMaximumHr} suffix="bpm" optional />
            <Field label="RPE" value={rpe} onChange={setRpe} suffix="/10" />
            {isSwim ? <Field label="Laps" value={laps} onChange={setLaps} optional /> : null}
            {isBike ? <Field label="Cadence" value={cadence} onChange={setCadence} suffix="rpm" optional /> : null}
            {isBike ? <Field label="Average power" value={power} onChange={setPower} suffix="W" optional /> : null}
            {isMixed ? <Field label="Rounds" value={rounds} onChange={setRounds} optional /> : null}
          </View>
          <Text style={[s.label, { color: C.textDim }]}>NOTES</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="How did it feel? Add useful context."
            placeholderTextColor={C.textMuted}
            style={[s.notes, { color: C.text, backgroundColor: C.card, borderColor: C.border }]}
          />
          <Text style={[s.helper, { color: C.textMuted }]}>
            Only useful fields are saved. Missing optional metrics remain absent rather than appearing as blank cards.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, suffix, optional }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  optional?: boolean;
}) {
  const C = useColors();
  return (
    <View style={[s.field, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[s.fieldLabel, { color: C.textDim }]}>{label.toUpperCase()}{optional ? ' · OPTIONAL' : ''}</Text>
      <View style={s.fieldRow}>
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="--" placeholderTextColor={C.textMuted} style={[s.input, { color: C.text }]} />
        {suffix ? <Text style={[s.suffix, { color: C.textMuted }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  saveButton: { minWidth: 70, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 13, fontWeight: '900' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 9, marginTop: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldTitle: { fontSize: 14, fontWeight: '900' },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { width: '48%', borderWidth: 1, borderRadius: 15, padding: 13, minHeight: 78 },
  fieldLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  input: { flex: 1, fontSize: 21, fontWeight: '900', padding: 0 },
  suffix: { fontSize: 12, fontWeight: '700' },
  notes: { minHeight: 110, borderWidth: 1, borderRadius: 15, padding: 14, textAlignVertical: 'top', fontSize: 14 },
});
