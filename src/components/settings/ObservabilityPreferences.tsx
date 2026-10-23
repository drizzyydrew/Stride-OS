import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Host, Switch } from '@expo/ui';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { observabilityConsent, useObservabilityConsent } from '../../store/observabilityConsentStore';
import { observability } from '../../lib/observability';

export default function ObservabilityPreferences() {
  const C = useColors();
  const mode = useThemeMode();
  const consent = useObservabilityConsent();
  useEffect(() => { observability.track('settings_opened'); }, []);
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>Privacy & Diagnostics</Text>
    {([
      ['usage', 'Share app usage', 'Send basic feature-use events to PostHog. No health data, routes, messages, or screen recordings.'],
      ['diagnostics', 'Share error reports', 'Send sanitized JavaScript errors to Sentry. No native crash reports, screenshots, or private content.'],
    ] as const).map(([key, label, description]) => <View key={key} style={s.row}>
      <Host style={{ width: '100%' }} matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all">
        <Switch label={label} value={consent[key]} disabled={!consent.ready || !consent.owner || consent.saving}
          onValueChange={enabled => { void observabilityConsent.setConsent(key, enabled); }} />
      </Host>
      <Text style={[s.copy, { color: C.textMuted }]}>{description}</Text>
    </View>)}
    <Text style={[s.copy, { color: C.textMuted }]}>Optional and off by default. Turning off stops new reports; it does not delete reports already sent.</Text>
    {consent.error ? <>
      <Text accessibilityRole="alert" style={[s.copy, { color: C.critical }]}>Privacy preferences could not be saved or loaded. Sharing is off for this session. Save the off setting again before closing the app.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry saving sharing off" style={s.retry}
        onPress={() => { void observabilityConsent.setConsent('usage', false); void observabilityConsent.setConsent('diagnostics', false); }}>
        <Ionicons name="refresh-outline" size={20} color={C.primary} />
        <Text style={[s.copy, { color: C.primary }]}>Save sharing off</Text>
      </TouchableOpacity>
    </> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 20, gap: 16 },
  heading: { fontSize: 18, fontWeight: '700' },
  row: { gap: 8 },
  copy: { fontSize: 13, lineHeight: 20 },
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
