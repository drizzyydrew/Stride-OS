import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Collapsible, Host, RNHostView } from '@expo/ui';
import { useFocusEffect } from 'expo-router';
import type { Activity } from '../../types/activity';
import type { UnitSystem } from '../../store/settingsStore';
import { useActivityStore } from '../../store/activityStore';
import { useActiveProfile } from '../../store/profileStore';
import { useColors } from '../../theme/useColors';
import { validActivityPowerEstimate } from '../../utils/outdoorPower';
import { automaticPowerInputKey, withAutomaticActivityPower } from '../../utils/automaticActivityPower';
import { profilePowerMass } from '../../utils/profilePower';
import { activityPowerPresentation, formatActivityPowerValue } from '../../utils/activityPowerPresentation';
import { energyReferencePool, equivalentRuntimeSeconds, formatEquivalentTime, formatPowerRatio, pickPowerReference, powerReferencePool, referenceDetails } from '../../utils/powerEquivalents';
import { useThemeMode } from '../../store/themeStore';

function PowerDisclosure({ label, open, onChange, children }: { label: string; open: boolean; onChange: (open: boolean) => void; children: ReactNode }) {
  const C = useColors();
  const mode = useThemeMode();
  return <View style={[s.disclosure, { borderColor: C.border }]}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%' }} ignoreSafeArea="all">
      <Collapsible label={label} labelStyle={{ fontSize: 15, fontWeight: '600', color: C.text }} isOpen={open} onOpenChange={onChange}>
        {open ? <RNHostView matchContents><View style={s.disclosureBody}>{children}</View></RNHostView> : null}
      </Collapsible>
    </Host>
  </View>;
}

