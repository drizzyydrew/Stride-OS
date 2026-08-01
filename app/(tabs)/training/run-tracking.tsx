// ─── GPS Run Tracking Screen ──────────────────────────────────────────────────
//
// Full-screen active run experience. Launched from [dayIndex].tsx via
// router.push('/training/run-tracking?dayIndex=N').
//
// Requires: expo-location, expo-task-manager, expo-speech (all installed).
// Background tracking requires a signed EAS build — Expo Go gets foreground
// location only.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import {
  activeRunElapsedSeconds,
  useActiveRunStore,
} from '../../../src/store/activeRunStore';
import { useAthleteStore }   from '../../../src/store/athleteStore';
import { useWorkoutStore }   from '../../../src/store/workoutStore';
import { useWeekPlan }       from '../../../src/hooks/useWeekPlan';
import { startLocationTracking, stopLocationTracking } from '../../../src/lib/gpsTracking';
import {
  endRunLiveActivity,
  startRunLiveActivity,
  updateRunLiveActivity,
} from '../../../src/lib/runLiveActivity';
import {
  discardActiveSession,
  getConflictingActiveSession,
  isActiveSessionStale,
  waitForActiveSessionStores,
} from '../../../src/lib/activeSessionCoordinator';
import { resolveLaunchDecision } from '../../../src/utils/workoutInstance';
import { runScheduledSessionId } from '../../../src/utils/scheduledSessionIds';
import { toYMD } from '../../../src/utils/calendarEngine';
import { enqueueVoiceCue } from '../../../src/lib/voiceCue';

import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type { RichWorkout } from '../../../src/types/workout';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PaceStatus = 'too_fast' | 'on_pace' | 'too_slow' | 'no_target';

function getPaceStatus(currentSecPerMile: number, minSec: number, maxSec: number): PaceStatus {
  if (currentSecPerMile === 0) return 'no_target';
  const TOLERANCE = 15;
  if (currentSecPerMile < minSec - TOLERANCE) return 'too_fast';
  if (currentSecPerMile > maxSec + TOLERANCE) return 'too_slow';
  return 'on_pace';
}

