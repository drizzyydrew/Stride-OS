import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ObservabilityPreferences from '../../../src/components/settings/ObservabilityPreferences';
import { getColors } from '../../../src/theme/colors';
import { setFixtureTheme, useThemeMode } from '../power-review/fixture-state';
import { setFailure } from './fixture';

function Preview() {
  const mode = useThemeMode(); const C = getColors(mode);
  const [failed, setFailed] = useState(false);
  return <main style={{ minHeight: '100dvh', boxSizing: 'border-box', background: C.bg, color: C.text, padding: 20, fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setFixtureTheme(mode === 'dark' ? 'light' : 'dark')}>Theme: {mode}</button>
        <button onClick={() => { setFailure(!failed); setFailed(!failed); }}>Storage failure: {failed ? 'on' : 'off'}</button>
      </nav>
      <p style={{ color: C.textMuted, fontSize: 12 }}>Component preview. In-memory preferences only; no vendor connections.</p>
      <h1 style={{ fontSize: 28 }}>Settings</h1>
      <ObservabilityPreferences />
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
