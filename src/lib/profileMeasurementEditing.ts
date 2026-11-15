import type { AthleteProfile } from '../types/athlete';
import { ageFromDateOfBirth, profileAge, type MeasurementDraft } from '../utils/profileMeasurements';
import { userEnteredWeightPatch } from '../utils/profilePower';
import { calibrationForCurrentAge } from '../utils/calibrationEngine';

export type MeasurementTarget = Pick<AthleteProfile, 'athleteId' | 'createdAt' | 'age' | 'dateOfBirth' | 'heightCm' | 'weightKg'>;
export type MeasurementSaveAdapter = {
  ownerIsCurrent: () => boolean;
  activeProfile: () => AthleteProfile | undefined;
  writeProfile: (id: string, patch: Partial<AthleteProfile>) => Promise<void>;
  confirmProfile: (id: string, patch: Partial<AthleteProfile>) => Promise<boolean>;
  writeLegacy: (patch: Partial<AthleteProfile>) => void | Promise<void>;
  confirmLegacy: (patch: Partial<AthleteProfile>) => Promise<boolean>;
};
export type MeasurementSaveResult = { status: 'saved' | 'unchanged' | 'invalid' | 'account-changed' | 'conflict' | 'storage-failed'; message: string };

export async function saveProfileMeasurement(draft: MeasurementDraft, target: MeasurementTarget,
  adapter: MeasurementSaveAdapter, now = new Date()): Promise<MeasurementSaveResult> {
  const current = () => {
    const p = adapter.activeProfile();
    return adapter.ownerIsCurrent() && p?.athleteId === target.athleteId && p.createdAt === target.createdAt;
  };
  const changed = (): MeasurementSaveResult => ({ status: 'account-changed', message: 'Your account or athlete changed. Reopen this picker.' });
  if (!current()) return changed();
  if (!draft.changed) return { status: 'unchanged', message: '' };
  const active = adapter.activeProfile()!;
  let patch: Partial<AthleteProfile>;
  if (draft.field === 'dateOfBirth') {
    const age = typeof draft.value === 'string' ? ageFromDateOfBirth(draft.value, now) : null;
    if (draft.value !== null && age == null) return { status: 'invalid', message: 'Choose a valid date of birth within the last 120 years.' };
    patch = { dateOfBirth: draft.value as string | null, age: age ?? profileAge(active, now) };
    if (draft.value === null && active.dateOfBirth && active.calibration && !calibrationForCurrentAge(active, now)) {
      patch.calibration = null;
    }
  } else if (draft.field === 'heightCm') {
    if (typeof draft.value !== 'number' || !Number.isFinite(draft.value) || draft.value <= 90 || draft.value >= 245) {
      return { status: 'invalid', message: 'Choose a height between 90 and 245 cm.' };
    }
    patch = { heightCm: draft.value };
  } else {
    const weight = typeof draft.value === 'number' ? userEnteredWeightPatch(draft.value, now.getTime()) : null;
    if (!weight) return { status: 'invalid', message: 'Choose a weight between 20 and 300 kg.' };
    patch = weight;
  }
  if (active[draft.field] !== target[draft.field] && active[draft.field] !== draft.value) {
    return { status: 'conflict', message: 'This value changed while the picker was open. Cancel and reopen it.' };
  }
  try {
    if (!current()) return changed();
    await adapter.writeProfile(target.athleteId, patch);
    if (!current()) return changed();
    if (!await adapter.confirmProfile(target.athleteId, patch)) throw new Error('Unconfirmed profile write');
    if (!current()) return changed();
    if (target.athleteId === 'athlete_default') {
      // Cache invalidation belongs only to the profile, never to raw setup or
      // its existing coarse-demographic cloud serializer.
      const { calibration: _profileOnlyCalibration, ...legacyPatch } = patch;
      await adapter.writeLegacy(legacyPatch);
      if (!current()) return changed();
      if (!await adapter.confirmLegacy(legacyPatch)) throw new Error('Unconfirmed profile mirror');
      if (!current()) return changed();
    }
  } catch {
    if (!current()) return changed();
    return { status: 'storage-failed', message: 'This change could not be confirmed on this device. Keep the picker open and retry.' };
  }
  return { status: 'saved', message: '' };
}
