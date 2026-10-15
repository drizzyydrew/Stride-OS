import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import ActiveOutdoorSession from '../../../src/components/activity/ActiveOutdoorSession';
import { OUTDOOR_SPORTS, type OutdoorSport } from '../../../src/utils/outdoorSports';
import { CYCLING_POWER_ASSUMPTIONS } from '../../../src/utils/outdoorPower';
import { useThemeStore } from '../../../src/store/themeStore';
import { useColors } from '../../../src/theme/useColors';

const startedAt = 1_760_000_000_000;
const points = Array.from({ length: 241 }, (_, i) => ({ latitude: 45 + i * 0.00002,
  longitude: 7 + Math.sin(i / 45) * 0.0009, timestamp: startedAt + i * 1000, altitudeMeters: 900 + i / 3, accuracyMeters: 5 }));
const query = new URLSearchParams(location.search);

function QA() {
  const C = useColors();
  const [sport, setSport] = useState<OutdoorSport>((query.get('sport') as OutdoorSport) || 'walking');
  const [paused, setPaused] = useState(false);
  const [gps, setGps] = useState(true);
  const [metric, setMetric] = useState(true);
  const [intervals, setIntervals] = useState(true);
  const [navigation, setNavigation] = useState(true);
  const [mass, setMass] = useState(false);
  const [finished, setFinished] = useState(false);
  const [watch, setWatch] = useState('Connected');
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  const speedBased = OUTDOOR_SPORTS[sport].speedBased;
  const runWalk = sport === 'running' || sport === 'walking';
  return <main style={{ height: '100dvh', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text }}>
    <nav aria-label="Synthetic fixture controls" style={{ padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${C.border}` }}>
      <select aria-label="Fixture sport" value={sport} onChange={event => { setSport(event.target.value as OutdoorSport); setMass(false); }}>
        {Object.entries(OUTDOOR_SPORTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select>
      <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>Theme</button>
      <button onClick={() => setMetric(!metric)}>Units</button>
      <button onClick={() => setGps(!gps)}>GPS</button>
      <button onClick={() => setWatch(watch === 'Connected' ? 'Watch app not reachable' : 'Connected')}>Watch</button>
    </nav>
    <div style={{ font: '11px sans-serif', padding: '7px 16px' }}>Synthetic active-session fixture{finished ? ' · Finish callback received' : ''}</div>
    <View style={{ flex: 1, minHeight: 0 }}>
      <ActiveOutdoorSession name={OUTDOOR_SPORTS[sport].label} activityType={sport} paused={paused} startedAt={startedAt}
        points={gps ? points : []} recordingPauses={[]} timeLabel="42:18" distanceLabel={metric ? '3.24' : '2.01'} distanceUnit={metric ? 'km' : 'mi'}
        primaryMetrics={[
          { label: speedBased ? 'Avg speed' : 'Avg pace', value: speedBased ? metric ? '18.4 km/h' : '11.4 mph' : metric ? '13:03 /km' : '21:00 /mi' },
          { label: 'Heart rate', value: paused ? '--' : '128 bpm', detail: paused ? undefined : 'Apple Watch' },
          { label: 'Elevation gain', value: metric ? '140 m' : '459 ft' },
        ]}
        additionalMetrics={[
          { label: speedBased ? 'Current speed' : 'Current pace', value: paused ? '--' : speedBased ? metric ? '20.4 km/h' : '12.7 mph' : metric ? '12:45 /km' : '20:31 /mi' },
          { label: 'Elevation loss', value: metric ? '52 m' : '171 ft' },
          ...(['running', 'walking', 'hiking', 'cycling'].includes(sport) ? [{ label: 'Cadence', value: paused ? '--' : sport === 'cycling' ? '86 rpm' : '112 spm' }] : []),
          ...(sport === 'cycling' || sport === 'running' ? [{ label: sport === 'cycling' ? 'Estimated cycling power' : 'Device power (est.)', value: sport === 'cycling' && mass && !paused ? '210 W' : '--' }] : []),
        ]}
        watchStatus={watch} watchDetail="Recording not yet confirmed"
        interval={runWalk ? { name: 'Walk', remaining: 48 } : undefined}
        instruction={navigation ? 'Continue on the trail for 250 m' : null}
        coachingControls={<>
          {runWalk ? <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>Interval voice prompts</Text><Switch accessibilityLabel="Interval voice prompts" value={intervals} onValueChange={setIntervals} />
          </View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>Navigation prompts</Text><Switch accessibilityLabel="Navigation prompts" value={navigation} onValueChange={setNavigation} />
          </View>
        </>}
        powerSettings={sport === 'cycling' ? <>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: mass }} accessibilityLabel="Confirm fixture profile mass" onPress={() => setMass(!mass)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: C.text }}>{mass ? '[x]' : '[ ]'} Estimate using profile mass: 70 kg</Text>
          </TouchableOpacity>
          {mass ? <><Text style={{ color: C.textMuted, fontSize: 12 }}>Confirmed profile mass 70 kg; assumed bike mass 10 kg. Steady-speed approximation.</Text>
            {CYCLING_POWER_ASSUMPTIONS.map(text => <Text key={text} style={{ color: C.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>{text}</Text>)}
          </> : null}
        </> : null}
        onPauseResume={() => setPaused(!paused)} onFinish={() => setFinished(true)} />
    </View>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QA />);
