import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { RECOVERY_ACHIEVEMENT_DEFINITIONS, type RecoveryAchievementBadgeState } from '../src/achievements/recovery/recoveryDefinitions';
import { renderRecoveryAchievementBadgeSvg } from '../src/achievements/recovery/recoveryArtwork';

const OUT_DIR = '/tmp';
const STATES: Array<{ label: string; state: RecoveryAchievementBadgeState }> = [
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
  const cols = 4;
  const cell = 166;
  const badge = 116;
  const left = 98;
  const top = 76;
  const rowGap = 276;
  const rows = STATES.map((row, rowIndex) => {
    const y = top + rowIndex * rowGap;
    const badges = RECOVERY_ACHIEVEMENT_DEFINITIONS.map((definition, index) => {
      const col = index % cols;
      const subRow = Math.floor(index / cols);
      const x = left + col * cell;
      const yy = y + subRow * 130;
      return `${nest(renderRecoveryAchievementBadgeSvg(definition.id, row.state), x, yy, badge)}
        <text x="${x + badge / 2}" y="${yy + badge + 15}" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="8" font-weight="800" fill="#AFCB9E">${definition.compactTitle.toUpperCase()}</text>`;
    }).join('\n');
    return `<text x="30" y="${y + 58}" font-family="Avenir Next, Arial, sans-serif" font-size="15" font-weight="900" fill="#F3F1EB" transform="rotate(-90 30 ${y + 58})">${row.label}</text>${badges}`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="1210" viewBox="0 0 820 1210">
  <rect width="820" height="1210" fill="#030303"/>
  <text x="410" y="42" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="4" fill="#F3F1EB">RECOVERY / READINESS QA</text>
  ${rows}
</svg>`;
}

function smallBoardSvg(): string {
  const sizes = [48, 64, 80, 96, 128, 256];
  const rows = RECOVERY_ACHIEVEMENT_DEFINITIONS.map((definition, rowIndex) => {
    const y = 76 + rowIndex * 292;
    const badges = sizes.map((size, index) => {
      const x = 190 + index * 102;
      return nest(renderRecoveryAchievementBadgeSvg(definition.id, 'unlocked', { compact: size < 80 }), x, y, size);
    }).join('\n');
    return `<text x="24" y="${y + 34}" font-family="Avenir Next, Arial, sans-serif" font-size="13" font-weight="900" fill="#F3F1EB">${definition.compactTitle.toUpperCase()}</text>${badges}`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="2140" viewBox="0 0 1100 2140">
  <rect width="1100" height="2140" fill="#030303"/>
  <text x="550" y="38" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="23" font-weight="900" letter-spacing="3" fill="#F3F1EB">RECOVERY SMALL SIZE QA</text>
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

writeAndRender('strideos-recovery-qa-board', boardSvg());
writeAndRender('strideos-recovery-small-sizes', smallBoardSvg());
