import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMemo } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useThemeColors, type ThemeColors } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight } from '../../src/theme/tokens';

const PILLARS = [
  { icon: '🏃', label: 'Running Zones',    desc: 'VDOT-calibrated pace + HR zones' },
  { icon: '💪', label: 'Strength System',  desc: 'Concurrent training integration'  },
  { icon: '🧬', label: 'Recovery Engine',  desc: 'ACWR, fatigue, readiness tracking' },
  { icon: '📹', label: 'Movement Lab',     desc: 'Gait + lifting mechanics analysis' },
];

export default function WelcomeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <OnboardingShell
      step={0}
      title="Your training, calibrated."
      subtitle="StrideOS builds a personalized running and strength system from your physiology — not generic algorithms."
      onNext={() => router.push('/onboarding/goal')}
      nextLabel="Get Started"
    >
      <View style={styles.pillars}>
        {PILLARS.map(p => (
          <View key={p.label} style={styles.pillar}>
            <Text style={styles.pillarIcon}>{p.icon}</Text>
            <View style={styles.pillarText}>
              <Text style={styles.pillarLabel}>{p.label}</Text>
              <Text style={styles.pillarDesc}>{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Everything stays on your device. No account, no cloud, no subscriptions.
      </Text>
    </OnboardingShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  pillars: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pillar: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  pillarIcon: {
    fontSize: 24,
    width:    36,
    textAlign: 'center',
  },
  pillarText: {
    flex: 1,
    gap:  2,
  },
  pillarLabel: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  pillarDesc: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  note: {
    color:      colors.textSubtle,
    fontSize:   FontSize.xs,
    textAlign:  'center',
    lineHeight: 18,
  },
  });
}
