import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import ProfileMeasurementFields, { type MeasurementSave } from '../../src/components/profile/profile-measurement-fields';
import { ageFromDateOfBirth, profileAge } from '../../src/utils/profileMeasurements';
import { userEnteredWeightPatch } from '../../src/utils/profilePower';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../src/lib/localDataOwner';
import { useProfileStore } from '../../src/store/profileStore';
import { useSettingsStore } from '../../src/store/settingsStore';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { estimateHRMax } from '../../src/utils/calibrationEngine';
import { colors }  from '../../src/theme/colors';
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
  const { data, updateData, setUserWeight } = useOnboardingStore();
  const [dateOfBirth, setDateOfBirth] = useState(data.dateOfBirth);
  const age = profileAge({ age: data.age, dateOfBirth });
  const units = useSettingsStore(s => s.units);
  const [sex,      setSex]      = useState<Sex>(data.sex);
  const [heightCm, setHeightCm] = useState(data.heightCm);
  const [weightKg, setWeightKg] = useState(data.weightKg);
  const [weightEdited, setWeightEdited] = useState(false);
  const [hrResting, setHrResting] = useState(data.hrResting ?? 55);
  const [hasResting, setHasResting] = useState(data.hrResting !== null);
  const [error, setError] = useState('');
  function captureGuard() {
    const lease = captureOwnerLease(); const boundary = getLocalDataOwner();
    const generation = boundary?.accessGeneration;
    const initial = useProfileStore.getState();
    const id = initial.activeAthleteId; const createdAt = initial.profiles[id]?.createdAt;
    return () => (lease ? ownerLeaseIsCurrent(lease) : !captureOwnerLease() && boundary?.accessGeneration === generation)
      && useProfileStore.getState().activeAthleteId === id && useProfileStore.getState().profiles[id]?.createdAt === createdAt;
  }
  const [setupCurrent] = useState(() => captureGuard());

  function createMeasurementSave(): MeasurementSave {
    const current = captureGuard();
    return async draft => {
      if (!current()) return { status: 'account-changed', message: 'Your account or athlete changed. Reopen setup.' };
      if (!draft.changed) return { status: 'unchanged', message: '' };
      if (draft.field === 'dateOfBirth') {
        const nextAge = typeof draft.value === 'string' ? ageFromDateOfBirth(draft.value) : null;
        if (draft.value !== null && nextAge == null) return { status: 'invalid', message: 'Choose a valid date of birth.' };
        setDateOfBirth(draft.value as string | null);
      } else if (draft.field === 'heightCm') {
        if (typeof draft.value !== 'number' || !Number.isFinite(draft.value) || draft.value <= 90 || draft.value >= 245) return { status: 'invalid', message: 'Choose a height between 90 and 245 cm.' };
        setHeightCm(draft.value);
      } else {
        if (typeof draft.value !== 'number' || !userEnteredWeightPatch(draft.value)) return { status: 'invalid', message: 'Choose a weight between 20 and 300 kg.' };
        setWeightEdited(true); setWeightKg(draft.value);
      }
      return { status: 'saved', message: '' };
    };
  }

  const tanakaHRMax = age > 0 ? estimateHRMax(age) : null;

  function handleNext() {
    if (!setupCurrent()) { setError('Your account or athlete changed. Reopen setup before continuing.'); return; }
    updateData({
      age,
      dateOfBirth,
      sex,
      heightCm,
      hrResting: hasResting ? hrResting : null,
      hrMaxManual: false,
    });
    if (weightEdited) setUserWeight(weightKg);
    router.push('/onboarding/availability');
  }

  return (
    <OnboardingShell
      step={5}
      title="Your physiology"
      subtitle="Your saved age helps calibrate HR zones. Date of birth is optional."
      onNext={handleNext}
      onBack={() => router.back()}
      nextEnabled={age >= 14}
    >
      <ProfileMeasurementFields values={{ age: data.age, dateOfBirth, heightCm, weightKg }} units={units} createSave={createMeasurementSave} />
      {error ? <Text accessibilityRole="alert" style={s.estimate}>{error}</Text> : null}

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

const s = StyleSheet.create({
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
