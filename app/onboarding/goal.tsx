import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { GoalType } from '../../src/store/onboardingStore';

const GOALS: { key: GoalType; label: string; desc: string }[] = [
  { key: 'marathon',          label: 'Marathon',          desc: 'Train for 26.2 miles'         },
  { key: 'half_marathon',     label: 'Half Marathon',     desc: 'Train for 13.1 miles'         },
  { key: '10k',               label: '10K',               desc: 'Race-pace 10 kilometers'      },
  { key: '5k',                label: '5K',                desc: 'Speed-focused 5K training'    },
  { key: 'general_fitness',   label: 'General Fitness',   desc: 'Stay fit, run consistently'   },
  { key: 'health',            label: 'Health & Wellness', desc: 'Low-stress aerobic base'      },
  { key: 'return_to_running', label: 'Return to Running', desc: 'Rebuilding after a break'     },
];

export default function GoalScreen() {
  const { data, updateData } = useOnboardingStore();
  const [selected, setSelected] = useState<GoalType>(data.primaryGoal);
  const [goalLabel, setGoalLabel] = useState(data.goalRaceLabel);

  function handleNext() {
    updateData({ primaryGoal: selected, goalRaceLabel: goalLabel });
    router.push('/onboarding/experience');
  }

  return (
    <OnboardingShell
      step={1}
      title="What's your primary goal?"
      subtitle="We'll build your training system around this focus."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={styles.goals}>
        {GOALS.map(g => (
          <Pressable
            key={g.key}
            style={[styles.goal, selected === g.key && styles.goalActive]}
            onPress={() => setSelected(g.key)}
          >
            <Text style={[styles.goalLabel, selected === g.key && styles.goalLabelActive]}>
              {g.label}
            </Text>
            <Text style={styles.goalDesc}>{g.desc}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.customRow}>
        <Text style={styles.customLabel}>GOAL RACE OR MILESTONE (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={goalLabel}
          onChangeText={setGoalLabel}
          placeholder="e.g. Sub 4-hour marathon, Spring 5K PR"
          placeholderTextColor={colors.textSubtle}
        />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  goals: {
    gap: spacing.sm,
  },
  goal: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             2,
  },
  goalActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  goalLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  goalLabelActive: {
    color: colors.primary,
  },
  goalDesc: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  customRow: {
    gap: spacing.xs,
  },
  customLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
  },
});
