import type { TrainingPhase, ProgressionLevel } from '../../types/training';

export type QualityRung =
  | 'easy'
  | 'strides'
  | 'gentle_fartlek'
  | 'hills'
  | 'tempo_threshold'
  | 'intervals'
  | 'norwegian_4x4';

export type QualityExposureInput = {
  progressionLevel: ProgressionLevel;
  phase: TrainingPhase;
  planWeek: number;
  recentConsistentWeeks: number;
  daysSinceLastQuality?: number;
  lastCompletedRung?: QualityRung;
  athleteHistoryRung?: QualityRung;
  readinessScore?: number;
  hasCurrentSymptoms?: boolean;
};

export type QualityExposureDecision = {
  allowed: boolean;
  recommendedRung: QualityRung;
  targetCadenceDays: [number, number];
  rationale: string;
};

export const QUALITY_LADDER: readonly QualityRung[] = [
  'easy',
  'strides',
  'gentle_fartlek',
  'hills',
  'tempo_threshold',
  'intervals',
  'norwegian_4x4',
];

const PHASE_CEILING: Record<TrainingPhase, QualityRung> = {
  foundation: 'easy',
  base: 'strides',
  aerobic_development: 'gentle_fartlek',
  threshold: 'tempo_threshold',
  vo2: 'intervals',
  race_specific: 'intervals',
  build: 'tempo_threshold',
  peak: 'intervals',
  deload: 'strides',
  taper: 'strides',
  transition: 'easy',
  recovery: 'easy',
};

function rungIndex(rung: QualityRung): number {
  return QUALITY_LADDER.indexOf(rung);
}

function minRung(a: QualityRung, b: QualityRung): QualityRung {
  return rungIndex(a) <= rungIndex(b) ? a : b;
}

export function nextQualityRung(input: QualityExposureInput): QualityExposureDecision {
  const targetCadenceDays: [number, number] = [7, 10];
  if (input.planWeek <= 1) {
    return { allowed: false, recommendedRung: 'easy', targetCadenceDays, rationale: 'Week 1 stays easy; formal quality is not introduced in the first week of a plan or rebuild.' };
  }
  if (input.hasCurrentSymptoms) {
    return { allowed: false, recommendedRung: 'easy', targetCadenceDays, rationale: 'Current symptoms keep the next exposure easy until the athlete can train normally again.' };
  }
  if ((input.readinessScore ?? 70) < 55) {
    return { allowed: false, recommendedRung: 'easy', targetCadenceDays, rationale: 'Readiness is low, so quality exposure is held.' };
  }
  if (input.daysSinceLastQuality !== undefined && input.daysSinceLastQuality < targetCadenceDays[0]) {
    return { allowed: false, recommendedRung: 'easy', targetCadenceDays, rationale: 'Quality exposure is targeted about every 7–10 days, not stacked inside the same week.' };
  }

  const historyIndex = Math.max(
    rungIndex(input.lastCompletedRung ?? 'easy'),
    input.progressionLevel === 'beginner' ? 0 : rungIndex(input.athleteHistoryRung ?? 'strides'),
  );
  const candidate = QUALITY_LADDER[Math.min(historyIndex + 1, QUALITY_LADDER.length - 1)]!;
  const capped = minRung(candidate, PHASE_CEILING[input.phase]);
  const beginnerCapped = input.progressionLevel === 'beginner' ? minRung(capped, 'gentle_fartlek') : capped;
  return {
    allowed: beginnerCapped !== 'easy',
    recommendedRung: beginnerCapped,
    targetCadenceDays,
    rationale: `Next quality exposure is ${beginnerCapped.replace(/_/g, ' ')} based on the ladder and current phase ceiling.`,
  };
}
