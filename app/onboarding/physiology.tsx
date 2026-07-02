import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { estimateHRMax } from '../../src/utils/calibrationEngine';
import { useThemeColors, type ThemeColors } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { Sex } from '../../src/types/athlete';

const SEXES: { key: Sex; label: string }[] = [
  { key: 'male',              label: 'Male'   },
  { key: 'female',            label: 'Female' },
  { key: 'non_binary',        label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function Row({
  label, display, onInc, onDec,
}: { label: string; display: string; onInc: () => void; onDec: () => void }) {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowControls}>
        <Pressable style={s.btn} onPress={onDec}><Text style={s.btnTxt}>−</Text></Pressable>
        <Text style={s.val}>{display}</Text>
        <Pressable style={s.btn} onPress={onInc}><Text style={s.btnTxt}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function PhysiologyScreen() {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { data, updateData } = useOnboardingStore();
  const [age,      setAge]      = useState(data.age);
  const [sex,      setSex]      = useState<Sex>(data.sex);
  const [heightCm, setHeightCm] = useState(data.heightCm);
  const [weightKg, setWeightKg] = useState(data.weightKg);
  const [hrResting, setHrResting] = useState(data.hrResting ?? 55);
  const [hasResting, setHasResting] = useState(data.hrResting !== null);

  const tanakaHRMax = age > 0 ? estimateHRMax(age) : null;
  const heightFt = Math.floor(heightCm / 30.48);
  const heightIn = Math.round((heightCm % 30.48) / 2.54);
  const weightLb = Math.round(weightKg * 2.205);

  function handleNext() {
    updateData({
      age,
      sex,
      heightCm,
      weightKg,
      hrResting: hasResting ? hrResting : null,
      hrMaxManual: false,
    });
    router.push('/onboarding/availability');
  }

  return (
    <OnboardingShell
      step={4}
      title="Your physiology"
      subtitle="Age and weight help calibrate HR zones. All optional except age."
      onNext={handleNext}
      onBack={() => router.back()}
      nextEnabled={age >= 14}
    >
      <Row
        label="Age"
        display={`${age} years`}
        onInc={() => setAge(v => Math.min(99, v + 1))}
        onDec={() => setAge(v => Math.max(14, v - 1))}
      />

      {tanakaHRMax && (
        <Text style={s.estimate}>
          Estimated HRmax (Tanaka 2001): {tanakaHRMax} bpm — used for HR zone calibration.
          You can set a measured value in Profile later.
        </Text>
      )}

      {/* Sex */}
      <View style={s.group}>
        <Text style={s.groupLabel}>BIOLOGICAL SEX (for calibration)</Text>
        <View style={s.pills}>
          {SEXES.map(o => (
            <Pressable
              key={o.key}
              style={[s.pill, sex === o.key && s.pillActive]}
              onPress={() => setSex(o.key)}
            >
              <Text style={[s.pillTxt, sex === o.key && s.pillTxtActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Row
        label="Height"
        display={`${heightFt}'${heightIn}"`}
        onInc={() => setHeightCm(v => Math.min(240, v + 1))}
        onDec={() => setHeightCm(v => Math.max(120, v - 1))}
      />

      <Row
        label="Weight"
        display={`${weightLb} lb`}
        onInc={() => setWeightKg(v => +(v + 0.5).toFixed(1))}
        onDec={() => setWeightKg(v => +(Math.max(30, v - 0.5)).toFixed(1))}
      />

      {/* Resting HR */}
      <View style={s.group}>
        <Text style={s.groupLabel}>RESTING HR (improves zone accuracy)</Text>
        <View style={s.toggle}>
          <Pressable
            style={[s.togglePill, !hasResting && s.toggleActive]}
            onPress={() => setHasResting(false)}
          >
            <Text style={[s.toggleTxt, !hasResting && s.toggleActiveTxt]}>Don't know</Text>
          </Pressable>
          <Pressable
            style={[s.togglePill, hasResting && s.toggleActive]}
            onPress={() => setHasResting(true)}
          >
            <Text style={[s.toggleTxt, hasResting && s.toggleActiveTxt]}>I know it</Text>
          </Pressable>
        </View>
        {hasResting && (
          <Row
            label="Morning Resting HR"
            display={`${hrResting} bpm`}
            onInc={() => setHrResting(v => Math.min(90, v + 1))}
            onDec={() => setHrResting(v => Math.max(30, v - 1))}
          />
        )}
      </View>
    </OnboardingShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  rowLabel: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  rowControls: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
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
  val: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  estimate: {
    color:      colors.primary,
    fontSize:   FontSize.xs,
    lineHeight: 17,
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
  pills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
  },
  pillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillTxt: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  pillTxtActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  toggle: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  togglePill: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
  },
  toggleActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  toggleTxt: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  toggleActiveTxt: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  });
}
