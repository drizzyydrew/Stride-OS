import { useAthleteStore } from '../../../src/store/athleteStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useCheckInStore } from '../../../src/store/checkInStore';

import {
  getLast7DaysLoad,
  getLast30DaysLoad,
  getWeeklyMileage,
  getTrainingDistribution,
  getWeeklyFatigueTrend,
  getWeeklyRecoveryTrend,
} from '../../../src/utils/historyUtils';
import { calculateACWR } from '../../../src/utils/training';
import {
  computeAnalytics,
  computeSlope,
  computeTrendDirection,
  computeConsistency,
  classifyACWR,
} from '../../../src/utils/analyticsEngine';
import { generateForecast } from '../../../src/utils/forecastEngine';
import { generateCoachingOutput } from '../../../src/utils/coachEngine';
import { analyzeTimeline } from '../../../src/utils/timelineEngine';
import { computePeriodization } from '../../../src/utils/periodizationEngine';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import TrendCard from '../../../src/components/analytics/TrendCard';
import BarChartCard from '../../../src/components/analytics/BarChartCard';
import LoadBalanceCard from '../../../src/components/analytics/LoadBalanceCard';
import PhaseProgressCard from '../../../src/components/analytics/PhaseProgressCard';
import LoadWindowCard from '../../../src/components/analytics/LoadWindowCard';
import IntensityDistributionCard from '../../../src/components/analytics/IntensityDistributionCard';
import RaceForecastCard from '../../../src/components/analytics/RaceForecastCard';
import ReadinessForecastCard from '../../../src/components/analytics/ReadinessForecastCard';
import RaceReadinessCard from '../../../src/components/coaching/RaceReadinessCard';
import ReadinessTimelineCard from '../../../src/components/analytics/ReadinessTimelineCard';
import TrendInterpretationCard from '../../../src/components/analytics/TrendInterpretationCard';
import TimelineSignalsCard from '../../../src/components/analytics/TimelineSignalsCard';
import MacrocycleTimelineCard from '../../../src/components/analytics/MacrocycleTimelineCard';
import WeeklyLoadTargetsCard from '../../../src/components/analytics/WeeklyLoadTargetsCard';
import PeriodizationSummaryCard from '../../../src/components/analytics/PeriodizationSummaryCard';

import type { MetricTrend, TrendSeverity, DataPoint } from '../../../src/types/analytics';

// ─── Local helpers ────────────────────────────────────────────────────────────

function buildMetricTrend(
  series:   DataPoint[],
  current:  number,
  severity: TrendSeverity,
): MetricTrend {
  const values   = series.map(p => p.value);
  const slope    = computeSlope(values);
  const previous = values.at(-2) ?? current;
  return {
    current,
    previous,
    direction:     computeTrendDirection(slope),
    severity,
    slope:         Math.round(slope * 100) / 100,
    changePercent: previous !== 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : 0,
  };
}

function fatigueSeverity(f: number): TrendSeverity {
  return f > 75 ? 'critical' : f > 55 ? 'warning' : f > 35 ? 'neutral' : 'positive';
}

