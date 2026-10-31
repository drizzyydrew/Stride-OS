import { Host, Switch } from '@expo/ui';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiConsent, useAiConsent } from '../../store/aiConsentStore';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { LEGAL_URLS } from '../../utils/legal';

export default function AiSharingPreferences() {
  const C = useColors();
  const mode = useThemeMode();
  const consent = useAiConsent();
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>AI Coach Privacy</Text>
    <Text style={[s.copy, { color: C.textMuted }]}>With your permission, AI Coach sends your messages and selected profile, training, recovery, hydration, and movement-analysis context to Anthropic (Claude), through StrideOS's server, to answer you. This can include health information. Raw videos and route coordinates are not included in this chat request.</Text>
    <Text style={[s.copy, { color: C.textMuted }]}>Optional. You can keep using tracking, your calendar, and on-device training guidance without AI sharing. Turning this off stops new chat requests; it cannot recall data already sent.</Text>
    <Host style={{ width: '100%' }} matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all">
      <Switch label="Allow sharing with Anthropic for AI Coach" value={consent.allowed}
        disabled={!consent.ready || !consent.owner || consent.saving}
        onValueChange={value => { void aiConsent.setAllowed(value); }} />
    </Host>
    {consent.error ? <>
      <Text accessibilityRole="alert" style={[s.copy, { color: C.critical }]}>Your choice could not be saved. AI sharing is off for this session. Unlock your device and save the off choice again before closing the app.</Text>
      <TouchableOpacity style={s.link} accessibilityRole="button" accessibilityLabel="Retry saving AI sharing off" disabled={consent.saving}
        onPress={() => { void aiConsent.setAllowed(false); }}>
        <Ionicons name="refresh-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>Save AI sharing off</Text>
      </TouchableOpacity>
    </> : null}
    <TouchableOpacity style={s.link} accessibilityRole="link" accessibilityLabel="Read the StrideOS privacy policy"
      onPress={() => { void Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined); }}>
      <Ionicons name="shield-checkmark-outline" size={18} color={C.primary} /><Text style={[s.copy, { color: C.primary }]}>Privacy policy</Text>
    </TouchableOpacity>
    <Text style={[s.copy, { color: C.textMuted }]}>AI guidance can be wrong. It is not diagnosis, treatment, or emergency care.</Text>
  </View>;
}
const s = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 20, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700' },
  copy: { fontSize: 13, lineHeight: 20 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
