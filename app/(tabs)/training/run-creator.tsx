// ─── Run Creator ──────────────────────────────────────────────────────────────
//
// Builds a custom run (fartlek, tempo, intervals, long run + strides) and
// estimates total duration before the user starts.

import { useState, useMemo } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useOnboardingStore }    from '../../../src/store/onboardingStore';
import { useAthleteStore }       from '../../../src/store/athleteStore';
import { useProfileStore }       from '../../../src/store/profileStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';

import {
  estimateEasyPaceSecPerMi,
  estimateFartlek,
  estimateTempo,
  estimateIntervals,
  estimateLongRunStrides,
  formatPaceMmSs,
  type DurationEstimate,
} from '../../../src/utils/hydrationEngine';
import { todayDateKey } from '../../../src/types/checkin';

import { colors }                       from '../../../src/theme/colors';
import { spacing }                      from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type RunType = 'fartlek' | 'tempo' | 'intervals' | 'long_run_strides';

const RUN_TYPES: { key: RunType; label: string; icon: string; desc: string }[] = [
  { key: 'fartlek',        label: 'Fartlek',          icon: 'flash-outline',    desc: 'Unstructured surges at feel' },
  { key: 'tempo',          label: 'Tempo',             icon: 'trending-up-outline', desc: 'Sustained comfortably hard effort' },
  { key: 'intervals',      label: 'Intervals',         icon: 'repeat-outline',   desc: 'Hard reps with timed recovery' },
  { key: 'long_run_strides', label: 'Long Run + Strides', icon: 'walk-outline', desc: 'Aerobic base + finishing strides' },
];

// ─── Stepper component ────────────────────────────────────────────────────────

