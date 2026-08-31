import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { FIRST_ACHIEVEMENT_DEFINITIONS, type FirstAchievementBadgeState, type FirstAchievementId } from '../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';

const OUT_DIR = '/tmp';
const STATES: Array<{ label: string; state: FirstAchievementBadgeState }> = [
  { label: 'UNLOCKED', state: 'unlocked' },
  { label: 'LOCKED', state: 'locked' },
  { label: 'TRANSPARENT', state: 'share-transparent' },
  { label: 'OPAQUE', state: 'share-opaque' },
];

function nest(svg: string, x: number, y: number, size: number): string {
  return svg.replace(
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="100"/,
    `<svg x="${x}" y="${y}" width="${size}" height="${size}"`,
  );
}

function boardSvg(): string {
  const cols = 5;
  const cell = 150;
  const badge = 104;
  const left = 80;
  const top = 72;
  const rowGap = 410;
  const body = STATES.map((row, rowIndex) => {
    const y = top + rowIndex * rowGap;
    const badges = FIRST_ACHIEVEMENT_DEFINITIONS.map((definition, index) => {
      const col = index % cols;
      const subRow = Math.floor(index / cols);
      const x = left + col * cell;
      const yy = y + subRow * 118;
      return `${nest(renderFirstAchievementBadgeSvg(definition.id, row.state, { unitSystem: 'imperial' }), x, yy, badge)}
        <text x="${x + badge / 2}" y="${yy + badge + 16}" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="8" font-weight="800" fill="#C9B398">${definition.compactTitle.toUpperCase()}</text>`;
    }).join('\n');
    return `<text x="28" y="${y + 58}" font-family="Avenir Next, Arial, sans-serif" font-size="15" font-weight="900" fill="#F3F1EB" transform="rotate(-90 28 ${y + 58})">${row.label}</text>${badges}`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="1760" viewBox="0 0 860 1760">
  <rect width="860" height="1760" fill="#030303"/>
  <text x="430" y="42" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="4" fill="#F3F1EB">FIRSTS QA BOARD</text>
  ${body}
</svg>`;
}

function smallBoardSvg(): string {
  const samples: FirstAchievementId[] = [
    'first_run',
    'first_run_walk',
    'first_5k',
    'first_marathon',
    'first_mobility_workout',
    'first_strength_workout',
    'first_movement_lab_analysis',
  ];
  const sizes = [48, 64, 80, 96, 128, 256];
  const rows = samples.map((id, rowIndex) => {
    const y = 72 + rowIndex * 290;
    const label = FIRST_ACHIEVEMENT_DEFINITIONS.find(item => item.id === id)?.compactTitle ?? id;
    const badges = sizes.map((size, index) => {
      const x = 190 + index * 102;
      return nest(renderFirstAchievementBadgeSvg(id, 'unlocked', { compact: size < 80, unitSystem: 'imperial' }), x, y, size);
    }).join('\n');
    return `<text x="24" y="${y + 34}" font-family="Avenir Next, Arial, sans-serif" font-size="13" font-weight="900" fill="#F3F1EB">${label.toUpperCase()}</text>${badges}`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="2140" viewBox="0 0 1100 2140">
  <rect width="1100" height="2140" fill="#030303"/>
  <text x="550" y="38" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="23" font-weight="900" letter-spacing="3" fill="#F3F1EB">FIRSTS SMALL SIZE QA</text>
  ${sizes.map((size, index) => `<text x="${190 + index * 102 + size / 2}" y="62" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="10" font-weight="800" fill="#AFA69C">${size}px</text>`).join('\n')}
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

writeAndRender('strideos-firsts-qa-board', boardSvg());
writeAndRender('strideos-firsts-small-sizes', smallBoardSvg());
