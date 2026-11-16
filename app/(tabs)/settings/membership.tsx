import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Collapsible, Column, Host, Text as NativeText } from '@expo/ui';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useColors } from '../../../src/theme/useColors';
import { annualSavingsPercent, billingIsConfigured, getSubscriptionOptions, purchaseSubscription, restoreSubscriptions, type SubscriptionOption } from '../../../src/lib/revenueCat';
import { LEGAL_URLS } from '../../../src/utils/legal';
import { useSubscriptionStore } from '../../../src/store/subscriptionStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { useAuthStore } from '../../../src/store/authStore';
import { observability } from '../../../src/lib/observability';

export default function MembershipScreen() {
  const C = useColors();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [options, setOptions] = useState<SubscriptionOption[] | null>(null);
  const [optionsOwner, setOptionsOwner] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const actionInFlight = useRef(false);
  const readRequest = useRef(0);
  const mounted = useRef(true);
  const owner = useAuthStore(state => state.user?.id);
  const canAccessLocalData = useAuthStore(state => state.canAccessLocalData);
  const localAccessStatus = useAuthStore(state => state.localAccessStatus);
  const accessOwner = useSubscriptionStore(state => state.owner);
  const isPro = useSubscriptionStore(state => state.isPro);
  const accessLoading = useSubscriptionStore(state => state.isLoading);
  const accessError = useSubscriptionStore(state => state.error);
  const [message, setMessage] = useState<string | null>(null);
  const [needsAccessRefresh, setNeedsAccessRefresh] = useState(false);
  const configured = billingIsConfigured();
  const verified = Boolean(owner && accessOwner === owner && !accessLoading && !accessError);
  const active = verified && isPro;
  const visibleOptions = optionsOwner === owner ? options : null;
  const option = visibleOptions?.find(item => item.id === selected);
  const savings = annualSavingsPercent(visibleOptions ?? []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    readRequest.current += 1;
    setOptions(null); setOptionsOwner(null); setSelected(null); setMessage(null);
    setPlansError(null); setNeedsAccessRefresh(false); setLoadingPlans(false);
  }, [owner, canAccessLocalData, localAccessStatus]);

  async function loadMembership(isFocused: () => boolean) {
    if (actionInFlight.current || !configured) return;
    const lease = captureOwnerLease(true);
    if (!lease) {
      if (mounted.current && isFocused()) {
        setLoadingPlans(false);
        setPlansError('Connect to the internet to check membership and load plans. Your saved training remains available.');
      }
      return;
    }
    const request = ++readRequest.current;
    const isCurrent = () => mounted.current && isFocused() && readRequest.current === request && ownerLeaseIsCurrent(lease, true);
    setLoadingPlans(true); setPlansError(null);
    // These are read-only SDK operations. Restore is always an explicit action.
    const access = useSubscriptionStore.getState();
    const refresh = access.refresh().catch(() => undefined);
    try {
      const next = await getSubscriptionOptions();
      if (!isCurrent()) return;
      setOptions(next); setOptionsOwner(lease.ownerUserId);
      setSelected(previous => next.some(item => item.id === previous) ? previous : next[0]?.id ?? null);
      if (!next.length) setPlansError('No subscription plans are currently available. No payment was started.');
    } catch {
      if (isCurrent()) setPlansError('Plans could not be loaded. Check your connection and try again. No payment was started.');
    } finally {
      await refresh;
      if (isCurrent()) setLoadingPlans(false);
    }
  }

  useFocusEffect(useCallback(() => {
    let focused = true;
    let pending = false;
    let lastState = AppState.currentState;
    observability.track('membership_viewed');
    const refresh = () => {
      if (!focused || AppState.currentState !== 'active' || pending || actionInFlight.current) return;
      pending = true;
      void loadMembership(() => focused).finally(() => { pending = false; });
    };
    refresh();
    const listener = AppState.addEventListener('change', next => {
      const returned = next === 'active' && lastState !== 'active';
      lastState = next;
      if (returned) refresh();
    });
    return () => { focused = false; listener.remove(); };
  }, [owner, canAccessLocalData, localAccessStatus, configured]));

  async function run(action: (isCurrent: () => boolean, ownerId: string) => Promise<string | null>, purchase = false) {
    if (actionInFlight.current || loadingPlans) return;
    const lease = captureOwnerLease(true);
    if (!lease) { setMessage('Sign in online with the account that owns this device before checking membership.'); return; }
    const isCurrent = () => mounted.current && ownerLeaseIsCurrent(lease, true);
    actionInFlight.current = true;
    setBusy(true); setMessage(null);
    try { const next = await action(isCurrent, lease.ownerUserId); if (isCurrent()) setMessage(next); }
    catch (e) {
      if (isCurrent()) {
        const cancelled = (e as { userCancelled?: boolean })?.userCancelled === true;
        if (purchase) observability.track(cancelled ? 'membership_purchase_cancelled' : 'membership_purchase_failed');
        setMessage(cancelled ? 'Purchase cancelled. No subscription was activated by this request.'
          : 'This request could not be completed. Check your Apple subscriptions before retrying a purchase.');
      }
    }
    finally { actionInFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function refreshAccess(source: 'purchase' | 'restore' | 'check', isCurrent: () => boolean, ownerId: string): Promise<string | null> {
    let failed = false;
    try { await useSubscriptionStore.getState().refresh(); } catch { failed = true; }
    if (!isCurrent()) return null;
    const access = useSubscriptionStore.getState();
    if (failed || access.error || access.isLoading || access.owner !== ownerId) {
      setNeedsAccessRefresh(true);
      const prefix = source === 'purchase' ? 'The purchase request finished' : source === 'restore' ? 'The restore request finished' : 'The membership check finished';
      return `${prefix}, but Pro access could not be verified in StrideOS. Retry the membership check. Check your Apple subscriptions before purchasing again.`;
    }
    setNeedsAccessRefresh(!access.isPro);
    if (access.isPro) observability.track('membership_access_confirmed', { source });
    return access.isPro ? 'Your Pro subscription is active.'
      : 'Pro access is not active in StrideOS. A purchase may be pending or the subscription may have ended. Check your Apple subscriptions before purchasing again, or retry the membership check.';
  }
  const disabled = busy || loadingPlans || accessLoading;
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader eyebrow="MEMBERSHIP" title="StrideOS Pro" onBack={() => router.back()} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content}>
      <Text style={[s.heading, { color: C.text }]}>Training that grows with you</Text>
      <Text style={[s.copy, { color: C.textMuted }]}>One membership for personalized plans, thoughtful adjustments, and your AI Coach.</Text>
      <View style={[s.benefits, { borderColor: C.border }]}>
        {[
          ['Personalized plans', 'Running and hybrid training built around your goal.'],
          ['Adapt your week', 'Review a rebuilt week as your training changes.'],
          ['AI Coach', 'Ask questions using the training context you choose. Up to 20 requests per UTC day.'],
        ].map(([title, detail]) => <View key={title} style={s.benefit}>
          <Ionicons name="checkmark-circle-outline" size={21} color={C.primary} />
          <View style={s.flex}><Text style={[s.benefitTitle, { color: C.text }]}>{title}</Text><Text style={[s.copy, { color: C.textMuted }]}>{detail}</Text></View>
        </View>)}
      </View>
      {!configured ? <Text style={[s.copy, { color: C.text }]}>Purchases are not available in this build. No payment will be taken.</Text> : <>
        <View accessibilityLiveRegion="polite" style={[s.status, { borderColor: active ? C.primary : C.border }]}>
          {(loadingPlans || accessLoading) && !busy ? <ActivityIndicator color={C.primary} /> : null}
          <Text selectable style={[s.benefitTitle, { color: C.text }]}>{active ? 'Your Pro subscription is active.'
            : accessLoading || loadingPlans ? 'Checking your membership…'
              : accessError || !verified ? 'Membership has not been verified.' : 'Choose your Pro membership'}</Text>
          {active ? <Text style={[s.copy, { color: C.textMuted }]}>You stay subscribed when you close the app. Restore purchases is only needed to recover a purchase.</Text> : null}
          {accessError && !busy ? <Text style={[s.copy, { color: C.textMuted }]}>Connect and retry the membership check. Your saved training remains available.</Text> : null}
        </View>
        {active ? <TouchableOpacity style={[s.command, { backgroundColor: C.primary }]} accessibilityRole="button"
          onPress={() => router.push(source === 'onboarding' ? { pathname: '/(tabs)/settings/next-goal', params: { source: 'onboarding' } }
            : '/(tabs)/settings/next-goal')}><Text style={[s.action, { color: C.onPrimary }]}>Choose your training goal</Text></TouchableOpacity> : null}
        {!active ? <>
          {visibleOptions?.map(item => <TouchableOpacity key={item.id} disabled={disabled}
            style={[s.plan, { borderColor: selected === item.id ? C.primary : C.border }]}
            accessibilityRole="radio" accessibilityState={{ checked: selected === item.id, disabled }}
            onPress={() => { setSelected(item.id); observability.track('membership_plan_selected', { period: item.period }); }}>
            <Ionicons name={selected === item.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={C.primary} />
            <View style={s.flex}>
              <Text style={[s.benefitTitle, { color: C.text }]}>{item.period === 'year' ? 'Annual membership' : 'Monthly membership'}</Text>
              <Text style={[s.copy, { color: C.text }]}>{item.price} per {item.period}, billed automatically</Text>
              {item.period === 'year' && item.monthlyEquivalent ? <Text style={[s.copy, { color: C.textMuted }]}>{item.monthlyEquivalent} per month equivalent</Text> : null}
              {item.period === 'year' && savings ? <Text style={[s.copy, { color: C.primary }]}>Save {savings}% compared with monthly billing</Text> : null}
              {item.freeTrial ? <Text style={[s.copy, { color: C.primary }]}>{item.freeTrial} free trial, then {item.price} per {item.period}</Text> : null}
            </View>
          </TouchableOpacity>)}
          {plansError ? <Text selectable accessibilityLiveRegion="polite" style={[s.copy, { color: C.text }]}>{plansError}</Text> : null}
          {option && verified ? <TouchableOpacity disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
            style={[s.command, { backgroundColor: C.primary, opacity: disabled ? 0.6 : 1 }]}
            onPress={() => { void run(async (isCurrent, ownerId) => {
              observability.track('membership_purchase_started', { period: option.period });
              await purchaseSubscription(option);
              if (!isCurrent()) return null;
              return refreshAccess('purchase', isCurrent, ownerId);
            }, true); }}><Text style={[s.action, { color: C.onPrimary }]}>{option.freeTrial ? `Start ${option.freeTrial} free trial` : `Subscribe for ${option.price} per ${option.period}`}</Text></TouchableOpacity> : null}
          {!loadingPlans && (!visibleOptions?.length || plansError) ? <TouchableOpacity style={[s.command, { borderColor: C.border }]} disabled={busy} accessibilityRole="button"
            onPress={() => { void loadMembership(() => true); }}><Ionicons name="refresh-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>Reload plans</Text></TouchableOpacity> : null}
          <Text style={[s.finePrint, { color: C.textMuted }]}>Auto-renews at the selected price unless cancelled at least 24 hours before the period ends. Apple confirms any eligible trial and payment before you subscribe.</Text>
        </> : null}
        {busy ? <View style={s.status}><ActivityIndicator color={C.primary} /><Text style={[s.copy, { color: C.textMuted }]}>Completing your request…</Text></View> : null}
        {message ? <Text selectable accessibilityLiveRegion="polite" style={[s.copy, { color: C.text }]}>{message}</Text> : null}
        {(needsAccessRefresh || accessError || !verified) && !loadingPlans ? <TouchableOpacity style={[s.command, { borderColor: C.border }]} disabled={disabled} accessibilityRole="button"
          onPress={() => { void run((isCurrent, ownerId) => refreshAccess('check', isCurrent, ownerId)); }}>
          <Ionicons name="refresh-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>Retry membership check</Text>
        </TouchableOpacity> : null}
        <TouchableOpacity style={s.command} disabled={disabled} accessibilityRole="button" onPress={() => { void run(async (isCurrent, ownerId) => {
          await restoreSubscriptions();
          if (!isCurrent()) return null;
          return refreshAccess('restore', isCurrent, ownerId);
        }); }}><Text style={[s.copy, { color: C.primary }]}>Restore purchases</Text></TouchableOpacity>
      </>}
      <Text style={[s.copy, { color: C.textMuted }]}>Recording, calendar, saved history, existing plans, and on-device Insights remain available without Pro.</Text>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Collapsible label="Membership details & privacy" isOpen={detailsOpen} onOpenChange={setDetailsOpen} labelStyle={{ color: C.primary, fontSize: 14 }}>
          <Column spacing={12} style={{ paddingTop: 12 }}>
            <NativeText textStyle={{ color: C.textMuted, fontSize: 14, lineHeight: 21 }}>Payment is charged to your Apple Account. Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in Apple subscriptions. Deleting StrideOS does not cancel a subscription. AI Coach is subject to service availability.</NativeText>
            <NativeText textStyle={{ color: C.textMuted, fontSize: 14, lineHeight: 21 }}>Apple processes purchases. RevenueCat manages membership using your StrideOS account identifier and purchase records. Health data, routes, videos, and chat messages are not sent to RevenueCat.</NativeText>
          </Column>
        </Collapsible>
      </Host>
      {(['privacy', 'terms', 'subscriptions'] as const).map(key => <TouchableOpacity key={key} style={s.link} accessibilityRole="link" onPress={() => {
        void Linking.openURL(LEGAL_URLS[key]).catch(() => { if (mounted.current) setMessage('This link could not be opened. Please try again.'); });
      }}><Text style={[s.copy, { color: C.primary }]}>{key === 'privacy' ? 'Privacy policy' : key === 'terms' ? 'Terms of use' : 'Manage Apple subscriptions'}</Text></TouchableOpacity>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 18 },
  heading: { fontSize: 24, fontWeight: '700' },
  copy: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  finePrint: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  benefitTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', flexShrink: 1 },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  benefits: { padding: 16, gap: 18, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  status: { padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  action: { fontSize: 15, fontWeight: '700', lineHeight: 22, textAlign: 'center', flexShrink: 1 },
  command: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  plan: { borderWidth: 1, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
});
