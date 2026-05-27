import { useState } from 'react';

import { useAthleteStore }       from '../../../src/store/athleteStore';
import { useWorkoutStore }       from '../../../src/store/workoutStore';
import { useCheckInStore }       from '../../../src/store/checkInStore';
import { useAdaptationStore }    from '../../../src/store/adaptationStore';
import { useReadinessThresholds } from '../../../src/store/profileStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';

import LogWorkoutModal from '../../../src/components/shared/LogWorkoutModal';
import OverrideModal   from '../../../src/components/shared/OverrideModal';
import FloatingActionButton from '../../../src/layout/FloatingActionButton';

import { generateTrainingWeek, generateWorkout } from '../../../src/utils/workoutGenerator';
import { generateRecommendation, calculateACWR } from '../../../src/utils/training';
import { ID_TO_GENERATABLE } from '../../../src/utils/training/adaptWeek';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { todayDateKey } from '../../../src/types/checkin';
import {
  getWeeklyMileage,
  getTrainingDistribution,
  getWeeklyFatigueTrend,
  getWeeklyRecoveryTrend,
} from '../../../src/utils/historyUtils';
import {
  computeSlope,
  computeConsistency,
} from '../../../src/utils/analyticsEngine';
import { generateCoachingOutput } from '../../../src/utils/coachEngine';
import { buildPerformanceProfile } from '../../../src/utils/performanceEngine';
import { useMovementStore } from '../../../src/store/movementStore';
import type { GeneratableWorkoutType } from '../../../src/types/training';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import WorkoutCard from '../../../src/components/ui/WorkoutCard';
import PreCheckInCard from '../../../src/components/today/PreCheckInCard';
import ReadinessCard from '../../../src/components/today/ReadinessCard';
import PostWorkoutCard from '../../../src/components/today/PostWorkoutCard';
import RecommendationCard from '../../../src/components/today/RecommendationCard';
import CoachInsightsCard from '../../../src/components/coaching/CoachInsightsCard';
import ActionPlanCard from '../../../src/components/today/ActionPlanCard';
import PerformanceScoreCard from '../../../src/components/performance/PerformanceScoreCard';
import { generateActionPlan } from '../../../src/utils/actionPlanEngine';

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });
}

