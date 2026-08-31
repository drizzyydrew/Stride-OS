// ─── Run Creator ──────────────────────────────────────────────────────────────
//
// Builds a custom run (fartlek, tempo, intervals, long run + strides) and
// estimates total duration before the user starts.

import { useEffect, useState, useMemo } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useOnboardingStore }    from '../../../src/store/onboardingStore';
import { useProfileStore }       from '../../../src/store/profileStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';
import type { CustomRunSegment } from '../../../src/types/customWorkout';

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
import { useColors } from '../../../src/theme/useColors';

import { colors }                       from '../../../src/theme/colors';
import { spacing }                      from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type RunType = 'fartlek' | 'tempo' | 'intervals' | 'long_run_strides' | 'custom_segments';

const RUN_TYPES: { key: RunType; label: string; icon: string; desc: string }[] = [
  { key: 'fartlek',        label: 'Fartlek',          icon: 'flash-outline',    desc: 'Unstructured surges at feel' },
  { key: 'tempo',          label: 'Tempo',             icon: 'trending-up-outline', desc: 'Sustained comfortably hard effort' },
  { key: 'intervals',      label: 'Intervals',         icon: 'repeat-outline',   desc: 'Hard reps with timed recovery' },
  { key: 'long_run_strides', label: 'Long Run + Strides', icon: 'walk-outline', desc: 'Aerobic base + finishing strides' },
  { key: 'custom_segments', label: 'Custom Segments', icon: 'options-outline', desc: 'Build time, distance, pace, and HR blocks' },
];

const DEFAULT_SEGMENTS: CustomRunSegment[] = [
  { id: 'seg_warmup', label: 'Warmup', kind: 'warmup', target: 'time', durationMinutes: 10, targetHrZone: 2 },
  { id: 'seg_work', label: 'Stride', kind: 'run', target: 'distance', distanceMiles: 0.13, targetPaceSecPerMile: 660, targetHrZone: 4 },
  { id: 'seg_recover', label: 'Recover', kind: 'recovery', target: 'time', durationMinutes: 2, targetHrZone: 2 },
  { id: 'seg_cooldown', label: 'Cooldown', kind: 'cooldown', target: 'time', durationMinutes: 8, targetHrZone: 1 },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function paceInputToSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(':')) {
    const [min, sec = '0'] = trimmed.split(':');
    const minutes = Number(min);
    const seconds = Number(sec);
    if (Number.isFinite(minutes) && Number.isFinite(seconds) && minutes >= 0 && seconds >= 0) {
      return Math.max(1, Math.round(minutes * 60 + seconds));
    }
    return undefined;
  }
  const decimal = Number(trimmed);
  return Number.isFinite(decimal) && decimal > 0 ? Math.round(decimal * 60) : undefined;
}

function customSegmentEstimate(segments: CustomRunSegment[], fallbackPaceSecPerMi: number): DurationEstimate {
  const estimated = segments.map(segment => {
    const pace = segment.targetPaceSecPerMile ?? fallbackPaceSecPerMi;
    const distanceMi = segment.target === 'distance'
      ? segment.distanceMiles ?? 0
      : ((segment.durationMinutes ?? 0) * 60) / pace;
    const durationMin = segment.target === 'time'
      ? segment.durationMinutes ?? 0
      : ((segment.distanceMiles ?? 0) * pace) / 60;
    const paceTarget = segment.targetPaceSecPerMile
      ? `${formatPaceMmSs(segment.targetPaceSecPerMile)} /mi`
      : segment.targetHrZone
        ? `Zone ${segment.targetHrZone}`
        : 'By feel';
    return {
      label: `${segment.label}${segment.targetHrZone ? ` · Z${segment.targetHrZone}` : ''}`,
      paceTarget,
      durationMin,
      distanceMi,
    };
  });
  return {
    estimatedMin: Math.max(1, Math.round(estimated.reduce((sum, segment) => sum + segment.durationMin, 0))),
    estimatedMi: round2(estimated.reduce((sum, segment) => sum + segment.distanceMi, 0)),
    segments: estimated,
  };
}

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

function displaySegmentKind(kind: CustomRunSegment['kind']): string {
  if (kind === 'warmup') return 'Warmup';
  if (kind === 'recovery') return 'Recover';
  if (kind === 'cooldown') return 'Cooldown';
  return 'Run';
}

