import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { STRENGTH_ACHIEVEMENT_DEFINITIONS, type StrengthAchievementBadgeState } from '../src/achievements/strength/strengthDefinitions';
import { renderStrengthAchievementBadgeSvg, strengthSessionDumbbellFragment } from '../src/achievements/strength/strengthArtwork';

const OUT_DIR = '/tmp';
const STATES: Array<{ label: string; state: StrengthAchievementBadgeState }> = [
  { label: 'UNLOCKED', state: 'unlocked' },
  { label: 'LOCKED', state: 'locked' },
  { label: 'TRANSPARENT', state: 'share-transparent' },
  { label: 'OPAQUE', state: 'share-opaque' },
];
const SESSION_IDS = new Set([
  'first_strength_session',
  'strength_10_sessions',
  'strength_25_sessions',
  'strength_50_sessions',
  'strength_100_sessions',
]);

function nest(svg: string, x: number, y: number, size: number): string {
  return svg.replace(
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="100"/,
    `<svg x="${x}" y="${y}" width="${size}" height="${size}"`,
  );
}

function boardSvg(): string {
  const cols = 5;
  const cell = 150;
  const badge = 112;
  const left = 84;
  const top = 72;
  const rowGap = 292;
  const rows = STATES.map((row, rowIndex) => {
    const y = top + rowIndex * rowGap;
    const badges = STRENGTH_ACHIEVEMENT_DEFINITIONS.map((definition, index) => {
      const col = index % cols;
      const subRow = Math.floor(index / cols);
      const x = left + col * cell;
      const yy = y + subRow * 126;
      return `${nest(renderStrengthAchievementBadgeSvg(definition.id, row.state), x, yy, badge)}
        <text x="${x + badge / 2}" y="${yy + badge + 15}" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="8" font-weight="800" fill="#CDBAA7">${definition.compactTitle.toUpperCase()}</text>`;
    }).join('\n');
    return `<text x="28" y="${y + 58}" font-family="Avenir Next, Arial, sans-serif" font-size="15" font-weight="900" fill="#F3F1EB" transform="rotate(-90 28 ${y + 58})">${row.label}</text>${badges}`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="1320" viewBox="0 0 880 1320">
  <rect width="880" height="1320" fill="#030303"/>
  <text x="440" y="42" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="4" fill="#F3F1EB">STRENGTH QA BOARD</text>
  ${rows}
</svg>`;
}

function dumbbellComparisonSvg(): string {
  const sessionDefinitions = STRENGTH_ACHIEVEMENT_DEFINITIONS.filter(definition => SESSION_IDS.has(definition.id));
  const cells = sessionDefinitions.map((definition, index) => {
    const fragment = strengthSessionDumbbellFragment(renderStrengthAchievementBadgeSvg(definition.id, 'unlocked')) ?? '';
    const x = 72 + index * 154;
    return `<g transform="translate(${x} 74)">
      <rect x="0" y="0" width="122" height="76" rx="6" fill="#090A09" stroke="#302B27" stroke-width="1"/>
      <svg x="11" y="-8" width="100" height="100" viewBox="0 0 100 100">${fragment}</svg>
      <text x="61" y="94" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="8" font-weight="900" fill="#D6C2AE">${definition.compactTitle.toUpperCase()}</text>
    </g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="210" viewBox="0 0 880 210">
  <rect width="880" height="210" fill="#030303"/>
  <text x="440" y="34" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="20" font-weight="900" letter-spacing="3" fill="#F3F1EB">CANONICAL DUMBBELL COMPARISON</text>
  ${cells}
</svg>`;
}

function smallBoardSvg(): string {
  const samples = [
    'first_strength_session',
    'strength_100_sessions',
    'strength_6_weeks_consistent',
    'strength_12_weeks_consistent',
    'strength_run_week_completed',
    'first_structured_workout',
    'prehab_resilience_block',
  ] as const;
  const sizes = [48, 64, 80, 96, 128, 256];
  const rows = samples.map((id, rowIndex) => {
    const y = 76 + rowIndex * 292;
    const definition = STRENGTH_ACHIEVEMENT_DEFINITIONS.find(item => item.id === id)!;
    const badges = sizes.map((size, index) => {
      const x = 190 + index * 102;
      return nest(renderStrengthAchievementBadgeSvg(id, 'unlocked', { compact: size < 80 }), x, y, size);
    }).join('\n');
    return `<text x="24" y="${y + 34}" font-family="Avenir Next, Arial, sans-serif" font-size="13" font-weight="900" fill="#F3F1EB">${definition.compactTitle.toUpperCase()}</text>${badges}`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="2140" viewBox="0 0 1100 2140">
  <rect width="1100" height="2140" fill="#030303"/>
  <text x="550" y="38" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="23" font-weight="900" letter-spacing="3" fill="#F3F1EB">STRENGTH SMALL SIZE QA</text>
  ${sizes.map((size, index) => `<text x="${190 + index * 102 + size / 2}" y="64" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="10" font-weight="800" fill="#AFA69C">${size}px</text>`).join('\n')}
  ${rows}
</svg>`;
}

function writeAndRender(name: string, svg: string): void {
  const svgPath = path.join(OUT_DIR, `${name}.svg`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  mkdirSync(path.dirname(svgPath), { recursive: true });
  writeFileSync(svgPath, svg, 'utf8');
  const result = spawnSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`sips failed for ${name}: ${result.stderr || result.stdout}`);
  console.log(pngPath);
}

writeAndRender('strideos-strength-qa-board', boardSvg());
writeAndRender('strideos-strength-dumbbell-comparison', dumbbellComparisonSvg());
writeAndRender('strideos-strength-small-sizes', smallBoardSvg());