function formatPace(secPerMile: number): string {
  if (secPerMile === 0) return '--:--';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PACE_STATUS_COLOR: Record<PaceStatus, string> = {
  too_fast:  colors.critical,
  on_pace:   colors.positive,
  too_slow:  '#FF9500',
  no_target: colors.textMuted,
};

const PACE_STATUS_LABEL: Record<PaceStatus, string> = {
  too_fast:  'TOO FAST',
  on_pace:   'ON PACE',
  too_slow:  'TOO SLOW',
  no_target: 'GPS ACTIVE',
};

// ── Interval card ─────────────────────────────────────────────────────────────

function IntervalCard({ workout }: { workout: RichWorkout }) {
  const { intervals } = workout;
  if (!intervals) return null;

  return (
    <View style={iv.card}>
      <View style={iv.header}>
        <Text style={iv.title}>{intervals.setCount}× {intervals.workLabel}</Text>
        <Text style={iv.zone}>Zone {intervals.workHRZone}</Text>
      </View>
      <Text style={iv.target}>Target: {intervals.workPaceGuide}</Text>
      <Text style={iv.rest}>Rest: {intervals.restLabel}</Text>
      {intervals.progressionNote && (
        <Text style={iv.note}>{intervals.progressionNote}</Text>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RunTrackingScreen() {
  const insets   = useSafeAreaInsets();
  const { dayIndex: dayParam } = useLocalSearchParams<{ dayIndex?: string }>();
  const dayIndex = parseInt(dayParam ?? '0', 10);

  const { richWeek } = useWeekPlan();
  const plannedWorkout = richWeek.workouts[dayIndex] as RichWorkout | undefined ?? null;
  // Canonical id for the workout this screen was launched to run — used to
  // decide whether an already-active run is *this* run (resume) or a
  // different one (never silently take over or silently discard it).
  const requestedScheduledSessionId = plannedWorkout
    ? runScheduledSessionId(toYMD(new Date()), plannedWorkout.id, dayIndex)
    : null;

  const {
    fatigueScore, recoveryScore, currentWeek,
    setFatigueScore, setRecentEasyLoad,
  } = useAthleteStore();

  const { completeWorkout, editLog, completedWorkouts } = useWorkoutStore();

  const {
    isActive, isPaused, startTime, distanceMiles,
    currentPaceSecPerMile, averagePaceSecPerMile,
    startRun, pauseRun, resumeRun, finishRun, cancelRun,
  } = useActiveRunStore();

  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timer ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isActive && !isPaused && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedSec(activeRunElapsedSeconds(useActiveRunStore.getState()));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, isPaused, startTime]);

  // ── Start run on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function beginFreshRun() {
      startRun(plannedWorkout, {
        mode: plannedWorkout ? 'workout' : 'quick',
        scheduledSessionId: requestedScheduledSessionId ?? undefined,
        environment: 'outdoor',
      });
      const startedRun = useActiveRunStore.getState();
      await startRunLiveActivity({
        sessionId: startedRun.workoutInstanceId ?? (startedRun.startTime ? `run:${startedRun.startTime}` : ''),
        workoutInstanceId: startedRun.workoutInstanceId ?? undefined,
        sessionSource: 'running',
        elapsedSeconds: 0,
        distanceMiles: 0,
        averagePace: '--:--',
        heartRateBpm: null,
        zoneLabel: 'Zone --',
        zoneStatus: 'unknown',
        isPaused: false,
      }).catch(console.warn);
      startLocationTracking().catch(console.warn);
      const workoutName = plannedWorkout?.title ?? 'run';
      enqueueVoiceCue(
        `${workoutName} started. ${plannedWorkout?.warmup?.instructions ?? 'Start easy.'}.`,
        'motivation',
      );
    }

    async function launch() {
      await waitForActiveSessionStores();
      if (cancelled) return;

      const conflict = getConflictingActiveSession('running');
      if (conflict) {
        const stale = isActiveSessionStale();
        Alert.alert(
          'Another session is active',
          stale
            ? `${conflict.name} started a while ago and is still open. Continue it, or end it and start this run.`
            : `${conflict.name} is still in progress. Continue it or end it before starting this run.`,
          [
            { text: 'Continue Current Session', onPress: () => router.replace(conflict.route as never) },
            {
              text: 'End Previous Session and Start New',
              style: 'destructive',
              onPress: () => { void discardActiveSession(conflict).then(beginFreshRun); },
            },
            { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
          ],
        );
        return;
      }

      const runState = useActiveRunStore.getState();
      const decision = resolveLaunchDecision({
        isActive: runState.isActive,
        activeScheduledSessionId: runState.scheduledSessionId,
        requestedScheduledSessionId,
        startedAtMs: runState.startTime,
      });

      if (decision === 'start_new') {
        await beginFreshRun();
        return;
      }

      if (decision === 'resume') {
        // This is genuinely the same run — but this legacy full-screen UI has
        // no treadmill panel. If the in-progress run is indoor, hand off to
        // the primary Running tab instead of silently rendering GPS UI for a
        // session with no GPS data.
        if (runState.environment === 'indoor') {
          router.replace('/(tabs)/training' as never);
        }
        return;
      }

      // decision === 'confirm': a different (or stale) run is active. Never a
      // silent wedge — offer resume-previous or discard-and-start-new.
      Alert.alert(
        'A run is already in progress',
        runState.environment === 'indoor'
          ? 'An indoor treadmill run is already active. Resume it in the Running tab, or discard it and start this GPS run.'
          : 'A different run is already active. Resume it, or discard it and start this one.',
        [
          {
            text: 'Resume Previous Run',
            onPress: () => {
              if (runState.environment === 'indoor') router.replace('/(tabs)/training' as never);
            },
          },
          {
            text: 'Discard and Start New',
            style: 'destructive',
            onPress: () => { void discardActiveSession({ domain: 'running', name: 'Training Run', route: '/(tabs)/training' }).then(beginFreshRun); },
          },
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        ],
      );
    }
    void launch();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isActive || !startTime) return;
    const latestState = useActiveRunStore.getState();
    void updateRunLiveActivity({
      sessionId: latestState.workoutInstanceId ?? `run:${startTime}`,
      workoutInstanceId: latestState.workoutInstanceId ?? undefined,
      sessionSource: 'running',
      elapsedSeconds: activeRunElapsedSeconds(latestState),
      distanceMiles,
      averagePace: formatPace(averagePaceSecPerMile),
      heartRateBpm: null,
      zoneLabel: 'Zone --',
      zoneStatus: 'unknown',
      isPaused,
    }).catch(console.warn);
  }, [averagePaceSecPerMile, distanceMiles, elapsedSec, isActive, isPaused, startTime]);

  // ── End run ───────────────────────────────────────────────────────────────────

  const handleEndRun = useCallback(() => {
    const confirmEnd = async () => {
      const finalState = useActiveRunStore.getState();
      const finalElapsed = activeRunElapsedSeconds(finalState);
      await endRunLiveActivity({
        sessionId: finalState.workoutInstanceId ?? (finalState.startTime ? `run:${finalState.startTime}` : ''),
        workoutInstanceId: finalState.workoutInstanceId ?? undefined,
        sessionSource: 'running',
        elapsedSeconds: finalElapsed,
        distanceMiles: finalState.distanceMiles,
        averagePace: formatPace(finalState.averagePaceSecPerMile),
        heartRateBpm: null,
        zoneLabel: 'Zone --',
        zoneStatus: 'unknown',
        isPaused: false,
      }).catch(console.warn);
      await stopLocationTracking().catch(console.warn);
      enqueueVoiceCue('Run complete. Great work.', 'motivation');
      finishRun();

      if (plannedWorkout) {
        const completionKey = `w${currentWeek}_${plannedWorkout.id}_${dayIndex}`;
        if (!completedWorkouts.includes(completionKey)) {
          completeWorkout(
            completionKey, plannedWorkout, currentWeek,
            fatigueScore, recoveryScore,
            setFatigueScore, setRecentEasyLoad,
          );
          editLog(completionKey, {
            actualDurationMinutes: Math.round(finalElapsed / 60),
            actualDistanceMiles:   Math.round(distanceMiles * 100) / 100,
          });
        }
      }
      router.back();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('End this run and save?')) confirmEnd();
    } else {
      Alert.alert('End Run', 'Save this run and finish?', [
        { text: 'Keep Running', style: 'cancel' },
        { text: 'End & Save', style: 'default', onPress: () => { void confirmEnd(); } },
      ]);
    }
  }, [
    completedWorkouts, completeWorkout, currentWeek, dayIndex,
    distanceMiles, editLog, elapsedSec, fatigueScore, finishRun,
    plannedWorkout, recoveryScore, setFatigueScore, setRecentEasyLoad,
  ]);

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Run', 'Discard this run without saving?', [
      { text: 'Keep Running', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          const finalState = useActiveRunStore.getState();
          await endRunLiveActivity({
            sessionId: finalState.workoutInstanceId ?? (finalState.startTime ? `run:${finalState.startTime}` : ''),
            workoutInstanceId: finalState.workoutInstanceId ?? undefined,
            sessionSource: 'running',
            elapsedSeconds: activeRunElapsedSeconds(finalState),
            distanceMiles: finalState.distanceMiles,
            averagePace: formatPace(finalState.averagePaceSecPerMile),
            heartRateBpm: null,
            zoneLabel: 'Zone --',
            zoneStatus: 'unknown',
            isPaused: false,
          }).catch(console.warn);
          await stopLocationTracking().catch(console.warn);
          cancelRun();
          router.back();
        },
      },
    ]);
  }, [cancelRun]);

  // ── Pace status ───────────────────────────────────────────────────────────────

  const paceRange  = plannedWorkout?.paceRange;
  const paceStatus = paceRange && currentPaceSecPerMile > 0
    ? getPaceStatus(currentPaceSecPerMile, paceRange.minSecPerMi, paceRange.maxSecPerMi)
    : 'no_target';
  const statusColor = PACE_STATUS_COLOR[paceStatus];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={s.headerBack}>✕</Text>
        </Pressable>
        <Text style={s.headerTitle}>{plannedWorkout?.title ?? 'Active Run'}</Text>
        <View style={s.recBadge}>
          <View style={s.recDot} />
          <Text style={s.recTime}>{formatElapsed(elapsedSec)}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{distanceMiles.toFixed(2)}</Text>
          <Text style={s.statLabel}>miles</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>{formatElapsed(elapsedSec)}</Text>
          <Text style={s.statLabel}>time</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>{formatPace(currentPaceSecPerMile)}</Text>
          <Text style={s.statLabel}>pace</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>

        {/* Interval block card (structured sessions) */}
        {plannedWorkout && <IntervalCard workout={plannedWorkout} />}

        {/* Pace target card */}
        {paceRange ? (
          <View style={s.paceCard}>
            <Text style={s.paceCardLabel}>PACE TARGET</Text>
            <Text style={s.paceTargetTxt}>
              {formatPace(paceRange.minSecPerMi)} – {formatPace(paceRange.maxSecPerMi)} /mi
            </Text>
          </View>
        ) : null}

        {/* Current pace + status */}
        <View style={s.currentPaceCard}>
          <Text style={s.paceCardLabel}>CURRENT PACE</Text>
          <Text style={s.paceBig}>{formatPace(currentPaceSecPerMile)}<Text style={s.paceUnit}> /mi</Text></Text>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[s.statusTxt, { color: statusColor }]}>{PACE_STATUS_LABEL[paceStatus]}</Text>
          </View>
        </View>

        {/* Execution cues */}
        {plannedWorkout?.executionCues && plannedWorkout.executionCues.length > 0 && (
          <View style={s.cuesCard}>
            <Text style={s.cuesLabel}>REMINDERS</Text>
            {plannedWorkout.executionCues.slice(0, 3).map((cue, i) => (
              <Text key={i} style={s.cue}>· {cue}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={[s.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={[s.ctrlBtn, s.ctrlBtnSecondary]}
          onPress={isPaused ? resumeRun : pauseRun}
        >
          <Text style={s.ctrlBtnTxt}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </Pressable>

        <Pressable style={[s.ctrlBtn, s.ctrlBtnEnd]} onPress={handleEndRun}>
          <Text style={s.ctrlBtnTxt}>End Run</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  headerBack:  { color: colors.textMuted, fontSize: 20 },
  headerTitle: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  recBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   colors.critical + '22',
    borderRadius:      20,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  recDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.critical,
  },
  recTime:  { color: colors.critical, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statsRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBox:   { flex: 1, alignItems: 'center', gap: 2 },
  statNum:   { color: colors.text, fontSize: FontSize.xl, fontWeight: FontWeight.black },
  statLabel: { color: colors.textMuted, fontSize: FontSize.xs },
  body:        { flex: 1 },
  bodyContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  paceCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    gap:             spacing.xs,
  },
  paceCardLabel: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
  paceTargetTxt: { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  currentPaceCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  paceBig:  { color: colors.text, fontSize: 44, fontWeight: FontWeight.black },
  paceUnit: { fontSize: FontSize.sm, color: colors.textMuted, fontWeight: '400' as any },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: 0.5 },
  cuesCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  cuesLabel: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
  cue:       { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 18 },
  controls: {
    flexDirection:     'row',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
  },
  ctrlBtn: {
    flex: 1, borderRadius: Radius.sm,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  ctrlBtnSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ctrlBtnEnd:       { backgroundColor: colors.critical },
  ctrlBtnTxt:       { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});

const iv = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '66',
    gap:             spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  zone:   { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  target: { color: colors.textSubtle, fontSize: FontSize.sm },
  rest:   { color: colors.textMuted, fontSize: FontSize.xs },
  note:   { color: colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },
});
