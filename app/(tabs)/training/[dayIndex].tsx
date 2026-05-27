import { useState } from 'react';
import {
  Alert, Modal, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAthleteStore } from '../../../src/store/athleteStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useWeekPlan }     from '../../../src/hooks/useWeekPlan';

import WorkoutDetailCard from '../../../src/components/training/WorkoutDetailCard';
import IntervalStructureCard from '../../../src/components/training/IntervalStructureCard';
import WorkoutRationaleCard from '../../../src/components/training/WorkoutRationaleCard';
import WorkoutScoreCard from '../../../src/components/training/WorkoutScoreCard';
import WorkoutLogForm, { WorkoutLogData } from '../../../src/components/training/WorkoutLogForm';
import Button from '../../../src/components/ui/Button';
import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';

import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import type { WorkoutIntensity } from '../../../src/types/training';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function rpeToIntensity(rpe: number): WorkoutIntensity {
  if (rpe <= 2) return 'very_easy';
  if (rpe <= 4) return 'easy';
  if (rpe <= 6) return 'moderate';
  if (rpe <= 8) return 'hard';
  return 'max';
}

// ─── Completion summary card ──────────────────────────────────────────────────

type SummaryProps = {
  durationMinutes:        number;
  actualDurationMinutes?: number;
  actualDistanceMiles?:   number;
  rpe?:                   number;
  notes?:                 string;
  skipped?:               boolean;
  skippedReason?:         string;
  source?:                string;
};

function CompletionSummaryCard({
  durationMinutes, actualDurationMinutes, actualDistanceMiles,
  rpe, notes, skipped, skippedReason, source,
}: SummaryProps) {
  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>
          {skipped ? 'Session Skipped' : 'Session Logged'}
        </Text>
        {source === 'manual' && (
          <Badge label="Manual" bg={colors.border} color={colors.textMuted} />
        )}
      </View>
      {skipped ? (
        <Text style={styles.summaryMeta}>
          {skippedReason ?? 'No reason provided.'}
        </Text>
      ) : (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryCellLabel}>Duration</Text>
            <Text style={styles.summaryCellValue}>
              {actualDurationMinutes ?? durationMinutes} min
            </Text>
            {actualDurationMinutes != null && actualDurationMinutes !== durationMinutes && (
              <Text style={styles.summaryCellPlan}>Planned: {durationMinutes} min</Text>
            )}
          </View>
          {actualDistanceMiles != null && (
            <View style={styles.summaryCell}>
              <Text style={styles.summaryCellLabel}>Distance</Text>
              <Text style={styles.summaryCellValue}>{actualDistanceMiles.toFixed(1)} mi</Text>
            </View>
          )}
          {rpe != null && (
            <View style={styles.summaryCell}>
              <Text style={styles.summaryCellLabel}>RPE</Text>
              <Text style={styles.summaryCellValue}>{rpe}/10</Text>
            </View>
          )}
        </View>
      )}
      {notes ? <Text style={styles.summaryNotes}>{notes}</Text> : null}
    </Card>
  );
}

// ─── Skip modal ────────────────────────────────────────────────────────────────

type SkipModalProps = {
  visible:  boolean;
  onSkip:   (reason: string) => void;
  onCancel: () => void;
};

