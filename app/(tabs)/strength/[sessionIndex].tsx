import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { useAthleteStore }  from '../../../src/store/athleteStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useSettingsStore } from '../../../src/store/settingsStore';

import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import {
  formatExerciseWeightLb,
  weightUnitLabel,
} from '../../../src/lib/units';

import Card   from '../../../src/components/ui/Card';
import Badge  from '../../../src/components/ui/Badge';
import Button from '../../../src/components/ui/Button';

import { colors }   from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  CompletedExercise, CompletedSet,
  ExerciseSessionDetail,
} from '../../../src/types/strength';

// ─── Completion summary ───────────────────────────────────────────────────────

type SummaryProps = {
  exercises:        CompletedExercise[];
  exerciseDetails?: ExerciseSessionDetail[];
  actualDuration?:  number;
  overallRpe?:      number;
  notes?:           string;
  skipped?:         boolean;
  skippedReason?:   string;
  source?:          string;
};

function CompletionSummaryCard({
  exercises, actualDuration, overallRpe, notes, skipped, skippedReason, source,
}: SummaryProps) {
  const totalSets = exercises.reduce(
    (s, e) => s + e.sets.filter(set => set.completed).length, 0,
  );
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>{skipped ? 'Session Skipped' : 'Session Logged'}</Text>
        {source === 'manual' && <Badge label="Manual" bg={colors.border} color={colors.textMuted} />}
      </View>
      {skipped ? (
        <Text style={styles.summaryMeta}>{skippedReason ?? 'No reason provided.'}</Text>
      ) : (
        <View style={styles.summaryStats}>
          {actualDuration !== undefined && (
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{actualDuration}</Text>
              <Text style={styles.summaryLabel}>min</Text>
            </View>
          )}
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{totalSets}</Text>
            <Text style={styles.summaryLabel}>sets</Text>
          </View>
          {overallRpe !== undefined && (
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{overallRpe}</Text>
              <Text style={styles.summaryLabel}>RPE</Text>
            </View>
          )}
        </View>
      )}
      {notes && <Text style={styles.summaryNotes}>{notes}</Text>}
    </Card>
  );
}

// ─── Stepper control ──────────────────────────────────────────────────────────

