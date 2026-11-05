import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Button, Host, Switch, Text as NativeText, TextInput, useNativeState } from '@expo/ui';

import type { AthleteProfile } from '../../types/athlete';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAthleteStore } from '../../store/athleteStore';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { getProfileIdentity, type ProfileIdentityDraft } from '../../utils/profileIdentity';
import { saveProfileIdentity } from '../../lib/profileIdentityEditing';

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  const C = useColors();
  const content = <><Text style={[s.label, { color: C.textMuted }]}>{label}</Text>{children}</>;
  return process.env.EXPO_OS === 'web'
    ? createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6 } }, content)
    : <View style={{ gap: 6 }}>{content}</View>;
}

function IdentityField({ label, value, onChange, username = false, disabled }: {
  label: string; value: string; onChange: (value: string) => void; username?: boolean; disabled: boolean;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const text = useNativeState(value);
  useEffect(() => { if (text.value !== value) text.value = value; }, [text, value]);
  return <FieldLabel label={label}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }}>
      <TextInput value={text} onChangeText={next => { text.value = next; onChange(next); }}
        placeholder={username ? 'Your display username' : label} editable={!disabled}
        autoCapitalize={username ? 'none' : 'words'} autoCorrect={false} autoComplete="off"
        maxLength={username ? 31 : 80} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()}
        modifiers={process.env.EXPO_OS === 'ios' ? [require('@expo/ui/swift-ui/modifiers').accessibilityLabel(label)] : undefined}
        placeholderTextColor={C.textDim} cursorColor={C.primary}
        style={{ padding: 12, borderRadius: 10, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border,
          ...(process.env.EXPO_OS === 'web' ? { width: '100%', height: 'auto' } : {}) }}
        textStyle={{ color: C.text, fontSize: 16 * fontScale }} />
    </Host>
  </FieldLabel>;
}

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
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>Name &amp; username</Text>
    <IdentityField label="First name" value={draft.firstName} onChange={firstName => change({ firstName })} disabled={disabled} />
    <IdentityField label="Last name" value={draft.lastName} onChange={lastName => change({ lastName })} disabled={disabled} />
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }} ignoreSafeArea="all">
      <Switch label="Show my name" value={draft.showName} onValueChange={showName => change({ showName })} disabled={disabled} />
    </Host>
    <IdentityField label="Username" value={draft.username} onChange={username => change({ username })} username disabled={disabled} />
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }} ignoreSafeArea="all">
      <Switch label="Show my username" value={draft.showUsername} onValueChange={showUsername => change({ showUsername })} disabled={disabled} />
    </Host>
    <Text style={[s.copy, { color: C.textMuted }]}>Choose which labels appear in your profile, greetings and new AI Coach context. You can still edit hidden details here. Your photo is separate, and earlier messages or shared content stay unchanged.</Text>
    <Text style={[s.copy, { color: C.textMuted }]}>Your username is a display alias saved on this device. It is not checked for availability. Continue using your email to sign in.</Text>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Button label={saving ? 'Saving profile details' : 'Save name & username'} onPress={() => { void save(); }} disabled={disabled} variant="filled" style={{ paddingVertical: 12 }}>
        <NativeText textStyle={{ color: C.onPrimary, fontSize: 16 * fontScale, fontWeight: '600' }}>{saving ? 'Saving…' : 'Save name & username'}</NativeText>
      </Button>
    </Host>
    {message ? <Text accessibilityRole={error ? 'alert' : undefined} selectable style={[s.copy, { color: error ? C.critical : C.textMuted }]}>{message}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, marginTop: 18, gap: 12 },
  heading: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  copy: { fontSize: 13, lineHeight: 20 },
});
