import type { Activity } from '../../types/activity';
import type { TrainingFocus, TrainingPhase, ProgressionLevel, GoalType } from '../../types/training';
import type { TrainingLoadDecision } from './deloadModel';
import { resolveDeloadDecision } from './deloadModel';

export type WeeklyTrainingDecisionInput = {
  phase: TrainingPhase;
  focus?: TrainingFocus;
  progressionLevel: ProgressionLevel;
  goalType?: GoalType | string;
  currentWeek: number;
  plannedSessionCount: number;
  completedSessionCount: number;
  availableTrainingDays?: number;
  missedSessionCount?: number;
  partialSessionCount?: number;
  stoppedEarlyCount?: number;
  averageRpe?: number;
  readinessScore?: number;
  readinessLabel?: string;
  acwr?: number;
  recentHardSessions?: number;
  consistencyWeeks?: number;
  interruptions?: number;
  daysToEvent?: number;
  activities?: readonly Activity[];
};

export type WeeklyTrainingDecision = {
  decision: TrainingLoadDecision;
  phase: TrainingPhase;
  focus: TrainingFocus;
  confidence: 'low' | 'moderate' | 'high';
  rationale: string;
  flags: string[];
  simultaneousLoadIncreaseAllowed: boolean;
};

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function focusForPhase(phase: TrainingPhase): TrainingFocus {
  switch (phase) {
    case 'foundation':
    case 'base':
    case 'aerobic_development':
      return 'Aerobic Capacity';
    case 'threshold':
      return 'Threshold';
    case 'vo2':
      return 'VO₂ Max';
    case 'race_specific':
    case 'peak':
    case 'taper':
      return 'Race Specific';
    case 'build':
      return 'Running Economy';
    case 'deload':
    case 'transition':
    case 'recovery':
      return 'Recovery';
  }
}

function activityCounts(activities: readonly Activity[] | undefined): {
  partial: number;
  stopped: number;
  missed: number;
  completed: number;
} {
  const base = { partial: 0, stopped: 0, missed: 0, completed: 0 };
  if (!activities) return base;
  return activities.reduce((acc, activity) => {
    if (activity.status === 'completed') acc.completed += 1;
    if (activity.completionClassification === 'partial' || activity.status === 'partial') acc.partial += 1;
    if (activity.completionClassification === 'stopped_early') acc.stopped += 1;
    if (activity.completionClassification === 'skipped' || activity.status === 'skipped') acc.missed += 1;
    return acc;
  }, base);
}

export function makeWeeklyTrainingDecision(input: WeeklyTrainingDecisionInput): WeeklyTrainingDecision {
  const counts = activityCounts(input.activities);
  const planned = Math.max(0, Math.round(finite(input.plannedSessionCount) ?? 0));
  const completed = Math.max(0, Math.round(finite(input.completedSessionCount) ?? counts.completed));
  const missed = Math.max(0, Math.round(finite(input.missedSessionCount) ?? counts.missed));
  const partial = Math.max(0, Math.round(finite(input.partialSessionCount) ?? counts.partial));
  const stopped = Math.max(0, Math.round(finite(input.stoppedEarlyCount) ?? counts.stopped));
  const adherence = planned > 0 ? completed / planned : 1;
  const readiness = clamp(finite(input.readinessScore) ?? 70, 0, 100);
  const acwr = finite(input.acwr);
  const averageRpe = finite(input.averageRpe);
  const deload = resolveDeloadDecision({ currentWeek: input.currentWeek, phase: input.phase });
  const flags: string[] = [];
  const focus = input.focus ?? focusForPhase(input.phase);

  if (deload.isDeload) flags.push('planned_deload');
  if (missed >= 2 || (input.interruptions ?? 0) >= 2) flags.push('multiple_interruptions');
  if (partial + stopped >= 2) flags.push('execution_breakdown');
  if (readiness < 45 || /Recovery Recommended/i.test(input.readinessLabel ?? '')) flags.push('low_readiness');
  if (averageRpe !== undefined && averageRpe >= 8) flags.push('high_rpe');
  if (acwr !== undefined && acwr > 1.3) flags.push('load_spike');
  if ((input.availableTrainingDays ?? planned) < Math.min(planned, 3)) flags.push('reduced_availability');
  if ((input.recentHardSessions ?? 0) >= 2) flags.push('hard_session_density');

  let decision: TrainingLoadDecision = 'maintain';
  if (deload.isDeload) {
    decision = 'deload';
  } else if (flags.includes('multiple_interruptions') || flags.includes('reduced_availability')) {
    decision = 'rebuild';
  } else if (flags.includes('execution_breakdown') || flags.includes('low_readiness') || flags.includes('load_spike')) {
    decision = 'regress';
  } else if (flags.includes('high_rpe') && adherence < 0.9) {
    decision = 'repeat';
  } else if (adherence < 0.65 || missed > 0) {
    decision = 'repeat';
  } else if (adherence >= 0.9 && readiness >= 72 && (input.consistencyWeeks ?? 0) >= 2 && (averageRpe ?? 6) <= 7 && (acwr ?? 1) <= 1.2) {
    decision = 'progress';
  }

  if (decision !== 'maintain' && flags.length === 0) flags.push(decision);
  const confidence: WeeklyTrainingDecision['confidence'] = planned >= 3 && (input.consistencyWeeks ?? 0) >= 2 ? 'high' : planned > 0 ? 'moderate' : 'low';
  const rationale = rationaleForDecision(decision, {
    adherence,
    readiness,
    missed,
    partial,
    stopped,
    acwr,
    averageRpe,
    focus,
    flags,
  });

  return {
    decision,
    phase: input.phase,
    focus,
    confidence,
    rationale,
    flags,
    simultaneousLoadIncreaseAllowed: false,
  };
}

function rationaleForDecision(
  decision: TrainingLoadDecision,
  context: {
    adherence: number;
    readiness: number;
    missed: number;
    partial: number;
    stopped: number;
    acwr?: number;
    averageRpe?: number;
    focus: TrainingFocus;
    flags: string[];
  },
): string {
  const adherencePct = Math.round(context.adherence * 100);
  if (decision === 'progress') return `Progress is allowed because adherence is ${adherencePct}%, readiness is stable, and the next focus remains ${context.focus}. Only one training lever should increase.`;
  if (decision === 'deload') return `Deload this week so the athlete can absorb prior training before the next ${context.focus} signal.`;
  if (decision === 'rebuild') return `Rebuild the remainder of the week because interruptions or availability changes make the original layout less reliable.`;
  if (decision === 'regress') return `Regress slightly because readiness, execution, RPE, or recent load suggests the current prescription is too aggressive.`;
  if (decision === 'repeat') return `Repeat the current week because adherence was ${adherencePct}% with ${context.missed} missed session(s), ${context.partial} partial session(s), and ${context.stopped} stopped-early session(s).`;
  return `Maintain the plan: current evidence supports the ${context.focus} focus without adding load.`;
}

export function decisionRequiresPlanRewrite(decision: WeeklyTrainingDecision): boolean {
  return decision.decision === 'rebuild' || decision.decision === 'regress' || decision.decision === 'deload' || decision.decision === 'repeat';
}
