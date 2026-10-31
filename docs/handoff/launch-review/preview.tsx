import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';
import AiSharingPreferences from '../../../src/components/settings/AiSharingPreferences';
import AccountPrivacy from '../../../src/components/settings/AccountPrivacy';
import { FeatureTourProvider, useFeatureTourRegistry } from '../../../src/components/featureTour/FeatureTourProvider';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { FEATURE_TOUR_BY_ID } from '../../../src/utils/featureTours';
import { setFixtureTheme, useThemeMode } from '../power-review/fixture-state';
import { getColors } from '../../../src/theme/colors';
import { setAiFailure } from './fixture';

function Preview() {
  const mode = useThemeMode(); const C = getColors(mode);
  const [failure, setFailure] = useState(false);
  const { startTour } = useFeatureTourRegistry();
  return <main style={{ minHeight: '100dvh', background: C.bg, color: C.text, padding: 20, boxSizing: 'border-box', fontFamily: 'system-ui,sans-serif' }}>
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setFixtureTheme(mode === 'dark' ? 'light' : 'dark')}>Theme: {mode}</button>
        <button onClick={() => { setAiFailure(!failure); setFailure(!failure); }}>Storage failure: {failure ? 'on' : 'off'}</button>
        <button onClick={() => startTour('today', 'replay')}>Replay Today</button>
      </nav>
      <p style={{ fontSize: 12 }}>Synthetic component check. No real accounts, vendor connections, deletion, or purchases.</p>
      <h1 style={{ fontSize: 28 }}>Settings</h1>
      <FeatureTourTarget targetId="today.workout" style={{ paddingVertical: 12 }}>
        <View style={{ padding: 16, borderWidth: 1, borderColor: C.border, borderRadius: 8 }}><Text style={{ color: C.text }}>Scheduled training</Text></View>
      </FeatureTourTarget>
      <AiSharingPreferences /><AccountPrivacy />
      {FEATURE_TOUR_BY_ID.today.steps.slice(1).map(step => <FeatureTourTarget key={step.targetId} targetId={step.targetId} style={{ paddingVertical: 16 }}>
        <View style={{ padding: 16, borderWidth: 1, borderColor: C.border, borderRadius: 8 }}><Text style={{ color: C.text, fontSize: 16 }}>{step.title}</Text></View>
      </FeatureTourTarget>)}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><FeatureTourProvider><Preview /></FeatureTourProvider></SafeAreaProvider>);
