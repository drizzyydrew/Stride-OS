import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Switch, Text, useWindowDimensions, View } from 'react-native';
import ActivityRouteReview from '../../../src/components/activity/ActivityRouteReview';
import ShareStudio from '../../../src/components/share/ShareStudio';
import BrandChevrons from '../../../src/components/ui/BrandChevrons';
import ActiveOutdoorSession from '../../../src/components/activity/ActiveOutdoorSession';
import { useThemeStore } from '../../../src/store/themeStore';
import type { Activity } from '../../../src/types/activity';

const startTime = 1_760_000_000_000;
const activity = {
  id: 'visual-qa-fixture', activityType: 'hiking', subtype: 'outdoor', startTime, endTime: startTime + 240_000,
  metrics: { durationSeconds: 240, activeTimeSeconds: 240, distanceMeters: 720, elevationGainMeters: 65,
    averageHeartRateBpm: 125,
    routeCoordinates: Array.from({ length: 241 }, (_, i) => ({ latitude: i * 3 / 111195, longitude: Math.sin(i / 35) * 0.0008, timestamp: startTime + i * 1000, altitudeMeters: 100 + Math.sin(i / 65) * 35 })),
    rawHeartRateSamples: Array.from({ length: 241 }, (_, i) => ({ timestamp: startTime + i * 1000, bpm: 110 + i % 40, source: 'apple_watch' })),
  },
} as Activity;

function QA() {
  const { height } = useWindowDimensions();
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [format, setFormat] = useState<'square' | 'story'>('square');
  const [editorial, setEditorial] = useState(false);
  const [cycling, setCycling] = useState(false);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [prompts, setPrompts] = useState(false);
  const selected = cycling ? { ...activity, activityType: 'cycling', metrics: { ...activity.metrics,
    powerSamples: Array.from({ length: 241 }, (_, i) => ({ timestamp: startTime + i * 1000, watts: 210 + i % 40, sport: 'cycling', kind: 'measured', source: 'cycling_power_meter' })),
  } } as Activity : activity;
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  return <main style={{ maxWidth: 420, margin: '0 auto', padding: 16, color: mode === 'dark' ? '#F5F0E8' : '#151515', background: mode === 'dark' ? '#11100F' : '#ECE6DD', minHeight: '100vh' }}>
    <p style={{ font: '12px sans-serif' }}>Visual QA fixture, not a real activity</p>
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>Theme</button>
      <button onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}>Units</button>
      <button onClick={() => setFormat(format === 'square' ? 'story' : 'square')}>Format</button>
      <button onClick={() => setEditorial(!editorial)}>Variant</button>
      <button onClick={() => setCycling(!cycling)}>Sport</button>
      <button onClick={() => setLive(!live)}>View</button>
      <View><BrandChevrons /></View><View><BrandChevrons direction="down" /></View>
    </nav>
    {live ? <View style={{ height: Math.max(440, height - 160) }}><ActiveOutdoorSession name={cycling ? 'Ride' : 'Hike'} activityType={cycling ? 'cycling' : 'hiking'}
      paused={paused} startedAt={startTime} points={activity.metrics.routeCoordinates!} recordingPauses={[]}
      timeLabel="42:18" distanceLabel={units === 'metric' ? '4.20' : '2.61'} distanceUnit={units === 'metric' ? 'km' : 'mi'}
      primaryMetrics={[{ label: cycling ? 'Speed' : 'Avg pace', value: cycling ? units === 'metric' ? '18.4 km/h' : '11.4 mph' : units === 'metric' ? '10:04 /km' : '16:12 /mi' }, { label: 'Heart rate', value: '138 bpm' }, { label: 'Elev gain', value: units === 'metric' ? '164 m' : '538 ft' }]}
      additionalMetrics={[{ label: 'Elev loss', value: units === 'metric' ? '82 m' : '269 ft' }, ...(cycling ? [{ label: 'Measured power', value: '230 W' }] : [{ label: 'Cadence', value: '112 spm' }])]}
      watchStatus="Apple Watch" watchDetail="Synthetic fixture, not a connected device"
      coachingControls={<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: mode === 'dark' ? '#F5F0E8' : '#151515' }}>Navigation prompts</Text><Switch accessibilityLabel="QA navigation prompts" value={prompts} onValueChange={setPrompts} /></View>}
      onPauseResume={() => setPaused(!paused)} onFinish={() => setLive(false)} /></View> : <>
      <ActivityRouteReview activity={selected} units={units} />
      <div style={{ marginTop: 24 }}><ShareStudio activity={selected} units={units} variant={editorial ? 'editorial_card' : 'minimal_card'} format={format} /></div>
    </>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<QA />);
