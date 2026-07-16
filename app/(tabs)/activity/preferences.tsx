import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTrainingPreferencesStore } from '../../../src/store/trainingPreferencesStore';
import { useColors } from '../../../src/theme/useColors';
import {
  CROSS_TRAINING_ACTIVITY_TYPES,
  type CrossTrainingActivityType,
  type CrossTrainingDecision,
  type CrossTrainingPurpose,
  type PrimaryEnduranceMode,
} from '../../../src/types/trainingPreferences';

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
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function TrainingPreferencesScreen() {
  const C = useColors();
  const router = useRouter();
  const prefs = useTrainingPreferencesStore();

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
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconButton}><Ionicons name="chevron-back" size={24} color={C.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>TRAINING PREFERENCES</Text>
          <Text style={[s.title, { color: C.text }]}>Endurance & Cross-Training</Text>
        </View>
      </View>
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
              <View style={s.frequency}>
                {[1, 2, 3, 4].map(value => (
                  <Chip key={value} label={`${value}× / week`} selected={prefs.crossTrainingFrequencyPerWeek === value} onPress={() => prefs.setCrossTrainingFrequency(value)} />
                ))}
              </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 27, fontFamily: 'CormorantGaramond_700Bold' },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  section: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionSub: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequency: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '800' },
  note: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', gap: 10 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
