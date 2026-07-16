import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight } from '../../src/theme/tokens';
import type { TrainingStyle } from '../../src/store/onboardingStore';

const STYLE_OPTIONS: {
  key:    TrainingStyle;
  label:  string;
  desc:   string;
  detail: string;
}[] = [
  {
    key:    'polarized',
    label:  'Polarized',
    desc:   '80% easy, 20% hard — no moderate zone',
    detail: 'Based on Seiler research. Most aerobic work at easy pace; quality sessions at VO₂ max. Avoids the "grey zone" trap.',
  },
  {
    key:    'threshold',
    label:  'Threshold',
    desc:   'Regular tempo and lactate threshold work',
    detail: 'Higher proportion of moderate-to-hard steady efforts. Common in 5K–10K specialists and coached programs.',
  },
  {
    key:    'mixed',
    label:  'Mixed / Pyramid',
    desc:   'Balanced across easy, moderate, and hard',
    detail: 'Blends all intensities. Most accessible for intermediate runners. Adapts well to life and schedule variability.',
  },
  {
    key:    'base_only',
    label:  'Aerobic Base',
    desc:   'Easy aerobic mileage only — no hard work',
    detail: 'For rebuilding fitness, early-phase training, or low-stress seasons. Ideal for return-to-running or health focus.',
  },
];

export default function StyleScreen() {
  const { data, updateData } = useOnboardingStore();
  const [style, setStyle] = useState<TrainingStyle>(data.trainingStyle);

  function handleNext() {
    updateData({ trainingStyle: style });
    router.push('/onboarding/cross-training' as never);
  }

  return (
    <OnboardingShell
      step={8}
      title="Training philosophy"
      subtitle="How should your weekly runs be distributed? This shapes intensity balance."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={s.options}>
        {STYLE_OPTIONS.map(opt => {
          const active = style === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.card, active && s.cardActive]}
              onPress={() => setStyle(opt.key)}
            >
              <View style={s.header}>
                <View style={[s.dot, active && s.dotActive]} />
                <View style={s.titleGroup}>
                  <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
                  <Text style={s.desc}>{opt.desc}</Text>
                </View>
              </View>
              {active && (
                <Text style={s.detail}>{opt.detail}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.note}>
        StrideOS will calibrate the proportion of easy, moderate, and quality sessions to match
        your chosen philosophy. You can switch styles anytime from Profile.
      </Text>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  options: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  cardActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  dot: {
    width:           16,
    height:          16,
    borderRadius:    8,
    borderWidth:     2,
    borderColor:     colors.border,
    backgroundColor: 'transparent',
  },
  dotActive: {
    borderColor:     colors.primary,
    backgroundColor: colors.primary,
  },
  titleGroup: {
    flex: 1,
    gap:  2,
  },
  label: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  labelActive: {
    color: colors.primary,
  },
  desc: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  detail: {
    color:      colors.textSubtle,
    fontSize:   FontSize.xs,
    lineHeight: 18,
    paddingLeft: 28,
  },
  note: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
});
