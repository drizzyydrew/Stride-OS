import { useCallback } from 'react';
import { Text, View } from 'react-native';
import type { AthleteProfile } from '../../types/athlete';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { saveProfileMeasurement } from '../../lib/profileMeasurementEditing';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { getAppStorage } from '../../store/persistStorage';
import { profilePowerMass } from '../../utils/profilePower';
import ProfileMeasurementFields, { type MeasurementSave } from './profile-measurement-fields';
import { useColors } from '../../theme/useColors';

function matches(saved: Record<string, unknown> | undefined, patch: Partial<AthleteProfile>) {
  return !!saved && Object.entries(patch).every(([key, value]) => JSON.stringify(saved[key]) === JSON.stringify(value));
}

export default function ProfileMeasurementEditor({ profile, units }: { profile: AthleteProfile; units: 'imperial' | 'metric' }) {
  const C = useColors();
  const storedCalibration = useProfileStore(s => s.profiles[profile.athleteId]?.calibration);
  const subscribeInvalidation = useCallback((close: () => void) => getLocalDataOwner()?.onLeaseInvalidated(close) ?? (() => {}), []);
  function createSave(): MeasurementSave | null {
    const lease = captureOwnerLease();
    const target = useProfileStore.getState().getActiveProfile();
    if (!lease || !target || !useProfileStore.persist.hasHydrated() || !useOnboardingStore.persist.hasHydrated()) return null;
    const current = () => ownerLeaseIsCurrent(lease);
    return draft => saveProfileMeasurement(draft, target, {
      ownerIsCurrent: current, activeProfile: () => useProfileStore.getState().getActiveProfile(),
      writeProfile: (id, patch) => useProfileStore.getState().updateProfile(id, patch),
      confirmProfile: async (id, patch) => {
        if (!current()) return false;
        const raw = await getAppStorage().getItemOnce('profile-store');
        return current() && matches(raw ? JSON.parse(raw).state?.profiles?.[id] : undefined, patch);
      },
      writeLegacy: patch => { if (current()) return useOnboardingStore.getState().updateData(patch); },
      confirmLegacy: async patch => {
        if (!current()) return false;
        const raw = await getAppStorage().getItemOnce('onboarding-store');
        return current() && matches(raw ? JSON.parse(raw).state?.data : undefined, patch);
      },
    });
  }
  return <View>
    <ProfileMeasurementFields values={{ ...profile, weightKg: profilePowerMass(profile)?.bodyMassKg }} units={units}
      createSave={createSave} subscribeInvalidation={subscribeInvalidation} />
    {storedCalibration && !profile.calibration ? <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20, marginTop: 10 }}>
      Age changed. Open Performance Calibration and tap Recalculate Paces + Zones to refresh age-estimated zones.
    </Text> : null}
  </View>;
}
