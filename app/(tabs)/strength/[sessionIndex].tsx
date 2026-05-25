import { useMemo, useState } from 'react';
import {
  Alert, Modal, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useStrengthStore } from '../../../src/store/strengthStore';

import { generateStrengthWeek } from '../../../src/utils/strengthEngine';

import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';
import Button from '../../../src/components/ui/Button';

import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import { todayDateKey } from '../../../src/types/checkin';
import type { StrengthEngineInput, CompletedExercise, CompletedSet } from '../../../src/types/strength';

// ─── Completion summary ───────────────────────────────────────────────────────

type SummaryProps = {
  exercises:      CompletedExercise[];
  actualDuration?: number;
  overallRpe?:    number;
  notes?:         string;
  skipped?:       boolean;
  skippedReason?: string;
  source?:        string;
};

function CompletionSummaryCard({ exercises, actualDuration, overallRpe, notes, skipped, skippedReason, source }: SummaryProps) {
  const totalSets = exercises.reduce((s, e) => s + e.sets.filter(set => set.completed).length, 0);
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
          {actualDuration !== undefined && <View style={styles.summaryStat}><Text style={styles.summaryValue}>{actualDuration}</Text><Text style={styles.summaryLabel}>min</Text></View>}
          <View style={styles.summaryStat}><Text style={styles.summaryValue}>{totalSets}</Text><Text style={styles.summaryLabel}>sets</Text></View>
          {overallRpe !== undefined && <View style={styles.summaryStat}><Text style={styles.summaryValue}>{overallRpe}</Text><Text style={styles.summaryLabel}>RPE</Text></View>}
        </View>
      )}
      {notes && <Text style={styles.summaryNotes}>{notes}</Text>}
    </Card>
  );
}

// ─── Stepper control ──────────────────────────────────────────────────────────

