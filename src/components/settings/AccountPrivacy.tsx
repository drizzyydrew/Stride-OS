import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_URLS } from '../../utils/legal';
import { accountDeletionRequest, type DeletionRequest } from '../../lib/accountDeletion';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { useActiveRunStore } from '../../store/activeRunStore';
import { useActiveActivityStore } from '../../store/activeActivityStore';
import { useActiveIndoorRideStore } from '../../store/activeIndoorRideStore';
import { billingIsConfigured } from '../../lib/revenueCat';
import { router } from 'expo-router';

export default function AccountPrivacy() {
  const C = useColors();
  const userId = useAuthStore(state => state.user?.id);
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setBusy(true); setRequest(null); setError(null);
    void accountDeletionRequest().then(value => { if (current) setRequest(value); })
      .catch(() => { if (current) setError('Deletion status is unavailable. You can retry submitting safely.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [userId]);
  async function submit() {
    if (busy) return;
    if (useActiveRunStore.getState().isActive || useActiveActivityStore.getState().isActive || useActiveIndoorRideStore.getState().isActive) {
      Alert.alert('Finish your recording first', 'Save or discard your active workout before requesting account deletion.'); return;
    }
    const owner = useAuthStore.getState().user?.id;
    setBusy(true); setError(null);
    try {
      const result = await accountDeletionRequest(true);
      if (useAuthStore.getState().user?.id === owner) setRequest(result);
    } catch (e) { if (useAuthStore.getState().user?.id === owner) setError(e instanceof Error ? e.message : 'Please retry.'); }
    finally { if (useAuthStore.getState().user?.id === owner) setBusy(false); }
  }
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>Account & Legal</Text>
    {billingIsConfigured() ? <TouchableOpacity style={s.link} accessibilityRole="button" onPress={() => router.push('/(tabs)/settings/membership' as never)}>
      <Ionicons name="card-outline" size={20} color={C.primary} /><Text style={[s.copy, { color: C.text }]}>StrideOS Pro membership</Text>
    </TouchableOpacity> : null}
    {([
      ['privacy', 'Privacy policy', 'shield-checkmark-outline'],
      ['terms', 'Terms of use', 'document-text-outline'],
      ['support', 'Contact support', 'help-circle-outline'],
      ['subscriptions', 'Manage Apple subscriptions', 'card-outline'],
    ] as const).map(([key, label, icon]) => <TouchableOpacity key={key} style={s.link} accessibilityRole="link" onPress={() => {
      void Linking.openURL(LEGAL_URLS[key]).catch(() => setError('This link could not be opened. Please try again.'));
    }}><Ionicons name={icon} size={20} color={C.primary} /><Text style={[s.copy, { color: C.text }]}>{label}</Text><Ionicons name="open-outline" size={16} color={C.textMuted} /></TouchableOpacity>)}
    <Text style={[s.copy, { color: C.textMuted }]}>Account deletion is separate from Reset Plan. Processing is not instantaneous. Cloud sync stops after your request is recorded. Data on this device, Apple Health, and your photo library is not erased by a request. Cancel any Apple subscription separately to stop renewal.</Text>
    {request ? <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
      <Text style={[s.copy, { color: C.text }]}>{request.status === 'completed' ? 'Deletion marked complete' : 'Deletion requested; not yet complete'}</Text>
      <Text selectable style={[s.copy, { color: C.textMuted }]}>Reference: {request.id}</Text>
      <Text style={[s.copy, { color: C.textMuted }]}>Requested {new Date(request.requested_at).toLocaleDateString()}. Contact support with this reference for progress.</Text>
    </View> : <TouchableOpacity disabled={busy} accessibilityRole="button" accessibilityLabel="Request deletion of your StrideOS account" style={s.link}
      onPress={() => Alert.alert('Delete your StrideOS account?', 'This requests permanent deletion of your StrideOS account and server records. Deletion cannot be undone once processed. It does not cancel an Apple subscription. You will receive a request reference; this is not an instant reset.', [
        { text: 'Keep account', style: 'cancel' }, { text: 'Request deletion', style: 'destructive', onPress: () => { void submit(); } },
      ])}>
      <Ionicons name="trash-outline" size={20} color={C.critical} /><Text style={[s.copy, { color: C.critical }]}>Request account deletion</Text>
    </TouchableOpacity>}
    {busy ? <ActivityIndicator color={C.primary} /> : null}
    {error ? <Text accessibilityRole="alert" style={[s.copy, { color: C.critical }]}>{error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({ root: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 20, gap: 12 }, heading: { fontSize: 18, fontWeight: '700' }, copy: { fontSize: 13, lineHeight: 20, flexShrink: 1 }, link: { minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center' } });
