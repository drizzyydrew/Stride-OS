import type { Activity } from '../types/activity';

export type AdaptivePerformanceMetric = {
  id: 'aero' | 'ana' | 'proc';
  title: string;
  subtitle: string;
  score: number | null;
  status: string;
  explanation: string;
  ranges: { label: string; range: string; active: boolean }[];
};

export type AdaptivePerformanceModel = {
  completedWorkoutCount: number;
  ready: boolean;
  overallScore: number | null;
  caption: string;
  metrics: AdaptivePerformanceMetric[];
};

const MIN_WORKOUTS_FOR_ASSESSMENT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function rangeFor(score: number, ranges: { label: string; range: string; min: number; max: number }[]) {
  return ranges.map(range => ({
    label: range.label,
    range: range.range,
    active: score >= range.min && score <= range.max,
  }));
}

export function buildAdaptivePerformanceModel(activities: readonly Activity[], now = Date.now()): AdaptivePerformanceModel {
  const completed = activities
    .filter(activity => activity.status === 'completed')
    .sort((a, b) => b.startTime - a.startTime);
  const completedWorkoutCount = completed.length;

  if (completedWorkoutCount < MIN_WORKOUTS_FOR_ASSESSMENT) {
    return {
      completedWorkoutCount,
      ready: false,
      overallScore: null,
      caption: `Log ${MIN_WORKOUTS_FOR_ASSESSMENT - completedWorkoutCount} more workout${MIN_WORKOUTS_FOR_ASSESSMENT - completedWorkoutCount === 1 ? '' : 's'} before StrideOS scores this.`,
      metrics: baseMetrics(null),
    };
  }

  const recent = completed.filter(activity => now - activity.startTime <= 42 * DAY_MS);
  const runLike = recent.filter(activity => activity.activityType === 'running' || activity.activityType === 'walking');
  const hardSessions = recent.filter(activity => (activity.rpe ?? 0) >= 7 || (activity.trainingLoad?.running ?? 0) >= 45);
  const strengthSessions = recent.filter(activity => activity.activityType === 'strength').length;
  const activeDays = new Set(recent.map(activity => new Date(activity.startTime).toISOString().slice(0, 10))).size;
  const weeklyDistanceMiles = runLike.reduce((sum, activity) => sum + ((activity.metrics.distanceMeters ?? 0) / 1609.344), 0) / 6;
  const weeklyMinutes = recent.reduce((sum, activity) => sum + ((activity.metrics.durationSeconds ?? 0) / 60), 0) / 6;
  const averageRpe = recent.reduce((sum, activity) => sum + (activity.rpe ?? 5), 0) / Math.max(1, recent.length);

  const aerobic = clamp(Math.round(38 + weeklyDistanceMiles * 1.4 + activeDays * 1.7 + weeklyMinutes * 0.08), 35, 92);
  const anaerobic = clamp(Math.round(35 + hardSessions.length * 7 + Math.max(0, averageRpe - 5) * 8), 30, 88);
  const processing = clamp(Math.round(42 + activeDays * 2.3 + strengthSessions * 4 + Math.min(weeklyDistanceMiles, 35) * 0.65), 35, 90);
  const overallScore = Math.round((aerobic + anaerobic + processing) / 3);

  return {
    completedWorkoutCount,
    ready: true,
    overallScore,
    caption: `Based on ${completedWorkoutCount} completed workouts. This updates as new sessions are logged, edited, or deleted.`,
    metrics: [
      {
        id: 'aero',
        title: 'Aerobic Base',
        subtitle: 'Recent run/walk volume and consistency',
        score: aerobic,
        status: labelFor(aerobic),
        explanation: `${aerobic} = ${labelFor(aerobic)}. This is derived from recent completed workouts, weekly run/walk distance, active days, and duration. It is not a lab VO2 max estimate.`,
        ranges: rangeFor(aerobic, [
          { label: 'BUILDING', range: '0-55', min: 0, max: 55 },
          { label: 'STEADY', range: '56-70', min: 56, max: 70 },
          { label: 'STRONG', range: '71-85', min: 71, max: 85 },
          { label: 'HIGH', range: '86+', min: 86, max: 100 },
        ]),
      },
      {
        id: 'ana',
        title: 'Hard-Effort Capacity',
        subtitle: 'Recent higher-intensity exposure',
        score: anaerobic,
        status: labelFor(anaerobic),
        explanation: `${anaerobic} = ${labelFor(anaerobic)}. This only rises when recent workouts contain real high-effort sessions or running load. It does not fabricate speed capacity.`,
        ranges: rangeFor(anaerobic, [
          { label: 'LIMITED', range: '0-50', min: 0, max: 50 },
          { label: 'MODERATE', range: '51-65', min: 51, max: 65 },
          { label: 'GOOD', range: '66-80', min: 66, max: 80 },
          { label: 'HIGH', range: '81+', min: 81, max: 100 },
        ]),
      },
      {
        id: 'proc',
        title: 'Durability Signal',
        subtitle: 'Consistency plus strength support',
        score: processing,
        status: labelFor(processing),
        explanation: `${processing} = ${labelFor(processing)}. This reflects recent consistency, strength support, and completed activity frequency. It is a planning signal, not an injury prediction.`,
        ranges: rangeFor(processing, [
          { label: 'BUILDING', range: '0-60', min: 0, max: 60 },
          { label: 'GOOD', range: '61-80', min: 61, max: 80 },
          { label: 'ROBUST', range: '81+', min: 81, max: 100 },
        ]),
      },
    ],
  };
}

function baseMetrics(score: number | null): AdaptivePerformanceMetric[] {
  return [
    {
      id: 'aero',
      title: 'Aerobic Base',
      subtitle: 'Needs completed workout history',
      score,
      status: 'Needs data',
      explanation: 'StrideOS needs at least 5 completed workouts before this signal is useful.',
      ranges: [],
    },
    {
      id: 'ana',
      title: 'Hard-Effort Capacity',
      subtitle: 'Needs completed workout history',
      score,
      status: 'Needs data',
      explanation: 'StrideOS needs at least 5 completed workouts before this signal is useful.',
      ranges: [],
    },
    {
      id: 'proc',
      title: 'Durability Signal',
      subtitle: 'Needs completed workout history',
      score,
      status: 'Needs data',
      explanation: 'StrideOS needs at least 5 completed workouts before this signal is useful.',
      ranges: [],
    },
  ];
}

function labelFor(score: number): string {
  if (score >= 86) return 'High';
  if (score >= 71) return 'Strong';
  if (score >= 56) return 'Steady';
  return 'Building';
}
