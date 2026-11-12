import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Button, Host, Text as NativeText } from '@expo/ui';

import type { AthleteProfile } from '../../types/athlete';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAthleteStore } from '../../store/athleteStore';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { getProfileIdentity, type ProfileIdentityDraft } from '../../utils/profileIdentity';
import ProfileIdentityFields from './profile-identity-fields';
import { saveProfileIdentity } from '../../lib/profileIdentityEditing';

export default function ProfileIdentityEditor({ profile }: { profile: AthleteProfile }) {
  const C = useColors();
  const mode = useThemeMode();
  const initial = getProfileIdentity(profile);
  const { fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState<ProfileIdentityDraft>(() => ({
    firstName: initial.firstName, lastName: initial.lastName, username: initial.username,
    showName: initial.showName, showUsername: initial.showUsername,
  }));
  const [lease] = useState(() => captureOwnerLease());
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const disabled = saving || !lease || !ownerLeaseIsCurrent(lease);
  function change(patch: Partial<ProfileIdentityDraft>) {
    if (busy.current) return;
    setDraft(value => ({ ...value, ...patch }));
    setMessage('');
  }
  async function save() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setMessage('');
    try {
      const result = await saveProfileIdentity(draft, profile, {
        ownerIsCurrent: () => ownerLeaseIsCurrent(lease),
        activeProfile: () => useProfileStore.getState().getActiveProfile(),
        writeProfile: (id, patch) => useProfileStore.getState().updateProfile(id, patch),
        writeLegacyNames: [
          name => useOnboardingStore.getState().updateData({ name }),
          name => useAthleteStore.getState().setAthleteName(name || 'Athlete'),
        ],
      });
      if (!mounted.current) return;
      setError(result.status !== 'saved'); setMessage(result.message);
      if (result.status === 'saved') {
        setDraft({ firstName: result.patch.firstName, lastName: result.patch.lastName,
          username: result.patch.username, showName: result.patch.showName, showUsername: result.patch.showUsername });
        Keyboard.dismiss();
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return <View style={s.root}>
    <Text style={[s.heading, { color: C.text }]}>Name &amp; username</Text>
    <ProfileIdentityFields draft={draft} onChange={change} disabled={disabled} />
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Button label={saving ? 'Saving profile details' : 'Save name & username'} onPress={() => { void save(); }} disabled={disabled} variant="filled" style={{ paddingVertical: 12 }}>
        <NativeText textStyle={{ color: C.onPrimary, fontSize: 16 * fontScale, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save name & username'}</NativeText>
      </Button>
    </Host>
    {message ? <Text accessibilityRole={error ? 'alert' : undefined} selectable style={[s.copy, { color: error ? C.critical : C.textMuted }]}>{message}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 16 },
  heading: { fontSize: 17, fontWeight: '700' },
  copy: { fontSize: 13, lineHeight: 20 },
});
