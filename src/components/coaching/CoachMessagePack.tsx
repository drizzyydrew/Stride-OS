import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../../theme/useColors';
import { canBuyCoachPack, type CoachUsage } from '../../utils/coachUsage';
import { getCoachPackOffer, purchaseCoachPack, type CoachPackOffer } from '../../lib/revenueCat';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';

export default function CoachMessagePack({ usage, onRefresh }: { usage: CoachUsage | null; onRefresh: () => Promise<unknown> }) {
  const C = useColors();
  const [offer, setOffer] = useState<CoachPackOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [paidPending, setPaidPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const eligible = canBuyCoachPack(usage);
  useEffect(() => {
    let active = true;
    const lease = captureOwnerLease(true);
    setOffer(null);
    if (usage?.purchasedRemaining) setPaidPending(false);
    if (!eligible || !lease) return;
    void getCoachPackOffer().then(value => { if (active && ownerLeaseIsCurrent(lease, true)) setOffer(value); })
      .catch(() => { if (active) setMessage('The message pack could not be loaded. Refresh your balance and try again.'); });
    return () => { active = false; };
  }, [eligible, usage?.purchasedRemaining, usage?.resetsAt]);
  if (!usage || usage.version !== 2) return null;
  const exhausted = usage.remaining === 0 && usage.purchasedRemaining === 0;
  if (!exhausted && usage.purchasedRemaining === 0 && usage.pro) return null;
  const copy = { color: C.textMuted, fontSize: 14, lineHeight: 21, flexShrink: 1 };
  return <View style={{ width: '100%', minWidth: 0, padding: 14, gap: 8, borderWidth: 1, borderRadius: 14, borderColor: C.border, backgroundColor: C.card }}>
    <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{exhausted ? 'No AI messages remaining' : 'Purchased AI messages'}</Text>
    {(usage.purchasedRemaining ?? 0) > 0 ? <Text style={copy}>{usage.purchasedRemaining} purchased messages remain. They are used after your included daily messages and expire {new Date(usage.purchasedExpiresAt!).toLocaleDateString()}.</Text>
      : <Text style={copy}>{usage.pro ? 'Your included messages reset at the time shown above.' : 'Pro includes 20 AI Coach messages daily, together with personalized training features.'}</Text>}
    {eligible && offer ? <>
      <Text style={copy}>30 AI Coach messages · valid for 12 months from purchase. No Pro subscription required. This is a one-time purchase and does not unlock other Pro features.</Text>
      <Pressable disabled={busy || paidPending} accessibilityRole="button" accessibilityState={{ disabled: busy || paidPending }}
        style={{ minHeight: 48, padding: 12, borderRadius: 10, backgroundColor: C.primary, opacity: busy || paidPending ? 0.5 : 1 }}
        onPress={() => { const lease = captureOwnerLease(true); if (!lease || busy || paidPending) return;
          setBusy(true); setMessage(null);
          void purchaseCoachPack(offer).then(async () => {
            if (!ownerLeaseIsCurrent(lease, true)) return;
            setPaidPending(true); setMessage('Payment received. Your messages are being verified. Refresh your balance before trying another purchase.');
            await onRefresh();
          }).catch(error => { if (ownerLeaseIsCurrent(lease, true)) setMessage(error?.userCancelled
            ? 'Purchase cancelled. No messages were added.' : 'The purchase could not be confirmed here. Check your Apple purchase history and refresh your balance before retrying.'); })
            .finally(() => { if (ownerLeaseIsCurrent(lease, true)) setBusy(false); });
        }}><Text style={{ color: C.onPrimary, fontWeight: '700', textAlign: 'center' }}>{busy ? 'Checking purchase…' : paidPending ? 'Verifying purchased messages…' : `Buy 30 messages · ${offer.price}`}</Text></Pressable>
    </> : usage.packsEnabled === false && exhausted ? <Text style={copy}>Message packs are not available for purchase yet.</Text> : null}
    {!usage.pro ? <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings/membership' as never)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[copy, { color: C.primary, fontWeight: '600' }]}>Compare Free and Pro</Text></Pressable> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={copy}>{message}</Text> : null}
    {paidPending ? <Pressable accessibilityRole="button" onPress={() => { void onRefresh(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[copy, { color: C.primary }]}>Refresh purchased balance</Text></Pressable> : null}
  </View>;
}
