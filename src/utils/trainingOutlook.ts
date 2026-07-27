import type { Activity } from '../types/activity';
import type { ReadinessLabel } from '../types/readiness';
import type { TrainingPhase } from '../types/training';
import { calculateActivityLoadTrend, type ActivityLoadTrend } from './activityLoad';
import type { RecalculationDecisionSnapshot } from './training/recalculationDecisionSnapshot';

export type OutlookStatus =
  | 'building_foundation'
  | 'on_track'
  | 'progressing_cautiously'
  | 'maintaining'
  | 'recovery_needed'
  | 'plan_adjustment_needed'
  | 'ready_for_current_goal'
  | 'insufficient_history';

export type LoadState =
  | 'recovering'
  | 'stable'
  | 'building'
  | 'ramping_quickly'
  | 'deloading'
  | 'returning'
  | 'insufficient_data';

export type TrainingOutlookInput = {
  activities: readonly Activity[];
  currentWeek?: number;
  trainingPhase?: TrainingPhase;
  focus?: string;
  weeksToRace?: number;
  readinessLabel?: ReadinessLabel;
  readinessScore?: number;
  decisionSnapshot?: RecalculationDecisionSnapshot;
  now?: number;
};

export type TrainingOutlook = {
  status: OutlookStatus;
  statusLabel: string;
  loadState: LoadState;
  loadStateLabel: string;
  message: string;
  recommendation: string;
  focus: string | null;
  confidence: 'limited' | 'moderate' | 'strong';
  historyWeeks: number;
  completedActivities: number;
  loadTrend: ActivityLoadTrend;
  dateClaimAllowed: boolean;
  generatedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<OutlookStatus, string> = {
  building_foundation: 'Building Foundation',
  on_track: 'On Track',
  progressing_cautiously: 'Progressing Carefully',
  maintaining: 'Maintaining',
  recovery_needed: 'Recovery Needed',
  plan_adjustment_needed: 'Plan Adjustment Needed',
  ready_for_current_goal: 'Ready for Current Goal',
  insufficient_history: 'Building Your Baseline',
};

const LOAD_LABEL: Record<LoadState, string> = {
  recovering: 'Recovering',
  stable: 'Stable',
  building: 'Building',
  ramping_quickly: 'Ramping Quickly',
  deloading: 'Deloading',
  returning: 'Returning',
  insufficient_data: 'Need More Data',
};

function completedActivities(activities: readonly Activity[], now: number): Activity[] {
  return activities.filter(activity => activity.status !== 'skipped' && activity.startTime <= now);
}

export function estimateHistoryWeeks(activities: readonly Activity[], now = Date.now()): number {
  const completed = completedActivities(activities, now);
  if (completed.length === 0) return 0;
  const oldest = Math.min(...completed.map(activity => activity.startTime));
  return Math.max(1, Math.ceil((now - oldest) / (7 * DAY_MS)));
}

function confidenceFor(historyWeeks: number, completedCount: number): TrainingOutlook['confidence'] {
  if (historyWeeks >= 8 && completedCount >= 16) return 'strong';
  if (historyWeeks >= 4 && completedCount >= 8) return 'moderate';
  return 'limited';
}

function deriveLoadState(input: {
  trend: ActivityLoadTrend;
  historyWeeks: number;
  completedCount: number;
  trainingPhase?: TrainingPhase;
  decision?: string;
}): LoadState {
  if (input.historyWeeks < 2 || input.completedCount < 3) return 'insufficient_data';
  if (input.decision === 'repeat') return 'returning';
  if (input.trainingPhase === 'deload' || input.trainingPhase === 'taper' || input.trainingPhase === 'recovery') return 'deloading';

  if (input.trend.ratio >= 1.5) return 'ramping_quickly';
  if (input.trend.ratio >= 1.15) return 'building';
  if (input.trend.ratio < 0.75) return 'recovering';
  return 'stable';
}

function deriveStatus(input: {
  historyWeeks: number;
  completedCount: number;
  loadState: LoadState;
  readinessLabel?: ReadinessLabel;
  readinessScore?: number;
  currentWeek: number;
  trainingPhase?: TrainingPhase;
  weeksToRace: number;
  decision?: string;
  confidence: TrainingOutlook['confidence'];
}): OutlookStatus {
  if (input.historyWeeks < 2 || input.completedCount < 3) return 'insufficient_history';
  if (input.decision === 'rebuild' || input.decision === 'regress') return 'plan_adjustment_needed';
  if (input.readinessLabel === 'Recovery Recommended' || (input.readinessScore ?? 100) < 45) return 'recovery_needed';
  if (input.loadState === 'ramping_quickly') return 'progressing_cautiously';
  if (input.currentWeek <= 2 || input.trainingPhase === 'foundation') return 'building_foundation';
  if (input.weeksToRace <= 2 && input.confidence !== 'limited' && input.readinessLabel === 'Ready to Train') return 'ready_for_current_goal';
  if (input.decision === 'deload' || input.trainingPhase === 'deload' || input.loadState === 'recovering') return 'maintaining';
  return 'on_track';
}

function messageFor(status: OutlookStatus, loadState: LoadState, focus: string | null): string {
  if (status === 'insufficient_history') return 'StrideOS is collecting enough completed training to make this outlook more specific.';
  if (status === 'recovery_needed') return 'Recent readiness or training signals suggest recovery should lead today’s decision.';
  if (status === 'plan_adjustment_needed') return 'Your recent training pattern suggests the plan should be reviewed before adding more load.';
  if (status === 'progressing_cautiously') return 'Training is building quickly, so keep easy sessions easy and avoid stacking intensity.';
  if (status === 'building_foundation') return focus ? `This week is focused on ${focus}. The goal is consistency before bigger progression.` : 'This week is about building a repeatable foundation.';
  if (status === 'ready_for_current_goal') return 'Current signals support the goal you are training toward. Keep the plan controlled.';
  if (status === 'maintaining') return 'This is a good time to absorb training rather than forcing a bigger week.';
  if (loadState === 'building') return 'Training load is building in a controlled range.';
  return 'Current training and recovery signals are generally aligned with the plan.';
}

function recommendationFor(status: OutlookStatus): string {
  switch (status) {
    case 'insufficient_history':
      return 'Keep logging completed sessions so the outlook can become more personalized.';
    case 'recovery_needed':
      return 'Choose recovery or an easier option if today’s workout does not feel controlled.';
    case 'plan_adjustment_needed':
      return 'Use Adapt My Week before trying to make up missed or reduced work.';
    case 'progressing_cautiously':
      return 'Proceed, but avoid adding extra intensity or volume.';
    case 'maintaining':
      return 'Treat this as an absorption week and preserve the plan’s easier days.';
    default:
      return 'Follow today’s workout as written unless readiness or real-life constraints change.';
  }
}

export function buildTrainingOutlook(input: TrainingOutlookInput): TrainingOutlook {
  const now = input.now ?? Date.now();
  const completed = completedActivities(input.activities, now);
  const historyWeeks = estimateHistoryWeeks(input.activities, now);
  const loadTrend = calculateActivityLoadTrend([...input.activities], 'wholeBody', now);
  const confidence = confidenceFor(historyWeeks, completed.length);
  const decision = input.decisionSnapshot?.decision;
  const loadState = deriveLoadState({
    trend: loadTrend,
    historyWeeks,
    completedCount: completed.length,
    trainingPhase: input.trainingPhase,
    decision,
  });
  const currentWeek = Math.max(0, Math.round(input.currentWeek ?? 0));
  const weeksToRace = Math.max(0, Math.round(input.weeksToRace ?? 999));
  const focus = input.focus?.trim() || null;
  const status = deriveStatus({
    historyWeeks,
    completedCount: completed.length,
    loadState,
    readinessLabel: input.readinessLabel,
    readinessScore: input.readinessScore,
    currentWeek,
    trainingPhase: input.trainingPhase,
    weeksToRace,
    decision,
    confidence,
  });

  return {
    status,
    statusLabel: STATUS_LABEL[status],
    loadState,
    loadStateLabel: LOAD_LABEL[loadState],
    message: messageFor(status, loadState, focus),
    recommendation: recommendationFor(status),
    focus,
    confidence,
    historyWeeks,
    completedActivities: completed.length,
    loadTrend,
    dateClaimAllowed: confidence === 'strong' && historyWeeks >= 8,
    generatedAt: now,
  };
}
