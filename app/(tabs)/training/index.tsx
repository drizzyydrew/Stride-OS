import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAthleteStore } from '../../../src/store/athleteStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useAdaptationStore } from '../../../src/store/adaptationStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useWorkoutWeekStore } from '../../../src/store/workoutWeekStore';

import { generateRichWeek } from '../../../src/utils/workoutEngine';
import { adaptWeek, ID_TO_GENERATABLE } from '../../../src/utils/training/adaptWeek';
import { generateTrainingWeek, generateWorkout } from '../../../src/utils/workoutGenerator';
import { calculateACWR } from '../../../src/utils/training';
import {
  getWeeklyMileage,
  getTrainingDistribution,
  getWeeklyFatigueTrend,
  getWeeklyRecoveryTrend,
} from '../../../src/utils/historyUtils';
import { computeSlope, computeConsistency } from '../../../src/utils/analyticsEngine';
import { generateCoachingOutput } from '../../../src/utils/coachEngine';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import Card from '../../../src/components/ui/Card';
import Badge from '../../../src/components/ui/Badge';
import WorkoutCard from '../../../src/components/ui/WorkoutCard';
import AdaptationSummaryCard from '../../../src/components/training/AdaptationSummaryCard';
import WeeklyCoachCard from '../../../src/components/coaching/WeeklyCoachCard';

import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import type { TrainingPhase, GeneratableWorkoutType } from '../../../src/types/training';
import type { WorkoutEngineInput } from '../../../src/types/workout';
import { todayDateKey } from '../../../src/types/checkin';

const PHASE_BADGE: Record<TrainingPhase, { bg: string; text: string; label: string }> = {
  base:   { bg: '#0C2340', text: '#60A5FA', label: 'BASE'   },
  build:  { bg: '#1E3A8A', text: '#93C5FD', label: 'BUILD'  },
  peak:   { bg: '#3B0764', text: '#C084FC', label: 'PEAK'   },
  deload: { bg: '#451A03', text: '#FCD34D', label: 'DELOAD' },
  taper:  { bg: '#052E16', text: '#4ADE80', label: 'TAPER'  },
};

