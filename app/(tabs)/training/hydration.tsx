import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import {
  FUELING_REMINDER_INTERVALS,
  DEFAULT_FUELING_REMINDER_INTERVAL_MIN,
  HYDRATION_INFO_COPY,
  PER_HOUR_UNIT,
  CONCENTRATION_UNIT,
  DISTANCE_STEP_MI,
  DURATION_STEP_MIN,
  type FuelingReminderIntervalMin,
} from '../../../src/constants/hydrationConfig';
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
  const [draft, setDraft] = useState(String(value));
  const minusRepeat = useAutoRepeat(onMinus);
  const plusRepeat  = useAutoRepeat(onPlus);
  useEffect(() => setDraft(String(value)), [value]);

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed)) onCommitValue?.(parsed);
    else setDraft(String(value));
  }
  return (
    <View style={s.inputRow}>
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
      <View style={s.stepControls}>
        <TouchableOpacity {...minusRepeat} style={[s.stepBtn, { backgroundColor: C.cardAlt }]}>
          <Ionicons name="remove" size={18} color={C.text} />
        </TouchableOpacity>
        {onCommitValue ? (
          <View style={s.editableValueWrap}>
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
          <Text style={[s.stepValue, { color: C.text }]}>
            {value}{unit ? <Text style={[s.stepUnit, { color: C.textMuted }]}> {unit}</Text> : null}
          </Text>
        )}
        <TouchableOpacity {...plusRepeat} style={[s.stepBtn, { backgroundColor: C.cardAlt }]}>
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

export default function HydrationScreen() {
  const C = useColors();
  const router = useRouter();
  const units = useSettingsStore(st => st.units);
  const fuelingIntervalMin = useSettingsStore(st => st.fuelingReminderIntervalMin);
  const setFuelingIntervalMin = useSettingsStore(st => st.setFuelingReminderIntervalMin);
  const weightKg = useOnboardingStore(st => st.data.weightKg) || 70;
  const weeklyMileage = useOnboardingStore(st => st.data.weeklyMileage);
  const profile = useProfileStore(st => st.getActiveProfile());
  const { weather, loading: weatherLoading, refresh: refreshWeather } = useWeather();
  const planner = useHydrationPlannerStore();
  const {
    distanceMi, durationMin, tempF, humidityPct, weatherSource, effort,
    sweatiness, saltiness, cramping, fluidComfort, goal, giTolerance,
    sweatRateMode, sweatRateLh, updateInputs, resetInputs,
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
  const [recalculatedFlash, setRecalculatedFlash] = useState(false);

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
    setFuelingIntervalMin(DEFAULTS.fuelingIntervalMin);
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
    carbToleranceGh: giTolerance === 'unsure' ? undefined : GI_TOLERANCE_CARBS_GH[giTolerance],
    sweatRateTestLh: sweatRateMode === 'known' ? sweatRateLh : undefined,
  }), [
    actualDuration, cramping, distanceMi, effort, fluidComfort, giTolerance,
    goal, humidityPct, saltiness, sweatiness, sweatRateMode, sweatRateLh, tempF, weightKg,
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

      <KeyboardAvoidingView style={s.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: LAYOUT.screenPadBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* ── Known athlete data and personalization come first. ── */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.sectionLabel, { color: C.textDim }]}>PERSONALIZATION + KNOWN DATA</Text>
          <Text style={[s.inputHint, { color: C.textMuted }]}>Body weight from profile: {weightLabel}</Text>
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
            label="Gastrointestinal tolerance"
            value={giTolerance}
            onChange={setGiTolerance}
            infoKey="giTolerance"
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
          <Text style={[s.sectionLabel, { color: C.textDim }]}>FUELING REMINDERS</Text>
          <ChoiceRow
            label="Remind me every"
            value={String(fuelingIntervalMin) as `${FuelingReminderIntervalMin}`}
            onChange={v => setFuelingIntervalMin(Number(v) as FuelingReminderIntervalMin)}
            options={FUELING_REMINDER_INTERVALS.map(min => ({ value: String(min) as `${FuelingReminderIntervalMin}`, label: `${min} min` }))}
          />
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
            Fuel reminder every {fuelingIntervalMin} min · {weatherSource === 'current_location' ? 'Current-location' : 'Manual'} weather · {humidityPct}% humidity
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
          <Text style={[s.body, { color: C.textMuted }]}>- Take fuel on the selected {fuelingIntervalMin}-minute reminder rhythm during Race Mode.</Text>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 32, fontFamily: 'CormorantGaramond_700Bold' },
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
  inputCopy: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '900' },
  inputHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 66, textAlign: 'center', fontSize: 15, fontWeight: '900' },
  editableValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editableValue: { minWidth: 58, height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8 },
  stepUnit: { fontSize: 11, fontWeight: '700' },
  choiceBlock: { paddingVertical: 10 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choicePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: '800' },
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
