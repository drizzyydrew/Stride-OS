import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Collapsible, Host, Picker, RNHostView, Text as NativeText, TextInput, useNativeState } from '@expo/ui';

import { useGoalLifecycle } from '../../hooks/useGoalLifecycle';
import { continueOpenTraining } from '../../lib/goalLifecycle';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { formatDateOnly } from '../../utils/dateOnly';

// Universal controls do not forward aria-label. An implicit HTML label names the
// actual nested input/select without changing Expo UI's web implementation.
function GoalControlLabel({ label, children }: { label: string; children: ReactNode }) {
  const C = useColors();
  const content = <>
    <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    {children}
  </>;
  return process.env.EXPO_OS === 'web'
    ? createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 } }, content)
    : <View style={{ gap: 8 }}>{content}</View>;
}

// Shared presentation primitives stay in this bounded sidecar, outside route files.
export function GoalAction({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  return (
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Button label={label} onPress={onPress} disabled={disabled} variant={secondary ? 'outlined' : 'filled'}
        style={{ paddingVertical: 14, ...(process.env.EXPO_OS === 'web' ? { width: '100%', height: 'auto' } : {}) }}>
        <NativeText textStyle={{ color: secondary ? C.text : C.onPrimary, fontSize: 16 * fontScale, lineHeight: 22 * fontScale, textAlign: 'center', fontWeight: '600' }}>{label}</NativeText>
      </Button>
    </Host>
  );
}

export function GoalField({ label, value, onChange, disabled = false, numeric = false, placeholder }: {
  label: string; value: string; onChange: (value: string) => void;
  disabled?: boolean; numeric?: boolean; placeholder?: string;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const text = useNativeState(value);
  useEffect(() => { if (text.value !== value) text.value = value; }, [text, value]);
  return (
    <GoalControlLabel label={label}>
      <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }}>
        <TextInput value={text} onChangeText={next => { text.value = next; onChange(next); }}
          placeholder={placeholder ?? label} editable={!disabled} maxLength={180}
          keyboardType={numeric ? 'number-pad' : 'default'} returnKeyType="done"
          autoCorrect={false} onSubmitEditing={() => Keyboard.dismiss()}
          modifiers={process.env.EXPO_OS === 'ios' ? [
            require('@expo/ui/swift-ui/modifiers').accessibilityLabel(label),
          ] : undefined}
          placeholderTextColor={C.textDim} cursorColor={C.primary}
          style={{ padding: 14, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 10,
            ...(process.env.EXPO_OS === 'web' ? { width: '100%', height: 'auto' } : {}) }}
          textStyle={{ color: C.text, fontSize: 16 * fontScale }} />
      </Host>
    </GoalControlLabel>
  );
}

export function GoalPicker<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; disabled?: boolean;
}) {
  const C = useColors();
  const mode = useThemeMode();
  return (
    <GoalControlLabel label={label}>
      <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
        {process.env.EXPO_OS === 'ios' ? <LabeledIOSPicker label={label} value={value} options={options} onChange={onChange} disabled={disabled} /> : <Picker selectedValue={value} onValueChange={onChange} enabled={!disabled}>
          {options.map(option => <Picker.Item key={option.value} value={option.value} label={option.label} />)}
        </Picker>}
      </Host>
    </GoalControlLabel>
  );
}

// The universal Picker drops its label on iOS. Use its underlying native control
// only on iOS, with the same menu/tag contract and an explicit accessible name.
function LabeledIOSPicker<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: readonly { value: T; label: string }[];
  onChange: (value: T) => void; disabled: boolean;
}) {
  if (process.env.EXPO_OS === 'ios') {
    const { Picker: IOSPicker, Text: IOSText } = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
    const modifiers = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
    return <IOSPicker label={label} selection={value} onSelectionChange={onChange}
      modifiers={[modifiers.pickerStyle('menu'), modifiers.disabled(disabled), modifiers.accessibilityLabel(label), modifiers.frame({ minHeight: 44 })]}>
      {options.map(option => <IOSText key={option.value} modifiers={[modifiers.tag(option.value)]}>{option.label}</IOSText>)}
    </IOSPicker>;
  }
  return null;
}

export function GoalDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  return (
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }}>
      <Collapsible label={label} isOpen={open} onOpenChange={setOpen}
        labelStyle={{ color: C.text, fontSize: 16 * fontScale, lineHeight: 44 * fontScale }}>
        {open ? <RNHostView matchContents><View style={{ gap: 12, paddingVertical: 12 }}>{children}</View></RNHostView> : null}
      </Collapsible>
    </Host>
  );
}

export function GoalMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const C = useColors();
  return <Text selectable accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion={error ? 'polite' : undefined}
    style={{ color: error ? C.text : C.textMuted, fontSize: 15, lineHeight: 23 }}>{children}</Text>;
}

export function goalDate(value: string) { return formatDateOnly(value) || '—'; }

export function GoalBackupStatus({ status }: { status?: unknown }) {
  const message = status === 'synced' ? 'Backed up' : status === 'error' ? 'Backup unavailable; saved on device'
    : status === 'local' || status === 'syncing' ? 'Saved on device' : null;
  return message ? <GoalMessage>{message}</GoalMessage> : null;
}

export default function GoalLifecycleCard() {
  const lifecycle = useGoalLifecycle();
  const router = useRouter();
  const C = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  if (!lifecycle.isDefaultAthlete) return null;
  if (lifecycle.status === 'loading') return null; // Never gate Today or recording.
  if (lifecycle.status === 'ready' && !lifecycle.pendingArchive && lifecycle.mode !== 'open') return null;

  async function keepTraining() {
    if (inFlight.current || lifecycle.status !== 'ready') return;
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease)) { setError('Your account is not ready. Retry after unlocking and signing in.'); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await continueOpenTraining();
      if (ownerLeaseIsCurrent(lease)) router.push('/(tabs)/activity' as never);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not switch to open training. Your archive is preserved.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  const archive = lifecycle.pendingArchive;
  return (
    <View style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: 21, fontWeight: '700' }}>
        {lifecycle.status === 'error' ? 'Training archive needs attention' : archive ? `${archive.title} · Archived` : 'Open Training'}
      </Text>
      {lifecycle.status === 'error' ? <>
        <GoalMessage error>{lifecycle.error ?? 'Saved training could not be loaded. Retry to see your archive.'}</GoalMessage>
        <GoalAction label="Retry" onPress={lifecycle.retry} />
      </> : <>
        <GoalMessage>{archive ? 'Your recorded training is saved. Choose a new goal whenever you’re ready.' : 'Train at your own pace. A new goal is optional.'}</GoalMessage>
        {lifecycle.archives.length > 0 ? <GoalBackupStatus status={'syncStatus' in lifecycle ? lifecycle.syncStatus : undefined} /> : null}
        {archive ? <GoalAction label="View results" disabled={busy} onPress={() => router.push({ pathname: '/(tabs)/settings/goal-archive-detail', params: { id: archive.id } } as never)} /> : null}
        <GoalAction label="Choose a new goal" disabled={busy} secondary onPress={() => router.push('/(tabs)/settings/next-goal' as never)} />
        {archive ? <GoalAction label={busy ? 'Saving…' : 'Keep training without a plan'} disabled={busy} secondary onPress={() => { void keepTraining(); }} /> : null}
        <GoalAction label="Training archive" disabled={busy} secondary onPress={() => router.push('/(tabs)/settings/goal-archive' as never)} />
      </>}
      {error ? <GoalMessage error>{error}</GoalMessage> : null}
    </View>
  );
}
