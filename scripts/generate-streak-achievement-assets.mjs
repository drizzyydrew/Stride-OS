import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const tiers = [
  { id: 'streak_3_day', slug: '3-day', name: '3-Day Streak', threshold: 3, badge: '3', tier: 1, outer: '#421010', mid: '#7A1717', core: '#B43A28', ring: '#7A1717', glow: '#2A0B0B', rings: 1 },
  { id: 'streak_1_week', slug: '1-week', name: '1-Week Streak', threshold: 7, badge: '7', tier: 2, outer: '#65110F', mid: '#B3221C', core: '#D9551D', ring: '#B3221C', glow: '#541313', rings: 2 },
  { id: 'streak_30_day', slug: '30-day', name: '30-Day Streak', threshold: 30, badge: '30', tier: 3, outer: '#8F2513', mid: '#D9551D', core: '#F29A20', ring: '#D9551D', glow: '#792113', rings: 2 },
  { id: 'streak_50_day', slug: '50-day', name: '50-Day Streak', threshold: 50, badge: '50', tier: 4, outer: '#B84C14', mid: '#F29A20', core: '#FFD449', ring: '#F29A20', glow: '#9A3E11', rings: 3 },
  { id: 'streak_60_day', slug: '60-day', name: '60-Day Streak', threshold: 60, badge: '60', tier: 5, outer: '#D98216', mid: '#FFD449', core: '#FFF1BA', ring: '#FFD449', glow: '#B76A12', rings: 3 },
  { id: 'streak_90_day', slug: '90-day', name: '90-Day Streak', threshold: 90, badge: '90', tier: 6, outer: '#E8BB63', mid: '#FFF1BA', core: '#FFFDF3', ring: '#FFF1BA', glow: '#C99C50', rings: 3 },
  { id: 'streak_6_month', slug: '6-month', name: '6-Month Streak', threshold: 183, badge: '6M', tier: 7, outer: '#F2DFB8', mid: '#FFFDF3', core: '#FFFFFF', ring: '#FFFDF3', glow: '#DCC9B1', rings: 4 },
];

const hex = [
  '56,5 100,31 100,81 56,107 12,81 12,31',
  '56,13 93,35 93,77 56,99 19,77 19,35',
  '56,21 86,39 86,73 56,91 26,73 26,39',
  '56,29 79,43 79,69 56,83 33,69 33,43',
];

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content.trim()}\n`);
}

function badgeBody(tier, { locked = false } = {}) {
  const baseId = `base-${tier.id}${locked ? '-locked' : ''}`;
  const flameId = `flame-${tier.id}${locked ? '-locked' : ''}`;
  const ring = locked ? '#6F6A61' : tier.ring;
  const core = locked ? '#C7BBA9' : tier.core;
  const mid = locked ? '#7F756A' : tier.mid;
  const outer = locked ? '#393530' : tier.outer;
  const ink = locked ? '#D8D0C1' : ['streak_60_day', 'streak_90_day', 'streak_6_month'].includes(tier.id) ? '#17120B' : '#F3D0BC';
  const ringOpacity = locked ? 0.42 : 0.88;
  const glowOpacity = locked ? 0.12 : 0.32 + Math.min(0.22, tier.tier * 0.025);
  const ringMarkup = hex.slice(0, tier.rings).map((points, index) => (
    `<polygon points="${points}" fill="none" stroke="${index === 0 ? ring : index === tier.rings - 1 ? core : '#DCC9B1'}" stroke-width="${index === 0 ? 2.1 : 1.15}" opacity="${Math.max(0.22, ringOpacity - index * 0.15).toFixed(2)}"/>`
  )).join('');

  return `
  <defs>
    <linearGradient id="${baseId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080808"/>
      <stop offset="0.62" stop-color="#11100E"/>
      <stop offset="1" stop-color="${locked ? '#201D1A' : '#211712'}"/>
    </linearGradient>
    <linearGradient id="${flameId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${core}"/>
      <stop offset="0.48" stop-color="${mid}"/>
      <stop offset="1" stop-color="${outer}"/>
    </linearGradient>
  </defs>
  <polygon points="${hex[0]}" fill="url(#${baseId})" stroke="${ring}" stroke-width="2.8" opacity="${locked ? 0.72 : 1}"/>
  <polygon points="56,10 95,33 95,79 56,102 17,79 17,33" fill="#0E0E0F" opacity="${locked ? 0.8 : 0.93}"/>
  <circle cx="56" cy="58" r="34" fill="${locked ? '#28241F' : tier.glow}" opacity="${glowOpacity.toFixed(2)}"/>
  ${ringMarkup}
  <path d="M56 18 C47 31 39 41 39 58 C39 73 48 83 56 91 C64 83 74 74 75 59 C76 47 69 39 66 29 C62 36 59 40 58 46 C54 37 59 27 56 18 Z" fill="url(#${flameId})" opacity="${locked ? 0.64 : 1}"/>
  <path d="M56 43 C50 52 47 60 49 68 C51 76 56 81 56 81 C61 76 65 70 65 63 C65 56 61 51 59 45 C57 49 56 53 56 57 C53 52 55 47 56 43 Z" fill="${core}" opacity="${locked ? 0.56 : 0.95}"/>
  <text x="56" y="77" text-anchor="middle" font-family="Avenir Next Condensed, Arial Narrow, Arial, sans-serif" font-size="${tier.badge === '6M' ? 18 : 20}" font-weight="900" fill="${ink}" stroke="#0E0E0F" stroke-width="0.7">${tier.badge}</text>`;
}

function badgeSvg(tier, options) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112" fill="none">
  ${badgeBody(tier, options)}
</svg>`;
}

