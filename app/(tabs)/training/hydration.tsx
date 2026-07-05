import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useWeather } from '../../../src/hooks/useWeather';
import { LAYOUT } from '../../../src/constants/layout';
import {
  calculateHydrationPlan,
  estimateEasyPaceSecPerMi,
  explainPlan,
  weatherBandForTemp,
  GI_TOLERANCE_CARBS_GH,
  type CrampingFrequency,
  type FluidComfort,
  type GiTolerance,
  type HydrationGoal,
  type Saltiness,
  type Sweatiness,
} from '../../../src/utils/hydrationEngine';

function fmt(n: number, decimals = 0) {
  return n.toFixed(decimals);
}

function Stepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  hint?: string;
}) {
  const C = useColors();
  return (
    <View style={s.inputRow}>
      <View style={s.inputCopy}>
        <Text style={[s.inputLabel, { color: C.text }]}>{label}</Text>
        {hint ? <Text style={[s.inputHint, { color: C.textMuted }]}>{hint}</Text> : null}
      </View>
      <View style={s.stepControls}>
        <TouchableOpacity onPress={onMinus} style={[s.stepBtn, { backgroundColor: C.cardAlt }]}>
          <Ionicons name="remove" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.stepValue, { color: C.text }]}>
          {value}{unit ? <Text style={[s.stepUnit, { color: C.textMuted }]}> {unit}</Text> : null}
        </Text>
        <TouchableOpacity onPress={onPlus} style={[s.stepBtn, { backgroundColor: C.cardAlt }]}>
          <Ionicons name="add" size={18} color={C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const C = useColors();
  return (
    <View style={s.choiceBlock}>
      <Text style={[s.inputLabel, { color: C.text }]}>{label}</Text>
      <View style={s.choiceWrap}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                s.choicePill,
                { backgroundColor: active ? C.primary : C.cardAlt, borderColor: active ? C.primary : C.border },
              ]}
            >
              <Text style={[s.choiceText, { color: active ? C.onPrimary : C.textMuted }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ResultCard({ label, value, range, note }: { label: string; value: string; range: string; note: string }) {
  const C = useColors();
  return (
    <View style={[s.resultCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[s.resultLabel, { color: C.textDim }]}>{label}</Text>
      <Text style={[s.resultValue, { color: C.text }]}>{value}</Text>
      <Text style={[s.resultRange, { color: C.primary }]}>{range}</Text>
      <Text style={[s.resultNote, { color: C.textMuted }]}>{note}</Text>
    </View>
  );
}

export default function HydrationScreen() {
  const C = useColors();
  const router = useRouter();
  const units = useSettingsStore(st => st.units);
  const weightKg = useOnboardingStore(st => st.data.weightKg) || 70;
  const weeklyMileage = useOnboardingStore(st => st.data.weeklyMileage);
  const profile = useProfileStore(st => st.getActiveProfile());
  const { weather } = useWeather();

  const [distanceMi, setDistanceMi] = useState(6);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [tempF, setTempF] = useState(65);
  const [liveTemp, setLiveTemp] = useState(false);
  const [effort, setEffort] = useState(5);
  const [sweatiness, setSweatiness] = useState<Sweatiness>('average');
  const [saltiness, setSaltiness] = useState<Saltiness>('moderate');
  const [cramping, setCramping] = useState<CrampingFrequency>('rarely');
  const [fluidComfort, setFluidComfort] = useState<FluidComfort>('moderate');
  const [goal, setGoal] = useState<HydrationGoal>('strong');
  const [giTolerance, setGiTolerance] = useState<GiTolerance | 'unsure'>('unsure');
  const [sweatRateMode, setSweatRateMode] = useState<'estimate' | 'known'>('estimate');
  const [sweatRateLh, setSweatRateLh] = useState(0.8);

  useEffect(() => {
    if (weather && !liveTemp) {
      setTempF(weather.tempF);
      setLiveTemp(true);
    }
  }, [liveTemp, weather]);

  const easyPaceSecPerMi = useMemo(() => {
    const zones = profile?.calibration?.paceZones;
    const easy = zones ? Object.values(zones).find(zone => zone.label.toLowerCase().includes('easy')) : undefined;
    return easy?.maxSecPerMi ?? estimateEasyPaceSecPerMi(weeklyMileage);
  }, [profile, weeklyMileage]);

  const autoDuration = Math.round(distanceMi * easyPaceSecPerMi / 60);
  const actualDuration = durationMin ?? autoDuration;

  const plan = useMemo(() => calculateHydrationPlan({
    distanceMiles: distanceMi,
    durationMin: actualDuration,
    bodyWeightKg: weightKg,
    effort,
    weatherBand: weatherBandForTemp(tempF),
    temperatureF: tempF,
    humidityBand: 'moderate',
    sunExposure: 'mixed',
    sweatiness,
    saltiness,
    cramping,
    fluidComfort,
    goal,
    carbToleranceGh: giTolerance === 'unsure' ? undefined : GI_TOLERANCE_CARBS_GH[giTolerance],
    sweatRateTestLh: sweatRateMode === 'known' ? sweatRateLh : undefined,
  }), [
    actualDuration, cramping, distanceMi, effort, fluidComfort, giTolerance,
    goal, saltiness, sweatiness, sweatRateMode, sweatRateLh, tempF, weightKg,
  ]);

  const planExplanation = useMemo(() => explainPlan({
    distanceMiles: distanceMi,
    durationMin: actualDuration,
    bodyWeightKg: weightKg,
    effort,
    weatherBand: weatherBandForTemp(tempF),
    temperatureF: tempF,
    sweatiness,
    saltiness,
    cramping,
    fluidComfort,
    goal,
  }, plan), [actualDuration, cramping, distanceMi, effort, fluidComfort, goal, plan, saltiness, sweatiness, tempF, weightKg]);

  const weightLabel = units === 'metric' ? `${fmt(weightKg, 1)} kg` : `${fmt(weightKg * 2.20462)} lb`;
  const distanceLabel = units === 'metric' ? `${fmt(distanceMi * 1.609344, 1)} km` : `${distanceMi} mi`;
  const fluidHour = units === 'metric'
    ? `${fmt(plan.range.fluidLowL * 1000)}-${fmt(plan.range.fluidHighL * 1000)} ml/h`
    : `${fmt(plan.range.fluidLowL * 33.814)}-${fmt(plan.range.fluidHighL * 33.814)} oz/h`;
  const fluidTotal = units === 'metric'
    ? `${fmt(plan.totals.fluidL, 1)} L total`
    : `${fmt(plan.totals.fluidOz)} oz total`;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>RUNNING</Text>
          <Text style={[s.title, { color: C.text }]}>Hydration Plan</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: LAYOUT.screenPadBottom }]} showsVerticalScrollIndicator={false}>
        <View style={[s.summaryCard, { backgroundColor: C.primaryDim, borderColor: C.border }]}>
          <Text style={[s.summaryTitle, { color: C.text }]}>
            {distanceLabel} · {actualDuration} min · {tempF} F
          </Text>
          <Text style={[s.summaryMeta, { color: C.textMuted }]}>
            Body weight {weightLabel} · {plan.confidence.label} ({plan.confidence.score}/100)
          </Text>
          <Text style={[s.summaryWhy, { color: C.text }]}>{planExplanation}</Text>
        </View>

        <View style={s.resultGrid}>
          <ResultCard
            label="CARBS"
            value={`${plan.hourly.carbsG} g/h`}
            range={`${plan.range.carbsLowG}-${plan.range.carbsHighG} g/h`}
            note={`${plan.totals.carbsG} g total`}
          />
          <ResultCard
            label="FLUID"
            value={`${plan.hourly.fluidOz} oz/h`}
            range={fluidHour}
            note={fluidTotal}
          />
          <ResultCard
            label="SODIUM"
            value={`${plan.hourly.sodiumMg} mg/h`}
            range={`${plan.range.sodiumLowMg}-${plan.range.sodiumHighMg} mg/h`}
            note={`${plan.hourly.sodiumMgPerL} mg/L drink`}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>QUICK INPUTS</Text>
          <Stepper
            label="Distance"
            value={distanceLabel}
            onMinus={() => setDistanceMi(v => Math.max(1, v - 1))}
            onPlus={() => setDistanceMi(v => v + 1)}
          />
          <Stepper
            label="Duration"
            value={actualDuration}
            unit="min"
            hint={durationMin === null ? 'Auto-estimated from easy pace. Tap +/- to set manually.' : 'Manual duration.'}
            onMinus={() => setDurationMin(v => Math.max(20, (v ?? autoDuration) - 5))}
            onPlus={() => setDurationMin(v => (v ?? autoDuration) + 5)}
          />
          <Stepper
            label="Temperature"
            value={tempF}
            unit="F"
            hint={liveTemp ? 'Using current weather until adjusted.' : 'Manual temperature.'}
            onMinus={() => { setTempF(v => Math.max(20, v - 5)); setLiveTemp(false); }}
            onPlus={() => { setTempF(v => Math.min(115, v + 5)); setLiveTemp(false); }}
          />
          <Stepper
            label="Effort"
            value={effort}
            unit="/10"
            onMinus={() => setEffort(v => Math.max(1, v - 1))}
            onPlus={() => setEffort(v => Math.min(10, v + 1))}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>PERSONALIZATION</Text>
          <ChoiceRow
            label="Sweat rate"
            value={sweatRateMode}
            onChange={setSweatRateMode}
            options={[
              { value: 'estimate', label: 'Estimate for me' },
              { value: 'known', label: 'I know mine' },
            ]}
          />
          {sweatRateMode === 'known' ? (
            <Stepper
              label="Sweat rate"
              value={fmt(sweatRateLh, 1)}
              unit="L/h"
              hint="From a sweat test or pre/post-run weigh-in."
              onMinus={() => setSweatRateLh(v => Math.max(0.2, Math.round((v - 0.1) * 10) / 10))}
              onPlus={() => setSweatRateLh(v => Math.min(2.5, Math.round((v + 0.1) * 10) / 10))}
            />
          ) : (
            <ChoiceRow
              label="Sweatiness"
              value={sweatiness}
              onChange={setSweatiness}
              options={[
                { value: 'very_low', label: 'Very low' },
                { value: 'low', label: 'Low' },
                { value: 'average', label: 'Average' },
                { value: 'high', label: 'High' },
                { value: 'very_high', label: 'Very high' },
              ]}
            />
          )}
          <ChoiceRow
            label="Saltiness"
            value={saltiness}
            onChange={setSaltiness}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'salty', label: 'Salty' },
              { value: 'very_salty', label: 'Very salty' },
            ]}
          />
          <ChoiceRow
            label="Cramping"
            value={cramping}
            onChange={setCramping}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'rarely', label: 'Rarely' },
              { value: 'sometimes', label: 'Sometimes' },
              { value: 'often', label: 'Often' },
            ]}
          />
          <ChoiceRow
            label="Fluid comfort"
            value={fluidComfort}
            onChange={setFluidComfort}
            options={[
              { value: 'low', label: 'Small sips' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'high', label: 'Drink well' },
            ]}
          />
          <ChoiceRow
            label="GI tolerance"
            value={giTolerance}
            onChange={setGiTolerance}
            options={[
              { value: 'unsure', label: 'Not sure' },
              { value: 'low', label: 'Sensitive' },
              { value: 'typical', label: 'Typical' },
              { value: 'high', label: 'Handles a lot' },
            ]}
          />
          <ChoiceRow
            label="Goal"
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'finish', label: 'Finish' },
              { value: 'strong', label: 'Strong' },
              { value: 'race_limit', label: 'Race' },
            ]}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>EXECUTION</Text>
          {plan.execution.map(item => (
            <Text key={item} style={[s.body, { color: C.textMuted }]}>- {item}</Text>
          ))}
          <Text style={[s.dividerText, { color: C.text }]}>Before</Text>
          <Text style={[s.body, { color: C.textMuted }]}>
            {plan.preRun
              ? `${plan.preRun.fluidMl[0]}-${plan.preRun.fluidMl[1]} ml with sodium ${plan.preRun.timing}`
              : 'Start normally hydrated. No special preload needed for this run.'}
          </Text>
          <Text style={[s.dividerText, { color: C.text }]}>After</Text>
          <Text style={[s.body, { color: C.textMuted }]}>
            Rehydrate about {plan.postRun.estimatedFluidL[0]}-{plan.postRun.estimatedFluidL[1]} L over the next few hours. {plan.postRun.sodiumGuidance}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>SAFETY + CONFIDENCE</Text>
          <Text style={[s.body, { color: C.textMuted }]}>
            {sweatRateMode === 'known' ? 'Measured' : 'Estimated'} sweat rate: {plan.physiology.sweatRateLh} L/h · Sweat sodium: {plan.physiology.sweatSodiumMgL} mg/L · Projected bodyweight loss: {plan.totals.projectedBodyWeightLossPct}%
          </Text>
          {plan.warnings.map(item => (
            <Text key={item} style={[s.warning, { color: C.critical }]}>- {item}</Text>
          ))}
          {plan.notes.map(item => (
            <Text key={item} style={[s.body, { color: C.textMuted }]}>- {item}</Text>
          ))}
          <Text style={[s.disclaimer, { color: C.textMuted }]}>
            This is a performance-planning estimate, not medical advice. Test it in training and do not force fluid beyond thirst or gut comfort.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 32, fontFamily: 'CormorantGaramond_700Bold' },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: '900' },
  summaryMeta: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  summaryWhy: { fontSize: 13, lineHeight: 19, marginTop: 10, fontWeight: '600' },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  resultCard: { width: '31%', minWidth: 104, flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 138 },
  resultLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  resultValue: { fontSize: 20, fontWeight: '900', marginTop: 8 },
  resultRange: { fontSize: 12, fontWeight: '900', marginTop: 5 },
  resultNote: { fontSize: 11, lineHeight: 15, marginTop: 5 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  inputCopy: { flex: 1, minWidth: 0 },
  inputLabel: { fontSize: 14, fontWeight: '900' },
  inputHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 66, textAlign: 'center', fontSize: 15, fontWeight: '900' },
  stepUnit: { fontSize: 11, fontWeight: '700' },
  choiceBlock: { paddingVertical: 10 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choicePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 21, marginBottom: 6 },
  dividerText: { fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 4 },
  warning: { fontSize: 13, lineHeight: 20, marginTop: 8, fontWeight: '800' },
  disclaimer: { fontSize: 12, lineHeight: 18, marginTop: 12 },
});