function SkipModal({ visible, onSkip, onCancel }: SkipModalProps) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Skip this session?</Text>
          <Text style={styles.modalSub}>Skipping is fine — recovery is part of training.</Text>

          <Text style={styles.inputLabel}>Reason (optional)</Text>
          <View style={styles.reasonInput}>
            <Text
              style={[styles.reasonText, !reason && styles.reasonPlaceholder]}
              onPress={() => {}}
            >
              {reason || 'Fatigue, schedule, illness…'}
            </Text>
          </View>

          {/* Simple reason chips */}
          <View style={styles.chipRow}>
            {['Too tired', 'Schedule conflict', 'Illness / injury', 'Weather'].map(r => (
              <Pressable key={r} onPress={() => setReason(r)} style={[
                styles.chip,
                reason === r && styles.chipActive,
              ]}>
                <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Button label="Skip Session" onPress={() => { onSkip(reason); setReason(''); }} variant="secondary" style={{ marginTop: spacing.xl }} />
          <Button label="Go Back" onPress={onCancel} variant="secondary" style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const router = useRouter();
  const { dayIndex: dayIndexParam } = useLocalSearchParams<{ dayIndex: string }>();
  const dayIndex = parseInt(dayIndexParam ?? '0', 10);

  // ── Stores ──────────────────────────────────────────────────────────────────
  const {
    recoveryScore, fatigueScore,
    setFatigueScore, setRecentEasyLoad,
    currentWeek,
  } = useAthleteStore();

  const {
    completedWorkouts, history,
    completeWorkout, skipWorkout, editLog, deleteLog, manualLog,
  } = useWorkoutStore();

  // ── Plan (shared with training list — deterministic, no store writes) ────
  const { richWeek } = useWeekPlan();

  const workout = richWeek.workouts[dayIndex];

  // ── Completion key ───────────────────────────────────────────────────────────
  const completionKey = workout
    ? `w${currentWeek}_${workout.id}_${dayIndex}`
    : '';

  const isComplete = completedWorkouts.includes(completionKey);

  // Find the history record for this session
  const logRecord = history.find(r => r.id === completionKey);

  const isRest = workout?.type === 'rest';

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showLogModal,     setShowLogModal]     = useState(false);
  const [showSkipModal,    setShowSkipModal]    = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Session not found.</Text>
          <Button label="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const dayName       = DAY_NAMES[dayIndex] ?? `Day ${dayIndex + 1}`;
  const isStarted     = sessionStartTime !== null;
  const elapsedMin    = isStarted
    ? Math.round((Date.now() - sessionStartTime) / 60000)
    : workout.durationMinutes;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleStart() {
    setSessionStartTime(Date.now());
  }

  function handleMarkComplete() {
    setShowLogModal(true);
  }

  function handleLogSave(data: WorkoutLogData) {
    setShowLogModal(false);
    setSessionStartTime(null);

    if (isComplete) {
      // Editing an existing log
      editLog(completionKey, {
        actualDurationMinutes: data.actualDurationMinutes,
        actualDistanceMiles:   data.actualDistanceMiles,
        rpe:                   data.rpe,
        notes:                 data.notes || undefined,
      });
    } else {
      // Fresh completion — use completeWorkout then patch with actual values
      completeWorkout(
        completionKey, workout, currentWeek,
        fatigueScore, recoveryScore,
        setFatigueScore, setRecentEasyLoad,
      );
      editLog(completionKey, {
        actualDurationMinutes: data.actualDurationMinutes,
        actualDistanceMiles:   data.actualDistanceMiles,
        rpe:                   data.rpe,
        notes:                 data.notes || undefined,
      });
    }
  }

  function handleManualLog(data: WorkoutLogData) {
    setShowLogModal(false);
    manualLog(
      {
        completionKey,
        type:            workout.type,
        intensity:       data.rpe ? rpeToIntensity(data.rpe) : workout.intensity,
        durationMinutes: data.actualDurationMinutes,
        distanceMiles:   data.actualDistanceMiles,
        rpe:             data.rpe,
        notes:           data.notes || undefined,
      },
      currentWeek, fatigueScore, recoveryScore,
      setFatigueScore, setRecentEasyLoad,
    );
  }

  function handleSkip(reason: string) {
    setShowSkipModal(false);
    skipWorkout(
      completionKey, workout, currentWeek,
      fatigueScore, recoveryScore,
      setFatigueScore, setRecentEasyLoad,
      reason || undefined,
    );
  }

  function handleDelete() {
    Alert.alert(
      'Delete Log',
      'Remove this session from your history? The session will return to "not completed" state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLog(completionKey),
        },
      ],
    );
  }

  const plannedDistance = workout.targetDistance ?? Math.round((workout.durationMinutes / 60) * 8 * 10) / 10;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerDay}>{dayName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Completion summary (shown when already logged) */}
        {isComplete && logRecord && (
          <CompletionSummaryCard
            durationMinutes={workout.durationMinutes}
            actualDurationMinutes={logRecord.actualDurationMinutes}
            actualDistanceMiles={logRecord.actualDistanceMiles}
            rpe={logRecord.rpe}
            notes={logRecord.notes}
            skipped={logRecord.skipped}
            skippedReason={logRecord.skippedReason}
            source={logRecord.source}
          />
        )}

        {/* Main workout detail */}
        <WorkoutDetailCard workout={workout} />

        {/* Interval structure (only for structured sessions) */}
        {workout.intervals && (
          <IntervalStructureCard intervals={workout.intervals} />
        )}

        {/* Execution plan, science, modifications */}
        <WorkoutRationaleCard workout={workout} />

        {/* Session scoring */}
        {!isRest && <WorkoutScoreCard score={workout.score} />}

        {/* ── Action section ─────────────────────────────────────────────────── */}
        <View style={styles.actionSection}>

          {!isComplete && !isRest && (
            <>
              {!isStarted ? (
                <Button label="Start Session" onPress={handleStart} />
              ) : (
                <View style={styles.timerRow}>
                  <Text style={styles.timerText}>{elapsedMin} min elapsed</Text>
                  <Button
                    label="Mark Complete"
                    onPress={handleMarkComplete}
                    style={styles.timerButton}
                  />
                </View>
              )}

              <View style={styles.secondaryActions}>
                <Button
                  label="Log Manually"
                  onPress={() => setShowLogModal(true)}
                  variant="secondary"
                  style={styles.halfButton}
                />
                <Button
                  label="Skip Session"
                  onPress={() => setShowSkipModal(true)}
                  variant="secondary"
                  style={styles.halfButton}
                />
              </View>
            </>
          )}

          {!isComplete && isRest && (
            <Button
              label="Log Rest Day"
              onPress={() => {
                skipWorkout(
                  completionKey, workout, currentWeek,
                  fatigueScore, recoveryScore,
                  setFatigueScore, setRecentEasyLoad,
                  'Rest day',
                );
              }}
              variant="secondary"
            />
          )}

          {isComplete && !logRecord?.skipped && (
            <View style={styles.secondaryActions}>
              <Button
                label="Edit Log"
                onPress={() => setShowEditModal(true)}
                variant="secondary"
                style={styles.halfButton}
              />
              <Button
                label="Delete Log"
                onPress={handleDelete}
                variant="danger"
                style={styles.halfButton}
              />
            </View>
          )}

          {isComplete && logRecord?.skipped && (
            <Button
              label="Delete Skip Log"
              onPress={handleDelete}
              variant="danger"
            />
          )}
        </View>
      </ScrollView>

      {/* ── Log form modal (complete / manual / edit) ───────────────────────── */}
      <Modal
        visible={showLogModal || showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowLogModal(false); setShowEditModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <WorkoutLogForm
                plannedDurationMinutes={
                  showEditModal && logRecord?.actualDurationMinutes
                    ? logRecord.actualDurationMinutes
                    : elapsedMin
                }
                plannedDistanceMiles={
                  showEditModal && logRecord?.actualDistanceMiles
                    ? logRecord.actualDistanceMiles
                    : plannedDistance
                }
                onSave={showEditModal
                  ? (data) => { setShowEditModal(false); editLog(completionKey, {
                      actualDurationMinutes: data.actualDurationMinutes,
                      actualDistanceMiles:   data.actualDistanceMiles,
                      rpe:                   data.rpe,
                      notes:                 data.notes || undefined,
                    }); }
                  : (isStarted ? handleLogSave : handleManualLog)
                }
                onCancel={() => { setShowLogModal(false); setShowEditModal(false); }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Skip modal ──────────────────────────────────────────────────────── */}
      <SkipModal
        visible={showSkipModal}
        onSkip={handleSkip}
        onCancel={() => setShowSkipModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color:      colors.primary,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.medium,
  },
  headerDay: {
    flex:       1,
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign:  'center',
  },
  headerSpacer: {
    width: 60,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.screenPadBottom,
  },
  errorContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
  },
  errorText: {
    color:        colors.textMuted,
    fontSize:     FontSize.md,
    marginBottom: spacing.xl,
  },
  // Completion summary
  summaryCard: {
    borderWidth:   1,
    borderColor:   colors.positive,
    marginBottom:  spacing.cardGap,
  },
  summaryHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  summaryTitle: {
    color:      colors.positive,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
  summaryMeta: {
    color:    colors.textMuted,
    fontSize: FontSize.base,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap:           spacing.xl,
  },
  summaryCell: {
    flex: 1,
  },
  summaryCellLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  summaryCellValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  summaryCellPlan: {
    color:    colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  summaryNotes: {
    color:     colors.textMuted,
    fontSize:  FontSize.sm,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  // Action section
  actionSection: {
    marginTop: spacing.sectionGap,
  },
  timerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius:   14,
    paddingLeft:    spacing.xl,
    marginBottom:   spacing.sm,
  },
  timerText: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.medium,
  },
  timerButton: {
    flex:         0,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
  },
  halfButton: {
    flex: 1,
  },
  // Modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor:    colors.card,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:  spacing.xl,
    paddingBottom:      spacing.xxxl,
    maxHeight:          '90%',
  },
  modalTitle: {
    color:        colors.text,
    fontSize:     24,
    fontWeight:   FontWeight.black,
    marginTop:    spacing.xl,
    marginBottom: spacing.sm,
  },
  modalSub: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    marginBottom: spacing.xl,
  },
  // Skip chips
  reasonInput: {
    backgroundColor:   colors.border,
    borderRadius:      8,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    marginBottom:      spacing.md,
    minHeight:         44,
  },
  reasonText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  reasonPlaceholder: {
    color: colors.textDim,
  },
  inputLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
  },
  chipText: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