function shareSvg(tier, transparent) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${transparent ? 520 : 1080}" viewBox="0 0 1080 ${transparent ? 520 : 1080}">
  <rect width="1080" height="${transparent ? 520 : 1080}" rx="${transparent ? 0 : 64}" fill="${transparent ? 'none' : '#0B0B0B'}"/>
  <g transform="translate(${transparent ? 44 : 100} ${transparent ? 72 : 100})">
    <text x="0" y="0" font-family="Avenir Next, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="6" fill="#F3F1EB">STRIDEOS</text>
    <text x="${transparent ? 760 : 650}" y="0" font-family="Avenir Next, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="4" fill="#DCC9B1">&gt;&gt;&gt;&gt;&gt;</text>
  </g>
  <g transform="translate(${transparent ? 52 : 346} ${transparent ? 144 : 254}) scale(${transparent ? 2.04 : 3.48})">
    ${badgeBody(tier)}
  </g>
  <g transform="translate(${transparent ? 330 : 100} ${transparent ? 206 : 780})">
    <text x="0" y="0" font-family="Avenir Next Condensed, Arial Narrow, Arial, sans-serif" font-size="${transparent ? 56 : 82}" font-weight="900" fill="#F3F1EB">${tier.name.toUpperCase()}</text>
    <text x="0" y="${transparent ? 62 : 86}" font-family="Avenir Next, Arial, sans-serif" font-size="${transparent ? 22 : 31}" font-weight="900" letter-spacing="3" fill="#DCC9B1">CONSISTENCY BUILT OVER TIME</text>
    <text x="0" y="${transparent ? 110 : 148}" font-family="Avenir Next, Arial, sans-serif" font-size="${transparent ? 31 : 42}" font-weight="900" letter-spacing="4" fill="#FFFDF3">${tier.badge === '6M' ? '6 MONTHS' : `${tier.threshold} DAYS`}</text>
  </g>
</svg>`;
}

for (const tier of tiers) {
  write(`assets/achievements/streak/badges/streak-${tier.slug}.svg`, badgeSvg(tier));
  write(`assets/achievements/streak/badges/streak-${tier.slug}-locked.svg`, badgeSvg(tier, { locked: true }));
  write(`assets/achievements/streak/share/streak-${tier.slug}-clean.svg`, shareSvg(tier, false));
  write(`assets/achievements/streak/share/streak-${tier.slug}-overlay.svg`, shareSvg(tier, true));
}

write('assets/achievements/streak/manifest.json', JSON.stringify(tiers.map(tier => ({
  achievementId: tier.id,
  name: tier.name,
  threshold: tier.badge === '6M' ? '6 months' : `${tier.threshold} days`,
  thresholdDays: tier.threshold,
  tier: tier.tier,
  artworkPath: `assets/achievements/streak/badges/streak-${tier.slug}.svg`,
  lockedArtworkPath: `assets/achievements/streak/badges/streak-${tier.slug}-locked.svg`,
  dominantHeatColor: tier.ring,
  shareArtPath: {
    cleanDark: `assets/achievements/streak/share/streak-${tier.slug}-clean.svg`,
    transparentOverlay: `assets/achievements/streak/share/streak-${tier.slug}-overlay.svg`,
  },
})), null, 2));

write('docs/achievements/streak/option-1-comparison.svg', `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <rect width="720" height="720" fill="#080808"/>
  <text x="32" y="44" font-family="Arial, sans-serif" font-size="17" font-weight="900" letter-spacing="2" fill="#F3F1EB">STRIDEOS STREAK ACHIEVEMENTS - OPTION 1 FINAL</text>
  ${tiers.map((tier, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const x = row === 0 ? 34 + col * 170 : 120 + col * 170;
    const y = row === 0 ? 92 : 392;
    return `
    <g transform="translate(${x} ${y})">
      <g transform="scale(0.95)">${badgeBody(tier)}</g>
      <text x="53" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#F3F1EB">${tier.name}</text>
      <text x="53" y="174" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" fill="${tier.ring}">TIER ${tier.tier}</text>
    </g>`;
  }).join('')}
</svg>`);
