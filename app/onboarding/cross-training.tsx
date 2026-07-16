import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useTrainingPreferencesStore } from '../../src/store/trainingPreferencesStore';
import { CROSS_TRAINING_ACTIVITY_TYPES, type CrossTrainingDecision } from '../../src/types/trainingPreferences';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight } from '../../src/theme/tokens';
import { displayLabel } from '../../src/utils/displayLabels';

const DECISIONS: { key: CrossTrainingDecision; label: string; description: string }[] = [
  { key: 'no', label: 'No', description: 'Keep program behavior focused on your primary endurance mode.' },
  { key: 'yes', label: 'Yes', description: 'Integrate preferred activities around endurance, strength, and recovery.' },
  { key: 'not_sure', label: 'Not sure yet', description: 'Start without automatic sessions and edit this later.' },
];

export default function CrossTrainingOnboardingScreen() {
  const store = useTrainingPreferencesStore();

  function toggleActivity(activityType: typeof CROSS_TRAINING_ACTIVITY_TYPES[number]) {
    const exists = store.crossTrainingActivities.some(item => item.activityType === activityType);
    if (exists) {
      store.removeCrossTrainingActivity(activityType);
    } else {
      store.upsertCrossTrainingActivity({
        activityType,
        preferredDays: [],
        equipment: [],
        setting: activityType === 'indoor_cycling' || activityType === 'elliptical' || activityType === 'rowing' ? 'indoor' : 'either',
        typicalDurationMinutes: 45,
        experienceLevel: 'some_experience',
        use: 'either',
        seasonalMonths: activityType.includes('skiing') ? [1, 2, 3, 11, 12] : undefined,
      });
    }
  }

  return (
    <OnboardingShell
      step={9}
      title="Would you like cross-training included in your program?"
      subtitle="Choose only what you actually use. You can change these preferences later."
      onNext={() => router.push('/onboarding/complete')}
      onBack={() => router.back()}
    >
      <View style={s.options}>
        {DECISIONS.map(option => {
          const selected = store.crossTrainingDecision === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => store.setCrossTrainingDecision(option.key)}
              style={[s.card, selected && s.cardActive]}
            >
              <View style={[s.dot, selected && s.dotActive]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, selected && s.labelActive]}>{option.label}</Text>
                <Text style={s.description}>{option.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {store.crossTrainingDecision === 'yes' ? (
        <View>
          <Text style={s.sectionLabel}>PREFERRED ACTIVITIES</Text>
          <View style={s.wrap}>
            {CROSS_TRAINING_ACTIVITY_TYPES.map(type => {
              const selected = store.crossTrainingActivities.some(item => item.activityType === type);
              return (
                <Pressable key={type} onPress={() => toggleActivity(type)} style={[s.chip, selected && s.chipActive]}>
                  <Text style={[s.chipText, selected && s.chipTextActive]}>
                    {type === 'mixed_modal' ? 'CrossFit / mixed-modal' : displayLabel(type)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <Text style={s.note}>
        Cross-training contributes to whole-body workload. Cycling, swimming, and walking never become running mileage or running pace history.
      </Text>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  options: { gap: spacing.sm },
  card: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  label: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  labelActive: { color: colors.primary },
  description: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17, marginTop: 3 },
  sectionLabel: { color: colors.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  chipText: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  chipTextActive: { color: colors.primary },
  note: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
});
