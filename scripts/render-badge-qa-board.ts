import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';
import { renderStrengthAchievementBadgeSvg } from '../src/achievements/strength/strengthArtwork';
import { renderRecoveryAchievementBadgeSvg } from '../src/achievements/recovery/recoveryArtwork';
import { renderStreakBadgeSvg } from '../src/achievements/streaks/streakArtwork';
import { renderLifetimeDistanceRunningBadgeSvg } from '../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningArtwork';
import { renderLifetimeDistanceCyclingBadgeSvg } from '../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingArtwork';
import { renderWeeklyDistanceBadgeSvg } from '../src/achievements/weeklyDistance/weeklyDistanceArtwork';
import { renderMonthlyDistanceBadgeSvg } from '../src/achievements/monthlyDistance/monthlyDistanceArtwork';
import { renderRunLevelBadgeSvg } from '../src/achievements/runLevels/runLevelArtwork';
import { renderChallengeBadgeSvg } from '../src/achievements/challenges/challengesArtwork';

import { LIFETIME_DISTANCE_RUNNING_DEFINITIONS } from '../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningDefinitions';
import { LIFETIME_DISTANCE_CYCLING_DEFINITIONS } from '../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';

const OUT_DIR = '/tmp/strideos-badge-qa';
const TEMP_DIR = path.join(OUT_DIR, '_tmp-svg');
const SIZES = [48, 64, 96, 128, 256];
const STATES: Array<'unlocked' | 'locked' | 'transparent'> = ['unlocked', 'locked', 'transparent'];

type Family = {
  name: string;
  render: (state: 'unlocked' | 'locked' | 'transparent', size: number) => string;
};

const lifetimeRunSample = LIFETIME_DISTANCE_RUNNING_DEFINITIONS.find(d => d.milestoneLabel === '100')!;
const lifetimeCycleSample = LIFETIME_DISTANCE_CYCLING_DEFINITIONS.find(d => d.milestoneLabel === '100')!;

const FAMILIES: Family[] = [
  { name: 'FIRSTS', render: (state, size) => renderFirstAchievementBadgeSvg('first_5k', state, { size }) },
  { name: 'STRENGTH', render: (state, size) => renderStrengthAchievementBadgeSvg('strength_10_sessions', state, { size }) },
  { name: 'RECOVERY', render: (state, size) => renderRecoveryAchievementBadgeSvg('recovery_week_completed', state, { size }) },
  { name: 'STREAKS', render: (state, size) => renderStreakBadgeSvg(100, state, { size }) },
  { name: 'LIFETIME RUN', render: (state, size) => renderLifetimeDistanceRunningBadgeSvg(lifetimeRunSample.thresholdMiles, state, { size }) },
  { name: 'LIFETIME CYCLE', render: (state, size) => renderLifetimeDistanceCyclingBadgeSvg(lifetimeCycleSample.thresholdMiles, state, { size }) },
  { name: 'WEEKLY DIST', render: (state, size) => renderWeeklyDistanceBadgeSvg(25, state, { size }) },
  { name: 'MONTHLY DIST', render: (state, size) => renderMonthlyDistanceBadgeSvg(100, state, { size }) },
  { name: 'RUN LEVELS', render: (state, size) => renderRunLevelBadgeSvg('peak', state, { size }) },
  { name: 'CHALLENGES', render: (state, size) => renderChallengeBadgeSvg('challenge_elevation_month', state, { size }) },
];

let renderCount = 0;

function svgToPng(svg: string, size: number, name: string): PNG {
  mkdirSync(TEMP_DIR, { recursive: true });
  const svgPath = path.join(TEMP_DIR, `${name}.svg`);
  const pngPath = path.join(TEMP_DIR, `${name}.png`);
  writeFileSync(svgPath, svg, 'utf8');
  const result = spawnSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`sips failed for ${name}: ${result.stderr || result.stdout}`);
  renderCount += 1;
  return PNG.sync.read(readFileSync(pngPath));
}

function canvas(width: number, height: number, bg: [number, number, number, number]): PNG {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = bg[0];
    png.data[offset + 1] = bg[1];
    png.data[offset + 2] = bg[2];
    png.data[offset + 3] = bg[3];
  }
  return png;
}

function busyCanvas(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  const palette: Array<[number, number, number]> = [
    [214, 92, 61], [46, 68, 86], [168, 185, 161], [220, 201, 177], [111, 129, 110], [78, 106, 135],
  ];
  const tile = 23;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (Math.floor(x / tile) + Math.floor(y / tile) * 3) % palette.length;
      const [r, g, b] = palette[(idx + palette.length) % palette.length]!;
      const offset = (width * y + x) * 4;
      png.data[offset] = r;
      png.data[offset + 1] = g;
      png.data[offset + 2] = b;
      png.data[offset + 3] = 255;
    }
  }
  return png;
}

function blit(target: PNG, source: PNG, dx: number, dy: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || tx >= target.width || ty < 0 || ty >= target.height) continue;
      const srcOffset = (source.width * y + x) * 4;
      const alpha = source.data[srcOffset + 3]! / 255;
      if (alpha <= 0) continue;
      const dstOffset = (target.width * ty + tx) * 4;
      target.data[dstOffset] = Math.round(source.data[srcOffset]! * alpha + target.data[dstOffset]! * (1 - alpha));
      target.data[dstOffset + 1] = Math.round(source.data[srcOffset + 1]! * alpha + target.data[dstOffset + 1]! * (1 - alpha));
      target.data[dstOffset + 2] = Math.round(source.data[srcOffset + 2]! * alpha + target.data[dstOffset + 2]! * (1 - alpha));
      target.data[dstOffset + 3] = 255;
    }
  }
}

