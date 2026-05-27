// ─── Running Screen ───────────────────────────────────────────────────────────
//
// Renamed from "Training" to "Running". Shows the week's planned runs in order
// with day labels, readiness context, and phase explanation.
//
// Architecture:
//   - Goal/phase from athleteStore (seeded from onboarding)
//   - Workout generation: workoutEngine.ts (rich) + workoutGenerator.ts (canonical)
//   - Adaptation: adaptWeek.ts
//   - Coach output: coachEngine.ts
//   - No business logic in this component

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAthleteStore }     from '../../../src/store/athleteStore';
import { useWorkoutStore }     from '../../../src/store/workoutStore';
import { useCheckInStore }     from '../../../src/store/checkInStore';
import { useAdaptationStore }  from '../../../src/store/adaptationStore';
import { useWorkoutWeekStore } from '../../../src/store/workoutWeekStore';
import { useOnboardingStore }  from '../../../src/store/onboardingStore';
import { useWeekPlan }         from '../../../src/hooks/useWeekPlan';

import { adaptWeek, ID_TO_GENERATABLE }          from '../../../src/utils/training/adaptWeek';
import { generateTrainingWeek, generateWorkout } from '../../../src/utils/workoutGenerator';
import { calculateACWR }                         from '../../../src/utils/training';
import {
  getWeeklyMileage,
  getTrainingDistribution,
  getWeeklyFatigueTrend,
  getWeeklyRecoveryTrend,
} from '../../../src/utils/historyUtils';
import { computeSlope, computeConsistency } from '../../../src/utils/analyticsEngine';
import { generateCoachingOutput }           from '../../../src/utils/coachEngine';
import { goalHeadline, weeklyFocusLabel }   from '../../../src/utils/goalRaceEngine';

import ScreenLayout          from '../../../src/layout/ScreenLayout';
import Card                  from '../../../src/components/ui/Card';
import WorkoutCard           from '../../../src/components/ui/WorkoutCard';
import AdaptationSummaryCard from '../../../src/components/training/AdaptationSummaryCard';
import WeeklyCoachCard       from '../../../src/components/coaching/WeeklyCoachCard';
import RunningReadinessCard  from '../../../src/components/running/RunningReadinessCard';
import RunningWeekCard       from '../../../src/components/running/RunningWeekCard';

import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import type { TrainingPhase, GeneratableWorkoutType } from '../../../src/types/training';
import { todayDateKey } from '../../../src/types/checkin';

// ─── Day label helpers ────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekDayDates(): Date[] {
  // Returns Mon–Sun (or available days) for the current ISO week
  const today = new Date();
  const day   = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function assignWorkoutDays(
  workoutCount: number,
  availableDays: string[],
  weekDates: Date[],
): Date[] {
  // Map ISO Mon=0…Sun=6 to day-of-week strings used in onboarding
  const DOW_MAP: Record<number, string> = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };

  // Filter weekDates to only available training days
  const trainingDates = weekDates.filter((_, i) => {
    const dayStr = DOW_MAP[i];
    return dayStr && (availableDays.length === 0 || availableDays.includes(dayStr));
  });

  // Assign workouts to available days in order, wrapping if needed
  return Array.from({ length: workoutCount }, (_, i) => {
    return trainingDates[i % Math.max(1, trainingDates.length)] ?? weekDates[i % 7]!;
  });
}

// ─── Phase explanation ────────────────────────────────────────────────────────

