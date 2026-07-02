import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { useThemeColors, type ThemeColors } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { StrengthLevel } from '../../src/store/onboardingStore';

const STRENGTH_OPTIONS: {
  key:   StrengthLevel;
  label: string;
  desc:  string;
  sub:   string;
}[] = [
  {
    key:   'none',
    label: 'None',
    desc:  'No strength training background',
    sub:   "I don't currently lift or do structured strength work",
  },
  {
    key:   'beginner',
    label: 'Beginner',
    desc:  'Some gym experience',
    sub:   'Basic movements, machines, or bodyweight — less than 1 year consistent',
  },
  {
    key:   'intermediate',
    label: 'Intermediate',
    desc:  'Regular training, compound lifts',
    sub:   '1–3 years of structured programming (squat, deadlift, press)',
  },
  {
    key:   'advanced',
    label: 'Advanced',
    desc:  'Competitive or structured strength program',
    sub:   '3+ years, periodized programming, or competitive lifting background',
  },
];

export default function StrengthScreen() {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);
  const { data, updateData } = useOnboardingStore();
  const [level, setLevel] = useState<StrengthLevel>(data.strengthLevel);

  function handleNext() {
    updateData({ strengthLevel: level });
    router.push('/onboarding/injury');
  }

  return (
    <OnboardingShell
      step={6}
      title="Strength background"
      subtitle="Helps us balance running load with strength work safely."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={s.options}>
        {STRENGTH_OPTIONS.map(opt => {
          const active = level === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.card, active && s.cardActive]}
              onPress={() => setLevel(opt.key)}
            >
              <View style={s.row}>
                <View style={[s.dot, active && s.dotActive]} />
                <View style={s.textGroup}>
                  <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
                  <Text style={[s.desc,  active && s.descActive]}>{opt.desc}</Text>
                </View>
              </View>
              {active && <Text style={s.sub}>{opt.sub}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.note}>
        Strength background influences injury risk stratification and cross-training recommendations.
        You can update this anytime in Profile.
      </Text>
    </OnboardingShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  row: {
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
  textGroup: {
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
  descActive: {
    color: colors.textSubtle,
  },
  sub: {
    color:      colors.textSubtle,
    fontSize:   FontSize.xs,
    lineHeight: 17,
    paddingLeft: 28,
  },
  note: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
  });
}