export default function ActivityPowerPanel({ activity, units }: { activity: Activity; units: UnitSystem }) {
  const C = useColors();
  const updateActivity = useActivityStore(state => state.updateActivity);
  const history = useActivityStore(state => state.activities);
  const profile = useActiveProfile();
  const mass = profilePowerMass(profile);
  const profileKey = mass ? `${mass.athleteId}:${mass.bodyMassKg}` : 'unavailable';
  const [saveError, setSaveError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [random, setRandom] = useState(() => Math.random());
  const [linkError, setLinkError] = useState(false);
  useFocusEffect(useCallback(() => {
    setRandom(Math.random());
    setInfoOpen(false); setComparisonOpen(false); setDetailsOpen(false); setLinkError(false);
  }, [activity.id]));
  const attempted = useRef<string | null>(null);
  const inputKey = useMemo(() => automaticPowerInputKey(activity), [activity]);
  useEffect(() => {
    const attemptKey = `${activity.id}:${inputKey}:${activity.metrics.powerEstimate?.computedAt ?? ''}:${profileKey}`;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;
    const metrics = withAutomaticActivityPower(activity, profile);
    if (metrics === activity.metrics) return;
    // Do not apply a stale render's metrics over a newer edit or recording enrichment.
    if (useActivityStore.getState().activities.find(item => item.id === activity.id) !== activity) return;
    try {
      updateActivity(activity.id, { metrics });
      setSaveError(false);
    } catch { setSaveError(true); }
  }, [activity, inputKey, profileKey, updateActivity]);

  const presentation = useMemo(() => activityPowerPresentation(activity, units, profile), [activity, units, profile]);
  const comparison = useMemo(() => presentation?.value != null && presentation.value > 0
    ? pickPowerReference(presentation.quantity === 'climbing' ? energyReferencePool() : powerReferencePool(presentation.value), random) : undefined,
  [activity.id, presentation?.value, presentation?.quantity, random]);
  if (!presentation) return null;
  const reference = comparison ? referenceDetails(comparison) : null;
  const seconds = presentation.quantity === 'climbing' && comparison ? equivalentRuntimeSeconds(presentation.value!, comparison.watts) : null;
  const estimate = presentation.estimate;
  const comparable = estimate ? history.filter(item => item.id !== activity.id
    && validActivityPowerEstimate(item, item.metrics.powerEstimate)
    && item.metrics.powerEstimate?.modelId === estimate.modelId && item.metrics.powerEstimate.version === estimate.version
    && item.metrics.powerEstimate.quantity === estimate.quantity)
    .sort((a, b) => b.startTime - a.startTime).slice(0, 5) : [];
  return <View style={[s.root, { borderColor: C.border }]}>
    <View style={s.headingRow}>
      <Text style={[s.heading, { color: C.text }]}>{presentation.title}</Text>
      <TouchableOpacity style={s.infoButton} onPress={() => setInfoOpen(open => !open)} accessibilityRole="button"
        accessibilityLabel={`About ${presentation.title.toLowerCase()}`} accessibilityHint="What it means, why it matters, and how to read it"
        accessibilityState={{ expanded: infoOpen }}>
        <Ionicons name="information-circle-outline" size={22} color={C.primary} />
      </TouchableOpacity>
    </View>
    {presentation.value != null ? <Text selectable style={[s.value, { color: C.text }]}>
      {formatActivityPowerValue(presentation.value)}{presentation.unit === 'kJ' ? ' kJ' : ' W'}
    </Text> : null}
    <Text style={[s.label, { color: C.text }]}>{presentation.label}</Text>
    <Text style={[s.copy, { color: C.textMuted }]}>{presentation.context}</Text>
    {infoOpen ? <View style={[s.help, { borderColor: C.primary }]}>
      {([['What is it?', presentation.help.what], ['Why care?', presentation.help.why], ['How to read it', presentation.help.read]] as const).map(([label, body]) =>
        <View key={label} style={s.helpSection}>
          <Text style={[s.label, { color: C.text }]}>{label}</Text>
          <Text style={[s.copy, { color: C.textMuted }]}>{body}</Text>
        </View>)}
    </View> : null}
    {presentation.value != null && presentation.value > 0 ? <PowerDisclosure label="Everyday equivalent" open={comparisonOpen} onChange={setComparisonOpen}>
      {comparison && reference ? <>
        <Text selectable style={[s.comparison, { color: C.text }]}>
          {presentation.quantity === 'climbing' ? seconds != null
            ? `Energy equivalent of running ${comparison.label} for about ${formatEquivalentTime(seconds)}.`
            : 'An energy comparison is unavailable for this result.'
            : `About ${formatPowerRatio(presentation.value, comparison.watts)} times the reference power draw of ${comparison.label}.`}
        </Text>
        <Text style={[s.copy, { color: C.textMuted }]}>{presentation.quantity === 'climbing'
          ? 'Uphill energy comparison only. No electricity was generated.' : presentation.quantity === 'metabolic'
            ? 'Metabolic power comparison only, not electrical output.' : 'Power comparison only, not electrical output.'}</Text>
      </> : <Text style={[s.copy, { color: C.textMuted }]}>No matching reference is available above 2,000 W.</Text>}
    </PowerDisclosure> : null}
    <PowerDisclosure label="Calculation details" open={detailsOpen} onChange={setDetailsOpen}>
      {presentation.details.map(note => <Text key={note} selectable style={[s.copy, { color: C.textMuted }]}>{note}</Text>)}
      {reference ? <>
        <Text style={[s.label, { color: C.text }]}>Everyday reference</Text>
        <Text style={[s.copy, { color: C.textMuted }]}>{reference.draw}. Approximate operating draw; models and settings vary. Startup and conversion losses are not modeled. No electricity was generated or assumed recoverable.</Text>
        {reference.assumptions.map(note => <Text key={note} style={[s.copy, { color: C.textDim }]}>{note}</Text>)}
        {reference.sources.map(source => <TouchableOpacity key={source.url} style={s.sourceLink} accessibilityRole="link"
          accessibilityLabel={`Open reference: ${source.title}`} onPress={() => { setLinkError(false); void Linking.openURL(source.url).catch(() => setLinkError(true)); }}>
          <Text style={[s.copy, { color: C.primary, flexShrink: 1 }]}>{source.title}</Text>
          <Ionicons name="open-outline" size={16} color={C.primary} />
        </TouchableOpacity>)}
        {linkError ? <Text accessibilityRole="alert" style={[s.copy, { color: C.textMuted }]}>Could not open the reference. Check your connection and try the link again.</Text> : null}
      </> : null}
      {comparable.length ? <>
        <Text style={[s.label, { color: C.text }]}>Same-model history</Text>
        {comparable.map(item => <View key={item.id} style={s.historyRow}>
          <Text style={[s.copy, { color: C.textMuted }]}>{new Date(item.startTime).toLocaleDateString()}</Text>
          <Text style={[s.copy, { color: C.text }]}>{Math.round(item.metrics.powerEstimate!.averageWatts!)} W</Text>
        </View>)}
      </> : null}
    </PowerDisclosure>
    {saveError ? <Text selectable style={[s.copy, { color: C.textMuted }]}>The automatic estimate could not be saved. Reopen this activity after history is available.</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  infoButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  copy: { fontSize: 13, lineHeight: 20 },
  help: { borderLeftWidth: 2, paddingLeft: 14, gap: 16, paddingVertical: 8 },
  helpSection: { gap: 4 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  disclosureBody: { gap: 12, paddingTop: 16, paddingBottom: 4 },
  comparison: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sourceLink: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
});
