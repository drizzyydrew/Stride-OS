import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Host, Switch } from '@expo/ui';
import { useSettingsStore } from '../../store/settingsStore';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { isAutoPauseEnabled } from '../../utils/autoPause';
import { setActivityAutoPauseEnabled } from '../../utils/autoPauseSettings';

/** Behavior control, deliberately separate from spoken pause announcements. */
export default function RunningAutoPauseControl({ paused = false }: { paused?: boolean }) {
  const C = useColors();
  const theme = useThemeMode();
  const mode = useSettingsStore(state => state.autoPauseMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(() => useSettingsStore.persist.hasHydrated());
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const loading = useSettingsStore.persist.onHydrate(() => setReady(false));
    const finished = useSettingsStore.persist.onFinishHydration(() => setReady(true));
    setReady(useSettingsStore.persist.hasHydrated());
    return () => { loading(); finished(); };
  }, []);
  const enabled = isAutoPauseEnabled(mode, 'running');
  async function change(next: boolean) {
    if (busy.current || !useSettingsStore.persist.hasHydrated()) return;
    busy.current = true;
    setSaving(true); setError('');
    try {
      // Read current settings at the action, preserving any cycling change
      // made since this component rendered.
      const settings = useSettingsStore.getState();
      await settings.setAutoPauseMode(setActivityAutoPauseEnabled(settings.autoPauseMode, 'running', next));
    } catch {
      if (mounted.current) setError('This choice could not be saved. Check Auto-pause before restarting the app.');
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  return <View style={{ gap: 6 }}>
    <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%' }}>
      <Switch label="Auto-pause runs" value={enabled} disabled={saving || !ready}
        onValueChange={next => { void change(next); }} />
    </Host>
    <Text style={{ fontSize: 12, lineHeight: 17, color: C.textMuted }}>
      {!ready ? 'Loading your auto-pause preference…'
        : paused ? 'Turning auto-pause off leaves this run paused until you tap Resume Run.'
        : enabled ? 'Pauses when stopped and resumes when moving. Voice announcements are separate.'
          : 'Keeps recording when you stop moving. You can still pause manually.'}
    </Text>
    <Text style={{ fontSize: 12, lineHeight: 17, color: C.textMuted }}>Applies to GPS runs in Running and Activity, including future runs.</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: C.critical, fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
