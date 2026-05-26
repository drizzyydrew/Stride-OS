import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { StandardDistance } from '../../src/types/athlete';

const DISTANCES: { key: StandardDistance; label: string; meters: number }[] = [
  { key: 'marathon',      label: 'Marathon',      meters: 42195    },
  { key: 'half_marathon', label: 'Half Marathon', meters: 21097.5  },
  { key: '10k',           label: '10K',           meters: 10000    },
  { key: '5k',            label: '5K',            meters: 5000     },
  { key: '1_mile',        label: '1 Mile',        meters: 1609.344 },
  { key: '800m',          label: '800m',          meters: 800      },
];

function TimeInput({
  hours, minutes, seconds,
  setHours, setMinutes, setSeconds,
}: {
  hours: number; minutes: number; seconds: number;
  setHours: (n: number) => void;
  setMinutes: (n: number) => void;
  setSeconds: (n: number) => void;
}) {
  const unit = (
    label: string, val: number, max: number,
    set: (n: number) => void,
  ) => (
    <View style={t.unit} key={label}>
      <Text style={t.val}>{String(val).padStart(2, '0')}</Text>
      <Text style={t.unitLabel}>{label}</Text>
      <View style={t.btnRow}>
        <Pressable style={t.btn} onPress={() => set(Math.max(0, val - 1))}>
          <Text style={t.btnTxt}>−</Text>
        </Pressable>
        <Pressable style={t.btn} onPress={() => set(Math.min(max, val + 1))}>
          <Text style={t.btnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
  return (
    <View style={t.row}>
      {unit('hrs', hours,   9,  setHours)}
      <Text style={t.sep}>:</Text>
      {unit('min', minutes, 59, setMinutes)}
      <Text style={t.sep}>:</Text>
      {unit('sec', seconds, 59, setSeconds)}
    </View>
  );
}

const t = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, justifyContent: 'center' },
  unit:     { alignItems: 'center', gap: 4 },
  val:      { color: colors.text, fontSize: 32, fontWeight: FontWeight.black, lineHeight: 36 },
  unitLabel:{ color: colors.textSubtle, fontSize: 9 },
  btnRow:   { flexDirection: 'row', gap: spacing.xs },
  btn:      { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  btnTxt:   { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  sep:      { color: colors.textSubtle, fontSize: 28, fontWeight: FontWeight.black, marginTop: 4 },
});

export default function RaceScreen() {
  const { data, updateData } = useOnboardingStore();
  const [hasPR,     setHasPR]     = useState(data.hasPR);
  const [distance,  setDistance]  = useState<StandardDistance>(data.prDistance ?? '5k');
  const [hours,     setHours]     = useState(0);
  const [minutes,   setMinutes]   = useState(25);
  const [seconds,   setSeconds]   = useState(0);

  function handleNext() {
    const totalSec = hours * 3600 + minutes * 60 + seconds;
    updateData({
      hasPR,
      prDistance:    hasPR ? distance : null,
      prTimeSeconds: hasPR ? totalSec : 0,
    });
    router.push('/onboarding/physiology');
  }

  return (
    <OnboardingShell
      step={3}
      title="Recent race or time trial"
      subtitle="A recent PR lets us calculate your VDOT and calibrate pace zones precisely."
      onNext={handleNext}
      onBack={() => router.back()}
      showSkip
      onSkip={() => {
        updateData({ hasPR: false });
        router.push('/onboarding/physiology');
      }}
    >
      {/* Toggle */}
      <View style={styles.toggle}>
        <Pressable
          style={[styles.togglePill, !hasPR && styles.togglePillActive]}
          onPress={() => setHasPR(false)}
        >
          <Text style={[styles.toggleText, !hasPR && styles.toggleTextActive]}>No recent PR</Text>
        </Pressable>
        <Pressable
          style={[styles.togglePill, hasPR && styles.togglePillActive]}
          onPress={() => setHasPR(true)}
        >
          <Text style={[styles.toggleText, hasPR && styles.toggleTextActive]}>I have a PR</Text>
        </Pressable>
      </View>

      {hasPR && (
        <>
          {/* Distance */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={styles.distRow}>
              {DISTANCES.map(d => (
                <Pressable
                  key={d.key}
                  style={[styles.distPill, distance === d.key && styles.distPillActive]}
                  onPress={() => setDistance(d.key)}
                >
                  <Text style={[styles.distText, distance === d.key && styles.distTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Time input */}
          <View style={styles.timeCard}>
            <Text style={styles.timeTitle}>FINISH TIME</Text>
            <TimeInput
              hours={hours} minutes={minutes} seconds={seconds}
              setHours={setHours} setMinutes={setMinutes} setSeconds={setSeconds}
            />
          </View>

          <Text style={styles.note}>
            Race result or time trial from the past 18 months gives the best VDOT accuracy.
          </Text>
        </>
      )}

      {!hasPR && (
        <Text style={styles.noPRNote}>
          No problem. We'll estimate your starting zones from mileage and experience.
          You can add a race PR anytime from the Profile screen.
        </Text>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
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
  togglePillActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  toggleText: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  toggleTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  distRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    paddingBottom: spacing.xs,
  },
  distPill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
  },
  distPillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  distText: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  distTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  timeCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.md,
  },
  timeTitle: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    textAlign:     'center',
  },
  note: {
    color:      colors.textSubtle,
    fontSize:   FontSize.xs,
    lineHeight: 18,
  },
  noPRNote: {
    color:           colors.textMuted,
    fontSize:        FontSize.sm,
    lineHeight:      20,
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
});
