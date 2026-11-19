import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { StrengthLevel } from '../../src/store/onboardingStore';
import StrengthSessionFit, { type StrengthSessionFitValue } from '../../src/components/strength/StrengthSessionFit';
import { saveStrengthFitDraft } from '../../src/utils/strengthSessionFit';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../src/lib/localDataOwner';

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
  const { data, updateData } = useOnboardingStore();
  const [level, setLevel] = useState<StrengthLevel>(data.strengthLevel);
  const [fit, setFit] = useState<StrengthSessionFitValue>({ strengthLevel: data.strengthLevel,
    strengthSessionMinutes: data.strengthSessionMinutes, strengthEquipment: data.strengthEquipment });
  const [ready, setReady] = useState(() => useOnboardingStore.persist.hasHydrated());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const loading = useOnboardingStore.persist.onHydrate(() => setReady(false));
    const hydrateDraft = () => {
      const saved = useOnboardingStore.getState().data;
      setLevel(saved.strengthLevel);
      setFit({ strengthLevel: saved.strengthLevel, strengthSessionMinutes: saved.strengthSessionMinutes, strengthEquipment: saved.strengthEquipment });
      setReady(true);
    };
    const finished = useOnboardingStore.persist.onFinishHydration(hydrateDraft);
    if (useOnboardingStore.persist.hasHydrated()) hydrateDraft();
    else setReady(false);
    return () => { loading(); finished(); };
  }, []);

  async function handleNext() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    const lease = captureOwnerLease();
    try {
      await saveStrengthFitDraft({ ...fit, strengthLevel: level }, {
        ready: () => useOnboardingStore.persist.hasHydrated(), capture: () => lease,
        isCurrent: current => ownerLeaseIsCurrent(current), write: updateData,
      });
      if (mounted.current && ownerLeaseIsCurrent(lease)) router.push('/onboarding/injury');
    } catch { if (mounted.current) setError('Could not save your choices. They are still here—please try again.'); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }

  return (
    <OnboardingShell
      step={7}
      title="Strength background"
      subtitle="Helps us balance running load with strength work safely."
      onNext={handleNext}
      nextEnabled={ready && !saving}
      nextLabel={saving ? 'Saving…' : 'Continue'}
      onBack={() => router.back()}
    >
      {!ready ? <Text style={s.note}>Loading your strength preferences…</Text> : <>
      <View style={s.options}>
        {STRENGTH_OPTIONS.map(opt => {
          const active = level === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.card, active && s.cardActive]}
              onPress={() => setLevel(opt.key)}
              disabled={saving}
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

      <StrengthSessionFit value={{ ...fit, strengthLevel: level }} disabled={saving} onChange={patch => setFit(previous => ({ ...previous, ...patch }))} />
      <Text style={s.note}>Running and lifting experience are used separately. You can update these choices in Profile → Training Availability.</Text>
      </>}
      {error ? <Text accessibilityRole="alert" style={[s.note, { color: colors.critical }]}>{error}</Text> : null}
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
