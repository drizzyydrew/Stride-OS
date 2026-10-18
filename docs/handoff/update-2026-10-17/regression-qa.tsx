import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Text, View } from 'react-native';
import ShareStudio, { SHARE_STUDIO_FORMATS, SHARE_STUDIO_VARIANTS, SHARE_STUDIO_ACHIEVEMENT_VARIANT, type ShareStudioFormat, type ShareStudioVariant } from '../../../src/components/share/ShareStudio';
import ShareOptionGrid from '../../../src/components/share/ShareOptionGrid';
import ActiveOutdoorSession from '../../../src/components/activity/ActiveOutdoorSession';
import WatchConnectionStatus from '../../../src/components/watch/WatchConnectionStatus';
import { useThemeStore } from '../../../src/store/themeStore';
import type { Activity } from '../../../src/types/activity';
import type { StrideWatchStatus } from '../../../modules/stride-watch-connectivity/src';
import { OUTDOOR_SPORTS, type OutdoorSport } from '../../../src/utils/outdoorSports';
import type { EvaluatedAchievement } from '../../../src/utils/achievementSystem';

const query = new URLSearchParams(location.search);
const startTime = 1_760_000_000_000;
const points = Array.from({ length: 241 }, (_, i) => ({ latitude: 45 + i * 0.00002,
  longitude: 7 + Math.sin(i / 45) * 0.0009, timestamp: startTime + i * 1000, altitudeMeters: 900 + i / 3, accuracyMeters: 5 }));
const status = { isSupported: true, isPaired: true, isWatchAppInstalled: true, isReachable: false,
  activationState: 'activated', lastError: 'Watch app launch failed: Unable to open URLs while locked or passcode compliance is pending.' } as StrideWatchStatus;

function QA() {
  const [view, setView] = useState(query.get('view') ?? 'share');
  const [sport, setSport] = useState<OutdoorSport>((query.get('sport') as OutdoorSport) || 'hiking');
  const [variant, setVariant] = useState<ShareStudioVariant>('transparent_overlay');
  const [format, setFormat] = useState<ShareStudioFormat>('square');
  const [long, setLong] = useState(query.has('long'));
  const [paused, setPaused] = useState(false);
  const [retried, setRetried] = useState(false);
  const [badge, setBadge] = useState(false);
  const mode = useThemeStore(state => state.mode);
  const setMode = useThemeStore(state => state.setMode);
  const duration = long ? 446399 : 240;
  const activity = { id: 'synthetic-qa', activityType: sport, startTime, endTime: startTime + duration * 1000,
    metrics: { durationSeconds: duration, activeTimeSeconds: duration, distanceMeters: long ? 12345670 : 720, elevationGainMeters: long ? 12345 : 65,
      averageHeartRateBpm: 125, routeCoordinates: points,
      ...(sport === 'cycling' ? { cyclingPowerWatts: 230, metricSources: { power: 'cycling_power_meter' }, powerSamples: points.map(point => ({ timestamp: point.timestamp, watts: 230,
        sport: 'cycling', kind: 'measured', source: 'cycling_power_meter' })) } : {}) } } as Activity;
  const watch = <WatchConnectionStatus status={status} active paused={paused} workoutInstanceId="synthetic-qa"
    onRetry={() => setRetried(true)} />;
  return <main style={{ maxWidth: 430, margin: '0 auto', background: mode === 'dark' ? '#11100f' : '#f2f2f2', color: mode === 'dark' ? 'white' : '#111', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
    <nav style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <select aria-label="Fixture view" value={view} onChange={e => setView(e.target.value)}><option value="share">Share</option><option value="live">Live</option></select>
      <select aria-label="Fixture sport" value={sport} onChange={e => setSport(e.target.value as OutdoorSport)}>{Object.entries(OUTDOOR_SPORTS).map(([id, spec]) => <option key={id} value={id}>{spec.label}</option>)}</select>
      <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>Theme</button>
      <button onClick={() => setLong(!long)}>Long values</button>
      <button onClick={() => { setBadge(!badge); setVariant(badge ? 'transparent_overlay' : 'activity_achievement'); }}>Badge</button>
    </nav>
    <p style={{ margin: 8, font: '12px sans-serif' }}>Synthetic regression fixture. No device connection.{retried ? ' Retry received.' : ''}</p>
    {view === 'live' ? <View style={{ flex: 1, minHeight: 0 }}><ActiveOutdoorSession name={OUTDOOR_SPORTS[sport].label} activityType={sport}
      paused={paused} startedAt={startTime} points={points} recordingPauses={[]}
      timeLabel={long ? '123:59:59' : '00:00'} distanceLabel={long ? '12345.67' : '0.00'} distanceUnit="km"
      primaryMetrics={[{ label: OUTDOOR_SPORTS[sport].speedBased ? 'Average speed' : 'Average pace', value: OUTDOOR_SPORTS[sport].speedBased ? '18.4 km/h' : '13:03 /km' }, { label: 'Heart rate', value: '125 bpm', detail: 'Apple Watch sample' }, { label: 'Elevation gain', value: '140 m' }]}
      additionalMetrics={[{ label: 'Current speed', value: long ? '12345.67 km/h' : '4.8 km/h' }, { label: 'Device power (estimated)', value: '234 W', detail: long ? 'LongUnbrokenSyntheticSourceTokenForWrapping' : 'Synthetic source' }, { label: 'Cadence', value: '112 spm' }]}
      watchConnection={watch} coachingControls={<Text style={{ color: mode === 'dark' ? 'white' : '#111' }}>Navigation prompts off</Text>}
      onPauseResume={() => setPaused(!paused)} onFinish={() => setView('share')} /></View>
      : <div style={{ overflowY: 'auto', padding: 28 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <ShareOptionGrid options={badge ? [...SHARE_STUDIO_VARIANTS, SHARE_STUDIO_ACHIEVEMENT_VARIANT] : SHARE_STUDIO_VARIANTS} value={variant} onChange={setVariant} />
          <ShareOptionGrid options={SHARE_STUDIO_FORMATS} value={format} onChange={setFormat} />
          <ShareStudio activity={activity} achievement={badge ? { id: 'first_half_marathon', title: 'First Half Marathon', category: 'firsts', state: 'earned', displayTarget: '21.1 km', achievedDate: startTime, shareCardEligibility: true } as EvaluatedAchievement : undefined} units="metric" variant={variant} format={format} />
          {watch}
        </View>
      </div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<QA />);
