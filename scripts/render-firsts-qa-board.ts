import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { FIRST_ACHIEVEMENT_DEFINITIONS, type FirstAchievementBadgeState } from '../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';
import { writeFirstsPng } from './lib/firstsRasterizer';

const OUT_DIR = process.env.FIRSTS_QA_DIR ?? '/tmp';
const STATES: FirstAchievementBadgeState[] = ['unlocked', 'locked', 'transparent'];
const SIZES = [48, 64, 96, 128, 256];

function nest(svg: string, x: number, y: number, size: number): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  root.setAttribute('x', String(x));
  root.setAttribute('y', String(y));
  root.setAttribute('width', String(size));
  root.setAttribute('height', String(size));
  const suffix = `-${x}-${y}-${size}`;
  const ids = new Map<string, string>();
  const elements = Array.from(document.getElementsByTagName('*'));
  for (const element of elements) {
    const id = element.getAttribute('id');
    if (id) { ids.set(id, id + suffix); element.setAttribute('id', id + suffix); }
  }
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.value.includes('url(#')) element.setAttribute(attribute.name, attribute.value.replace(/url\(#([^()]+)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`));
    }
  }
  return new XMLSerializer().serializeToString(root);
}

function boardSvg(): string {
  const sections = STATES.map((state, section) => {
    const top = 75 + section * 875;
    return `<text x="35" y="${top - 24}" font-family="Arial,sans-serif" font-size="22" fill="#eeeeee">${state.toUpperCase()}</text>` + FIRST_ACHIEVEMENT_DEFINITIONS.map((d, index) => {
      const x = 35 + (index % 5) * 260, y = top + Math.floor(index / 5) * 282;
      return nest(renderFirstAchievementBadgeSvg(d.id, state), x, y, 245);
    }).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1370" height="2695" viewBox="0 0 1370 2695"><rect width="1370" height="2695" fill="#000000"/>${sections}</svg>`;
}

function smallBoardSvg(state: FirstAchievementBadgeState): string {
  const height = FIRST_ACHIEVEMENT_DEFINITIONS.length * 290 + 85;
  const rows = FIRST_ACHIEVEMENT_DEFINITIONS.map((d, row) => {
    const y = 65 + row * 290;
    return `<text x="15" y="${y + 40}" font-family="Arial,sans-serif" font-size="13" fill="#eeeeee">${d.compactTitle}</text>` + SIZES.map((size, col) => nest(renderFirstAchievementBadgeSvg(d.id, state), 190 + col * 280 + (256 - size) / 2, y + (256 - size) / 2, size)).join('');
  }).join('');
  const labels = SIZES.map((size, col) => `<text x="${318 + col * 280}" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#eeeeee">${size}px</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1610" height="${height}" viewBox="0 0 1610 ${height}"><rect width="1610" height="${height}" fill="${state === 'transparent' ? '#454846' : '#000000'}"/>${labels}${rows}</svg>`;
}

async function writeAndRender(name: string, svg: string): Promise<void> {
  const svgPath = path.join(OUT_DIR, `${name}.svg`), pngPath = path.join(OUT_DIR, `${name}.png`);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(svgPath, svg, 'utf8');
  await writeFirstsPng(svg, pngPath);
  console.log(pngPath);
}

async function renderBoards(): Promise<void> {
  await writeAndRender('strideos-firsts-qa-board', boardSvg());
  for (const state of STATES) await writeAndRender(`strideos-firsts-small-sizes-${state}`, smallBoardSvg(state));
}

renderBoards().catch(error => { console.error(error); process.exitCode = 1; });