function SegmentField({
  label,
  value,
  suffix,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  suffix: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={st.segmentField}>
      <Text style={st.segmentFieldLabel}>{label}</Text>
      <View style={st.segmentFieldRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numbers-and-punctuation"
          placeholder={placeholder ?? '--'}
          placeholderTextColor={colors.textSubtle}
          style={st.segmentFieldInput}
        />
        <Text style={st.segmentFieldSuffix}>{suffix}</Text>
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
  const C = useColors();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const weeklyMileage  = useOnboardingStore(s => s.data.weeklyMileage);
  const profile        = useProfileStore(s => s.getActiveProfile());
  const customRuns = useCustomWorkoutStore(s => s.customRuns);
  const saveCustomRun = useCustomWorkoutStore(s => s.saveCustomRun);
  const selectCustomRunToday = useCustomWorkoutStore(s => s.selectCustomRunToday);
  const editingRun = editId ? customRuns.find(run => run.id === editId) : undefined;

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

  const [structuredSegments, setStructuredSegments] = useState<CustomRunSegment[]>(DEFAULT_SEGMENTS);
  const [customName, setCustomName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!editingRun) return;
    setRunType(editingRun.runType);
    setCustomName(editingRun.name);
    setFartlekMin(editingRun.parameters.fartlekMin);
    setWarmupMi(editingRun.parameters.warmupMi);
    setTempoMi(editingRun.parameters.tempoMi);
    setCooldownMi(editingRun.parameters.cooldownMi);
    setIvWarmupMi(editingRun.parameters.ivWarmupMi);
    setIvReps(editingRun.parameters.ivReps);
    setIvWorkMi(editingRun.parameters.ivWorkMi);
    setIvRestMin(editingRun.parameters.ivRestMin);
    setIvCooldownMi(editingRun.parameters.ivCooldownMi);
    setLrDistanceMi(editingRun.parameters.lrDistanceMi);
    setLrStrides(editingRun.parameters.lrStrides);
    if (editingRun.structuredSegments?.length) setStructuredSegments(editingRun.structuredSegments);
  }, [editingRun]);

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
      case 'custom_segments':
        return customSegmentEstimate(structuredSegments, easyPaceSecPerMi);
    }
  }, [
    runType, fartlekMin, warmupMi, tempoMi, cooldownMi,
    ivWarmupMi, ivReps, ivWorkMi, ivRestMin, ivCooldownMi,
    lrDistanceMi, lrStrides, structuredSegments, easyPaceSecPerMi,
  ]);

  const runTypeLabel: Record<RunType, string> = {
    fartlek:          'Fartlek',
    tempo:            'Tempo Run',
    intervals:        'Interval Workout',
    long_run_strides: 'Long Run + Strides',
    custom_segments:  'Custom Workout',
  };

  function updateSegment(id: string, patch: Partial<CustomRunSegment>) {
    setSaved(false);
    setStructuredSegments(current => current.map(segment => segment.id === id ? { ...segment, ...patch } : segment));
  }

  function removeSegment(id: string) {
    setSaved(false);
    setStructuredSegments(current => current.length > 1 ? current.filter(segment => segment.id !== id) : current);
  }

  function addSegment() {
    setSaved(false);
    setStructuredSegments(current => [
      ...current,
      {
        id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `Segment ${current.length + 1}`,
        kind: 'run',
        target: 'time',
        durationMinutes: 5,
        targetHrZone: 2,
      },
    ]);
  }

  function handleSave() {
    if (runType === 'custom_segments') {
      const invalid = structuredSegments.find(segment => {
        const value = segment.target === 'time' ? segment.durationMinutes : segment.distanceMiles;
        return !segment.label.trim() || !Number.isFinite(value) || (value ?? 0) <= 0;
      });
      if (invalid) {
        Alert.alert('Segment needs a target', 'Each segment needs a name and either a time or distance target before saving.');
        return;
      }
    }
    const segmentSummary = estimate.segments
      .filter(s => s.distanceMi > 0 || s.durationMin > 0)
      .map(s => s.label)
      .join(' · ');

    const id = saveCustomRun({
      name: customName.trim() || runTypeLabel[runType],
      runType,
      durationMinutes: estimate.estimatedMin,
      distanceMiles: estimate.estimatedMi,
      segmentSummary,
      parameters: {
        fartlekMin,
        warmupMi,
        tempoMi,
        cooldownMi,
        ivWarmupMi,
        ivReps,
        ivWorkMi,
        ivRestMin,
        ivCooldownMi,
        lrDistanceMi,
        lrStrides,
      },
      structuredSegments: runType === 'custom_segments' ? structuredSegments : undefined,
    }, editingRun?.id);
    selectCustomRunToday(id, todayDateKey());
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
        <Text style={st.title}>{editingRun ? 'Edit Run' : 'Build a Run'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >

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

        {/* Workout name */}
        <View style={st.card}>
          <Text style={st.sectionLabel}>WORKOUT NAME (OPTIONAL)</Text>
          <TextInput
            style={[st.nameInput, { color: C.text, backgroundColor: C.bg, borderColor: C.border }]}
            value={customName}
            onChangeText={setCustomName}
            placeholder={runTypeLabel[runType]}
            placeholderTextColor={C.textSubtle}
            selectionColor={C.primary}
            cursorColor={C.primary}
            maxLength={60}
            returnKeyType="done"
          />
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

          {runType === 'custom_segments' && (
            <View style={st.segmentStack}>
              {structuredSegments.map((segment, index) => {
                const targetValue = segment.target === 'time'
                  ? String(segment.durationMinutes ?? '')
                  : String(segment.distanceMiles ?? '');
                return (
                  <View key={segment.id} style={st.segmentCard}>
                    <View style={st.segmentHeader}>
                      <Text style={st.segmentTitle}>Segment {index + 1}</Text>
                      <TouchableOpacity
                        onPress={() => removeSegment(segment.id)}
                        disabled={structuredSegments.length <= 1}
                        style={[st.segmentIconBtn, structuredSegments.length <= 1 && { opacity: 0.35 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove segment ${index + 1}`}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={st.segmentNameInput}
                      value={segment.label}
                      onChangeText={label => updateSegment(segment.id, { label })}
                      placeholder="Segment name"
                      placeholderTextColor={colors.textSubtle}
                      maxLength={28}
                    />
                    <View style={st.segmentChipRow}>
                      {(['warmup', 'run', 'recovery', 'cooldown'] as const).map(kind => {
                        const active = segment.kind === kind;
                        return (
                          <TouchableOpacity
                            key={kind}
                            style={[st.segmentChip, active && st.segmentChipActive]}
                            onPress={() => updateSegment(segment.id, { kind })}
                          >
                            <Text style={[st.segmentChipText, active && st.segmentChipTextActive]}>{displaySegmentKind(kind)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={st.segmentChipRow}>
                      {(['time', 'distance'] as const).map(target => {
                        const active = segment.target === target;
                        return (
                          <TouchableOpacity
                            key={target}
                            style={[st.segmentChip, active && st.segmentChipActive]}
                            onPress={() => updateSegment(segment.id, { target })}
                          >
                            <Text style={[st.segmentChipText, active && st.segmentChipTextActive]}>
                              {target === 'time' ? 'Time' : 'Distance'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={st.segmentGrid}>
                      <SegmentField
                        label={segment.target === 'time' ? 'Target time' : 'Target distance'}
                        value={targetValue}
                        suffix={segment.target === 'time' ? 'min' : 'mi'}
                        onChange={value => {
                          const parsed = Number(value);
                          updateSegment(segment.id, segment.target === 'time'
                            ? { durationMinutes: Number.isFinite(parsed) ? parsed : undefined }
                            : { distanceMiles: Number.isFinite(parsed) ? parsed : undefined });
                        }}
                      />
                      <SegmentField
                        label="Pace"
                        value={segment.targetPaceSecPerMile ? formatPaceMmSs(segment.targetPaceSecPerMile) : ''}
                        suffix="/mi"
                        placeholder="11:00"
                        onChange={value => updateSegment(segment.id, { targetPaceSecPerMile: paceInputToSeconds(value) })}
                      />
                    </View>
                    <View style={st.segmentChipRow}>
                      {[1, 2, 3, 4, 5].map(zone => {
                        const active = segment.targetHrZone === zone;
                        return (
                          <TouchableOpacity
                            key={zone}
                            style={[st.zoneChip, active && st.zoneChipActive]}
                            onPress={() => updateSegment(segment.id, { targetHrZone: active ? undefined : zone as 1 | 2 | 3 | 4 | 5 })}
                          >
                            <Text style={[st.zoneChipText, active && st.zoneChipTextActive]}>Z{zone}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity style={st.addSegmentButton} onPress={addSegment}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={st.addSegmentText}>Add Segment</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={st.savedTxt}>Saved and selected for today</Text>
            </View>
          ) : (
            <TouchableOpacity style={st.btnSecondary} onPress={handleSave}>
              <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
              <Text style={st.btnSecondaryTxt}>{editingRun ? 'Save Changes & Use Today' : 'Save & Use Today'}</Text>
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
  nameInput: {
    color:             colors.text,
    backgroundColor:   colors.bg,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    minHeight:          44,
    fontSize:          FontSize.base,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginVertical:  spacing.md,
  },
  segmentStack: {
    gap: spacing.md,
  },
  segmentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentTitle: {
    color: colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
  },
  segmentIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  segmentNameInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  segmentChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  segmentChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  segmentChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  segmentChipText: {
    color: colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  segmentChipTextActive: {
    color: colors.accent,
  },
  segmentGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentField: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
  },
  segmentFieldLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: FontWeight.black,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  segmentFieldRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 5,
  },
  segmentFieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
    padding: 0,
  },
  segmentFieldSuffix: {
    color: colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  zoneChip: {
    width: 40,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  zoneChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  zoneChipText: {
    color: colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
  },
  zoneChipTextActive: {
    color: colors.primary,
  },
  addSegmentButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addSegmentText: {
    color: colors.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
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
