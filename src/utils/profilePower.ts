import type { AthleteProfile, WeightProvenance } from '../types/athlete';

export type ProfileWeightProvenance = WeightProvenance;
export type PowerMassProfile = Pick<AthleteProfile, 'athleteId' | 'weightKg' | 'weightProvenance'>;
export type ProfilePowerMass = { bodyMassKg: number; athleteId: string; source: 'active_profile'; savedAt?: number; provenance: WeightProvenance };

export function validWeightKg(value: number): boolean {
  return Number.isFinite(value) && value >= 20 && value <= 300;
}

export function matchingWeightProvenance(weightKg: number, evidence: WeightProvenance | null | undefined): WeightProvenance | null {
  if (!validWeightKg(weightKg) || evidence?.weightKg !== weightKg) return null;
  if (evidence.source === 'user_entered' && Number.isFinite(evidence.savedAt) && evidence.savedAt > 0) return evidence;
  if (evidence.source === 'legacy_nondefault' && ![70, 75].includes(weightKg) && Number.isFinite(evidence.migratedAt) && evidence.migratedAt > 0) return evidence;
  return null;
}

export function userEnteredWeightPatch(weightKg: number, now = Date.now()): { weightKg: number; weightProvenance: WeightProvenance } | null {
  if (!validWeightKg(weightKg)) return null;
  return { weightKg, weightProvenance: { source: 'user_entered', weightKg, savedAt: now } };
}

/** Legacy non-default values imply prior input, but do not establish its date. */
export function migrateStoredWeight<T extends { weightKg: number; weightProvenance?: WeightProvenance | null }>(stored: T, now = Date.now()): T {
  if (stored.weightProvenance !== undefined) return { ...stored, weightProvenance: matchingWeightProvenance(stored.weightKg, stored.weightProvenance) };
  const inferred = validWeightKg(stored.weightKg) && ![70, 75].includes(stored.weightKg);
  return { ...stored, weightProvenance: inferred ? { source: 'legacy_nondefault', weightKg: stored.weightKg, migratedAt: now } : null };
}

/** Generic patches cannot turn copied/default numbers into explicit user input. */
export function preserveWeightProvenance<T extends { weightKg: number; weightProvenance?: WeightProvenance | null }>(previous: T, patch: Partial<T>): Partial<T> {
  if (!Object.prototype.hasOwnProperty.call(patch, 'weightKg') && !Object.prototype.hasOwnProperty.call(patch, 'weightProvenance')) return patch;
  const weightKg = patch.weightKg ?? previous.weightKg;
  const supplied = Object.prototype.hasOwnProperty.call(patch, 'weightProvenance') ? patch.weightProvenance
    : weightKg === previous.weightKg ? previous.weightProvenance : null;
  return { ...patch, weightProvenance: matchingWeightProvenance(weightKg, supplied) };
}

/** Shared with the activity launcher: no onboarding fallback or per-workout confirmation. */
export function profilePowerMass(profile: PowerMassProfile | undefined): ProfilePowerMass | null {
  if (!profile?.athleteId) return null;
  const evidence = matchingWeightProvenance(profile.weightKg, profile.weightProvenance);
  if (!evidence) return null;
  return { bodyMassKg: profile.weightKg, athleteId: profile.athleteId, source: 'active_profile',
    ...(evidence.source === 'user_entered' ? { savedAt: evidence.savedAt } : {}), provenance: evidence };
}
