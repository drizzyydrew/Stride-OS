import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { STREAK_MILESTONE_DEFINITIONS, streakHeatTierForDays } from '../src/achievements/streaks/streakDefinitions';
import { renderStreakBadgeSvg } from '../src/achievements/streaks/streakArtwork';

const OUT = '/tmp/strideos-streak-qa-board.png';
const SMALL_OUT = '/tmp/strideos-streak-small-sizes.png';
const TEMP_DIR = '/tmp/strideos-streak-qa-assets';
const BG = { r: 4, g: 5, b: 6, a: 255 };

function load(assetPath: string): PNG {
  return PNG.sync.read(readFileSync(path.resolve(process.cwd(), assetPath)));
}

function canvas(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = BG.r;
    png.data[offset + 1] = BG.g;
    png.data[offset + 2] = BG.b;
    png.data[offset + 3] = BG.a;
  }
  return png;
}

function drawTextPlaceholder(target: PNG, text: string, x: number, y: number): void {
  // QA labels are simple tick marks; the badges themselves are the reviewed artwork.
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

function blitScaled(target: PNG, source: PNG, dx: number, dy: number, size: number): void {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x / size) * source.width));
      const sy = Math.min(source.height - 1, Math.floor((y / size) * source.height));
      const srcOffset = (source.width * sy + sx) * 4;
      const alpha = source.data[srcOffset + 3] / 255;
      if (alpha <= 0) continue;
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || tx >= target.width || ty < 0 || ty >= target.height) continue;
      const dstOffset = (target.width * ty + tx) * 4;
      target.data[dstOffset] = Math.round(source.data[srcOffset] * alpha + target.data[dstOffset] * (1 - alpha));
      target.data[dstOffset + 1] = Math.round(source.data[srcOffset + 1] * alpha + target.data[dstOffset + 1] * (1 - alpha));
      target.data[dstOffset + 2] = Math.round(source.data[srcOffset + 2] * alpha + target.data[dstOffset + 2] * (1 - alpha));
      target.data[dstOffset + 3] = 255;
    }
  }
}

function dynamicPng(days: number, state: 'unlocked' | 'locked' | 'share-transparent' | 'share-opaque', compact = false): PNG {
  mkdirSync(TEMP_DIR, { recursive: true });
  const slug = `${days}-${state}-${compact ? 'compact' : 'full'}`;
  const svgPath = path.join(TEMP_DIR, `${slug}.svg`);
  const pngPath = path.join(TEMP_DIR, `${slug}.png`);
  writeFileSync(svgPath, renderStreakBadgeSvg(days, state, { size: 1024, compact }), 'utf8');
  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', '1024', '1024', svgPath, '--out', pngPath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`sips failed for dynamic QA streak ${days}: ${result.stderr || result.stdout}`);
  return load(pngPath);
}

function writeBoard(): void {
  const board = canvas(1900, 1380);
  const rowY = [45, 255, 465, 675, 885, 1095];
  const rows = [
    { label: 'HEAT TIERS', days: [1, 11, 51, 101, 151, 201, 251, 301, 365], state: 'unlocked' as const },
    { label: 'SPECIALTY', days: STREAK_MILESTONE_DEFINITIONS.map(item => item.thresholdDays), state: 'unlocked' as const },
    { label: 'LOCKED', days: STREAK_MILESTONE_DEFINITIONS.map(item => item.thresholdDays), state: 'locked' as const },
    { label: 'TRANSPARENT', days: STREAK_MILESTONE_DEFINITIONS.map(item => item.thresholdDays), state: 'transparent' as const },
    { label: 'OPAQUE', days: STREAK_MILESTONE_DEFINITIONS.map(item => item.thresholdDays), state: 'opaque' as const },
    { label: 'CURRENT', days: [8, 35, 75, 142, 188, 225, 276, 330, 365, 428], state: 'unlocked' as const },
  ];

  for (let row = 0; row < rows.length; row += 1) {
    const config = rows[row]!;
    drawTextPlaceholder(board, config.label, 30, rowY[row]! - 18);
    const size = row === 0 ? 154 : 142;
    const gap = row === 0 ? 44 : 35;
    const startX = row === 0 ? 165 : 110;
    config.days.forEach((days, index) => {
      const definition = STREAK_MILESTONE_DEFINITIONS.find(item => item.thresholdDays === days);
      const assetPath =
        config.state === 'locked' ? definition?.lockedPngPath
          : config.state === 'transparent' ? definition?.shareTransparentPngPath
            : config.state === 'opaque' ? definition?.shareOpaquePngPath
              : definition?.unlockedPngPath;
      const png = assetPath ? load(assetPath) : dynamicPng(days, 'unlocked');
      blitScaled(board, png, startX + index * (size + gap), rowY[row]!, size);
      drawTextPlaceholder(board, String(days), startX + index * (size + gap) + 48, rowY[row]! + size + 16);
    });
  }

  writeFileSync(OUT, PNG.sync.write(board));
}

function writeSmallSizes(): void {
  const board = canvas(1180, 330);
  [40, 48, 64, 80, 96, 128, 256].forEach((size, index) => {
    const source = dynamicPng(365, 'unlocked', size <= 64);
    blitScaled(board, source, 20 + index * 130, 42, size);
    drawTextPlaceholder(board, `${size}px`, 20 + index * 130, 42 + size + 18);
  });
  writeFileSync(SMALL_OUT, PNG.sync.write(board));
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeBoard();
writeSmallSizes();
console.log(`Rendered Streak QA boards:\n${OUT}\n${SMALL_OUT}`);
