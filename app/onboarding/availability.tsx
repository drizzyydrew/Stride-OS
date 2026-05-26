import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { TrainingDay } from '../../src/types/athlete';

const ALL_DAYS: TrainingDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS: Record<TrainingDay, string> = {
  Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S', Sun: 'S',
};

export default function AvailabilityScreen() {
  const { data, updateData } = useOnboardingStore();
  const [days,     setDays]     = useState<TrainingDay[]>(data.availableDays);
  const [sessions, setSessions] = useState(data.targetSessions);

  function toggleDay(d: TrainingDay) {
    if (days.includes(d)) {
      if (days.length <= 1) return;
      setDays(prev => prev.filter(x => x !== d));
    } else {
      setDays(prev => [...prev, d]);
    }
  }

  function handleNext() {
    updateData({ availableDays: days, targetSessions: sessions });
    router.push('/onboarding/strength');
  }

  return (
    <OnboardingShell
      step={5}
      title="Training availability"
      subtitle="Which days can you run? We'll schedule around your life."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      {/* Day picker */}
      <View style={s.section}>
        <Text style={s.label}>AVAILABLE DAYS</Text>
        <View style={s.dayRow}>
          {ALL_DAYS.map(d => {
            const active = days.includes(d);
            return (
              <Pressable
                key={d}
                style={[s.dayCell, active && s.dayCellActive]}
                onPress={() => toggleDay(d)}
              >
                <Text style={[s.dayText, active && s.dayTextActive]}>{DAY_LABELS[d]}</Text>
                <Text style={[s.dayFull, active && s.dayFullActive]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sessions per week */}
      <View style={s.section}>
        <Text style={s.label}>TARGET SESSIONS / WEEK</Text>
        <View style={s.stepRow}>
          <Pressable style={s.btn} onPress={() => setSessions(v => Math.max(2, v - 1))}>
            <Text style={s.btnTxt}>−</Text>
          </Pressable>
          <View style={s.sessionInfo}>
            <Text style={s.sessionNum}>{sessions}</Text>
            <Text style={s.sessionSub}>sessions per week</Text>
          </View>
          <Pressable style={s.btn} onPress={() => setSessions(v => Math.min(7, v + 1))}>
            <Text style={s.btnTxt}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={s.note}>
        {days.length} days selected · {sessions} planned sessions.
        {days.length < sessions
          ? '\n⚠ Consider adding more days or reducing target sessions.'
          : ''}
      </Text>
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  dayRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    width:          42,
    height:         54,
    borderRadius:   10,
    backgroundColor: colors.card,
    borderWidth:    1,
    borderColor:    colors.border,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            2,
  },
  dayCellActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  dayText: {
    color:      colors.textSubtle,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  dayTextActive: {
    color: colors.primary,
  },
  dayFull: {
    color:    colors.textSubtle,
    fontSize: 8,
  },
  dayFullActive: {
    color: colors.primary,
  },
  stepRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  btn: {
    width:           44,
    height:          44,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnTxt: {
    color:      colors.text,
    fontSize:   22,
    fontWeight: FontWeight.bold,
    lineHeight: 26,
  },
  sessionInfo: {
    alignItems: 'center',
    gap:        2,
  },
  sessionNum: {
    color:      colors.text,
    fontSize:   36,
    fontWeight: FontWeight.black,
    lineHeight: 40,
  },
  sessionSub: {
    color:    colors.textSubtle,
    fontSize: FontSize.xs,
  },
  note: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
});