function Stepper({ label, value, onDec, onInc, display }: {
  label:   string;
  value:   number;
  onDec:   () => void;
  onInc:   () => void;
  display?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.stepValue}>{display ?? value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Log form (shown after completing session) ────────────────────────────────

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
  const idx    = parseInt(sessionIndex ?? '0', 10);
  const router = useRouter();

  const {
    fatigueScore, recoveryScore, trainingPhase, progressionLevel,
    weeklyMileage, currentWeek,
  } = useAthleteStore();

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();
  const soreness     = checkedIn ? (todayCheckIn?.soreness ?? null) : null;

  const profile = useProfileStore(s => s.getActiveProfile());

  const { completedSessions, history, logSession, skipSession, deleteLog } = useStrengthStore();

  const engineInput: StrengthEngineInput = {
    trainingPhase, progressionLevel, weeklyMileage, currentWeek,
    fatigueScore, recoveryScore, soreness,
    injuryRisk:       profile?.returningFromInjury ?? false,
    acwr:             1.0,
    weeksToRace:      0,
    availableTimeMin: 60,
    strengthHistory:  history,
  };

  const strengthWeek = useMemo(() => generateStrengthWeek(engineInput), [
    trainingPhase, progressionLevel, weeklyMileage, currentWeek, fatigueScore, recoveryScore, soreness,
  ]);

  const session = strengthWeek.sessions[idx];
  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>Session not found.</Text>
      </SafeAreaView>
    );
  }

  const completionKey = `sw${currentWeek}_${session.id}_${idx}`;
  const isComplete    = completedSessions.includes(completionKey);
  const logRecord     = history.find(r => r.id === completionKey);

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showLogModal,  setShowLogModal]  = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [elapsedMin, setElapsedMin]       = useState(0);

  // Track elapsed time via state update
  const isActive = sessionStartTime !== null && !isComplete;
  if (isActive) {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 60000);
    if (elapsed !== elapsedMin) setElapsedMin(elapsed);
  }

  function handleStart() {
    setSessionStartTime(Date.now());
  }

  function handleMarkComplete() {
    setShowLogModal(true);
  }

  function handleLogSave(duration: number, rpe: number, notes: string) {
    // Build minimal completed exercise records (all sets at planned reps, RPE from overall)
    const exercises: CompletedExercise[] = session.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      sets: Array.from({ length: ex.sets }, (): CompletedSet => ({
        reps:      ex.repRange[0],
        rpe,
        completed: true,
      })),
    }));

    logSession(
      completionKey, session.id, session.sessionType, session.goal,
      currentWeek, session.targetDuration, exercises,
      fatigueScore, rpe, notes || undefined,
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

        {/* Status / timer */}
        {isActive && (
          <Card style={styles.timerCard}>
            <Text style={styles.timerLabel}>In Progress</Text>
            <Text style={styles.timerValue}>{elapsedMin} min elapsed</Text>
          </Card>
        )}

        {/* Completion summary */}
        {isComplete && logRecord && (
          <CompletionSummaryCard
            exercises={logRecord.exercises}
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
        {session.exercises.map((ex, i) => (
          <Card key={ex.exerciseId} style={styles.exerciseCard}>
            <View style={styles.exHeader}>
              <View style={styles.exNumber}><Text style={styles.exNumText}>{i + 1}</Text></View>
              <View style={styles.exMeta}>
                <Text style={styles.exName}>{ex.exercise.name}</Text>
                <Text style={styles.exPattern}>{ex.exercise.pattern.replace('_', ' ')}</Text>
              </View>
              <View style={styles.exSets}>
                <Text style={styles.exSetsValue}>{ex.sets}×{ex.repRange[0]}–{ex.repRange[1]}</Text>
                <Text style={styles.exSetsLabel}>sets×reps</Text>
              </View>
            </View>

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
          </Card>
        ))}

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
              <>
                <Button label="Mark Complete" onPress={handleMarkComplete} />
                <Button label="Skip Session" onPress={() => setShowSkipModal(true)} variant="secondary" />
              </>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.bg },
  scroll:         { padding: spacing.lg },
  errorText:      { color: colors.critical, fontSize: FontSize.base, padding: spacing.xl },
  backRow:        { marginBottom: spacing.md },
  backText:       { color: colors.primary, fontSize: FontSize.sm },
  headerCard:     { marginBottom: spacing.cardGap },
  headerTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  sessionType:    { color: '#C084FC', fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  duration:       { color: colors.textDim, fontSize: FontSize.sm },
  sessionTitle:   { color: colors.text, fontSize: 22, fontWeight: FontWeight.black, marginBottom: spacing.xs },
  purpose:        { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },
  timerCard:      { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: colors.positive },
  timerLabel:     { color: colors.positive, fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: 2 },
  timerValue:     { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  summaryCard:    { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: colors.positive },
  summaryHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  summaryTitle:   { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  summaryStats:   { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.sm },
  summaryStat:    { alignItems: 'center' },
  summaryValue:   { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  summaryLabel:   { color: colors.textDim, fontSize: FontSize.xs },
  summaryMeta:    { color: colors.textMuted, fontSize: FontSize.sm },
  summaryNotes:   { color: colors.textMuted, fontSize: FontSize.sm, marginTop: spacing.sm, fontStyle: 'italic' },
  protocolCard:   { marginBottom: spacing.cardGap },
  protocolTitle:  { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: 'uppercase' },
  protocolText:   { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18 },
  sectionHeader:  { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm },
  exerciseCard:   { marginBottom: spacing.cardGap },
  exHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  exNumber:       { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  exNumText:      { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  exMeta:         { flex: 1 },
  exName:         { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  exPattern:      { color: colors.textDim, fontSize: FontSize.xs, textTransform: 'capitalize' },
  exSets:         { alignItems: 'flex-end' },
  exSetsValue:    { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  exSetsLabel:    { color: colors.textDim, fontSize: FontSize.xs },
  exDetails:      { backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, gap: 4 },
  exDetailRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  exDetailLabel:  { color: colors.textDim, fontSize: FontSize.xs },
  exDetailValue:  { color: colors.textMuted, fontSize: FontSize.xs },
  rationaleText:  { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 17, marginBottom: spacing.sm },
  cues:           { gap: 4, marginBottom: spacing.sm },
  cue:            { color: colors.textDim, fontSize: FontSize.xs, lineHeight: 16 },
  progressionRule:{ color: colors.primary, fontSize: FontSize.xs, lineHeight: 16 },
  rationaleCard:  { marginBottom: spacing.cardGap, borderLeftWidth: 3, borderLeftColor: '#C084FC' },
  rationaleTitle: { color: '#C084FC', fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: 'uppercase' },
  rationaleBody:  { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  progressionNote:{ color: colors.textDim, fontSize: FontSize.xs, fontStyle: 'italic' },
  actions:        { gap: spacing.sm, marginBottom: spacing.cardGap },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: 40 },
  logForm:        { gap: spacing.md },
  logFormTitle:   { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  logLabel:       { color: colors.textMuted, fontSize: FontSize.sm },
  stepper:        { gap: spacing.xs },
  stepperLabel:   { color: colors.textMuted, fontSize: FontSize.sm },
  stepperRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:    { color: colors.text, fontSize: 20, fontWeight: FontWeight.bold, lineHeight: 22 },
  stepValue:      { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black, minWidth: 48, textAlign: 'center' },
  notesInput:     { backgroundColor: colors.bg, borderRadius: 10, padding: spacing.md, color: colors.text, fontSize: FontSize.sm, minHeight: 72, borderWidth: 1, borderColor: colors.border },
  logActions:     { flexDirection: 'row', gap: spacing.sm },
  skipTitle:      { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: spacing.md },
  skipReason:     { padding: spacing.md, backgroundColor: colors.bg, borderRadius: 10, marginBottom: spacing.sm },
  skipReasonText: { color: colors.text, fontSize: FontSize.base },
});