export default function TodayScreen() {
  const [showLog,          setShowLog]          = useState(false);
  const [showOverride,     setShowOverride]      = useState(false);
  const [pendingOverrideId, setPendingOverrideId] = useState<string | undefined>();

  const {
    goalRace,
    weeklyMileage,
    recoveryScore,
    fatigueScore,
    setFatigueScore,
    setRecentEasyLoad,
    recentEasyLoad,
    currentWeek,
    trainingPhase,
    progressionLevel,
    vo2Estimate,
  } = useAthleteStore();

  const { addLog: addCustomLog, addOverride } = useCustomWorkoutStore();
  const getActiveRiskFlags = useMovementStore(s => s.getActiveRiskFlags);
  const postWorkoutNotes   = useCheckInStore(s => s.postWorkoutNotes);

  function handleLogPress() {
    const isLowReadiness = fatigueScore > 60 || recoveryScore < 50;
    if (isLowReadiness) {
      setShowOverride(true);
    } else {
      setShowLog(true);
    }
  }

  function handleOverrideConfirmed(overrideId: string) {
    setShowOverride(false);
    setPendingOverrideId(overrideId);
    setShowLog(true);
  }

  const { completedWorkouts, completeWorkout, history } = useWorkoutStore();

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();

  const adaptation          = useAdaptationStore(s => s.getAdaptation(currentWeek));
  const readinessThresholds = useReadinessThresholds();
  const { weeksToRace }     = useWeekPlan();

  const generatorInput = {
    weeklyMileage, recoveryScore, fatigueScore,
    goalRace, currentWeek, trainingPhase, progressionLevel,
  };

  const canonicalWeek = generateTrainingWeek(generatorInput);

  // Build the effective workout list — adapted if an adaptation exists, canonical otherwise.
  const effectiveWorkouts = adaptation
    ? adaptation.dayTypes.map(type =>
        generateWorkout(type as GeneratableWorkoutType, generatorInput),
      )
    : canonicalWeek.plannedWorkouts;

  // First uncompleted workout is "today's". Fall back to index 0 when all done.
  // Completion keys always reference the CANONICAL workout id so they survive
  // adaptation recalculations without orphaning prior completions.
  const rawIndex = effectiveWorkouts.findIndex((_, i) => {
    const canonicalId = canonicalWeek.plannedWorkouts[i]?.id ?? effectiveWorkouts[i]!.id;
    return !completedWorkouts.includes(`w${currentWeek}_${canonicalId}_${i}`);
  });
  const todayIndex    = rawIndex === -1 ? 0 : rawIndex;
  const todayWorkout  = effectiveWorkouts[todayIndex]!;
  const canonicalId   = canonicalWeek.plannedWorkouts[todayIndex]?.id ?? todayWorkout.id;
  const completionKey = `w${currentWeek}_${canonicalId}_${todayIndex}`;
  const isComplete    = completedWorkouts.includes(completionKey);
  const isRestDay     = todayWorkout.type === 'rest';

  // ── Coach intelligence inputs ──────────────────────────────────────────────
  const acwrResult         = calculateACWR(history);
  const weeklySummaries    = getWeeklyMileage(history);
  const dist               = getTrainingDistribution(history, 30);
  const weeklyFatigueTrend = getWeeklyFatigueTrend(history);
  const weeklyRecovery     = getWeeklyRecoveryTrend(history);

  const fatigueSlope  = weeklyFatigueTrend.length >= 2
    ? computeSlope(weeklyFatigueTrend.map(p => p.value))
    : 0;
  const recoverySlope = weeklyRecovery.length >= 2
    ? computeSlope(weeklyRecovery.map(p => p.value))
    : 0;

  const totalIntensity =
    (dist.byIntensity.easy      ?? 0) +
    (dist.byIntensity.very_easy ?? 0) +
    (dist.byIntensity.moderate  ?? 0) +
    (dist.byIntensity.hard      ?? 0) +
    (dist.byIntensity.max       ?? 0);
  const easyCount = (dist.byIntensity.easy ?? 0) + (dist.byIntensity.very_easy ?? 0);
  const easyProportion = totalIntensity > 0 ? easyCount / totalIntensity : 0.80;

  const weeksWithLongRun = new Set(
    history.filter(r => r.type === 'long_run').map(r => r.week),
  ).size;
  const longRunConsistency = currentWeek > 0 ? weeksWithLongRun / currentWeek : 0;

  const adherenceRate      = Math.min(1, history.length / Math.max(1, currentWeek * 6));
  const consistencyScore   = computeConsistency(weeklySummaries.map(s => s.totalMiles));

  const { todayInsights } = generateCoachingOutput({
    athleteName:       'Athlete',
    goalRace,
    currentWeek,
    trainingPhase,
    progressionLevel,
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    soreness:          checkedIn ? todayCheckIn!.soreness   : null,
    motivation:        checkedIn ? todayCheckIn!.motivation : null,
    checkedIn,
    todayWorkoutType:  todayWorkout.type,
    isRestDay,
    isTodayComplete:   isComplete,
    acwr:              acwrResult.acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    historyWeeks:      weeklySummaries.length,
    consistencyScore,
    fatigueSlope,
    recoverySlope,
    weeksRemaining:    weeksToRace,
  });

  const actionPlan = generateActionPlan(todayInsights, {
    currentWeek,
    fatigueScore,
    recoveryScore,
    acwr:            acwrResult.acwr,
    trainingPhase,
    isRestDay,
    checkedIn,
    isTodayComplete: isComplete,
  });

  const recommendation = generateRecommendation({
    recoveryScore,
    fatigueScore,
    weeklyMileage,
    trainingPhase,
    progressionLevel,
    soreness:             checkedIn ? todayCheckIn!.soreness   : null,
    motivation:           checkedIn ? todayCheckIn!.motivation : null,
    plannedType:          todayWorkout.type,
    plannedIntensity:     todayWorkout.intensity,
    plannedDuration:      todayWorkout.durationMinutes,
    history,
    readinessThresholds,
  });

  const activeRiskFlags = getActiveRiskFlags().map(f => ({
    severity:      f.severity,
    affectsScores: f.affectsScores as string[],
  }));

  const performanceProfile = buildPerformanceProfile({
    history,
    fatigueScore,
    recoveryScore,
    weeklyMileage,
    vdot:           vo2Estimate > 0 ? vo2Estimate : undefined,
    activeRiskFlags,
    checkInCount:   postWorkoutNotes.length,
  });

  return (
    <ScreenLayout
      title="Today"
      meta={formatDate()}
      fab={<FloatingActionButton icon="add" onPress={handleLogPress} />}
    >

      {checkedIn ? (
        <ReadinessCard
          recoveryScore={recoveryScore}
          fatigueScore={fatigueScore}
          trainingPhase={trainingPhase}
          soreness={todayCheckIn!.soreness}
          motivation={todayCheckIn!.motivation}
        />
      ) : (
        <PreCheckInCard />
      )}

      <RecommendationCard rec={recommendation} checkedIn={checkedIn} />

      <CoachInsightsCard insights={todayInsights} />

      <ActionPlanCard actions={actionPlan} />

      <WorkoutCard
        workout={todayWorkout}
        isComplete={isComplete}
        onComplete={() =>
          completeWorkout(
            completionKey,
            todayWorkout,
            currentWeek,
            fatigueScore,
            recoveryScore,
            setFatigueScore,
            setRecentEasyLoad,
          )
        }
      />

      {isComplete && !isRestDay && (
        <PostWorkoutCard completionKey={completionKey} />
      )}

      <PerformanceScoreCard profile={performanceProfile} compact />

      <OverrideModal
        visible={showOverride}
        onClose={() => setShowOverride(false)}
        onConfirmed={handleOverrideConfirmed}
        fatigueScore={fatigueScore}
        recoveryScore={recoveryScore}
        addOverride={addOverride}
      />

      <LogWorkoutModal
        visible={showLog}
        onClose={() => { setShowLog(false); setPendingOverrideId(undefined); }}
        onSaved={() => { setShowLog(false); setPendingOverrideId(undefined); }}
        onAddLog={addCustomLog}
        currentFatigue={fatigueScore}
        currentRecovery={recoveryScore}
        recentEasyLoad={recentEasyLoad}
        setFatigueScore={setFatigueScore}
        setRecentEasyLoad={setRecentEasyLoad}
        overrideId={pendingOverrideId}
      />

    </ScreenLayout>
  );
}