function recoverySeverity(r: number): TrendSeverity {
  return r >= 80 ? 'positive' : r >= 60 ? 'neutral' : r >= 40 ? 'warning' : 'critical';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const {
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    currentWeek,
    trainingPhase,
    progressionLevel,
    goalRace,
    vo2Estimate,
  } = useAthleteStore();

  const { history } = useWorkoutStore();
  const postWorkoutNotes = useCheckInStore(s => s.postWorkoutNotes);

  // Plan-level metrics — phase progress, plan length, consistency projection.
  // These are always derived from the periodization engine (no history required).
  const analytics = computeAnalytics({
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    currentWeek,
    trainingPhase,
    progressionLevel,
    goalRace,
  });

  // ── History-derived data ────────────────────────────────────────────────────

  const load7d  = getLast7DaysLoad(history);
  const load30d = getLast30DaysLoad(history);
  const dist    = getTrainingDistribution(history, 30);

  // Weekly mileage from actual completed workouts
  const weeklySummaries = getWeeklyMileage(history);
  const mileagePoints   = weeklySummaries.map(s => ({ week: s.week, value: s.totalMiles }));

  // ACWR from real history using ATL (7-day) / CTL (42-day) time constants
  const acwrResult = calculateACWR(history);
  const trainingLoad = {
    acute:        acwrResult.acute,
    chronic:      acwrResult.chronic,
    acwr:         acwrResult.acwr,
    acwrSeverity: classifyACWR(acwrResult.acwr),
  };

  // ── Trend series ────────────────────────────────────────────────────────────
  // When ≥ 2 weeks of history exist, build real trends from stored snapshots.
  // Fall back to synthetic projections for first-run experience.

  const weeklyFatigue  = getWeeklyFatigueTrend(history);
  const weeklyRecovery = getWeeklyRecoveryTrend(history);
  const hasRealTrend   = weeklyFatigue.length >= 2;

  const fatigueTrend = hasRealTrend
    ? buildMetricTrend(weeklyFatigue,  fatigueScore,  fatigueSeverity(fatigueScore))
    : analytics.fatigueMetric;

  const recoveryTrend = hasRealTrend
    ? buildMetricTrend(weeklyRecovery, recoveryScore, recoverySeverity(recoveryScore))
    : analytics.recoveryMetric;

  // ── Forecast inputs ─────────────────────────────────────────────────────────

  // Adherence: completed sessions / (currentWeek × 6 expected sessions per week).
  // Capped at 1.0 — can't exceed 100% even if some weeks had bonus sessions.
  const adherenceRate = Math.min(
    1,
    history.length / Math.max(1, currentWeek * 6),
  );

  // Long run consistency: fraction of training weeks that included a long_run.
  const weeksWithLongRun = new Set(
    history.filter(r => r.type === 'long_run').map(r => r.week),
  ).size;
  const longRunConsistency = currentWeek > 0 ? weeksWithLongRun / currentWeek : 0;

  // Easy proportion from intensity distribution (last 30 days).
  const totalIntensity =
    (dist.byIntensity.easy      ?? 0) +
    (dist.byIntensity.very_easy ?? 0) +
    (dist.byIntensity.moderate  ?? 0) +
    (dist.byIntensity.hard      ?? 0) +
    (dist.byIntensity.max       ?? 0);
  const easyProportion = totalIntensity > 0
    ? ((dist.byIntensity.easy ?? 0) + (dist.byIntensity.very_easy ?? 0)) / totalIntensity
    : 0.80;

  const consistencyScore = computeConsistency(weeklySummaries.map(s => s.totalMiles));

  const { raceReadiness } = generateCoachingOutput({
    athleteName:       'Athlete',
    goalRace,
    currentWeek,
    trainingPhase,
    progressionLevel,
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    soreness:          null,
    motivation:        null,
    checkedIn:         false,
    todayWorkoutType:  'easy_run',
    isRestDay:         false,
    isTodayComplete:   false,
    acwr:              acwrResult.acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    historyWeeks:      weeklySummaries.length,
    consistencyScore,
    fatigueSlope:      fatigueTrend.slope,
    recoverySlope:     recoveryTrend.slope,
    weeksRemaining:    analytics.weeksRemaining,
  });

  // ── Longitudinal timeline analysis ─────────────────────────────────────────
  const timeline = analyzeTimeline(history, postWorkoutNotes, {
    trainingPhase,
    currentWeek,
    fatigueScore,
    recoveryScore,
  });

  const forecast = generateForecast({
    vdot:               vo2Estimate,
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    currentWeek,
    trainingPhase,
    progressionLevel,
    acwr:               acwrResult.acwr,
    adherenceRate,
    longRunConsistency,
    easyProportion,
    fatigueSlope:       fatigueTrend.slope,
    recoverySlope:      recoveryTrend.slope,
    historyWeeks:       weeklySummaries.length,
  });

  // ── Periodization engine ────────────────────────────────────────────────────

  const previousWeekMiles = weeklySummaries.length >= 2
    ? weeklySummaries[weeklySummaries.length - 2].totalMiles
    : 0;

  const oneWeekAgo           = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentHardSessions   = history.filter(
    r => r.timestamp >= oneWeekAgo && (r.intensity === 'hard' || r.intensity === 'max'),
  ).length;

  const periodization = computePeriodization({
    weeklyMileage,
    currentWeek,
    trainingPhase,
    progressionLevel,
    goalRace,
    acwr:               acwrResult.acwr,
    fatigueScore,
    recoveryScore,
    adherenceRate,
    weeksRemaining:     analytics.weeksRemaining,
    previousWeekMiles,
    recentHardSessions,
  });

  return (
    <ScreenLayout title="Analytics">

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <PhaseProgressCard
        phase={trainingPhase}
        planProgress={analytics.planProgress}
        currentWeek={currentWeek}
        totalWeeks={analytics.totalWeeks}
        weeksRemaining={analytics.weeksRemaining}
      />

      {/* ── Load ─────────────────────────────────────────────────────────── */}
      <LoadWindowCard load7d={load7d} load30d={load30d} />

      {/* ── Readiness ────────────────────────────────────────────────────── */}
      <TrendCard
        label="Recovery"
        value={recoveryScore}
        trend={recoveryTrend}
      />

      <TrendCard
        label="Fatigue"
        value={fatigueScore}
        trend={fatigueTrend}
      />

      <LoadBalanceCard load={trainingLoad} />

      {/* ── Volume ───────────────────────────────────────────────────────── */}
      {mileagePoints.length > 0 ? (
        <BarChartCard
          label="Weekly Mileage"
          data={mileagePoints}
          unit=" mi"
          barColor="#1E3A8A"
          highlightColor="#2563EB"
          helper="Miles per training week from completed workouts."
        />
      ) : null}

      {/* ── Distribution ─────────────────────────────────────────────────── */}
      <IntensityDistributionCard distribution={dist} />

      {/* ── Forecast ─────────────────────────────────────────────────────── */}
      <RaceForecastCard
        predictions={forecast.racePredictions}
        confidence={forecast.overallConfidence}
      />

      <ReadinessForecastCard
        readiness={forecast.readinessForecast}
        fatigue={forecast.fatigueTrajectory}
        risk={forecast.overreachingRisk}
      />

      {/* ── Race readiness ────────────────────────────────────────────────── */}
      <RaceReadinessCard readiness={raceReadiness} />

      {/* ── Periodization ────────────────────────────────────────────────── */}
      <MacrocycleTimelineCard
        currentWeek={currentWeek}
        totalWeeks={periodization.totalWeeks}
        planPhases={periodization.planPhases}
        raceDistance={periodization.raceDistance}
        mesocycle={periodization.mesocycle}
        baseMileage={weeklyMileage}
      />

      <WeeklyLoadTargetsCard
        targets={periodization.weeklyTargets}
        trainingPhase={trainingPhase}
        currentMiles={weeklyMileage}
      />

      <PeriodizationSummaryCard
        rationale={periodization.rationale}
        safeguards={periodization.safeguards}
        integrityFlags={periodization.integrityFlags}
        mesocycle={periodization.mesocycle}
        trainingPhase={trainingPhase}
        weeksRemaining={analytics.weeksRemaining}
      />

      {/* ── Longitudinal timeline ─────────────────────────────────────────── */}
      <ReadinessTimelineCard analysis={timeline} />
      <TrendInterpretationCard analysis={timeline} />
      <TimelineSignalsCard signals={timeline.signals} />

    </ScreenLayout>
  );
}
