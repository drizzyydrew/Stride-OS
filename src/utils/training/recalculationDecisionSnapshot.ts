import type { Activity } from '../../types/activity';
import { calculateACWR, activitiesToACWRRecords } from './index';
import type { ACWRResult } from './calculateACWR';
import { makeWeeklyTrainingDecision } from './trainingDecisionEngine';

export type RecalculationDecisionSnapshot = {
  decision: string;
  phase: string;
  focus: string;
  rationale: string;
  flags: string[];
  confidence: 'low' | 'moderate' | 'high';
  updatedAt: number;
};

export type RecalculationSnapshotResult = {
  acwr: ACWRResult;
  decisionSnapshot: RecalculationDecisionSnapshot;
};

function finiteAverage(values: readonly number[]): number | undefined {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : undefined;
}

export function buildRecalculationDecisionSnapshot(
  activities: readonly Activity[],
  updatedAt = Date.now(),
): RecalculationSnapshotResult {
  const acwr = calculateACWR(activitiesToACWRRecords(activities));
  const completed = activities.filter(activity => activity.status === 'completed').length;
  const skipped = activities.filter(activity => activity.status === 'skipped' || activity.completionClassification === 'skipped').length;
  const partial = activities.filter(activity => activity.status === 'partial' || activity.completionClassification === 'partial').length;
  const stopped = activities.filter(activity => activity.completionClassification === 'stopped_early').length;
  const averageRpe = finiteAverage(
    activities.map(activity => activity.rpe).filter((value): value is number => typeof value === 'number'),
  );

  const decision = makeWeeklyTrainingDecision({
    // Phase 12 can feed richer live plan context into this same pure builder.
    // Until then, the snapshot remains conservative and intentionally compact.
    phase: 'base',
    currentWeek: 1,
    progressionLevel: 'intermediate',
    plannedSessionCount: Math.max(1, completed + skipped + partial + stopped),
    completedSessionCount: completed,
    missedSessionCount: skipped,
    partialSessionCount: partial,
    stoppedEarlyCount: stopped,
    averageRpe,
    acwr: acwr.acwr,
    activities,
  });

  return {
    acwr,
    decisionSnapshot: {
      decision: decision.decision,
      phase: decision.phase,
      focus: decision.focus,
      rationale: decision.rationale,
      flags: decision.flags,
      confidence: decision.confidence,
      updatedAt,
    },
  };
}
