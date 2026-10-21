import React from 'react';
import { createRoot } from 'react-dom/client';
import BadgeShareCanvas from '../../../src/components/share/BadgeShareCanvas';
import BrandChevrons from '../../../src/components/ui/BrandChevrons';
import { useThemeStore } from '../../../src/store/themeStore';
import type { ShareStudioFormat, ShareStudioVariant } from '../../../src/components/share/ShareStudio';

const query = new URLSearchParams(location.search);
const variant = (query.get('variant') ?? 'minimal_card') as ShareStudioVariant;
const format = (query.get('format') ?? 'story') as ShareStudioFormat;
const monthly = query.get('badge') === 'monthly';
useThemeStore.setState({ mode: query.get('theme') === 'light' ? 'light' : 'dark' });

function QA() {
  if (query.has('matrix')) return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
    {[320, 430].flatMap(width => ['challenge_august_base_builder', 'monthly_run_200k'].flatMap(id =>
      (['square', 'story'] as const).flatMap(format =>
        (['minimal_card', 'transparent_overlay', 'editorial_card'] as const).map(variant =>
          <div key={`${width}:${id}:${format}:${variant}`} style={{ width }}>
            <BadgeShareCanvas achievement={{ id: id as 'monthly_run_200k', title: id,
              category: id.startsWith('challenge') ? 'challenges' : 'monthly_distance', state: 'earned' }}
              units="metric" format={format} variant={variant} />
          </div>))))}
  </div>;
  return <main style={{ maxWidth: 430, margin: 'auto', minHeight: '100dvh' }}>
    <header style={{ height: 72, display: 'flex', alignItems: 'center', position: 'sticky', top: 0,
      background: '#11100f', color: '#bbb7b0', zIndex: 1, padding: '0 22px' }}>
      <button aria-label="Back" style={{ background: 'none', border: 0 }}><BrandChevrons /></button>
      <strong style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', font: 'bold 12px sans-serif' }}>STRIDEOS</strong>
    </header>
    <div style={{ padding: 18 }}>
      <BadgeShareCanvas achievement={{ id: monthly ? 'monthly_run_200k' : 'challenge_august_base_builder',
        title: monthly ? '200K Month' : 'August Base Builder', category: monthly ? 'monthly_distance' : 'challenges', state: 'earned' }}
        units="metric" variant={variant} format={format} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QA />);
