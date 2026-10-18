import type { Activity, ActivityMetrics, TelemetrySource } from '../types/activity';
import type { WeightProvenance } from '../types/athlete';
import { climbingWorkTime, estimateClimbingWork, type ClimbingWorkCalculation } from './outdoorPower';
import { profilePowerMass, type PowerMassProfile } from './profilePower';

export type ClimbingWorkEstimate = ClimbingWorkCalculation & {
  modelId: 'stride-ascent-component'; version: '1'; computedAt: number; inputKey: string;
  bodyMassKg: number; athleteId: string; massSource: 'active_profile'; weightProvenance: WeightProvenance;
  elevationGainMeters: number; elevationSource: TelemetrySource;
};
export type ClimbingWorkMetrics = ActivityMetrics & { climbingWorkEstimate?: ClimbingWorkEstimate };
type ClimbingActivity = Pick<Activity, 'activityType' | 'indoor' | 'metrics'>;

export function climbingWorkInputKey(activity: ClimbingActivity): string {
  return JSON.stringify([activity.activityType, activity.indoor, activity.metrics.elevationGainMeters,
    climbingWorkTime(activity), activity.metrics.metricSources?.elevation]);
}

export function storedClimbingWork(activity: ClimbingActivity): ClimbingWorkEstimate | undefined {
  const estimate = (activity.metrics as ClimbingWorkMetrics).climbingWorkEstimate;
  if (!estimate || estimate.inputKey !== climbingWorkInputKey(activity) || estimate.modelId !== 'stride-ascent-component'
    || estimate.version !== '1' || !Number.isFinite(estimate.computedAt)) return undefined;
  const mass = profilePowerMass({ athleteId: estimate.athleteId, weightKg: estimate.bodyMassKg, weightProvenance: estimate.weightProvenance });
  const calculated = mass ? estimateClimbingWork(activity, mass.bodyMassKg) : null;
  if (!calculated || calculated.kilojoules !== estimate.kilojoules || calculated.averageClimbingWatts !== estimate.averageClimbingWatts) return undefined;
  return estimate;
}

export function withAutomaticClimbingWork(activity: ClimbingActivity, profile: PowerMassProfile | undefined, now = Date.now()): ClimbingWorkMetrics {
  const metrics = activity.metrics as ClimbingWorkMetrics;
  if (storedClimbingWork(activity)) return metrics;
  const previous = metrics.climbingWorkEstimate;
  const mass = previous ? profilePowerMass({ athleteId: previous.athleteId, weightKg: previous.bodyMassKg, weightProvenance: previous.weightProvenance }) : profilePowerMass(profile);
  const calculated = mass ? estimateClimbingWork(activity, mass.bodyMassKg) : null;
  if (!calculated) return previous ? { ...metrics, climbingWorkEstimate: undefined } : metrics;
  return { ...metrics, climbingWorkEstimate: { ...calculated, modelId: 'stride-ascent-component', version: '1', computedAt: now,
    inputKey: climbingWorkInputKey(activity), bodyMassKg: mass!.bodyMassKg, athleteId: mass!.athleteId,
    massSource: 'active_profile', weightProvenance: mass!.provenance, elevationGainMeters: metrics.elevationGainMeters!,
    elevationSource: metrics.metricSources?.elevation ?? 'unavailable' } };
}
