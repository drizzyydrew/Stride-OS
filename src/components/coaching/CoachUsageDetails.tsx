import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host } from '@expo/ui';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { coachUsageExample, coachUsageLabel, type CoachUsage } from '../../utils/coachUsage';

type Props = { usage: CoachUsage | null; status: 'loading' | 'current' | 'unavailable'; checkedAt: number | null; sending: boolean; onRefresh: () => void };

export default function CoachUsageDetails({ usage, status, checkedAt, sending, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const freshDay = usage && Date.parse(usage.resetsAt) > Date.now();
  const shown = freshDay ? usage : null;
  const label = sending ? 'Updating AI usage…' : shown
    ? `${coachUsageLabel(shown)}${status === 'unavailable' ? ' · last checked' : status === 'loading' ? ' · updating' : ''}`
    : status === 'loading' ? 'Checking AI usage…' : 'AI usage unavailable';
  const copy = { color: C.textMuted, fontSize: 13, lineHeight: 20, flexShrink: 1 };
  return <View style={{ width: '100%', maxWidth: '100%', minWidth: 0, paddingHorizontal: 4, paddingBottom: 8 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label={label} isOpen={open} onOpenChange={setOpen}
        labelStyle={{ color: C.textMuted, fontSize: 13 * fontScale, fontWeight: '500' }} />
    </Host>
    {/* Yoga owns the paragraph width. A content-sized RNHostView inside the
        native disclosure group measures long paragraphs at intrinsic width. */}
    {open ? <View style={{ width: '100%', maxWidth: '100%', minWidth: 0, alignSelf: 'stretch', paddingVertical: 8, paddingHorizontal: 8, gap: 8 }}>
          <Text style={[copy, { color: C.text, fontWeight: '600' }]}>AI usage details</Text>
          {shown ? <>
            <Text style={copy}>{shown.remaining} included messages remain today. Resets {new Date(shown.resetsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(shown.version === 2 ? { timeZone: shown.timezone } : { timeZone: 'UTC' }) })}{shown.version === 2 ? ` (${shown.timezone})` : ' (00:00 UTC)'}.</Text>
            {shown.timezoneFallback ? <Text style={copy}>{shown.timezoneChangePending ? 'Your allowance will switch to a temporary 00:00 UTC reset after the current period. The reset above remains in effect until then.' : 'Your daily AI allowance temporarily resets at 00:00 UTC. Local-midnight reset is currently unavailable for your time zone.'}</Text> : shown.timezoneChangePending ? <Text style={copy}>Your time-zone change takes effect after the current allowance period. It does not add extra messages.</Text> : null}
            {shown.limit > 0 ? <Text style={copy}>{coachUsageExample(shown.limit)}</Text> : <Text style={copy}>Daily included messages are part of Pro. Purchased messages can be used without a subscription.</Text>}
            {shown.version === 2 ? <Text style={copy}>{shown.purchasedRemaining} purchased messages remain{shown.purchasedExpiresAt ? ` · expires ${new Date(shown.purchasedExpiresAt).toLocaleDateString()}` : ''}. Purchased messages do not reset daily. Another pack is available only after this balance reaches zero or expires.</Text> : null}
          </> : <Text style={copy}>Connect and refresh to check your daily allowance. An unavailable count does not mean you have used it up.</Text>}
          <Text style={copy}>Each message with a completed Coach reply uses one message, even if it contains several questions. A follow-up uses another. Opening this page or checking usage does not count. Included Pro messages are used before purchased messages.</Text>
          <Text style={copy}>If a reply is interrupted, recover it before sending it again. A pending reply can temporarily reserve a message. Service failures do not spend purchased messages. Shared service limits can temporarily affect availability.</Text>
          <Text style={copy}>Each chat message disappears from StrideOS history 24 hours after it was sent. Your existing profile, goals and chosen training context remain separate. We do not save new profile memories from chat.</Text>
          {checkedAt && shown ? <Text style={copy}>Last checked {new Date(checkedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Usage on another device appears after refresh.</Text> : null}
          {status === 'unavailable' && shown ? <Text style={copy}>Could not refresh. The count above is the last checked reading.</Text> : null}
          <Pressable accessibilityRole="button" onPress={onRefresh} disabled={sending || status === 'loading'}
            style={{ minHeight: 44, justifyContent: 'center', opacity: sending || status === 'loading' ? 0.5 : 1 }}>
            <Text style={[copy, { color: C.primary, fontWeight: '600' }]}>{status === 'loading' ? 'Refreshing…' : 'Refresh usage'}</Text>
          </Pressable>
        </View> : null}
  </View>;
}
