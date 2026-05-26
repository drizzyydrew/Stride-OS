import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight } from '../../src/theme/tokens';

function Stepper({
  label, value, display, onInc, onDec,
}: { label: string; value: number; display: string; onInc: () => void; onDec: () => void }) {
  return (
    <View style={s.stepRow}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepControls}>
        <View style={s.stepBtn} onStartShouldSetResponder={() => true}
          // biome-ignore lint: intentional
          onResponderRelease={onDec}>
          <Text style={s.stepBtnText}>−</Text>
        </View>
        <Text style={s.stepValue}>{display}</Text>
        <View style={s.stepBtn} onStartShouldSetResponder={() => true}
          // biome-ignore lint: intentional
          onResponderRelease={onInc}>
          <Text style={s.stepBtnText}>+</Text>
        </View>
      </View>
    </View>
  );
}

export default function ExperienceScreen() {
  const { data, updateData } = useOnboardingStore();
  const [years,  setYears]  = useState(data.yearsRunning);
  const [miles,  setMiles]  = useState(data.weeklyMileage);

  function handleNext() {
    updateData({ yearsRunning: years, weeklyMileage: miles });
    router.push('/onboarding/race');
  }

  return (
    <OnboardingShell
      step={2}
      title="Your running background"
      subtitle="Helps calibrate training load and progression pace."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <Stepper
        label="Years Running"
        value={years}
        display={years === 0 ? 'Less than 1 year' : `${years} ${years === 1 ? 'year' : 'years'}`}
        onInc={() => setYears(v => Math.min(40, v + 1))}
        onDec={() => setYears(v => Math.max(0, v - 1))}
      />
      <Stepper
        label="Current Weekly Mileage"
        value={miles}
        display={`${miles} miles / week`}
        onInc={() => setMiles(v => Math.min(150, v + 5))}
        onDec={() => setMiles(v => Math.max(0, v - 5))}
      />

      <Text style={s.note}>
        Use your average from the past 4–6 weeks. Doesn't need to be exact.
      </Text>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  stepRow: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  stepLabel: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  stepControls: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width:           44,
    height:          44,
    borderRadius:    8,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepBtnText: {
    color:      colors.text,
    fontSize:   22,
    fontWeight: FontWeight.bold,
    lineHeight: 26,
  },
  stepValue: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  note: {
    color:      colors.textSubtle,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
});