export default function TrainingScreen() {
  const router = useRouter();

  const {
    goalRace, weeklyMileage, recoveryScore, fatigueScore,
    setFatigueScore, setRecentEasyLoad,
    currentWeek, trainingPhase, progressionLevel,
  } = useAthleteStore();

  const { completedWorkouts, completeWorkout, history } = useWorkoutStore();

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();

  const { getAdaptation, setAdaptation, clearAdaptation } = useAdaptationStore();
  const adaptation = getAdaptation(currentWeek);

  const profile     = useProfileStore(s => s.getActiveProfile());
  const calibration = profile?.calibration ?? null;

  const { setRichWeek } = useWorkoutWeekStore();

  const [isRecalculating, setIsRecalculating] = useState(false);

  // ── Analytics inputs (shared with coach engine) ───────────────────────────
  const acwrResult         = useMemo(() => calculateACWR(history), [history]);
  const weeklySummaries    = useMemo(() => getWeeklyMileage(history), [history]);
  const dist               = useMemo(() => getTrainingDistribution(history, 30), [history]);
  const weeklyFatigueTrend = useMemo(() => getWeeklyFatigueTrend(history), [history]);
  const weeklyRecoveryData = useMemo(() => getWeeklyRecoveryTrend(history), [history]);

  const fatigueSlope  = weeklyFatigueTrend.length >= 2
    ? computeSlope(weeklyFatigueTrend.map(p => p.value)) : 0;
  const recoverySlope = weeklyRecoveryData.length >= 2
    ? computeSlope(weeklyRecoveryData.map(p => p.value)) : 0;

  const totalIntensity =
    (dist.byIntensity.easy      ?? 0) +
    (dist.byIntensity.very_easy ?? 0) +
    (dist.byIntensity.moderate  ?? 0) +
    (dist.byIntensity.hard      ?? 0) +
    (dist.byIntensity.max       ?? 0);
  const easyCount      = (dist.byIntensity.easy ?? 0) + (dist.byIntensity.very_easy ?? 0);
  const easyProportion = totalIntensity > 0 ? easyCount / totalIntensity : 0.80;

  const weeksWithLongRun   = new Set(history.filter(r => r.type === 'long_run').map(r => r.week)).size;
  const longRunConsistency = currentWeek > 0 ? weeksWithLongRun / currentWeek : 0;
  const adherenceRate      = Math.min(1, history.length / Math.max(1, currentWeek * 6));
  const consistencyScore   = computeConsistency(weeklySummaries.map(s => s.totalMiles));

  const recentHardSessions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return history.filter(r =>
      r.timestamp >= cutoff && (r.intensity === 'hard' || r.intensity === 'max'),
    ).length;
  }, [history]);

  // ── Rich week generation ──────────────────────────────────────────────────
  const engineInput: WorkoutEngineInput = {
    calibration,
    fatigueSensitivity:    profile?.fatigueSensitivity    ?? 1.0,
    recoveryResponsiveness: profile?.recoveryResponsiveness ?? 1.0,
    injuryRisk:            profile?.returningFromInjury   ?? false,
    fatigueScore,
    recoveryScore,
    soreness:    checkedIn ? (todayCheckIn?.soreness    ?? null) : null,
    motivation:  checkedIn ? (todayCheckIn?.motivation  ?? null) : null,
    acwr:               acwrResult.acwr,
    trainingPhase,
    progressionLevel,
    weeklyMileage,
    currentWeek,
    goalRace,
    weeksToRace:        0,
    recentIntensityDist: {
      easy:     easyProportion,
      moderate: totalIntensity > 0 ? (dist.byIntensity.moderate ?? 0) / totalIntensity : 0.10,
      hard:     totalIntensity > 0 ? ((dist.byIntensity.hard ?? 0) + (dist.byIntensity.max ?? 0)) / totalIntensity : 0.10,
    },
    recentHardSessions,
    adherenceRate,
    consistencyScore,
    longRunConsistency,
  };

  const richWeek = useMemo(() => generateRichWeek(engineInput), [
    calibration, fatigueScore, recoveryScore, trainingPhase,
    progressionLevel, weeklyMileage, currentWeek, goalRace,
    acwrResult.acwr, adherenceRate,
  ]);

  // Publish rich week for the detail screen
  useEffect(() => { setRichWeek(richWeek); }, [richWeek]);

  // ── Legacy canonical week (for adaptation system + completion keys) ────────
  const generatorInput = {
    weeklyMileage, recoveryScore, fatigueScore,
    goalRace, currentWeek, trainingPhase, progressionLevel,
  };
  const canonicalWeek = generateTrainingWeek(generatorInput);

  const originalTypes: GeneratableWorkoutType[] = canonicalWeek.plannedWorkouts.map(
    w => (ID_TO_GENERATABLE[w.id] ?? 'easy_run') as GeneratableWorkoutType,
  );

  const effectiveWorkouts = adaptation
    ? adaptation.dayTypes.map(type => generateWorkout(type, generatorInput))
    : canonicalWeek.plannedWorkouts;

  function handleRecalculate() {
    setIsRecalculating(true);
    const weekHistory = history.filter(r => r.week === currentWeek);
    const { acwr } = calculateACWR(weekHistory);
    const result = adaptWeek({
      originalTypes,
      completedWorkouts,
      currentWeek,
      fatigueScore,
      recoveryScore,
      soreness: todayCheckIn?.soreness ?? null,
      acwr,
      trainingPhase,
      progressionLevel,
      weekHistory,
    });
    setAdaptation(currentWeek, result);
    setIsRecalculating(false);
  }

  function handleClearAdaptation() {
    clearAdaptation(currentWeek);
  }

  // ── Coach card ─────────────────────────────────────────────────────────────
  const { weeklySummary } = generateCoachingOutput({
    athleteName: 'Athlete',
    goalRace,
    currentWeek,
    trainingPhase,
    progressionLevel,
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    soreness:         todayCheckIn?.soreness   ?? null,
    motivation:       todayCheckIn?.motivation ?? null,
    checkedIn,
    todayWorkoutType: canonicalWeek.plannedWorkouts[0]?.type ?? 'easy_run',
    isRestDay:        false,
    isTodayComplete:  false,
    acwr:             acwrResult.acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    historyWeeks:     weeklySummaries.length,
    consistencyScore,
    fatigueSlope,
    recoverySlope,
    weeksRemaining:   0,
  });

  const badge = PHASE_BADGE[trainingPhase];

  return (
    <ScreenLayout title="Training">

      {/* Week summary */}
      <Card style={{ marginBottom: spacing.sectionGap }}>
        <View style={styles.summaryHeader}>
          <Badge label={badge.label} bg={badge.bg} color={badge.text} />
          <Text style={styles.summaryMileage}>{canonicalWeek.totalMileage} mi</Text>
        </View>
        <Text style={styles.summaryGoal}>{goalRace}</Text>
        <Text style={styles.summaryMeta}>
          Week {currentWeek} · {effectiveWorkouts.length} sessions · {progressionLevel}
        </Text>
        {adaptation && (
          <Text style={styles.adaptedNote} onPress={handleClearAdaptation}>
            Week adapted · Tap to restore original plan
          </Text>
        )}
      </Card>

      {/* Rich week phase rationale */}
      <Card style={styles.rationaleCard}>
        <Text style={styles.rationaleNote}>{richWeek.progressionNote}</Text>
        <Text style={styles.rationaleText}>{richWeek.phaseRationale}</Text>
      </Card>

      {/* Adaptation card */}
      {adaptation ? (
        <AdaptationSummaryCard
          result={adaptation}
          onRecalculate={handleRecalculate}
          isLoading={isRecalculating}
        />
      ) : (
        <AdaptationSummaryCard
          result={{
            dayTypes:     originalTypes,
            originalTypes,
            entries:      originalTypes.map((t, i) => ({
              dayIndex: i, originalType: t, adaptedType: t,
              change: 'as_planned' as const, reason: '',
            })),
            triggers:     [],
            summary:      'Week is on track — no session changes needed.',
            appliedCount: 0,
            missedCount:  0,
          }}
          onRecalculate={handleRecalculate}
          isLoading={isRecalculating}
        />
      )}

      {/* Coach summary */}
      <WeeklyCoachCard summary={weeklySummary} />

      {/* Workout list — uses rich workouts, navigates to detail on tap */}
      {richWeek.workouts.map((workout, index) => {
        const completionKey = `w${currentWeek}_${workout.id}_${index}`;
        const isComplete    = completedWorkouts.includes(completionKey);

        return (
          <TouchableOpacity
            key={completionKey}
            activeOpacity={0.92}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={() => (router as any).push(`/training/${index}`)}
          >
            <WorkoutCard
              workout={workout}
              isComplete={isComplete}
              onComplete={() =>
                completeWorkout(
                  completionKey, workout, currentWeek,
                  fatigueScore, recoveryScore,
                  setFatigueScore, setRecentEasyLoad,
                )
              }
            />
          </TouchableOpacity>
        );
      })}

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.md,
  },
  summaryMileage: {
    color:      colors.text,
    fontSize:   32,
    fontWeight: FontWeight.black,
  },
  summaryGoal: {
    color:        colors.text,
    fontSize:     FontSize.lg,
    fontWeight:   FontWeight.bold,
    marginBottom: 6,
  },
  summaryMeta: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  adaptedNote: {
    color:     colors.primary,
    fontSize:  FontSize.sm,
    marginTop: spacing.sm,
  },
  rationaleCard: {
    marginBottom:  spacing.cardGap,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  rationaleNote: {
    color:        colors.primary,
    fontSize:     FontSize.sm,
    fontWeight:   FontWeight.medium,
    marginBottom: spacing.xs,
  },
  rationaleText: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
});
