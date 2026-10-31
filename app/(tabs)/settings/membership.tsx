import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useColors } from '../../../src/theme/useColors';
import { billingIsConfigured, getSubscriptionOptions, purchaseSubscription, restoreSubscriptions, type SubscriptionOption } from '../../../src/lib/revenueCat';
import { LEGAL_URLS } from '../../../src/utils/legal';
import { useSubscriptionStore } from '../../../src/store/subscriptionStore';

export default function MembershipScreen() {
  const C = useColors();
  const [options, setOptions] = useState<SubscriptionOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true); setMessage(null);
    try { await action(); }
    catch (e) { setMessage((e as { userCancelled?: boolean })?.userCancelled ? 'Purchase cancelled. No subscription was activated by this request.' : 'This request could not be completed. Check your Apple subscriptions before retrying a purchase.'); }
    finally { actionInFlight.current = false; setBusy(false); }
  }
  const option = options?.find(item => item.id === selected);
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader eyebrow="MEMBERSHIP" title="StrideOS Pro" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={s.content}>
      <Text style={[s.heading, { color: C.text }]}>Your training membership</Text>
      <Text style={[s.copy, { color: C.text }]}>Pro includes personalized AI Coach chat using your selected training context, up to 20 requests per UTC day, subject to service availability. Recording, calendar, saved history, and on-device Insights remain available without Pro.</Text>
      <Text style={[s.copy, { color: C.textMuted }]}>Subscription purchases are processed by Apple and managed with RevenueCat using your StrideOS account identifier and purchase records. Health data, routes, videos, and chat messages are not sent to RevenueCat.</Text>
      {!billingIsConfigured() ? <Text style={[s.copy, { color: C.text }]}>Purchases are not available in this build. No payment will be taken.</Text> : <>
        <TouchableOpacity style={[s.command, { borderColor: C.border }]} disabled={busy} onPress={() => { void run(async () => {
          const next = await getSubscriptionOptions(); setOptions(next); setSelected(next[0]?.id ?? null);
          if (!next.length) setMessage('No subscription plans are currently available. No payment was started.');
        }); }} accessibilityRole="button"><Ionicons name="refresh-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>{options ? 'Reload plans' : 'View plans with RevenueCat'}</Text></TouchableOpacity>
        {options?.map(item => <TouchableOpacity key={item.id} disabled={busy} style={[s.plan, { borderColor: selected === item.id ? C.primary : C.border }]}
          accessibilityRole="radio" accessibilityState={{ checked: selected === item.id }} onPress={() => setSelected(item.id)}>
          <Ionicons name={selected === item.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={C.primary} />
          <View style={{ flex: 1 }}><Text style={[s.copy, { color: C.text }]}>{item.period === 'year' ? 'Annual membership' : 'Monthly membership'}</Text><Text style={[s.copy, { color: C.textMuted }]}>{item.price} per {item.period}, billed automatically</Text></View>
        </TouchableOpacity>)}
        {option ? <TouchableOpacity disabled={busy} accessibilityRole="button" style={[s.command, { backgroundColor: C.primary }]}
          onPress={() => { void run(async () => {
            const result = await purchaseSubscription(option);
            await useSubscriptionStore.getState().refresh();
            setMessage(result.isPro ? 'Your Pro subscription is active.' : 'Apple has not confirmed an active Pro subscription. A purchase may be pending; check your subscriptions before retrying.');
          }); }}><Ionicons name="card-outline" size={20} color={C.onPrimary} /><Text style={[s.copy, { color: C.onPrimary }]}>Subscribe for {option.price} per {option.period}</Text></TouchableOpacity> : null}
        <Text style={[s.copy, { color: C.textMuted }]}>Payment is charged to your Apple Account. Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends. Any eligible trial and its renewal price are shown in Apple's confirmation. Manage or cancel in Apple subscriptions. Deleting StrideOS does not cancel a subscription.</Text>
        <TouchableOpacity style={[s.command, { borderColor: C.border }]} disabled={busy} accessibilityRole="button" onPress={() => { void run(async () => {
          const result = await restoreSubscriptions(); await useSubscriptionStore.getState().refresh(); setMessage(result.isPro ? 'Your Pro subscription was restored.' : 'No active Pro subscription was found for this account.');
        }); }}><Ionicons name="refresh-circle-outline" size={20} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>Restore purchases</Text></TouchableOpacity>
      </>}
      {busy ? <ActivityIndicator color={C.primary} /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={[s.copy, { color: C.text }]}>{message}</Text> : null}
      {(['privacy', 'terms', 'subscriptions'] as const).map(key => <TouchableOpacity key={key} style={s.command} accessibilityRole="link" onPress={() => {
        void Linking.openURL(LEGAL_URLS[key]).catch(() => setMessage('This link could not be opened. Please try again.'));
      }}><Ionicons name="open-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>{key === 'privacy' ? 'Privacy policy' : key === 'terms' ? 'Terms of use' : 'Manage Apple subscriptions'}</Text></TouchableOpacity>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({ content: { padding: 18, paddingBottom: 120, gap: 16 }, heading: { fontSize: 20, fontWeight: '700' }, copy: { fontSize: 14, lineHeight: 21, flexShrink: 1 }, command: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 }, plan: { borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 } });