function Stepper({
  label, sub, value, unit, min, step, onDecrement, onIncrement,
}: {
  label: string; sub?: string; value: number; unit: string;
  min?: number; step?: number;
  onDecrement: () => void; onIncrement: () => void;
}) {
  const s = step ?? 1;
  return (
    <View style={st.stepRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.stepLabel}>{label}</Text>
        {sub ? <Text style={st.stepSub}>{sub}</Text> : null}
      </View>
      <View style={st.stepControls}>
        <TouchableOpacity style={st.stepBtn} onPress={onDecrement}
          disabled={min !== undefined && value <= min}>
          <Ionicons name="remove" size={16} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.stepVal}>{value}<Text style={st.stepUnit}> {unit}</Text></Text>
        <TouchableOpacity style={st.stepBtn} onPress={onIncrement}>
          <Ionicons name="add" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ estimate, easyPaceSecPerMi }: { estimate: DurationEstimate; easyPaceSecPerMi: number }) {
  const totalHr  = Math.floor(estimate.estimatedMin / 60);
  const totalMin = estimate.estimatedMin % 60;
  const durationStr = totalHr > 0
    ? `~${totalHr} hr ${totalMin} min`
    : `~${totalMin} min`;

  return (
    <View style={st.summaryCard}>
      <Text style={st.sectionLabel}>ESTIMATED DURATION</Text>
      <View style={st.summaryRow}>
        <View style={st.summaryCell}>
          <Text style={st.summaryValue}>{durationStr}</Text>
          <Text style={st.summaryUnit}>Total Time</Text>
        </View>
        <View style={st.summaryDivider} />
        <View style={st.summaryCell}>
          <Text style={st.summaryValue}>~{estimate.estimatedMi} mi</Text>
          <Text style={st.summaryUnit}>Distance</Text>
        </View>
        <View style={st.summaryDivider} />
        <View style={st.summaryCell}>
          <Text style={st.summaryValue}>{formatPaceMmSs(easyPaceSecPerMi)}</Text>
          <Text style={st.summaryUnit}>Easy Pace</Text>
        </View>
      </View>

      {estimate.segments.filter(s => s.distanceMi > 0 || s.durationMin > 0).map((seg, i) => (
        <View key={i} style={st.segRow}>
          <Text style={st.segLabel}>{seg.label}</Text>
          <Text style={st.segPace}>{seg.paceTarget}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RunCreatorScreen() {
  const router = useRouter();

  const weeklyMileage  = useOnboardingStore(s => s.data.weeklyMileage);
  const { fatigueScore, recoveryScore, setFatigueScore, setRecentEasyLoad, recentEasyLoad } = useAthleteStore();
  const profile        = useProfileStore(s => s.getActiveProfile());
  const { addLog }     = useCustomWorkoutStore();

  // Resolve easy pace
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

  const [runType, setRunType] = useState<RunType>('tempo');

  // Fartlek state
  const [fartlekMin, setFartlekMin] = useState(30);

  // Tempo state
  const [warmupMi,   setWarmupMi]   = useState(1);
  const [tempoMi,    setTempoMi]    = useState(3);
  const [cooldownMi, setCooldownMi] = useState(1);

  // Interval state
  const [ivWarmupMi,   setIvWarmupMi]   = useState(1);
  const [ivReps,       setIvReps]       = useState(5);
  const [ivWorkMi,     setIvWorkMi]     = useState(0.5);
  const [ivRestMin,    setIvRestMin]    = useState(2);
  const [ivCooldownMi, setIvCooldownMi] = useState(1);

  // Long run state
  const [lrDistanceMi, setLrDistanceMi] = useState(10);
  const [lrStrides,    setLrStrides]    = useState(4);

  const [saved, setSaved] = useState(false);

  const estimate: DurationEstimate = useMemo(() => {
    switch (runType) {
      case 'fartlek':
        return estimateFartlek({ totalMin: fartlekMin }, easyPaceSecPerMi);
      case 'tempo':
        return estimateTempo({ warmupMi, tempoMi, cooldownMi }, easyPaceSecPerMi);
      case 'intervals':
        return estimateIntervals(
          { warmupMi: ivWarmupMi, reps: ivReps, workMi: ivWorkMi, restMin: ivRestMin, cooldownMi: ivCooldownMi },
          easyPaceSecPerMi,
        );
      case 'long_run_strides':
        return estimateLongRunStrides({ distanceMi: lrDistanceMi, strides: lrStrides }, easyPaceSecPerMi);
    }
  }, [
    runType, fartlekMin, warmupMi, tempoMi, cooldownMi,
    ivWarmupMi, ivReps, ivWorkMi, ivRestMin, ivCooldownMi,
    lrDistanceMi, lrStrides, easyPaceSecPerMi,
  ]);

  const runTypeLabel: Record<RunType, string> = {
    fartlek:          'Fartlek',
    tempo:            'Tempo Run',
    intervals:        'Interval Workout',
    long_run_strides: 'Long Run + Strides',
  };

  const runTypeToCustomType: Record<RunType, string> = {
    fartlek:          'fartlek',
    tempo:            'tempo',
    intervals:        'intervals',
    long_run_strides: 'long_run',
  };

  function handleSave() {
    const segmentSummary = estimate.segments
      .filter(s => s.distanceMi > 0 || s.durationMin > 0)
      .map(s => s.label)
      .join(' · ');

    addLog(
      {
        category:         'running',
        date:             todayDateKey(),
        source:           'custom',
        runType:          runTypeToCustomType[runType] as never,
        durationMinutes:  estimate.estimatedMin,
        distanceMiles:    estimate.estimatedMi,
        notes:            `${runTypeLabel[runType]}: ${segmentSummary}`,
      },
      fatigueScore,
      setFatigueScore,
      setRecentEasyLoad,
      recentEasyLoad,
    );
    setSaved(true);
  }

  function handleStartGPS() {
    // Navigate to GPS run tracking with no planned workout (free run)
    router.push('/training/run-tracking' as never);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.title}>Build a Run</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Run type selector */}
        <View style={st.typeGrid}>
          {RUN_TYPES.map(rt => (
            <TouchableOpacity
              key={rt.key}
              style={[st.typeCard, runType === rt.key && st.typeCardActive]}
              onPress={() => { setRunType(rt.key); setSaved(false); }}
            >
              <Ionicons
                name={rt.icon as never}
                size={20}
                color={runType === rt.key ? colors.primary : colors.textMuted}
              />
              <Text style={[st.typeLabel, runType === rt.key && st.typeLabelActive]}>
                {rt.label}
              </Text>
              <Text style={st.typeDesc}>{rt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type-specific inputs */}
        <View style={st.card}>
          <Text style={st.sectionLabel}>WORKOUT PARAMETERS</Text>

          {runType === 'fartlek' && (
            <Stepper
              label="Total Duration" sub="You control the surges"
              value={fartlekMin} unit="min" min={10} step={5}
              onDecrement={() => setFartlekMin(v => Math.max(10, v - 5))}
              onIncrement={() => setFartlekMin(v => v + 5)}
            />
          )}

          {runType === 'tempo' && (
            <>
              <Stepper label="Warmup" value={warmupMi} unit="mi" min={0.5} step={0.5}
                onDecrement={() => setWarmupMi(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                onIncrement={() => setWarmupMi(v => Math.round((v + 0.5) * 2) / 2)}
              />
              <View style={st.divider} />
              <Stepper label="Tempo Segment" sub="Comfortably hard effort"
                value={tempoMi} unit="mi" min={1} step={0.5}
                onDecrement={() => setTempoMi(v => Math.max(1, Math.round((v - 0.5) * 2) / 2))}
                onIncrement={() => setTempoMi(v => Math.round((v + 0.5) * 2) / 2)}
              />
              <View style={st.divider} />
              <Stepper label="Cooldown" value={cooldownMi} unit="mi" min={0.5} step={0.5}
                onDecrement={() => setCooldownMi(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                onIncrement={() => setCooldownMi(v => Math.round((v + 0.5) * 2) / 2)}
              />
            </>
          )}

          {runType === 'intervals' && (
            <>
              <Stepper label="Warmup" value={ivWarmupMi} unit="mi" min={0.5} step={0.5}
                onDecrement={() => setIvWarmupMi(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                onIncrement={() => setIvWarmupMi(v => Math.round((v + 0.5) * 2) / 2)}
              />
              <View style={st.divider} />
              <Stepper label="Reps" value={ivReps} unit="reps" min={1}
                onDecrement={() => setIvReps(v => Math.max(1, v - 1))}
                onIncrement={() => setIvReps(v => v + 1)}
              />
              <View style={st.divider} />
              <Stepper label="Work Distance" sub="Per rep" value={ivWorkMi} unit="mi" min={0.25} step={0.25}
                onDecrement={() => setIvWorkMi(v => Math.max(0.25, Math.round((v - 0.25) * 4) / 4))}
                onIncrement={() => setIvWorkMi(v => Math.round((v + 0.25) * 4) / 4)}
              />
              <View style={st.divider} />
              <Stepper label="Rest Between Reps" value={ivRestMin} unit="min" min={1}
                onDecrement={() => setIvRestMin(v => Math.max(1, v - 1))}
                onIncrement={() => setIvRestMin(v => v + 1)}
              />
              <View style={st.divider} />
              <Stepper label="Cooldown" value={ivCooldownMi} unit="mi" min={0.5} step={0.5}
                onDecrement={() => setIvCooldownMi(v => Math.max(0.5, Math.round((v - 0.5) * 2) / 2))}
                onIncrement={() => setIvCooldownMi(v => Math.round((v + 0.5) * 2) / 2)}
              />
            </>
          )}

          {runType === 'long_run_strides' && (
            <>
              <Stepper label="Total Distance" value={lrDistanceMi} unit="mi" min={4}
                onDecrement={() => setLrDistanceMi(v => Math.max(4, v - 1))}
                onIncrement={() => setLrDistanceMi(v => v + 1)}
              />
              <View style={st.divider} />
              <Stepper label="Strides" sub="20s hard, 45s recovery each"
                value={lrStrides} unit="strides" min={2}
                onDecrement={() => setLrStrides(v => Math.max(2, v - 1))}
                onIncrement={() => setLrStrides(v => Math.min(10, v + 1))}
              />
            </>
          )}
        </View>

        {/* Duration estimate */}
        <SummaryCard estimate={estimate} easyPaceSecPerMi={easyPaceSecPerMi} />

        {/* Actions */}
        <View style={st.actions}>
          <TouchableOpacity style={st.btnPrimary} onPress={handleStartGPS}>
            <Ionicons name="location-outline" size={18} color={colors.text} />
            <Text style={st.btnPrimaryTxt}>Start GPS Run</Text>
          </TouchableOpacity>

          {saved ? (
            <View style={st.savedRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.positive} />
              <Text style={st.savedTxt}>Saved to My Runs</Text>
            </View>
          ) : (
            <TouchableOpacity style={st.btnSecondary} onPress={handleSave}>
              <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
              <Text style={st.btnSecondaryTxt}>Save to My Runs</Text>
            </TouchableOpacity>
          )}
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
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
  typeGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            spacing.sm,
    marginBottom:   spacing.cardGap,
  },
  typeCard: {
    width:           '47%',
    backgroundColor: colors.card,
    borderRadius:    Radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  typeCardActive: {
    borderColor:     colors.primary,
    backgroundColor: colors.primaryDim,
  },
  typeLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  typeLabelActive: {
    color: colors.primary,
  },
  typeDesc: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
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
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginVertical:  spacing.md,
  },
  stepRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  stepSub: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  stepControls: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  stepBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepVal: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    minWidth:   48,
    textAlign:  'center',
  },
  stepUnit: {
    color:      colors.textMuted,
    fontWeight: '400',
    fontSize:   FontSize.xs,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius:    Radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.cardGap,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  summaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    marginBottom:   spacing.lg,
  },
  summaryCell: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  summaryValue: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
  summaryUnit: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  summaryDivider: {
    width:           1,
    height:          36,
    backgroundColor: colors.border,
  },
  segRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: spacing.xs,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  segLabel: {
    color:    colors.text,
    fontSize: FontSize.sm,
    flex:     1,
  },
  segPace: {
    color:      colors.primary,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  actions: {
    gap:          spacing.md,
    marginBottom: spacing.cardGap,
  },
  btnPrimary: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.primary,
    borderRadius:    Radius.md,
    paddingVertical: spacing.md,
  },
  btnPrimaryTxt: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  btnSecondary: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.card,
    borderRadius:    Radius.md,
    paddingVertical: spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  btnSecondaryTxt: {
    color:      colors.primary,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  savedRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    paddingVertical: spacing.md,
  },
  savedTxt: {
    color:      colors.positive,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
});
