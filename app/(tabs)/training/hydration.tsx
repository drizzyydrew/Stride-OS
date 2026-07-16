import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useWeather } from '../../../src/hooks/useWeather';
import {
  HYDRATION_PLANNER_DEFAULTS,
  useHydrationPlannerStore,
} from '../../../src/store/hydrationPlannerStore';
import { LAYOUT } from '../../../src/constants/layout';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import {
  RUN_REMINDER_INTERVALS,
  DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
  HYDRATION_INFO_COPY,
  PER_HOUR_UNIT,
  CONCENTRATION_UNIT,
  DISTANCE_STEP_MI,
  DURATION_STEP_MIN,
} from '../../../src/constants/hydrationConfig';
import {
  calculateMeasuredSweatRate,
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
import { enqueueVoiceCue } from '../../../src/lib/voiceCue';

// ─── Defaults (used by Reset) ────────────────────────────────────────────────

const DEFAULTS = {
  ...HYDRATION_PLANNER_DEFAULTS,
  fuelingIntervalMin: DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
};

function fmt(n: number, decimals = 0) {
  return n.toFixed(decimals);
}

function formatMi(n: number) {
  // Trim trailing zeros while still allowing hundredths precision.
  return (Math.round(n * 100) / 100).toString();
}

function humidityBandForPercent(humidityPct: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (humidityPct < 35) return 'low';
  if (humidityPct < 65) return 'moderate';
  if (humidityPct < 80) return 'high';
  return 'very_high';
}

function showInfo(key: keyof typeof HYDRATION_INFO_COPY) {
  const copy = HYDRATION_INFO_COPY[key];
  Alert.alert(copy.title, copy.body);
}

// Press-and-hold auto-repeat so fine-grained (0.01 mi / 1 min) steps are
// still usable without hundreds of individual taps.
function useAutoRepeat(fn: () => void) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }

  function start() {
    fn();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(fn, 60);
    }, 420);
  }

  return { onPressIn: start, onPressOut: clear };
}

function Stepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
  hint,
  infoKey,
  onCommitValue,
}: {
  label: string;
  value: string | number;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  hint?: string;
  infoKey?: keyof typeof HYDRATION_INFO_COPY;
  onCommitValue?: (value: number) => void;
}) {
  const C = useColors();
  const { width, fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState(String(value));
  const minusRepeat = useAutoRepeat(onMinus);
  const plusRepeat  = useAutoRepeat(onPlus);
  const stacked = width <= 480 || fontScale >= 1.15;
  useEffect(() => setDraft(String(value)), [value]);

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed)) onCommitValue?.(parsed);
    else setDraft(String(value));
  }
  return (
    <View style={[s.inputRow, stacked && s.inputRowStacked]}>
      <View style={s.inputCopy}>
        <View style={s.labelRow}>
          <Text style={[s.inputLabel, { color: C.text }]}>{label}</Text>
          {infoKey && (
            <TouchableOpacity onPress={() => showInfo(infoKey)} hitSlop={10}>
              <Ionicons name="information-circle-outline" size={15} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>
        {hint ? <Text style={[s.inputHint, { color: C.textMuted }]}>{hint}</Text> : null}
      </View>
      <View style={[s.stepControls, stacked && s.stepControlsStacked]}>
        <TouchableOpacity
          {...minusRepeat}
          style={[s.stepBtn, { backgroundColor: C.cardAlt }]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        >
          <Ionicons name="remove" size={18} color={C.text} />
        </TouchableOpacity>
        {onCommitValue ? (
          <View style={[s.editableValueWrap, stacked && s.editableValueWrapStacked]}>
            <TextInput
              accessibilityLabel={`Enter ${label.toLowerCase()}`}
              value={draft}
              onChangeText={setDraft}
              onBlur={commitDraft}
              onSubmitEditing={commitDraft}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[s.stepValue, s.editableValue, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
            />
            {unit ? <Text style={[s.stepUnit, { color: C.textMuted }]}>{unit}</Text> : null}
          </View>
        ) : (
          <Text style={[s.stepValue, stacked && s.stepValueStacked, { color: C.text }]}>
            {value}{unit ? <Text style={[s.stepUnit, { color: C.textMuted }]}> {unit}</Text> : null}
          </Text>
        )}
        <TouchableOpacity
          {...plusRepeat}
          style={[s.stepBtn, { backgroundColor: C.cardAlt }]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
        >
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
  infoKey,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  infoKey?: keyof typeof HYDRATION_INFO_COPY;
}) {
  const C = useColors();
  return (
    <View style={s.choiceBlock}>
      <View style={s.labelRow}>
        <Text style={[s.inputLabel, { color: C.text }]}>{label}</Text>
        {infoKey && (
          <TouchableOpacity onPress={() => showInfo(infoKey)} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={15} color={C.textDim} />
          </TouchableOpacity>
        )}
      </View>
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

export default function HydrationScreen({ embedded = false }: { embedded?: boolean }) {
  const C = useColors();
  const router = useRouter();
  const units = useSettingsStore(st => st.units);
  const legacyFuelingIntervalMin = useSettingsStore(st => st.fuelingReminderIntervalMin);
  const weightKg = useOnboardingStore(st => st.data.weightKg) || 70;
  const weeklyMileage = useOnboardingStore(st => st.data.weeklyMileage);
  const profile = useProfileStore(st => st.getActiveProfile());
  const { weather, loading: weatherLoading, refresh: refreshWeather } = useWeather();
  const planner = useHydrationPlannerStore();
  const {
    distanceMi, durationMin, tempF, humidityPct, weatherSource, effort,
    sweatiness, saltiness, cramping, fluidComfort, goal, giTolerance,
    sweatRateMode, sweatRateLh, sweatSodiumMgL,
    sweatTestPreWeightKg, sweatTestPostWeightKg, sweatTestFluidConsumedL,
    sweatTestUrineOutputL, sweatTestDurationMin,
    carbToleranceMode, knownCarbToleranceGh, carbProgressionTargetGh,
    hydrationReminderEnabled, hydrationReminderIntervalMin, hydrationReminderRecommendedMin,
    hydrationReminderSelection, fuelReminderEnabled, fuelReminderIntervalMin,
    fuelReminderRecommendedMin, fuelReminderSelection, migratedLegacyFuelInterval,
    updateInputs, resetInputs,
  } = planner;
  const setDistanceMi = (next: number | ((value: number) => number)) =>
    updateInputs({ distanceMi: typeof next === 'function' ? next(distanceMi) : next });
  const setDurationMin = (next: number | null | ((value: number | null) => number | null)) =>
    updateInputs({ durationMin: typeof next === 'function' ? next(durationMin) : next });
  const setTempF = (next: number | ((value: number) => number)) =>
    updateInputs({ tempF: typeof next === 'function' ? next(tempF) : next });
  const setHumidityPct = (next: number | ((value: number) => number)) =>
    updateInputs({ humidityPct: typeof next === 'function' ? next(humidityPct) : next });
  const setWeatherSource = (next: 'current_location' | 'manual') => updateInputs({ weatherSource: next });
  const setEffort = (next: number | ((value: number) => number)) =>
    updateInputs({ effort: typeof next === 'function' ? next(effort) : next });
  const setSweatiness = (next: Sweatiness) => updateInputs({ sweatiness: next });
  const setSaltiness = (next: Saltiness) => updateInputs({ saltiness: next });
  const setCramping = (next: CrampingFrequency) => updateInputs({ cramping: next });
  const setFluidComfort = (next: FluidComfort) => updateInputs({ fluidComfort: next });
  const setGoal = (next: HydrationGoal) => updateInputs({ goal: next });
  const setGiTolerance = (next: GiTolerance | 'unsure') => updateInputs({ giTolerance: next });
  const setSweatRateMode = (next: 'estimate' | 'known') => updateInputs({ sweatRateMode: next });
  const setSweatRateLh = (next: number | ((value: number) => number)) =>
    updateInputs({ sweatRateLh: typeof next === 'function' ? next(sweatRateLh) : next });
  const [pickerFor, setPickerFor] = useState<'hydration' | 'fuel' | null>(null);
  const [recalculatedFlash, setRecalculatedFlash] = useState(false);

  useEffect(() => {
    if (!migratedLegacyFuelInterval) {
      updateInputs({
        fuelReminderIntervalMin: Math.max(5, Math.min(60, legacyFuelingIntervalMin)),
        migratedLegacyFuelInterval: true,
      });
    }
  }, [legacyFuelingIntervalMin, migratedLegacyFuelInterval, updateInputs]);

  useEffect(() => {
    if (weather && weatherSource === 'current_location') {
      setTempF(weather.tempF);
      setHumidityPct(weather.humidity);
    }
  }, [weather, weatherSource]); // setters intentionally write the latest live weather into persisted inputs

  function useCurrentLocation() {
    setWeatherSource('current_location');
    refreshWeather();
  }

  function handleReset() {
    resetInputs({
      ...HYDRATION_PLANNER_DEFAULTS,
      tempF: weather?.tempF ?? DEFAULTS.tempF,
      humidityPct: weather?.humidity ?? DEFAULTS.humidityPct,
    });
  }

  function handleRecalculate() {
    if (weatherSource === 'current_location') refreshWeather();
    setRecalculatedFlash(true);
    setTimeout(() => setRecalculatedFlash(false), 1400);
  }

  const easyPaceSecPerMi = useMemo(() => {
    const zones = profile?.calibration?.paceZones;
    const easy = zones ? Object.values(zones).find(zone => zone.label.toLowerCase().includes('easy')) : undefined;
    return easy?.maxSecPerMi ?? estimateEasyPaceSecPerMi(weeklyMileage);
  }, [profile, weeklyMileage]);

  const autoDuration = Math.round(distanceMi * easyPaceSecPerMi / 60);
  const actualDuration = durationMin ?? autoDuration;
  const measuredSweatRate = useMemo(() => calculateMeasuredSweatRate({
    preWeightKg: sweatTestPreWeightKg,
    postWeightKg: sweatTestPostWeightKg,
    fluidConsumedL: sweatTestFluidConsumedL,
    urineOutputL: sweatTestUrineOutputL,
    durationMin: sweatTestDurationMin,
  }), [
    sweatTestDurationMin, sweatTestFluidConsumedL, sweatTestPostWeightKg,
    sweatTestPreWeightKg, sweatTestUrineOutputL,
  ]);
  const carbToleranceGh = carbToleranceMode === 'known'
    ? knownCarbToleranceGh ?? undefined
    : carbToleranceMode === 'category' && giTolerance !== 'unsure'
      ? GI_TOLERANCE_CARBS_GH[giTolerance]
      : undefined;

  const plan = useMemo(() => calculateHydrationPlan({
    distanceMiles: distanceMi,
    durationMin: actualDuration,
    bodyWeightKg: weightKg,
    effort,
    weatherBand: weatherBandForTemp(tempF),
    temperatureF: tempF,
    humidityBand: humidityBandForPercent(humidityPct),
    sunExposure: 'mixed',
    sweatiness,
    saltiness,
    cramping,
    fluidComfort,
    goal,
    carbToleranceGh,
    sweatRateTestLh: sweatRateMode === 'known' ? sweatRateLh : undefined,
    sweatSodiumMgL: sweatSodiumMgL ?? undefined,
  }), [
    actualDuration, carbToleranceGh, cramping, distanceMi, effort, fluidComfort,
    goal, humidityPct, saltiness, sweatiness, sweatRateMode, sweatRateLh,
    sweatSodiumMgL, tempF, weightKg,
  ]);

  useEffect(() => {
    const hydrationRecommended = actualDuration >= 120 ? 15 : 20;
    const fuelRecommended = actualDuration <= 60 ? 30 : actualDuration <= 120 ? 25 : 20;
    const patch: Parameters<typeof updateInputs>[0] = {
      hydrationReminderRecommendedMin: hydrationRecommended,
      fuelReminderRecommendedMin: fuelRecommended,
    };
    if (hydrationReminderSelection === 'recommended') patch.hydrationReminderIntervalMin = hydrationRecommended;
    if (fuelReminderSelection === 'recommended') patch.fuelReminderIntervalMin = fuelRecommended;
    if (
      hydrationReminderRecommendedMin !== hydrationRecommended
      || fuelReminderRecommendedMin !== fuelRecommended
      || (hydrationReminderSelection === 'recommended' && hydrationReminderIntervalMin !== hydrationRecommended)
      || (fuelReminderSelection === 'recommended' && fuelReminderIntervalMin !== fuelRecommended)
    ) updateInputs(patch);
  }, [
    actualDuration, fuelReminderIntervalMin, fuelReminderRecommendedMin,
    fuelReminderSelection, hydrationReminderIntervalMin, hydrationReminderRecommendedMin,
    hydrationReminderSelection, updateInputs,
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
  const distanceLabel = units === 'metric' ? `${fmt(distanceMi * 1.609344, 2)} km` : `${formatMi(distanceMi)} mi`;
  const fluidHour = units === 'metric'
    ? `${fmt(plan.range.fluidLowL, 2)}-${fmt(plan.range.fluidHighL, 2)} L${PER_HOUR_UNIT}`
    : `${fmt(plan.range.fluidLowL * 33.814)}-${fmt(plan.range.fluidHighL * 33.814)} oz${PER_HOUR_UNIT}`;
  const fluidHourlyValue = units === 'metric'
    ? `${fmt(plan.hourly.fluidL, 2)} L${PER_HOUR_UNIT}`
    : `${plan.hourly.fluidOz} oz${PER_HOUR_UNIT}`;
  const fluidTotal = units === 'metric'
    ? `${fmt(plan.totals.fluidL, 1)} L total`
    : `${fmt(plan.totals.fluidOz)} oz total`;
  const hydrationCueOz = Math.max(1, Math.round(plan.hourly.fluidOz * hydrationReminderIntervalMin / 60));
  const fuelCueG = Math.max(1, Math.round((plan.hourly.carbsG * fuelReminderIntervalMin / 60) / 5) * 5);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={embedded ? [] : ['top']}>
      {!embedded ? (
        <ScreenHeader
          eyebrow="RUNNING"
          title="Hydration Plan"
          onBack={() => router.back()}
        />
      ) : null}

      <KeyboardAvoidingView style={s.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: embedded ? 32 : LAYOUT.screenPadBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* ── Known athlete data and personalization come first. ── */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>PERSONALIZATION + KNOWN DATA</Text>
          <Text style={[s.inputHint, { color: C.textMuted }]}>Body weight from profile: {weightLabel}</Text>
          <Text style={[s.dividerText, { color: C.text }]}>Measured sweat rate</Text>
          <Text style={[s.inputHint, { color: C.textMuted }]}>
            A pre/post-run weigh-in is distinct from estimated sweatiness. Fluid consumed is added and urine output is subtracted.
          </Text>
          <Stepper
            label="Pre-run weight"
            value={sweatTestPreWeightKg == null ? '' : fmt(sweatTestPreWeightKg, 1)}
            unit="kg"
            onMinus={() => updateInputs({ sweatTestPreWeightKg: Math.max(20, (sweatTestPreWeightKg ?? weightKg) - 0.1) })}
            onPlus={() => updateInputs({ sweatTestPreWeightKg: Math.min(250, (sweatTestPreWeightKg ?? weightKg) + 0.1) })}
            onCommitValue={value => updateInputs({ sweatTestPreWeightKg: Math.max(20, Math.min(250, value)) })}
          />
          <Stepper
            label="Post-run weight"
            value={sweatTestPostWeightKg == null ? '' : fmt(sweatTestPostWeightKg, 1)}
            unit="kg"
            onMinus={() => updateInputs({ sweatTestPostWeightKg: Math.max(20, (sweatTestPostWeightKg ?? weightKg) - 0.1) })}
            onPlus={() => updateInputs({ sweatTestPostWeightKg: Math.min(250, (sweatTestPostWeightKg ?? weightKg) + 0.1) })}
            onCommitValue={value => updateInputs({ sweatTestPostWeightKg: Math.max(20, Math.min(250, value)) })}
          />
          <Stepper
            label="Fluid consumed"
            value={fmt(sweatTestFluidConsumedL, 2)}
            unit="L"
            onMinus={() => updateInputs({ sweatTestFluidConsumedL: Math.max(0, sweatTestFluidConsumedL - 0.05) })}
            onPlus={() => updateInputs({ sweatTestFluidConsumedL: Math.min(5, sweatTestFluidConsumedL + 0.05) })}
            onCommitValue={value => updateInputs({ sweatTestFluidConsumedL: Math.max(0, Math.min(5, value)) })}
          />
          <Stepper
            label="Test duration"
            value={sweatTestDurationMin}
            unit="min"
            onMinus={() => updateInputs({ sweatTestDurationMin: Math.max(1, sweatTestDurationMin - 1) })}
            onPlus={() => updateInputs({ sweatTestDurationMin: Math.min(360, sweatTestDurationMin + 1) })}
            onCommitValue={value => updateInputs({ sweatTestDurationMin: Math.max(1, Math.min(360, Math.round(value))) })}
          />
          <Stepper
            label="Urine output"
            value={fmt(sweatTestUrineOutputL, 2)}
            unit="L"
            onMinus={() => updateInputs({ sweatTestUrineOutputL: Math.max(0, sweatTestUrineOutputL - 0.05) })}
            onPlus={() => updateInputs({ sweatTestUrineOutputL: Math.min(3, sweatTestUrineOutputL + 0.05) })}
            onCommitValue={value => updateInputs({ sweatTestUrineOutputL: Math.max(0, Math.min(3, value)) })}
          />
          {measuredSweatRate != null ? (
            <TouchableOpacity
              style={[s.measureResult, { backgroundColor: C.primaryDim, borderColor: C.primary }]}
              onPress={() => updateInputs({ sweatRateMode: 'known', sweatRateLh: measuredSweatRate })}
            >
              <Text style={[s.inputLabel, { color: C.primary }]}>Measured Sweat Rate: {measuredSweatRate} L/hr</Text>
              <Text style={[s.inputHint, { color: C.textMuted }]}>Tap to use this result in the plan.</Text>
            </TouchableOpacity>
          ) : null}
          <ChoiceRow
            label="Sweat rate"
            value={sweatRateMode}
            onChange={setSweatRateMode}
            infoKey="sweatRate"
            options={[
              { value: 'estimate', label: 'Estimate for me' },
              { value: 'known', label: 'I know mine' },
            ]}
          />
          {sweatRateMode === 'known' ? (
            <Stepper
              label="Sweat rate"
              value={fmt(sweatRateLh, 1)}
              unit={`L${PER_HOUR_UNIT}`}
              hint="From a sweat test or pre/post-run weigh-in."
              onMinus={() => setSweatRateLh(v => Math.max(0.2, Math.round((v - 0.1) * 10) / 10))}
              onPlus={() => setSweatRateLh(v => Math.min(2.5, Math.round((v + 0.1) * 10) / 10))}
              onCommitValue={value => setSweatRateLh(Math.max(0.2, Math.min(2.5, Math.round(value * 10) / 10)))}
            />
          ) : (
            <>
              <ChoiceRow
                label="Estimated sweatiness"
                value={sweatiness}
                onChange={setSweatiness}
                infoKey="sweatRate"
                options={[
                  { value: 'very_low', label: 'Very low' },
                  { value: 'low', label: 'Low' },
                  { value: 'average', label: 'Average' },
                  { value: 'high', label: 'High' },
                  { value: 'very_high', label: 'Very high' },
                ]}
              />
              <Text style={[s.inputHint, { color: C.textMuted }]}>
                Subjective starting estimate used only when measured sweat rate is unavailable; it is not equivalent to a measured value.
              </Text>
            </>
          )}
          <ChoiceRow
            label="Sweat saltiness"
            value={saltiness}
            onChange={setSaltiness}
            infoKey="saltiness"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'salty', label: 'Salty' },
              { value: 'very_salty', label: 'Very salty' },
            ]}
          />
          <Stepper
            label="Known sweat sodium concentration"
            value={sweatSodiumMgL ?? 900}
            unit="mg/L"
            hint="Optional concentration from a sweat test. mg/L is concentration, not hourly intake."
            onMinus={() => updateInputs({ sweatSodiumMgL: Math.max(100, (sweatSodiumMgL ?? 900) - 50) })}
            onPlus={() => updateInputs({ sweatSodiumMgL: Math.min(2500, (sweatSodiumMgL ?? 900) + 50) })}
            onCommitValue={value => updateInputs({ sweatSodiumMgL: Math.max(100, Math.min(2500, Math.round(value))) })}
          />
          <ChoiceRow
            label="Cramping tendency"
            value={cramping}
            onChange={setCramping}
            infoKey="cramping"
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
            infoKey="fluidComfort"
            options={[
              { value: 'low', label: 'Small sips' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'high', label: 'Drink well' },
            ]}
          />
          <ChoiceRow
            label="Carbohydrate tolerance"
            value={carbToleranceMode}
            onChange={value => updateInputs({ carbToleranceMode: value })}
            infoKey="giTolerance"
            options={[
              { value: 'known', label: 'Known g/hr' },
              { value: 'category', label: 'Practical category' },
              { value: 'unknown', label: 'Not tested' },
            ]}
          />
          {carbToleranceMode === 'known' ? (
            <>
              <Stepper
                label="Current tolerated carbohydrate"
                value={knownCarbToleranceGh ?? 60}
                unit="g/hr"
                onMinus={() => updateInputs({ knownCarbToleranceGh: Math.max(10, (knownCarbToleranceGh ?? 60) - 5) })}
                onPlus={() => updateInputs({ knownCarbToleranceGh: Math.min(120, (knownCarbToleranceGh ?? 60) + 5) })}
                onCommitValue={value => updateInputs({ knownCarbToleranceGh: Math.max(10, Math.min(120, Math.round(value))) })}
              />
              <Stepper
                label="Progression target"
                value={carbProgressionTargetGh ?? knownCarbToleranceGh ?? 60}
                unit="g/hr"
                hint="A higher value is a practice target, not established current tolerance."
                onMinus={() => updateInputs({ carbProgressionTargetGh: Math.max(10, (carbProgressionTargetGh ?? knownCarbToleranceGh ?? 60) - 5) })}
                onPlus={() => updateInputs({ carbProgressionTargetGh: Math.min(120, (carbProgressionTargetGh ?? knownCarbToleranceGh ?? 60) + 5) })}
                onCommitValue={value => updateInputs({ carbProgressionTargetGh: Math.max(10, Math.min(120, Math.round(value))) })}
              />
            </>
          ) : carbToleranceMode === 'category' ? (
            <ChoiceRow
              label="Gastrointestinal tolerance"
              value={giTolerance}
              onChange={setGiTolerance}
              options={[
                { value: 'unsure', label: 'Not sure' },
                { value: 'low', label: 'Sensitive' },
                { value: 'typical', label: 'Typical' },
                { value: 'high', label: 'Handles a lot' },
              ]}
            />
          ) : (
            <Text style={[s.inputHint, { color: C.textMuted }]}>
              The plan uses a conservative starting estimate until tolerance is tested in training.
            </Text>
          )}
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

        {/* ── Run details and environment. ── */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>QUICK INPUTS</Text>
          <Stepper
            label="Distance"
            value={units === 'metric' ? fmt(distanceMi * 1.609344, 2) : formatMi(distanceMi)}
            unit={units === 'metric' ? 'km' : 'mi'}
            onMinus={() => setDistanceMi(v => Math.max(0.1, Math.round((v - DISTANCE_STEP_MI) * 100) / 100))}
            onPlus={() => setDistanceMi(v => Math.round((v + DISTANCE_STEP_MI) * 100) / 100)}
            onCommitValue={value => setDistanceMi(Math.max(0.1, Math.round((units === 'metric' ? value / 1.609344 : value) * 100) / 100))}
            hint="Hold +/- to move faster."
          />
          <Stepper
            label="Duration"
            value={actualDuration}
            unit="min"
            hint={durationMin === null ? 'Auto-estimated from easy pace. Tap +/- to set manually.' : 'Manual duration. Hold +/- to move faster.'}
            onMinus={() => setDurationMin(v => Math.max(1, (v ?? autoDuration) - DURATION_STEP_MIN))}
            onPlus={() => setDurationMin(v => (v ?? autoDuration) + DURATION_STEP_MIN)}
            onCommitValue={value => setDurationMin(Math.max(1, Math.round(value)))}
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
          <Text style={[s.sectionLabel, { color: C.textDim }]}>WEATHER</Text>
          <View style={s.weatherRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.inputLabel, { color: C.text }]}>{tempF} F</Text>
              <Text style={[s.inputHint, { color: C.textMuted }]}>
                {weatherSource === 'current_location'
                  ? (weatherLoading ? 'Fetching current location weather…' : 'Using current location weather.')
                  : 'Manual entry.'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={useCurrentLocation}
              style={[s.locationBtn, { backgroundColor: weatherSource === 'current_location' ? C.primaryDim : C.cardAlt, borderColor: weatherSource === 'current_location' ? C.primary : C.border }]}
            >
              {weatherLoading && weatherSource === 'current_location' ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Ionicons name="locate-outline" size={16} color={weatherSource === 'current_location' ? C.primary : C.textMuted} />
              )}
              <Text style={[s.locationBtnTxt, { color: weatherSource === 'current_location' ? C.primary : C.textMuted }]}>
                Use current location
              </Text>
            </TouchableOpacity>
          </View>
          <Stepper
            label="Temperature"
            value={tempF}
            unit="F"
            hint="Manual entry switches away from current-location weather."
            onMinus={() => { setTempF(v => Math.max(-20, v - 1)); setWeatherSource('manual'); }}
            onPlus={() => { setTempF(v => Math.min(130, v + 1)); setWeatherSource('manual'); }}
            onCommitValue={value => { setTempF(Math.max(-20, Math.min(130, Math.round(value)))); setWeatherSource('manual'); }}
          />
          <Stepper
            label="Humidity"
            value={humidityPct}
            unit="%"
            hint="Live when current location is on; editable in manual mode."
            onMinus={() => { setHumidityPct(v => Math.max(0, v - 1)); setWeatherSource('manual'); }}
            onPlus={() => { setHumidityPct(v => Math.min(100, v + 1)); setWeatherSource('manual'); }}
            onCommitValue={value => { setHumidityPct(Math.max(0, Math.min(100, Math.round(value)))); setWeatherSource('manual'); }}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>VOICE REMINDERS</Text>
          <Text style={[s.inputHint, { color: C.textMuted }]}>
            Hydration and fuel are scheduled independently. If both are due together, StrideOS combines them into one spoken and visual cue.
          </Text>
          <View style={s.reminderRow}>
            <View style={s.inputCopy}>
              <Text style={[s.inputLabel, { color: C.text }]}>Hydration reminder</Text>
              <Text style={[s.inputHint, { color: C.textMuted }]}>
                Every {hydrationReminderIntervalMin} min · approximately {hydrationCueOz} oz per cue
              </Text>
            </View>
            <Switch
              accessibilityLabel="Enable hydration voice reminders"
              value={hydrationReminderEnabled}
              onValueChange={value => updateInputs({ hydrationReminderEnabled: value })}
              trackColor={{ false: C.border, true: C.primaryDim }}
              thumbColor={hydrationReminderEnabled ? C.primary : C.textDim}
            />
          </View>
          <TouchableOpacity
            style={[s.intervalButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={() => setPickerFor('hydration')}
          >
            <Text style={[s.inputLabel, { color: C.text }]}>Hydration interval</Text>
            <Text style={[s.intervalValue, { color: C.primary }]}>
              {hydrationReminderIntervalMin} min · {hydrationReminderSelection === 'recommended' ? 'Recommended' : 'Override'}
            </Text>
          </TouchableOpacity>
          {hydrationReminderSelection === 'override' ? (
            <TouchableOpacity onPress={() => updateInputs({
              hydrationReminderSelection: 'recommended',
              hydrationReminderIntervalMin: hydrationReminderRecommendedMin,
            })}>
              <Text style={[s.recommendLink, { color: C.primary }]}>Use recommended {hydrationReminderRecommendedMin}-minute interval</Text>
            </TouchableOpacity>
          ) : null}
          <View style={s.reminderRow}>
            <View style={s.inputCopy}>
              <Text style={[s.inputLabel, { color: C.text }]}>Fuel reminder</Text>
              <Text style={[s.inputHint, { color: C.textMuted }]}>
                Every {fuelReminderIntervalMin} min · approximately {fuelCueG} g carbohydrate per cue
              </Text>
            </View>
            <Switch
              accessibilityLabel="Enable fuel voice reminders"
              value={fuelReminderEnabled}
              onValueChange={value => updateInputs({ fuelReminderEnabled: value })}
              trackColor={{ false: C.border, true: C.primaryDim }}
              thumbColor={fuelReminderEnabled ? C.primary : C.textDim}
            />
          </View>
          <TouchableOpacity
            style={[s.intervalButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={() => setPickerFor('fuel')}
          >
            <Text style={[s.inputLabel, { color: C.text }]}>Fuel interval</Text>
            <Text style={[s.intervalValue, { color: C.primary }]}>
              {fuelReminderIntervalMin} min · {fuelReminderSelection === 'recommended' ? 'Recommended' : 'Override'}
            </Text>
          </TouchableOpacity>
          {fuelReminderSelection === 'override' ? (
            <TouchableOpacity onPress={() => updateInputs({
              fuelReminderSelection: 'recommended',
              fuelReminderIntervalMin: fuelReminderRecommendedMin,
            })}>
              <Text style={[s.recommendLink, { color: C.primary }]}>Use recommended {fuelReminderRecommendedMin}-minute interval</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[s.testVoiceBtn, { borderColor: C.primary }]}
            onPress={() => {
              if (!hydrationReminderEnabled && !fuelReminderEnabled) {
                Alert.alert('Voice reminders are off', 'Enable hydration, fuel, or both reminders before testing the spoken cue.');
                return;
              }
              enqueueVoiceCue(
                hydrationReminderEnabled && fuelReminderEnabled
                  ? `Hydration and fuel reminder. Drink approximately ${hydrationCueOz} ounces and take approximately ${fuelCueG} grams of carbohydrate.`
                  : hydrationReminderEnabled
                    ? `Hydration reminder. Drink approximately ${hydrationCueOz} ounces.`
                    : `Fuel reminder. Take approximately ${fuelCueG} grams of carbohydrate.`,
              );
            }}
          >
            <Ionicons name="volume-high-outline" size={17} color={C.primary} />
            <Text style={[s.controlBtnTxt, { color: C.primary }]}>Test Voice</Text>
          </TouchableOpacity>
        </View>

        <View style={s.controlsRow}>
          <TouchableOpacity onPress={handleRecalculate} style={[s.controlBtn, s.controlBtnPrimary, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
            <Ionicons name={recalculatedFlash ? 'checkmark' : 'calculator-outline'} size={16} color={C.primary} />
            <Text style={[s.controlBtnTxt, { color: C.primary }]}>{recalculatedFlash ? 'Recalculated' : 'Recalculate'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hydration Plan: the primary visual, shown after inputs are set ── */}
        <View style={[s.summaryCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[s.summaryEyebrow, { color: C.primary }]}>YOUR HYDRATION PLAN</Text>
          <Text style={[s.summaryTitle, { color: C.text }]}>
            {distanceLabel} · {actualDuration} min · {tempF} F
          </Text>
          <Text style={[s.summaryMeta, { color: C.textMuted }]}>
            Body weight {weightLabel} · {plan.confidence.label} ({plan.confidence.score}/100)
          </Text>
          <Text style={[s.summaryMeta, { color: C.textMuted }]}>
            Hydration every {hydrationReminderIntervalMin} min · Fuel every {fuelReminderIntervalMin} min · {weatherSource === 'current_location' ? 'Current-location' : 'Manual'} weather · {humidityPct}% humidity
          </Text>
          <Text style={[s.summaryWhy, { color: C.text }]}>{planExplanation}</Text>
        </View>

        <View style={s.resultGrid}>
          <ResultCard
            label="CARBS"
            value={`${plan.hourly.carbsG} g${PER_HOUR_UNIT}`}
            range={`${plan.range.carbsLowG}-${plan.range.carbsHighG} g${PER_HOUR_UNIT}`}
            note={`${plan.totals.carbsG} g total`}
          />
          <ResultCard
            label="FLUID"
            value={fluidHourlyValue}
            range={fluidHour}
            note={fluidTotal}
          />
          <ResultCard
            label="SODIUM"
            value={`${plan.hourly.sodiumMg} mg${PER_HOUR_UNIT}`}
            range={`${plan.range.sodiumLowMg}-${plan.range.sodiumHighMg} mg${PER_HOUR_UNIT}`}
            note={`${plan.hourly.sodiumMgPerL} ${CONCENTRATION_UNIT} drink`}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>EXECUTION</Text>
          <Text style={[s.body, { color: C.textMuted }]}>- Hydration cues: every {hydrationReminderIntervalMin} minutes, approximately {hydrationCueOz} oz each.</Text>
          <Text style={[s.body, { color: C.textMuted }]}>- Fuel cues: every {fuelReminderIntervalMin} minutes, approximately {fuelCueG} g carbohydrate each.</Text>
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
            {sweatRateMode === 'known' ? 'Measured' : 'Estimated'} sweat rate: {plan.physiology.sweatRateLh} L{PER_HOUR_UNIT} · Sweat sodium: {plan.physiology.sweatSodiumMgL} {CONCENTRATION_UNIT} · Projected bodyweight loss: {plan.totals.projectedBodyWeightLossPct}%
          </Text>
          <Text style={[s.body, { color: C.textMuted }]}>
            mg/L describes sodium concentration in sweat or fluid. mg/hr describes the total sodium consumed each hour.
          </Text>
          {plan.warnings.map(item => (
            <Text key={item} style={[s.warning, { color: C.critical }]}>- {item}</Text>
          ))}
          {plan.notes.map(item => (
            <Text key={item} style={[s.body, { color: C.textMuted }]}>- {item}</Text>
          ))}
          <Text style={[s.disclaimer, { color: C.textMuted }]}>
            This is a performance-planning estimate, not medical advice. Test it in training and do not force fluid beyond thirst or gut comfort. Manual review is recommended if anything here doesn't match how you actually feel on the run.
          </Text>
          <TouchableOpacity onPress={handleReset} style={[s.resetBtn, { borderColor: C.border, backgroundColor: C.cardAlt }]}>
            <Ionicons name="refresh-outline" size={16} color={C.textMuted} />
            <Text style={[s.controlBtnTxt, { color: C.textMuted }]}>Reset planner inputs</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      <PickerWheel
        visible={pickerFor !== null}
        title={pickerFor === 'hydration' ? 'Hydration reminder interval' : 'Fuel reminder interval'}
        values={RUN_REMINDER_INTERVALS}
        selectedValue={pickerFor === 'hydration' ? hydrationReminderIntervalMin : fuelReminderIntervalMin}
        formatValue={value => `${value} minutes`}
        onClose={() => setPickerFor(null)}
        onConfirm={value => {
          if (pickerFor === 'hydration') updateInputs({
            hydrationReminderIntervalMin: value,
            hydrationReminderSelection: value === hydrationReminderRecommendedMin ? 'recommended' : 'override',
          });
          if (pickerFor === 'fuel') updateInputs({
            fuelReminderIntervalMin: value,
            fuelReminderSelection: value === fuelReminderRecommendedMin ? 'recommended' : 'override',
          });
          setPickerFor(null);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },
  summaryCard: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 14 },
  summaryEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  summaryTitle: { fontSize: 19, fontWeight: '900' },
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
  inputRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  inputCopy: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputLabel: { flexShrink: 1, fontSize: 14, fontWeight: '900' },
  inputHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepControlsStacked: { alignSelf: 'stretch', justifyContent: 'space-between', marginTop: 12 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 66, textAlign: 'center', fontSize: 15, fontWeight: '900' },
  editableValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editableValueWrapStacked: { flex: 1, justifyContent: 'center' },
  editableValue: { minWidth: 58, height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8 },
  stepUnit: { fontSize: 11, fontWeight: '700' },
  stepValueStacked: { flex: 1 },
  choiceBlock: { paddingVertical: 10 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choicePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '800' },
  measureResult: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  intervalButton: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  intervalValue: { fontSize: 12, fontWeight: '900', textAlign: 'right', flexShrink: 1 },
  recommendLink: { fontSize: 12, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  testVoiceBtn: {
    minHeight: 44, borderWidth: 1, borderRadius: 12, marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  body: { fontSize: 13, lineHeight: 21, marginBottom: 6 },
  dividerText: { fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 4 },
  warning: { fontSize: 13, lineHeight: 20, marginTop: 8, fontWeight: '800' },
  disclaimer: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
  locationBtnTxt: { fontSize: 12, fontWeight: '800' },
  controlsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  controlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingVertical: 12,
  },
  controlBtnPrimary: {},
  controlBtnTxt: { fontSize: 13, fontWeight: '800' },
  resetBtn: { marginTop: 14, minHeight: 44, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});
