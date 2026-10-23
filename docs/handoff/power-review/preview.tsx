import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Ionicons } from '@expo/vector-icons';
import ActivityPowerPanel from '../../../src/components/activity/ActivityPowerPanel';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import BrandChevrons from '../../../src/components/ui/BrandChevrons';
import type { Activity } from '../../../src/types/activity';
import { getColors } from '../../../src/theme/colors';
import { setFixtures, setFixtureTheme, useActivityStore, useThemeMode } from './fixture-state';
import serifFont from '../../../node_modules/@expo-google-fonts/cormorant-garamond/700Bold/CormorantGaramond_700Bold.ttf';

const start = 1_700_000_000_000;
const base = { source: 'manual', indoor: false, startTime: start, createdAt: start, updatedAt: start,
  status: 'completed', rpe: 5, notes: 'Synthetic preview only' };
const fixtures = [
  { ...base, id: 'hike', activityType: 'hiking', metrics: { activeTimeSeconds: 20040, durationSeconds: 20040, elevationGainMeters: 767.69, metricSources: { elevation: 'manual_entry' } } },
  { ...base, id: 'metabolic', activityType: 'running', source: 'tracked', workoutInstanceId: 'synthetic', metrics: { activeTimeSeconds: 100,
    powerEstimate: { modelId: 'stride-running-metabolic', version: '3', computedAt: start, quantity: 'running_metabolic_estimate', sport: 'running', averageWatts: 728.4,
      coverageSeconds: 70, coverageRatio: 0.7, inputs: [], assumptions: ['Synthetic saved model result; no athlete data.'] } } },
  { ...base, id: 'device', activityType: 'cycling', source: 'tracked', endTime: start + 100000, metrics: { activeTimeSeconds: 100,
    powerSamples: Array.from({ length: 101 }, (_, index) => ({ timestamp: start + index * 1000, watts: 285, kind: 'measured', source: 'cycling_power_meter', sport: 'cycling' })) } },
  { ...base, id: 'unavailable', activityType: 'running', metrics: {} },
  ...[0, 26, 2001].map(watts => ({ ...base, id: `entered-${watts}`, indoor: true, activityType: 'indoor_cycling', metrics: { cyclingPowerWatts: watts, metricSources: { power: 'manual_entry' } } })),
] as Activity[];
setFixtures(fixtures);

function ActivityFrame({ activity }: { activity: Activity }) {
  const C = getColors(useThemeMode());
  const name = activity.activityType === 'hiking' ? 'Hiking' : activity.activityType === 'running' ? 'Running' : 'Cycling';
  return <section aria-label={`${name} app preview`} style={{ background: C.bg, color: C.text, minWidth: 0, minHeight: 740, display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
      <BrandChevrons /><span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700 }}>STRIDEOS</span><span style={{ width: 26 }} />
    </div>
    <ScreenHeader title={name} eyebrow="ACTIVITY DETAIL" />
    <div style={{ padding: '12px 20px 28px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, fontSize: 13, paddingBottom: 22 }}>
        <span>Training load</span><span>Sample activity</span>
      </div>
      <ActivityPowerPanel key={activity.id} activity={activity} units="imperial" />
    </div>
    <div aria-label="Navigation illustration" style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 8px 20px', borderTop: `1px solid ${C.border}` }}>
      {([['grid-outline', 'Today'], ['calendar-outline', 'Calendar'], ['footsteps-outline', 'Running'], ['chatbubble-ellipses-outline', 'AI Coach'], ['menu-outline', 'More']] as const).map(([icon, label]) =>
        <div key={label} style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 7, fontSize: 10, color: C.textMuted }}><Ionicons name={icon} size={23} color={C.textMuted} />{label}</div>)}
    </div>
  </section>;
}

function Preview() {
  const [id, setId] = useState(new URLSearchParams(location.search).get('activity') ?? 'hike');
  const [units, setUnits] = useState<'metric' | 'imperial'>('imperial');
  const mode = useThemeMode();
  const C = getColors(mode);
  const records = useActivityStore(state => state.activities);
  const item = useActivityStore(state => state.activities.find(activity => activity.id === id)!);
  if (new URLSearchParams(location.search).has('gallery')) return <main style={{ minHeight: '100dvh', boxSizing: 'border-box', background: C.bg, padding: 24, fontFamily: 'system-ui, sans-serif', color: C.text }}>
    <style>{`@font-face{font-family:CormorantGaramond_700Bold;src:url('${serifFont}')}`}</style>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 20, maxWidth: 1140, margin: '0 auto' }}>
      {['hike', 'metabolic', 'device'].map(id => <ActivityFrame key={id} activity={records.find(item => item.id === id)!} />)}
    </div>
    <p style={{ color: C.textMuted, textAlign: 'center', fontSize: 12, margin: '18px 0 0' }}>Local component preview with sample data. Not an installed-device screenshot.</p>
  </main>;
  return <main style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', padding: '16px 20px 48px', boxSizing: 'border-box' }}>
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <nav aria-label="Preview controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <select aria-label="Synthetic activity" value={id} onChange={event => setId(event.target.value)}>{fixtures.map(item => <option key={item.id}>{item.id}</option>)}</select>
        <button onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}>Units: {units}</button>
        <button onClick={() => setFixtureTheme(mode === 'dark' ? 'light' : 'dark')}>Theme: {mode}</button>
      </nav>
      <p style={{ fontSize: 12, color: C.textMuted }}>Synthetic UI preview. No Health records or device connection.</p>
      <header style={{ padding: '16px 0 24px', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px' }}>STRIDEOS / ACTIVITY DETAIL</p>
        <h1 style={{ fontSize: 28, margin: 0 }}>{item.activityType === 'hiking' ? 'Hiking' : item.activityType === 'running' ? 'Running' : 'Cycling'}</h1>
      </header>
      <ActivityPowerPanel key={id} activity={item} units={units} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
