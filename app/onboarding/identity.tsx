import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import ProfileIdentityFields from '../../src/components/profile/profile-identity-fields';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { onboardingIdentityDraft } from '../../src/utils/onboardingIdentity';
import { profileIdentityPatch } from '../../src/utils/profileIdentity';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../src/lib/localDataOwner';
import { useColors } from '../../src/theme/useColors';

export default function IdentityScreen() {
  const C = useColors();
  const data = useOnboardingStore(s => s.data);
  const updateData = useOnboardingStore(s => s.updateData);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const lease = useRef(captureOwnerLease());
  function canEdit() {
    lease.current ??= captureOwnerLease();
    if (ownerLeaseIsCurrent(lease.current)) return true;
    setError('Your account changed. Reopen setup before editing your details.');
    return false;
  }
  const draft = onboardingIdentityDraft(data);
  async function next() {
    if (busy.current || !canEdit()) return;
    const result = profileIdentityPatch(draft);
    if (!result.ok) { setError(result.error); return; }
    busy.current = true; setSaving(true);
    try {
      await updateData({ ...result.patch, identityConfigured: true });
      if (canEdit()) router.push('/onboarding/goal');
    } catch {
      setError('Your profile details could not be saved. Keep this screen open and retry.');
    } finally { busy.current = false; setSaving(false); }
  }
  function change(patch: Partial<typeof draft>) {
    if (busy.current || !canEdit()) return;
    setError('');
    void Promise.resolve(updateData({ ...patch, identityConfigured: true })).catch(() => {
      setError('Your profile details could not be saved. Use Continue to retry.');
    });
  }
  return <OnboardingShell step={1} title="What should we call you?"
    subtitle="These details are optional. Choose whether your name, username, both or neither appear in the app."
    onBack={() => router.back()} onNext={() => { void next(); }} nextEnabled={!saving} nextLabel={saving ? 'Saving…' : 'Continue'}>
    <ProfileIdentityFields draft={draft} onChange={change} disabled={saving} />
    {error ? <Text accessibilityRole="alert" style={{ color: C.critical }}>{error}</Text> : null}
  </OnboardingShell>;
}
