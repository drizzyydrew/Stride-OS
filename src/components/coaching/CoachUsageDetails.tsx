import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView } from '@expo/ui';
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
  const copy = { color: C.textMuted, fontSize: 13, lineHeight: 20 };
  return <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label={label} isOpen={open} onOpenChange={setOpen}
        labelStyle={{ color: C.textMuted, fontSize: 13 * fontScale, fontWeight: '500' }}>
        {open ? <RNHostView matchContents><View style={{ paddingVertical: 8, gap: 8 }}>
          <Text style={[copy, { color: C.text, fontWeight: '600' }]}>AI usage details</Text>
          {shown ? <>
            <Text style={copy}>{shown.remaining} requests remain in your personal daily allowance. Resets {new Date(shown.resetsAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })} (00:00 UTC).</Text>
            <Text style={copy}>{coachUsageExample(shown.limit)}</Text>
          </> : <Text style={copy}>Connect and refresh to check your daily allowance. An unavailable count does not mean you have used it up.</Text>}
          <Text style={copy}>Each message accepted for AI processing uses one request, even if it contains several questions. A follow-up message uses another. Opening this page or checking usage does not count. A request may still count if the AI reply fails.</Text>
          <Text style={copy}>Once your allowance is used, chat resumes after the daily reset. Your saved training and on-device Insights stay available. Shared service limits can also temporarily affect chat.</Text>
          {checkedAt && shown ? <Text style={copy}>Last checked {new Date(checkedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Usage on another device appears after refresh.</Text> : null}
          {status === 'unavailable' && shown ? <Text style={copy}>Could not refresh. The count above is the last checked reading.</Text> : null}
          <Pressable accessibilityRole="button" onPress={onRefresh} disabled={sending || status === 'loading'}
            style={{ minHeight: 44, justifyContent: 'center', opacity: sending || status === 'loading' ? 0.5 : 1 }}>
            <Text style={[copy, { color: C.primary, fontWeight: '600' }]}>{status === 'loading' ? 'Refreshing…' : 'Refresh usage'}</Text>
          </Pressable>
        </View></RNHostView> : null}
      </Collapsible>
    </Host>
  </View>;
}
