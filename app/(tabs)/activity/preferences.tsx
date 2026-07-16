import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import { useTrainingPreferencesStore } from '../../../src/store/trainingPreferencesStore';
import { useColors } from '../../../src/theme/useColors';
import {
  CROSS_TRAINING_ACTIVITY_TYPES,
  type CrossTrainingActivityType,
  type CrossTrainingDecision,
  type CrossTrainingPurpose,
  type PrimaryEnduranceMode,
} from '../../../src/types/trainingPreferences';
import { displayLabel } from '../../../src/utils/displayLabels';

const MODES: { key: PrimaryEnduranceMode; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'walking', label: 'Walking' },
  { key: 'run_walk', label: 'Run / Walk' },
  { key: 'general_endurance', label: 'General endurance' },
];
const DECISIONS: { key: CrossTrainingDecision; label: string }[] = [
  { key: 'no', label: 'No' },
  { key: 'yes', label: 'Yes' },
  { key: 'not_sure', label: 'Not sure yet' },
];
const PURPOSES: { key: CrossTrainingPurpose; label: string }[] = [
  { key: 'aerobic_development', label: 'Aerobic development' },
  { key: 'lower_impact_substitute', label: 'Lower-impact substitute' },
  { key: 'variety', label: 'Variety' },
  { key: 'sport_specific_preparation', label: 'Sport preparation' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'general_fitness', label: 'General fitness' },
];

function activityLabel(type: CrossTrainingActivityType): string {
  if (type === 'mixed_modal') return 'CrossFit / mixed-modal';
  return displayLabel(type);
}

export default function TrainingPreferencesScreen() {
  const C = useColors();
  const router = useRouter();
  const prefs = useTrainingPreferencesStore();
  const [frequencyPickerVisible, setFrequencyPickerVisible] = useState(false);

  function toggleActivity(type: CrossTrainingActivityType) {
    const existing = prefs.crossTrainingActivities.find(item => item.activityType === type);
    if (existing) {
      prefs.removeCrossTrainingActivity(type);
      return;
    }
    prefs.upsertCrossTrainingActivity({
      activityType: type,
      preferredDays: [],
      equipment: [],
      setting: type === 'indoor_cycling' || type === 'elliptical' || type === 'rowing' ? 'indoor' : 'either',
      typicalDurationMinutes: 45,
      experienceLevel: 'some_experience',
      use: 'either',
      seasonalMonths: type.includes('skiing') ? [1, 2, 3, 11, 12] : undefined,
    });
  }

  function togglePurpose(purpose: CrossTrainingPurpose) {
    prefs.setCrossTrainingPurpose(prefs.crossTrainingPurpose.includes(purpose)
      ? prefs.crossTrainingPurpose.filter(item => item !== purpose)
      : [...prefs.crossTrainingPurpose, purpose]);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="TRAINING PREFERENCES"
        title="Endurance & Cross-Training"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Section title="Primary endurance program" subtitle="Changing this shapes future programming and never erases history.">
          <ChoiceRow values={MODES} selected={prefs.primaryEnduranceMode} onSelect={prefs.setPrimaryEnduranceMode} />
        </Section>
        <Section title="Include cross-training?" subtitle="Manual logging remains available even when automatic programming is off.">
          <ChoiceRow values={DECISIONS} selected={prefs.crossTrainingDecision} onSelect={prefs.setCrossTrainingDecision} />
        </Section>
        {prefs.crossTrainingDecision === 'yes' ? (
          <>
            <Section title="Preferred activities" subtitle="Choose one or more. Seasonal options only appear when available.">
              <View style={s.wrap}>
                {CROSS_TRAINING_ACTIVITY_TYPES.map(type => {
                  const selected = prefs.crossTrainingActivities.some(item => item.activityType === type);
                  return <Chip key={type} label={activityLabel(type)} selected={selected} onPress={() => toggleActivity(type)} />;
                })}
              </View>
            </Section>
            <Section title="Frequency" subtitle="StrideOS adapts this around running, walking, strength, and readiness.">
              <TouchableOpacity
                style={[s.frequencyRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                onPress={() => setFrequencyPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Cross-training frequency, ${prefs.crossTrainingFrequencyPerWeek || 2} times per week`}
                accessibilityHint="Opens the frequency picker"
              >
                <View style={s.frequencyCopy}>
                  <Text style={[s.frequencyLabel, { color: C.text }]}>Frequency</Text>
                  <Text style={[s.frequencyValue, { color: C.textMuted }]}>
                    {prefs.crossTrainingFrequencyPerWeek || 2}× per week
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
              </TouchableOpacity>
            </Section>
            <Section title="Primary purpose" subtitle="HIIT and mixed-modal work count as intensity and will not be casually stacked beside intervals.">
              <View style={s.wrap}>
                {PURPOSES.map(item => (
                  <Chip key={item.key} label={item.label} selected={prefs.crossTrainingPurpose.includes(item.key)} onPress={() => togglePurpose(item.key)} />
                ))}
              </View>
            </Section>
          </>
        ) : null}
        <View style={[s.note, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={C.primary} />
          <Text style={[s.noteText, { color: C.textMuted }]}>
            Cross-training supports whole-body workload and recovery decisions. It does not become running mileage or change running PR and pace history.
          </Text>
        </View>
      </ScrollView>
      <PickerWheel
        visible={frequencyPickerVisible}
        title="Cross-training frequency"
        values={[1, 2, 3, 4]}
        selectedValue={prefs.crossTrainingFrequencyPerWeek || 2}
        formatValue={value => `${value}× per week`}
        onClose={() => setFrequencyPickerVisible(false)}
        onConfirm={value => {
          prefs.setCrossTrainingFrequency(value);
          setFrequencyPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={[s.section, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[s.sectionTitle, { color: C.text }]}>{title}</Text>
      <Text style={[s.sectionSub, { color: C.textMuted }]}>{subtitle}</Text>
      {children}
    </View>
  );
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, { backgroundColor: selected ? C.primaryDim : C.cardAlt, borderColor: selected ? C.primary : C.border }]}>
      <Text style={[s.chipText, { color: selected ? C.primary : C.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function ChoiceRow<K extends string>({ values, selected, onSelect }: { values: { key: K; label: string }[]; selected: K; onSelect: (value: K) => void }) {
  return <View style={s.wrap}>{values.map(value => <Chip key={value.key} label={value.label} selected={selected === value.key} onPress={() => onSelect(value.key)} />)}</View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  section: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionSub: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyRow: { minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  frequencyCopy: { flex: 1, minWidth: 0 },
  frequencyLabel: { fontSize: 14, fontWeight: '900' },
  frequencyValue: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '800' },
  note: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