function Stepper({ label, value, onDec, onInc, display }: {
  label:    string;
  value:    number;
  onDec:    () => void;
  onInc:    () => void;
  display?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{display ?? value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Weight picker modal ──────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;

function WeightPickerModal({ visible, unitLabel, currentLb, onConfirm, onClose }: {
  visible:    boolean;
  unitLabel:  string;
  currentLb:  number;
  onConfirm:  (lb: number) => void;
  onClose:    () => void;
}) {
  // Build list: 0, 2.5, 5, 7.5 … 500 lb
  const weights = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i <= 500; i += 2.5) list.push(i);
    return list;
  }, []);

  const [selected, setSelected] = useState(currentLb);

  useEffect(() => { setSelected(currentLb); }, [currentLb, visible]);

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) return;
    const idx = weights.findIndex(w => w === selected);
    if (idx >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }, 50);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: 32 }]}>
          <Text style={styles.pickerTitle}>Set Weight ({unitLabel})</Text>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerHighlight} />
            <FlatList
              ref={listRef}
              data={weights}
              keyExtractor={item => String(item)}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * 2 + ITEM_HEIGHT * index,
                index,
              })}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              style={{ height: ITEM_HEIGHT * 5 }}
              contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                setSelected(weights[Math.max(0, Math.min(idx, weights.length - 1))]);
              }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => setSelected(item)}
                >
                  <Text style={[
                    styles.pickerItemText,
                    item === selected && styles.pickerItemTextActive,
                  ]}>
                    {item % 5 === 0 ? item : item.toFixed(1)}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          <Text style={styles.pickerSelected}>
            {selected === 0 ? 'Bodyweight' : `${selected % 5 === 0 ? selected : selected.toFixed(1)} ${unitLabel}`}
          </Text>

          <View style={styles.logActions}>
            <Button label="Cancel" onPress={onClose} variant="secondary" />
            <Button label="Set Weight" onPress={() => onConfirm(selected)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Log form ─────────────────────────────────────────────────────────────────

type LogFormProps = {
  plannedDuration: number;
  onSave:   (duration: number, rpe: number, notes: string) => void;
  onCancel: () => void;
};

function SessionLogForm({ plannedDuration, onSave, onCancel }: LogFormProps) {
  const [duration, setDuration] = useState(plannedDuration);
  const [rpe, setRpe]           = useState(6);
  const [notes, setNotes]       = useState('');

  const RPE_HINTS = ['', '', 'Very easy', 'Easy', 'Moderate effort', 'Somewhat hard', 'Hard',
    'Very hard', 'Extremely hard', 'Near maximal', 'Absolute max'];

  return (
    <View style={styles.logForm}>
      <Text style={styles.logFormTitle}>Log Session</Text>

      <Stepper
        label="Duration (min)"
        value={duration}
        onDec={() => setDuration(d => Math.max(5, d - 5))}
        onInc={() => setDuration(d => Math.min(180, d + 5))}
      />

      <Stepper
        label={`Overall RPE — ${RPE_HINTS[rpe] ?? ''}`}
        value={rpe}
        onDec={() => setRpe(r => Math.max(1, r - 1))}
        onInc={() => setRpe(r => Math.min(10, r + 1))}
      />

      <Text style={styles.logLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Technique, energy, adjustments..."
        placeholderTextColor={colors.textDim}
        multiline
        numberOfLines={3}
      />

      <View style={styles.logActions}>
        <Button label="Cancel" onPress={onCancel} variant="secondary" />
        <Button label="Save Session" onPress={() => onSave(duration, rpe, notes)} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const SKIP_REASONS = ['Too tired', 'Schedule conflict', 'Illness / injury', 'Running priority'] as const;

export default function StrengthSessionDetailScreen() {
  const { sessionIndex } = useLocalSearchParams<{ sessionIndex: string }>();
  const idx       = parseInt(sessionIndex ?? '0', 10);
  const router    = useRouter();
  const navigation = useNavigation();

  const weekPlan  = useWeekPlan();
  const currentWeek = weekPlan.metadata.currentWeek;
  const fatigueScore = useAthleteStore(s => s.fatigueScore);

  const units   = useSettingsStore(s => s.units);
  const unitLbl = weightUnitLabel(units);

  const { completedSessions, history, logSession, skipSession, deleteLog } = useStrengthStore();

  const session = weekPlan.strengthWeek.sessions[idx];

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec]             = useState(0);
  const [isPaused, setIsPaused]                 = useState(false);
  const [totalPausedMs, setTotalPausedMs]       = useState(0);
  const [pausedAt, setPausedAt]                 = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completionKey = session ? `sw${currentWeek}_${session.id}_${idx}` : '';
  const isComplete    = completedSessions.includes(completionKey);
  const logRecord     = history.find(r => r.id === completionKey);
  const isActive      = sessionStartTime !== null && !isComplete;

  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - sessionStartTime! - totalPausedMs) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, sessionStartTime, isPaused, totalPausedMs]);

  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedSS  = String(elapsedSec % 60).padStart(2, '0');
  const timerLabel = `${elapsedMin}:${elapsedSS}`;

  // Update nav header with live timer when active
  useEffect(() => {
    if (isActive) {
      navigation.setOptions({
        headerRight: () => (
          <View style={styles.timerBadge}>
            <Text style={styles.timerBadgeText}>{timerLabel}</Text>
          </View>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [isActive, timerLabel]);

  // ── Per-exercise state ─────────────────────────────────────────────────────
  type ExerciseStatus = 'pending' | 'done' | 'skipped';
  const [exerciseStatus, setExerciseStatus] = useState<Record<string, ExerciseStatus>>({});
  const [exerciseWeightsLb, setExerciseWeightsLb] = useState<Record<string, number>>({});
  const [weightPickerFor, setWeightPickerFor] = useState<string | null>(null);

  function toggleExerciseDone(id: string) {
    setExerciseStatus(prev => ({
      ...prev,
      [id]: prev[id] === 'done' ? 'pending' : 'done',
    }));
  }

  function skipExercise(id: string) {
    setExerciseStatus(prev => ({
      ...prev,
      [id]: prev[id] === 'skipped' ? 'pending' : 'skipped',
    }));
  }

  // ── Modal states ───────────────────────────────────────────────────────────
  const [showLogModal,  setShowLogModal]  = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Session not found.</Text>
      </SafeAreaView>
    );
  }

  function handleStart() {
    setSessionStartTime(Date.now());
  }

  function handlePause() {
    setPausedAt(Date.now());
    setIsPaused(true);
  }

  function handleResume() {
    if (pausedAt !== null) {
      setTotalPausedMs(prev => prev + (Date.now() - pausedAt!));
      setPausedAt(null);
    }
    setIsPaused(false);
  }

  function handleMarkComplete() {
    setShowLogModal(true);
  }

  function handleLogSave(duration: number, rpe: number, notes: string) {
    const exercises: CompletedExercise[] = session.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      sets: Array.from({ length: ex.sets }, (): CompletedSet => ({
        reps:      ex.repRange[0],
        rpe,
        completed: exerciseStatus[ex.exerciseId] !== 'skipped',
      })),
    }));

    const details: ExerciseSessionDetail[] = session.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      weightLb:   exerciseWeightsLb[ex.exerciseId] ?? undefined,
      status:     (exerciseStatus[ex.exerciseId] ?? 'pending') as ExerciseSessionDetail['status'],
    }));

    logSession(
      completionKey, session.id, session.sessionType, session.goal,
      currentWeek, session.targetDuration, exercises,
      fatigueScore, rpe, notes || undefined, details,
    );
    setShowLogModal(false);
  }

  function handleSkip(reason: string) {
    skipSession(
      completionKey, session.id, session.sessionType, session.goal,
      currentWeek, fatigueScore, reason,
    );
    setShowSkipModal(false);
  }

  function handleDelete() {
    Alert.alert(
      'Delete Session Log',
      'Remove this session from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteLog(completionKey); } },
      ],
    );
  }

  const currentWeightLb = weightPickerFor ? (exerciseWeightsLb[weightPickerFor] ?? 0) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Strength</Text>
        </TouchableOpacity>

        {/* Session header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.sessionType}>{session.sessionType.replace(/_/g, ' ').toUpperCase()}</Text>
            <Text style={styles.duration}>{session.targetDuration} min</Text>
          </View>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <Text style={styles.purpose}>{session.purpose}</Text>
        </View>

        {/* Status / timer (in-screen display) */}
        {isActive && (
          <Card style={[styles.timerCard, isPaused && styles.timerCardPaused]}>
            <Text style={[styles.timerLabel, isPaused && styles.timerLabelPaused]}>
              {isPaused ? 'Paused' : 'In Progress'}
            </Text>
            <Text style={styles.timerValue}>{timerLabel}</Text>
          </Card>
        )}

        {/* Completion summary */}
        {isComplete && logRecord && (
          <CompletionSummaryCard
            exercises={logRecord.exercises}
            exerciseDetails={logRecord.exerciseDetails}
            actualDuration={logRecord.actualDuration}
            overallRpe={logRecord.overallRpe}
            notes={logRecord.notes}
            skipped={logRecord.skipped}
            skippedReason={logRecord.skippedReason}
            source={logRecord.source}
          />
        )}

        {/* Warm-up */}
        <Card style={styles.protocolCard}>
          <Text style={styles.protocolTitle}>Warm-Up</Text>
          <Text style={styles.protocolText}>{session.warmupProtocol}</Text>
        </Card>

        {/* Exercise list */}
        <Text style={styles.sectionHeader}>Exercises</Text>
        {session.exercises.map((ex, i) => {
          const status  = exerciseStatus[ex.exerciseId] ?? 'pending';
          const wLb     = exerciseWeightsLb[ex.exerciseId] ?? 0;
          const isDone  = status === 'done';
          const isSkip  = status === 'skipped';

          return (
            <Card key={ex.exerciseId} style={[
              styles.exerciseCard,
              isDone && styles.exerciseCardDone,
              isSkip && styles.exerciseCardSkipped,
            ]}>
              <View style={styles.exHeader}>
                <View style={[styles.exNumber, isDone && styles.exNumberDone]}>
                  <Text style={[styles.exNumText, isDone && styles.exNumTextDone]}>
                    {isDone ? '✓' : String(i + 1)}
                  </Text>
                </View>
                <View style={styles.exMeta}>
                  <Text style={[styles.exName, isSkip && styles.exNameSkipped]}>{ex.exercise.name}</Text>
                  <Text style={styles.exPattern}>{ex.exercise.pattern.replace('_', ' ')}</Text>
                </View>
                <View style={styles.exSets}>
                  <Text style={styles.exSetsValue}>{ex.sets}×{ex.repRange[0]}–{ex.repRange[1]}</Text>
                  <Text style={styles.exSetsLabel}>sets×reps</Text>
                </View>
              </View>

              {/* Weight row */}
              {isActive && !isComplete && (
                <TouchableOpacity
                  style={styles.weightRow}
                  onPress={() => setWeightPickerFor(ex.exerciseId)}
                >
                  <Text style={styles.weightLabel}>Weight</Text>
                  <Text style={styles.weightValue}>
                    {wLb === 0
                      ? `Tap to set (${unitLbl})`
                      : formatExerciseWeightLb(wLb, units)}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.exDetails}>
                <View style={styles.exDetailRow}>
                  <Text style={styles.exDetailLabel}>Load</Text>
                  <Text style={styles.exDetailValue}>{ex.loadTarget}</Text>
                </View>
                <View style={styles.exDetailRow}>
                  <Text style={styles.exDetailLabel}>Tempo</Text>
                  <Text style={styles.exDetailValue}>{ex.tempo}</Text>
                </View>
                <View style={styles.exDetailRow}>
                  <Text style={styles.exDetailLabel}>Rest</Text>
                  <Text style={styles.exDetailValue}>{ex.restSeconds}s</Text>
                </View>
                <View style={styles.exDetailRow}>
                  <Text style={styles.exDetailLabel}>RPE / RIR</Text>
                  <Text style={styles.exDetailValue}>RPE {ex.rpe} · {ex.rir} RIR</Text>
                </View>
              </View>

              <Text style={styles.rationaleText}>{ex.rationale}</Text>

              <View style={styles.cues}>
                {ex.coachingCues.map((cue, ci) => (
                  <Text key={ci} style={styles.cue}>· {cue}</Text>
                ))}
              </View>

              <Text style={styles.progressionRule}>↑ {ex.progressionRule}</Text>

              {/* Exercise actions (only when session is active) */}
              {isActive && !isComplete && (
                <View style={styles.exActions}>
                  <Pressable
                    style={[styles.exActionBtn, isDone && styles.exActionBtnDone]}
                    onPress={() => toggleExerciseDone(ex.exerciseId)}
                  >
                    <Text style={[styles.exActionBtnText, isDone && styles.exActionBtnTextDone]}>
                      {isDone ? '✓ Done' : 'Mark Done'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.exSkipBtn, isSkip && styles.exSkipBtnActive]}
                    onPress={() => skipExercise(ex.exerciseId)}
                  >
                    <Text style={[styles.exSkipBtnText, isSkip && styles.exSkipBtnTextActive]}>
                      {isSkip ? 'Undo Skip' : 'Skip'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}

        {/* Cool-down */}
        <Card style={styles.protocolCard}>
          <Text style={styles.protocolTitle}>Cool-Down</Text>
          <Text style={styles.protocolText}>{session.cooldownProtocol}</Text>
        </Card>

        {/* Rationale */}
        <Card style={styles.rationaleCard}>
          <Text style={styles.rationaleTitle}>Session Rationale</Text>
          <Text style={styles.rationaleBody}>{session.rationale}</Text>
          <Text style={styles.progressionNote}>{session.progressionNote}</Text>
        </Card>

        {/* Action buttons */}
        {!isComplete && (
          <View style={styles.actions}>
            {!isActive ? (
              <>
                <Button label="Start Session" onPress={handleStart} />
                <Button label="Skip Session" onPress={() => setShowSkipModal(true)} variant="secondary" />
              </>
            ) : (
              <View style={styles.activeControls}>
                {isPaused ? (
                  <Button label="Resume" onPress={handleResume} />
                ) : (
                  <Button label="Pause" onPress={handlePause} variant="secondary" />
                )}
                <Button label="End Session" onPress={handleMarkComplete} />
              </View>
            )}
          </View>
        )}

        {isComplete && (
          <View style={styles.actions}>
            <Button label="Delete Log" onPress={handleDelete} variant="secondary" />
          </View>
        )}

        <View style={{ height: spacing.screenPadBottom }} />
      </ScrollView>

      {/* Log modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <SessionLogForm
              plannedDuration={sessionStartTime
                ? Math.round((Date.now() - sessionStartTime) / 60000)
                : session.targetDuration}
              onSave={handleLogSave}
              onCancel={() => setShowLogModal(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Skip modal */}
      <Modal visible={showSkipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.skipTitle}>Why are you skipping?</Text>
            {SKIP_REASONS.map(reason => (
              <Pressable key={reason} style={styles.skipReason} onPress={() => handleSkip(reason)}>
                <Text style={styles.skipReasonText}>{reason}</Text>
              </Pressable>
            ))}
            <Button label="Cancel" onPress={() => setShowSkipModal(false)} variant="secondary" />
          </View>
        </View>
      </Modal>

      {/* Weight picker */}
      <WeightPickerModal
        visible={weightPickerFor !== null}
        unitLabel={unitLbl}
        currentLb={currentWeightLb}
        onConfirm={lb => {
          if (weightPickerFor) {
            setExerciseWeightsLb(prev => ({ ...prev, [weightPickerFor]: lb }));
          }
          setWeightPickerFor(null);
        }}
        onClose={() => setWeightPickerFor(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { padding: spacing.lg, paddingBottom: 120 },
  errorText:   { color: colors.critical, fontSize: FontSize.base, padding: spacing.xl },
  backRow:     { marginBottom: spacing.md },
  backText:    { color: colors.primary, fontSize: FontSize.sm },
  headerCard:  { marginBottom: spacing.cardGap },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  sessionType: { color: colors.accent, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  duration:    { color: colors.textDim, fontSize: FontSize.sm },
  sessionTitle:{ color: colors.text, fontSize: 22, fontWeight: FontWeight.black, marginBottom: spacing.xs },
  purpose:     { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },

  // In-screen timer card
  timerCard:        { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: colors.positive },
  timerCardPaused:  { borderLeftColor: colors.warning },
  timerLabel:       { color: colors.positive, fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 2 },
  timerLabelPaused: { color: colors.warning },
  timerValue:       { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },

  // Navigation header timer badge
  timerBadge:     { marginRight: spacing.sm, backgroundColor: colors.positiveDim, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.positive },
  timerBadgeText: { color: colors.positive, fontSize: FontSize.sm, fontWeight: FontWeight.black, fontVariant: ['tabular-nums'] },

  summaryCard:   { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: colors.positive },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  summaryTitle:  { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  summaryStats:  { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.sm },
  summaryStat:   { alignItems: 'center' },
  summaryValue:  { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  summaryLabel:  { color: colors.textDim, fontSize: FontSize.xs },
  summaryMeta:   { color: colors.textMuted, fontSize: FontSize.sm },
  summaryNotes:  { color: colors.textMuted, fontSize: FontSize.sm, marginTop: spacing.sm, fontStyle: 'italic' },

  protocolCard:   { marginBottom: spacing.cardGap },
  protocolTitle:  { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: 'uppercase' },
  protocolText:   { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },

  sectionHeader:  { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm },

  exerciseCard:        { marginBottom: spacing.cardGap },
  exerciseCardDone:    { borderWidth: 1, borderColor: colors.positive, opacity: 0.85 },
  exerciseCardSkipped: { opacity: 0.45 },

  exHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  exNumber:     { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  exNumberDone: { backgroundColor: colors.positiveDim },
  exNumText:    { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  exNumTextDone:{ color: colors.positive },
  exMeta:       { flex: 1 },
  exName:       { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  exPattern:    { color: colors.textMuted, fontSize: FontSize.xs, textTransform: 'capitalize', marginTop: 2 },
  exNameSkipped:{ textDecorationLine: 'line-through', color: colors.textDim },
  exSets:       { alignItems: 'flex-end' },
  exSetsValue:  { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  exSetsLabel:  { color: colors.textDim, fontSize: FontSize.xs },

  // Weight row
  weightRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  weightLabel: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  weightValue: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  exDetails:     { backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, gap: 4 },
  exDetailRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  exDetailLabel: { color: colors.textDim, fontSize: FontSize.xs },
  exDetailValue: { color: colors.textMuted, fontSize: FontSize.xs },
  rationaleText: { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 17, marginBottom: spacing.sm },
  cues:          { gap: 4, marginBottom: spacing.sm },
  cue:           { color: colors.textDim, fontSize: FontSize.xs, lineHeight: 16 },
  progressionRule: { color: colors.primary, fontSize: FontSize.xs, lineHeight: 16 },

  // Per-exercise action buttons
  exActions:            { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  exActionBtn:          { flex: 1, paddingVertical: spacing.sm, borderRadius: Radius.sm, backgroundColor: colors.border, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  exActionBtnDone:      { backgroundColor: colors.positiveDim, borderColor: colors.positive },
  exActionBtnText:      { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  exActionBtnTextDone:  { color: colors.positive },
  exSkipBtn:            { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  exSkipBtnActive:      { backgroundColor: colors.warningDim },
  exSkipBtnText:        { color: colors.textDim, fontSize: FontSize.xs },
  exSkipBtnTextActive:  { color: colors.warning },

  rationaleCard:   { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: colors.accent },
  rationaleTitle:  { color: colors.accent, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: 'uppercase' },
  rationaleBody:   { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  progressionNote: { color: colors.textDim, fontSize: FontSize.xs, fontStyle: 'italic' },

  actions:        { gap: spacing.sm, marginBottom: spacing.cardGap },
  activeControls: { flexDirection: 'row', gap: spacing.sm },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: 40 },
  logForm:       { gap: spacing.md },
  logFormTitle:  { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  logLabel:      { color: colors.textMuted, fontSize: FontSize.sm },
  stepper:       { gap: spacing.xs },
  stepperLabel:  { color: colors.textMuted, fontSize: FontSize.sm },
  stepperRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:   { color: colors.text, fontSize: 20, fontWeight: FontWeight.bold, lineHeight: 22 },
  stepValue:     { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black, minWidth: 48, textAlign: 'center' },
  notesInput:    { backgroundColor: colors.bg, borderRadius: 10, padding: spacing.md, color: colors.text, fontSize: FontSize.sm, minHeight: 72, borderWidth: 1, borderColor: colors.border },
  logActions:    { flexDirection: 'row', gap: spacing.sm },
  skipTitle:     { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: spacing.md },
  skipReason:    { padding: spacing.md, backgroundColor: colors.bg, borderRadius: 10, marginBottom: spacing.sm },
  skipReasonText:{ color: colors.text, fontSize: FontSize.base },

  // Weight picker
  pickerTitle:     { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: spacing.md, textAlign: 'center' },
  pickerContainer: { height: ITEM_HEIGHT * 5, overflow: 'hidden', position: 'relative', marginBottom: spacing.sm },
  pickerHighlight: { position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.primary, zIndex: 1, pointerEvents: 'none' },
  pickerItem:      { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  pickerItemText:  { color: colors.textDim, fontSize: FontSize.lg },
  pickerItemTextActive: { color: colors.text, fontWeight: FontWeight.black, fontSize: FontSize.xl },
  pickerSelected:  { color: colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.bold, textAlign: 'center', marginBottom: spacing.md },
});