const PHASE_RATIONALE: Record<TrainingPhase, { rationale: string; priority: string }> = {
  base: {
    rationale: 'Base phase builds the aerobic engine — mitochondrial density, capillary bed, and fat oxidation capacity. All subsequent training quality depends on this foundation. Consistency and easy effort are more valuable than pace right now.',
    priority:  'Run easy, run often. Hit your long run every week. Resist the urge to run hard.',
  },
  build: {
    rationale: 'Build phase introduces quality work — threshold, tempo, and VO₂ intervals — while maintaining aerobic volume. This is when the aerobic base gets leveraged into race-specific fitness. Fatigue will be higher; trust the process.',
    priority:  'Execute quality sessions exactly as prescribed. Easy runs must stay easy to allow full recovery between hard days.',
  },
  peak: {
    rationale: 'Peak phase reaches maximum race-specific fitness. Volume may decrease slightly but intensity remains high. This is the most productive but also highest-risk phase — fatigue accumulation is real. Stay disciplined with recovery.',
    priority:  'Don\'t add volume. Nail the quality sessions. Protect your sleep and nutrition.',
  },
  deload: {
    rationale: 'Deload weeks allow the body to absorb the previous 3 weeks of training stress. Adaptation happens during recovery, not during loading. Cutting volume by 30–40% now makes the next block more effective.',
    priority:  'Run at feel, not pace. Less is more this week. Let fatigue dissipate.',
  },
  taper: {
    rationale: 'Taper preserves fitness while eliminating accumulated fatigue. Volume drops significantly but a few short quality efforts maintain neuromuscular sharpness. You\'ll feel rusty — that\'s normal and expected.',
    priority:  'Reduce volume, keep some intensity. Prioritize sleep and carbohydrates. Trust your training.',
  },
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RunningScreen() {
  const router = useRouter();

  const {
    goalRace, weeklyMileage, recoveryScore, fatigueScore,
    setFatigueScore, setRecentEasyLoad,
    currentWeek, trainingPhase, progressionLevel,
  } = useAthleteStore();

  const { completedWorkouts, completeWorkout, history } = useWorkoutStore();

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();

  const { getAdaptation, setAdaptation } = useAdaptationStore();
  const adaptation = getAdaptation(currentWeek);

  const { setRichWeek, setWeekPlan } = useWorkoutWeekStore();

  const onboardingData = useOnboardingStore(s => s.data);
  const availableDays  = onboardingData.availableDays;

  const [isRecalculating, setIsRecalculating] = useState(false);

  // ── Unified plan — single source of truth for run sessions ───────────────
  const weekPlan    = useWeekPlan();
  const richWeek    = weekPlan.richWeek;
  const weeksToRace = weekPlan.weeksToRace;

  // ── Analytics inputs ──────────────────────────────────────────────────────
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

  useEffect(() => {
    setRichWeek(richWeek);
    setWeekPlan(weekPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [richWeek]);

  // ── Canonical week (adaptation system) ──────────────────────────────────
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

  // ── Day/date assignment ──────────────────────────────────────────────────
  const weekDates     = getWeekDayDates();
  const workoutDates  = assignWorkoutDays(richWeek.workouts.length, availableDays, weekDates);
  const today         = new Date();
  const todayStr      = `${WEEKDAY_LABELS[today.getDay()]}, ${today.getMonth() + 1}/${today.getDate()}`;

  // ── Completion tracking ──────────────────────────────────────────────────
  const completedThisWeek = richWeek.workouts.filter((_, i) => {
    const key = `w${currentWeek}_${richWeek.workouts[i]!.id}_${i}`;
    return completedWorkouts.includes(key);
  }).length;

  const isCurrentRestDay = effectiveWorkouts[0]?.type === 'rest';

  // ── Key workout identification ───────────────────────────────────────────
  const keyWorkout = richWeek.workouts.find(
    w => w.intensity === 'hard' || w.type === 'threshold' || w.type === 'vo2',
  ) ?? richWeek.workouts.find(w => w.type === 'long_run') ?? richWeek.workouts[0];

  const longRunEntry = richWeek.workouts.find(w => w.type === 'long_run');
  const longRunDate  = longRunEntry
    ? (workoutDates[richWeek.workouts.indexOf(longRunEntry)] ?? null)
    : null;
  const longRunDay   = longRunDate
    ? WEEKDAY_LABELS[longRunDate.getDay()] ?? null
    : null;

  // ── Phase text ───────────────────────────────────────────────────────────
  const phaseText   = PHASE_RATIONALE[trainingPhase];
  const focusSummary = weeklyFocusLabel(onboardingData.primaryGoal);
  const goalDisplay  = goalHeadline(goalRace, onboardingData.primaryGoal);

  // ── Adaptation ───────────────────────────────────────────────────────────
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

  // ── Coach card ────────────────────────────────────────────────────────────
  const { weeklySummary } = generateCoachingOutput({
    athleteName:      'Athlete',
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
    isRestDay:        isCurrentRestDay,
    isTodayComplete:  false,
    acwr:             acwrResult.acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    historyWeeks:     weeklySummaries.length,
    consistencyScore,
    fatigueSlope,
    recoverySlope,
    weeksRemaining:   weeksToRace,
  });

  return (
    <ScreenLayout title="Running">

      {/* ── Readiness ── */}
      <RunningReadinessCard
        fatigue={fatigueScore}
        recovery={recoveryScore}
        soreness={checkedIn ? todayCheckIn!.soreness : null}
        acwr={acwrResult.acwr}
        isRestDay={isCurrentRestDay}
        weeksToRace={weeksToRace}
      />

      {/* ── Goal label ── */}
      <Card style={styles.goalCard}>
        <Text style={styles.goalLabel}>GOAL</Text>
        <Text style={styles.goalText}>{goalDisplay}</Text>
      </Card>

      {/* ── Week overview + explanation ── */}
      <RunningWeekCard
        phase={trainingPhase}
        currentWeek={currentWeek}
        totalMileage={canonicalWeek.totalMileage}
        sessionCount={richWeek.workouts.length}
        completedCount={completedThisWeek}
        keyWorkout={keyWorkout?.title ?? 'Easy Run'}
        longRunDay={longRunDay}
        focusSummary={focusSummary}
        phaseRationale={phaseText.rationale}
        weekPriority={phaseText.priority}
        isDeloadWeek={trainingPhase === 'deload'}
      />

      {/* ── Adaptation card ── */}
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

      {/* ── Coach summary ── */}
      <WeeklyCoachCard summary={weeklySummary} />

      {/* ── Ordered workout list with day/date labels ── */}
      <Text style={styles.workoutsHeader}>THIS WEEK'S RUNS</Text>

      {richWeek.workouts.map((workout, index) => {
        const completionKey = `w${currentWeek}_${workout.id}_${index}`;
        const isComplete    = completedWorkouts.includes(completionKey);
        const assignedDate  = workoutDates[index];
        const isToday       = assignedDate
          ? assignedDate.toDateString() === new Date().toDateString()
          : false;

        const dayLabel = assignedDate
          ? `${WEEKDAY_LABELS[assignedDate.getDay()]} ${assignedDate.getMonth() + 1}/${assignedDate.getDate()}`
          : `Session ${index + 1}`;

        // Determine pairings
        const pairs: string[] = [];
        if (workout.type === 'easy_run' && index < richWeek.workouts.length - 1) {
          const next = richWeek.workouts[index + 1];
          if (next?.type === 'strides') pairs.push('+ Strides after');
        }
        if (workout.intensity === 'hard' || workout.type === 'long_run') {
          pairs.push('+ Strength day tomorrow');
        }

        return (
          <View key={completionKey} style={styles.workoutBlock}>
            {/* Day header */}
            <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {isToday ? `TODAY · ${dayLabel}` : dayLabel}
              </Text>
              {isComplete && <Text style={styles.doneTag}>✓ Done</Text>}
            </View>

            {/* Workout card */}
            <TouchableOpacity
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

            {/* Pairing hints */}
            {pairs.length > 0 && (
              <View style={styles.pairRow}>
                {pairs.map(p => (
                  <View key={p} style={styles.pairChip}>
                    <Text style={styles.pairTxt}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    marginBottom: spacing.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  goalText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    flex:       1,
  },
  workoutsHeader: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    marginBottom:  spacing.sm,
    marginTop:     spacing.xs,
  },
  workoutBlock: {
    marginBottom: spacing.cardGap,
  },
  dayHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    marginBottom:      spacing.xs,
  },
  dayHeaderToday: {
    backgroundColor: colors.primaryDim,
    borderRadius:    6,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  dayLabel: {
    color:         colors.textDim,
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayLabelToday: {
    color: colors.primary,
  },
  doneTag: {
    color:      colors.positive,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  pairRow: {
    flexDirection:     'row',
    gap:               spacing.xs,
    paddingHorizontal: spacing.lg,
    marginTop:         spacing.xs,
  },
  pairChip: {
    backgroundColor: colors.border,
    borderRadius:    12,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  pairTxt: {
    color:    colors.textDim,
    fontSize: FontSize.xs,
  },
});
