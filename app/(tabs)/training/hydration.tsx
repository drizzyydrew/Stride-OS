// ─── Hydration Calculator ──────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useSettingsStore }   from '../../../src/store/settingsStore';
import { useProfileStore }    from '../../../src/store/profileStore';
import { useWeather }         from '../../../src/hooks/useWeather';
import {
  calcHydration,
  estimateEasyPaceSecPerMi,
} from '../../../src/utils/hydrationEngine';

import { colors }                   from '../../../src/theme/colors';
import { spacing }                  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

const OZ_TO_ML = 29.5735;

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals);
}

function intervalLabel(index: number): string {
  const startMin = index * 20;
  const endMin   = startMin + 20;
  const toHhMm   = (m: number) => `${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, '0')}`;
  return `${toHhMm(startMin)}–${toHhMm(endMin)}`;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  label, value, onDecrement, onIncrement, unit,
}: {
  label: string; value: number; onDecrement: () => void; onIncrement: () => void; unit: string;
}) {
  return (
    <View style={st.stepperRow}>
      <Text style={st.stepperLabel}>{label}</Text>
      <View style={st.stepperControls}>
        <TouchableOpacity style={st.stepBtn} onPress={onDecrement}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.stepperValue}>{value} <Text style={st.stepperUnit}>{unit}</Text></Text>
        <TouchableOpacity style={st.stepBtn} onPress={onIncrement}>
          <Ionicons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HydrationScreen() {
  const router = useRouter();

  const weightKg      = useOnboardingStore(s => s.data.weightKg);
  const weeklyMileage = useOnboardingStore(s => s.data.weeklyMileage);
  const units         = useSettingsStore(s => s.units);
  const profile       = useProfileStore(s => s.getActiveProfile());

  // Resolve easy pace: prefer calibrated zone, fall back to mileage-based estimate
  const easyPaceSecPerMi = useMemo(() => {
    const calibration = profile?.calibration;
    if (calibration?.paceZones) {
      const easyZone = Object.values(calibration.paceZones).find(z =>
        z.label.toLowerCase().includes('easy'),
      );
      if (easyZone) return easyZone.maxSecPerMi;
    }
    return estimateEasyPaceSecPerMi(weeklyMileage);
  }, [profile, weeklyMileage]);

  const { weather } = useWeather();
  const [liveTemp,   setLiveTemp]   = useState(false);

  const [distanceMi, setDistanceMi] = useState(5);
  const [tempF,      setTempF]      = useState(65);
  const [manualMin,  setManualMin]  = useState<number | null>(null);

  // Auto-fill temperature from live weather once on mount
  useEffect(() => {
    if (weather && !liveTemp) {
      setTempF(weather.tempF);
      setLiveTemp(true);
    }
  }, [weather]);

  const autoDuration = useMemo(
    () => Math.round(distanceMi * easyPaceSecPerMi / 60),
    [distanceMi, easyPaceSecPerMi],
  );
  const durationMin = manualMin ?? autoDuration;

  const result = useMemo(
    () => calcHydration(weightKg, durationMin, tempF),
    [weightKg, durationMin, tempF],
  );

  const isMetric    = units === 'metric';
  const weightLabel = isMetric
    ? `${fmt(weightKg, 1)} kg`
    : `${fmt(weightKg * 2.20462, 0)} lb`;

  function fluidLabel(oz: number) {
    return isMetric
      ? `${fmt(oz * OZ_TO_ML, 0)} ml`
      : `${fmt(oz, 1)} oz`;
  }

  const tempPct = Math.round((result.tempMultiplier - 1) * 100);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.title}>Hydration Calculator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Inputs */}
        <View style={st.card}>
          <Text style={st.sectionLabel}>INPUTS</Text>

          <View style={st.weightRow}>
            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
            <Text style={st.weightTxt}>Body weight: {weightLabel}</Text>
          </View>

          <View style={st.divider} />

          <Stepper
            label="Distance"
            value={distanceMi}
            unit="mi"
            onDecrement={() => setDistanceMi(v => Math.max(1, v - 1))}
            onIncrement={() => setDistanceMi(v => v + 1)}
          />

          <View style={st.divider} />

          <View>
            <Stepper
              label="Temperature"
              value={tempF}
              unit="°F"
              onDecrement={() => { setTempF(v => Math.max(32, v - 5)); setLiveTemp(false); }}
              onIncrement={() => { setTempF(v => Math.min(115, v + 5)); setLiveTemp(false); }}
            />
            {liveTemp && (
              <View style={st.liveBadgeRow}>
                <View style={st.liveDot} />
                <Text style={st.liveLabel}>Live weather — tap +/− to override</Text>
              </View>
            )}
          </View>

          <View style={st.divider} />

          {/* Duration row with auto/manual toggle */}
          <View style={st.durationRow}>
            <View>
              <Text style={st.stepperLabel}>Duration</Text>
              {manualMin === null && (
                <Text style={st.autoNote}>auto-estimated from pace</Text>
              )}
            </View>
            <View style={st.stepperControls}>
              {manualMin !== null && (
                <TouchableOpacity style={st.stepBtn} onPress={() => setManualMin(v => Math.max(10, (v ?? autoDuration) - 5))}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setManualMin(v => v === null ? autoDuration : null)}
                style={st.durationValueBtn}
              >
                <Text style={st.stepperValue}>
                  {durationMin} <Text style={st.stepperUnit}>min</Text>
                </Text>
                <Text style={st.editHint}>{manualMin === null ? 'tap to edit' : 'tap to reset'}</Text>
              </TouchableOpacity>
              {manualMin !== null && (
                <TouchableOpacity style={st.stepBtn} onPress={() => setManualMin(v => (v ?? autoDuration) + 5)}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Temperature note */}
        {tempPct > 0 && (
          <View style={st.tempNote}>
            <Ionicons name="sunny-outline" size={14} color={colors.warning} />
            <Text style={st.tempNoteTxt}>
              +{tempPct}% adjustment for warm conditions
            </Text>
          </View>
        )}

        {/* Summary totals */}
        <View style={st.card}>
          <Text style={st.sectionLabel}>TOTALS FOR YOUR RUN</Text>
          <View style={st.totalsRow}>
            <View style={st.totalCell}>
              <Text style={st.totalValue}>{fluidLabel(result.totalWaterOz)}</Text>
              <Text style={st.totalUnit}>Fluid</Text>
            </View>
            <View style={st.totalDivider} />
            <View style={st.totalCell}>
              <Text style={st.totalValue}>{fmt(result.carbsMinG, 0)}–{fmt(result.carbsMaxG, 0)}g</Text>
              <Text style={st.totalUnit}>Carbs</Text>
            </View>
            <View style={st.totalDivider} />
            <View style={st.totalCell}>
              <Text style={st.totalValue}>{fmt(result.sodiumMg, 0)}mg</Text>
              <Text style={st.totalUnit}>Sodium</Text>
            </View>
          </View>
        </View>

        {/* Per-interval summary - single line, no repeating table */}
        <View style={st.card}>
          <Text style={st.sectionLabel}>EVERY 20 MINUTES</Text>
          <View style={st.totalsRow}>
            <View style={st.totalCell}>
              <Text style={st.totalValue}>{fluidLabel(result.perInterval.waterOz)}</Text>
              <Text style={st.totalUnit}>Fluid</Text>
            </View>
            <View style={st.totalDivider} />
            <View style={st.totalCell}>
              <Text style={st.totalValue}>
                {fmt(result.perInterval.carbsMinG, 0)}–{fmt(result.perInterval.carbsMaxG, 0)}g
              </Text>
              <Text style={st.totalUnit}>Carbs</Text>
            </View>
            <View style={st.totalDivider} />
            <View style={st.totalCell}>
              <Text style={st.totalValue}>{fmt(result.perInterval.sodiumMg, 0)}mg</Text>
              <Text style={st.totalUnit}>Sodium</Text>
            </View>
          </View>
        </View>

        <View style={{ height: spacing.screenPadBottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius:    Radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.cardGap,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
    marginBottom:  spacing.md,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
  },
  weightTxt: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginVertical:  spacing.md,
  },
  stepperRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  stepperLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  stepBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepperValue: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    minWidth:   60,
    textAlign:  'center',
  },
  stepperUnit: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    fontWeight: '400',
  },
  durationRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  autoNote: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  durationValueBtn: {
    alignItems: 'center',
  },
  editHint: {
    color:    colors.textDim,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  tempNote: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.xs,
    backgroundColor: colors.warningDim,
    borderRadius:   Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:   spacing.cardGap,
  },
  tempNoteTxt: {
    color:    colors.warning,
    fontSize: FontSize.sm,
  },
  totalsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
  },
  totalCell: {
    flex:       1,
    alignItems: 'center',
    gap:        spacing.xs,
  },
  totalValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  totalUnit: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  totalDivider: {
    width:           1,
    height:          36,
    backgroundColor: colors.border,
  },
  tableHeader: {
    flexDirection:  'row',
    paddingBottom:  spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom:   spacing.xs,
  },
  colHead: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection:  'row',
    paddingVertical: spacing.sm,
  },
  tableRowAlt: {
    backgroundColor: colors.bg,
    borderRadius:    4,
  },
  cellTxt: {
    color:    colors.text,
    fontSize: FontSize.sm,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginTop:     4,
  },
  liveDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.positive,
  },
  liveLabel: {
    color:    colors.positive,
    fontSize: 10,
  },
});
