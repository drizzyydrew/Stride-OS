import { createElement, useEffect, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Host, Switch, TextInput, useNativeState } from '@expo/ui';

import { GoalDisclosure } from '../goals/GoalLifecycleCard';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { type ProfileIdentityDraft } from '../../utils/profileIdentity';

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

export default function ProfileIdentityFields({ draft, onChange, disabled = false }: {
  draft: ProfileIdentityDraft; onChange: (patch: Partial<ProfileIdentityDraft>) => void; disabled?: boolean;
}) {
  const C = useColors();
  const mode = useThemeMode();
  return <View style={{ gap: 12, minWidth: 0 }}>
    <IdentityField label="First name" value={draft.firstName} onChange={firstName => onChange({ firstName })} disabled={disabled} />
    <IdentityField label="Last name" value={draft.lastName} onChange={lastName => onChange({ lastName })} disabled={disabled} />
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }} ignoreSafeArea="all">
      <Switch label="Show my name" value={draft.showName} onValueChange={showName => onChange({ showName })} disabled={disabled} />
    </Host>
    <IdentityField label="Username" value={draft.username} onChange={username => onChange({ username })} username disabled={disabled} />
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }} ignoreSafeArea="all">
      <Switch label="Show my username" value={draft.showUsername} onValueChange={showUsername => onChange({ showUsername })} disabled={disabled} />
    </Host>
    <Text style={[s.copy, { color: C.textMuted }]}>Your username is a display alias. Sign in with your email.</Text>
    <GoalDisclosure label="About profile visibility">
      <Text style={[s.copy, { color: C.textMuted }]}>Choose which labels appear in your profile, greetings and new AI Coach context. You can still edit hidden details here. Your photo is separate, and earlier messages or shared content stay unchanged.</Text>
      <Text style={[s.copy, { color: C.textMuted }]}>Your username is saved on this device and is not checked for availability.</Text>
    </GoalDisclosure>
  </View>;
}
const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600' },
  copy: { fontSize: 13, lineHeight: 20 },
});