function label(target: PNG, text: string, x: number, y: number): void {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    for (let bit = 0; bit < 6; bit += 1) {
      if ((code >> bit) & 1) {
        const px = x + i * 7 + bit;
        const py = y;
        if (px >= 0 && px < target.width && py >= 0 && py < target.height) {
          const offset = (target.width * py + px) * 4;
          target.data[offset] = 230;
          target.data[offset + 1] = 232;
          target.data[offset + 2] = 226;
          target.data[offset + 3] = 255;
        }
      }
    }
  }
}

// Board 1: every family x every state at 256px, laid out as a grid.
function writeStateBoard(): void {
  const cols = STATES.length;
  const cell = 300;
  const left = 160;
  const top = 60;
  const board = canvas(left + cols * cell + 40, top + FAMILIES.length * cell, [8, 8, 9, 255]);
  STATES.forEach((state, col) => label(board, state.toUpperCase(), left + col * cell + cell / 2 - 40, top - 24));
  FAMILIES.forEach((family, row) => {
    label(board, family.name, 20, top + row * cell + cell / 2);
    STATES.forEach((state, col) => {
      const svg = family.render(state, 256);
      const png = svgToPng(svg, 256, `${family.name}-${state}-256`);
      blit(board, png, left + col * cell + (cell - 256) / 2, top + row * cell + (cell - 256) / 2);
    });
  });
  writeFileSync(path.join(OUT_DIR, 'states-board.png'), PNG.sync.write(board));
}

// Board 2: every family's unlocked badge at every required size (48/64/96/128/256).
function writeSizeBoard(): void {
  const left = 170;
  const top = 50;
  const rowH = 300;
  const colW = 300;
  const board = canvas(left + SIZES.length * colW, top + FAMILIES.length * rowH, [8, 8, 9, 255]);
  SIZES.forEach((size, col) => label(board, `${size}PX`, left + col * colW + colW / 2 - 20, top - 20));
  FAMILIES.forEach((family, row) => {
    label(board, family.name, 20, top + row * rowH + rowH / 2);
    SIZES.forEach((size, col) => {
      const svg = family.render('unlocked', size);
      const png = svgToPng(svg, size, `${family.name}-unlocked-${size}`);
      const x = left + col * colW + (colW - size) / 2;
      const y = top + row * rowH + (rowH - size) / 2;
      blit(board, png, x, y);
    });
  });
  writeFileSync(path.join(OUT_DIR, 'size-board.png'), PNG.sync.write(board));
}

// Board 3: every family's TRANSPARENT badge composited over dark / light / busy-photographic backgrounds.
function writeTransparencyBoard(): void {
  const backgrounds: Array<{ label: string; make: () => PNG }> = [
    { label: 'DARK', make: () => canvas(280, 280, [10, 10, 11, 255]) },
    { label: 'LIGHT', make: () => canvas(280, 280, [245, 243, 237, 255]) },
    { label: 'BUSY', make: () => busyCanvas(280, 280) },
  ];
  const cols = backgrounds.length;
  const cell = 300;
  const left = 170;
  const top = 60;
  const board = canvas(left + cols * cell + 40, top + FAMILIES.length * cell, [8, 8, 9, 255]);
  backgrounds.forEach((bgDef, col) => label(board, bgDef.label, left + col * cell + cell / 2 - 20, top - 24));
  FAMILIES.forEach((family, row) => {
    label(board, family.name, 20, top + row * cell + cell / 2);
    const svg = family.render('transparent', 256);
    const badgePng = svgToPng(svg, 256, `${family.name}-transparent-256`);
    backgrounds.forEach((bgDef, col) => {
      const bg = bgDef.make();
      blit(bg, badgePng, (bg.width - 256) / 2, (bg.height - 256) / 2);
      blit(board, bg, left + col * cell + (cell - 280) / 2, top + row * cell + (cell - 280) / 2);
    });
  });
  writeFileSync(path.join(OUT_DIR, 'transparency-board.png'), PNG.sync.write(board));
}

function alphaAt(png: PNG, x: number, y: number): number {
  return png.data[(png.width * y + x) * 4 + 3]!;
}

function verifyTransparency(): void {
  let checked = 0;
  let failed = 0;
  for (const family of FAMILIES) {
    const svg = family.render('transparent', 256);
    const png = svgToPng(svg, 256, `${family.name}-verify-transparent`);
    const corners: Array<[number, number]> = [[0, 0], [255, 0], [0, 255], [255, 255]];
    const cornersClear = corners.every(([x, y]) => alphaAt(png, x, y) === 0);
    let hasOpaque = false;
    for (let i = 3; i < png.data.length; i += 4) {
      if (png.data[i] === 255) { hasOpaque = true; break; }
    }
    checked += 1;
    if (!cornersClear || !hasOpaque) {
      failed += 1;
      console.error(`ALPHA CHECK FAILED for ${family.name}: cornersClear=${cornersClear} hasOpaqueInterior=${hasOpaque}`);
    }
  }
  console.log(`Alpha channel spot-check: ${checked - failed}/${checked} families pass (genuine transparency, no opaque corners).`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeStateBoard();
writeSizeBoard();
writeTransparencyBoard();
verifyTransparency();
console.log(`Rendered ${renderCount} badge PNGs across ${FAMILIES.length} families.`);
console.log(`Boards written to:\n  ${path.join(OUT_DIR, 'states-board.png')}\n  ${path.join(OUT_DIR, 'size-board.png')}\n  ${path.join(OUT_DIR, 'transparency-board.png')}`);
