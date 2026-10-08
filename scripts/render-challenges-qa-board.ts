import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { CHALLENGE_ACHIEVEMENT_DEFINITIONS, type ChallengeBadgeState } from '../src/achievements/challenges/challengesDefinitions';
import { renderChallengeBadgeSvg } from '../src/achievements/challenges/challengesArtwork';

const OUT_DIR = '/tmp';
const STATES: Array<{ label: string; state: ChallengeBadgeState }> = [
  { label: 'UNLOCKED', state: 'unlocked' },
  { label: 'LOCKED', state: 'locked' },
  { label: 'TRANSPARENT', state: 'transparent' },
];

function nest(svg: string, x: number, y: number, size: number): string {
  return svg.replace(
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="100"/,
    `<svg x="${x}" y="${y}" width="${size}" height="${size}"`,
  );
}

function boardSvg(): string {
  const cols = 6;
  const cell = 150;
  const badge = 104;
  const left = 80;
  const top = 72;
  const rowGap = 300;
  const body = STATES.map((row, rowIndex) => {
    const y = top + rowIndex * rowGap;
    const badges = CHALLENGE_ACHIEVEMENT_DEFINITIONS.map((definition, index) => {
      const col = index % cols;
      const subRow = Math.floor(index / cols);
      const x = left + col * cell;
      const yy = y + subRow * 118;
      return `${nest(renderChallengeBadgeSvg(definition.id, row.state), x, yy, badge)}
        <text x="${x + badge / 2}" y="${yy + badge + 16}" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="8" font-weight="800" fill="#C9B398">${definition.compactTitle.toUpperCase()}</text>`;
    }).join('\n');
    return `<text x="28" y="${y + 58}" font-family="Avenir Next, Arial, sans-serif" font-size="15" font-weight="900" fill="#F3F1EB" transform="rotate(-90 28 ${y + 58})">${row.label}</text>${badges}`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="980" viewBox="0 0 980 980">
  <rect width="980" height="980" fill="#030303"/>
  <text x="490" y="42" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="25" font-weight="900" letter-spacing="4" fill="#F3F1EB">CHALLENGES QA BOARD</text>
  ${body}
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

writeAndRender('strideos-challenges-qa-board', boardSvg());
