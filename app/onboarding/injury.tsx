import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight } from '../../src/theme/tokens';

const BODY_PARTS = [
  'Knee', 'Hip', 'Ankle', 'Foot', 'Shin', 'Calf',
  'Hamstring', 'Quad', 'Achilles', 'IT Band', 'Back', 'Other',
];

export default function InjuryScreen() {
  const { data, updateData } = useOnboardingStore();
  const [hasInjury, setHasInjury] = useState(data.hasCurrentInjury);
  const [notes,     setNotes]     = useState(data.injuryNotes);
  const [selected,  setSelected]  = useState<string[]>([]);

  function togglePart(part: string) {
    setSelected(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part],
    );
  }

  function handleNext() {
    const injuryText = hasInjury
      ? [selected.join(', '), notes].filter(Boolean).join(' — ')
      : '';
    updateData({ hasCurrentInjury: hasInjury, injuryNotes: injuryText });
    router.push('/onboarding/style');
  }

  return (
    <OnboardingShell
      step={7}
      title="Current injuries"
      subtitle="We'll reduce load on affected areas and flag high-risk movement patterns."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      {/* Toggle */}
      <View style={s.toggle}>
        <Pressable
          style={[s.togglePill, !hasInjury && s.toggleActive]}
          onPress={() => setHasInjury(false)}
        >
          <Text style={[s.toggleTxt, !hasInjury && s.toggleActiveTxt]}>No current injuries</Text>
        </Pressable>
        <Pressable
          style={[s.togglePill, hasInjury && s.toggleActive]}
          onPress={() => setHasInjury(true)}
        >
          <Text style={[s.toggleTxt, hasInjury && s.toggleActiveTxt]}>I have an injury</Text>
        </Pressable>
      </View>

      {hasInjury && (
        <>
          <View style={s.group}>
            <Text style={s.groupLabel}>AFFECTED AREA(S)</Text>
            <View style={s.chipRow}>
              {BODY_PARTS.map(part => {
                const active = selected.includes(part);
                return (
                  <Pressable
                    key={part}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => togglePart(part)}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{part}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.groupLabel}>DESCRIBE (OPTIONAL)</Text>
            <TextInput
              style={s.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. left knee, pain on descents, started 3 weeks ago"
              placeholderTextColor={colors.textSubtle}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </>
      )}

      {!hasInjury && (
        <View style={s.clearCard}>
          <Text style={s.clearText}>
            Great — no current injuries. We'll still monitor load to prevent overuse.
          </Text>
        </View>
      )}

      <Text style={s.note}>
        You can add or edit injury records anytime in Profile. Movement Lab can help identify
        biomechanical risk factors once you're set up.
      </Text>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  togglePill: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    12,
    backgroundColor: colors.card,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
  },
  toggleActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  toggleTxt: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  toggleActiveTxt: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  chipTxt: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  chipTxtActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.sm,
    padding:         spacing.md,
    minHeight:       80,
  },
  clearCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  clearText: {
    color:      colors.textSubtle,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  note: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
});
