import type { Activity, ActivityMetrics, PowerEstimate } from '../types/activity';
import { devicePowerSummary, estimateActivityPower, validActivityPowerEstimate } from './outdoorPower';
import { profilePowerMass, type PowerMassProfile } from './profilePower';
import type { WeightProvenance } from '../types/athlete';
import { climbingWorkInputKey, withAutomaticClimbingWork } from './climbingWork';

type PowerProfile = PowerMassProfile | undefined;
type AutomaticPowerEstimate = PowerEstimate & {
  automaticInputs: { schemaVersion: 1; key: string; massSource: 'active_profile'; massSavedAt?: number; weightProvenance?: WeightProvenance; athleteId: string; bodyMassKg: number; bikeMassKg?: number };
};

// A compact deterministic fingerprint avoids persisting a second copy of the GPS trace.
function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < text.length; index += 1) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(index);
  }
  return `${text.length}:${first >>> 0}:${second >>> 0}`;
}

export function automaticPowerInputKey(activity: Activity): string {
  if (activity.activityType === 'hiking' || activity.activityType === 'walking') return climbingWorkInputKey(activity);
  const m = activity.metrics;
  return fingerprint([3, activity.activityType, activity.subtype, activity.indoor,
    activity.source, activity.workoutInstanceId, Boolean(activity.healthKit), activity.startTime, activity.endTime,
    m.activeTimeSeconds, m.durationSeconds, m.elapsedTimeSeconds, m.runWalkIntervals,
    m.routeCoordinates, m.recordingPauses, m.metricSources?.distance]);
}

/** Returns the original metrics on a no-op, including an already persisted estimate. */
export function withAutomaticActivityPower(activity: Activity, profile: PowerProfile, now = Date.now()): ActivityMetrics {
  if (activity.activityType === 'hiking' || activity.activityType === 'walking') return withAutomaticClimbingWork(activity, profile, now);
  const metrics = activity.metrics;
  const previous = metrics.powerEstimate as AutomaticPowerEstimate | undefined;
  if (devicePowerSummary(activity) || (Number.isFinite(metrics.cyclingPowerWatts) && metrics.cyclingPowerWatts! >= 0
    && metrics.metricSources?.power !== 'model_estimate')) return metrics;
  let mass = profilePowerMass(profile);
  if (validActivityPowerEstimate(activity, previous)) {
    if (!previous?.automaticInputs || previous.automaticInputs.key === automaticPowerInputKey(activity)) return metrics;
    // An activity correction uses the original mass snapshot, never today's profile.
    const saved = previous.automaticInputs;
    mass = profilePowerMass({ athleteId: saved.athleteId, weightKg: saved.bodyMassKg,
      weightProvenance: saved.weightProvenance ?? (saved.massSavedAt ? { source: 'user_entered', weightKg: saved.bodyMassKg, savedAt: saved.massSavedAt } : null) });
  }
  const calculated = mass ? estimateActivityPower(activity, mass.bodyMassKg, 10, now) : null;
  if (!calculated) return previous ? { ...metrics, powerEstimate: undefined } : metrics;
  const powerEstimate: AutomaticPowerEstimate = {
    ...calculated,
    version: '3',
    automaticInputs: { schemaVersion: 1, key: automaticPowerInputKey(activity), massSource: mass!.source, massSavedAt: mass!.savedAt, weightProvenance: mass!.provenance,
      athleteId: mass!.athleteId, bodyMassKg: mass!.bodyMassKg, ...(activity.activityType === 'cycling' ? { bikeMassKg: 10 } : {}) },
    inputs: [
      { name: `Saved active-profile body mass (${mass!.athleteId})`, value: mass!.bodyMassKg, unit: 'kg', source: 'manual_entry' },
      ...(activity.activityType === 'cycling' ? [{ name: 'Assumed bicycle mass', value: 10, unit: 'kg', source: 'model_estimate' as const }] : []),
      calculated.inputs[calculated.inputs.length - 1]!,
    ],
    assumptions: [...calculated.assumptions, 'Body mass is the saved active-profile value at calculation time.',
      ...(mass!.provenance.source === 'legacy_nondefault' ? ['Mass inferred from a legacy non-default entry; original entry date is unknown.'] : []),
      ...(activity.activityType === 'cycling' ? ['Bicycle mass assumed to be 10 kg; actual bicycle and carried load may differ.'] : [])],
  };
  return { ...metrics, powerEstimate };
}
