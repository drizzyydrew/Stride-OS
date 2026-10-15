import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { APPROVED_BADGE_ASSETS, APPROVED_BADGE_STATES, type ApprovedAssetEntry } from './lib/approvedBadgeFamilies';
import { writeFirstsPng } from './lib/firstsRasterizer';
import { FIRST_ACHIEVEMENT_DEFINITIONS } from '../src/achievements/firsts/firstsDefinitions';
import { renderFirstAchievementBadgeSvg } from '../src/achievements/firsts/firstsArtwork';

const out = process.env.BADGE_QA_DIR ?? '/tmp/strideos-approved-badges';
const sizes = [48, 64, 96, 128, 256];
type Row = Pick<ApprovedAssetEntry, 'family' | 'id' | 'units' | 'render'>;
const rows: Row[] = [
  ...APPROVED_BADGE_ASSETS,
  ...FIRST_ACHIEVEMENT_DEFINITIONS.map(definition => ({
    family: 'firsts', id: definition.id,
    render: (state, size, compact) => renderFirstAchievementBadgeSvg(definition.id, state, { size, compact }),
  } satisfies Row)),
];

function nest(svg: string, x: number, y: number, size: number, suffix: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  root.setAttribute('x', String(x)); root.setAttribute('y', String(y));
  root.setAttribute('width', String(size)); root.setAttribute('height', String(size));
  const elements = Array.from(document.getElementsByTagName('*'));
  for (const element of elements) {
    const id = element.getAttribute('id');
    if (id) element.setAttribute('id', `${id}-${suffix}`);
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.value.includes('url(#')) element.setAttribute(attribute.name, attribute.value.replace(/url\(#([^()]+)\)/g, (_, value: string) => `url(#${value}-${suffix})`));
    }
  }
  return new XMLSerializer().serializeToString(root);
}

async function renderBoards(): Promise<void> {
  mkdirSync(out, { recursive: true });
  for (const family of new Set(rows.map(row => row.family))) {
    if (process.env.BADGE_QA_FAMILY && process.env.BADGE_QA_FAMILY !== family) continue;
    const entries = rows.filter(row => row.family === family);
    for (const state of APPROVED_BADGE_STATES) {
      const width = 1570, height = 75 + entries.length * 285;
      const labels = sizes.map((size, column) => `<text x="${220 + column * 268 + 128}" y="35" text-anchor="middle">${size}px</text>`).join('');
      const content = entries.map((entry, row) => {
        const y = 65 + row * 285;
        return `<text x="12" y="${y + 115}" font-size="10">${entry.id}</text><text x="12" y="${y + 135}" font-size="10">${entry.units ?? ''}</text>`
          + sizes.map((size, column) => nest(entry.render(state), 220 + column * 268 + (256 - size) / 2, y + (256 - size) / 2, size, `${row}-${column}`)).join('');
      }).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${state === 'transparent' ? '#404340' : '#080909'}"/><g font-family="Arial,sans-serif" font-size="14" fill="#EEEEEE">${labels}${content}</g></svg>`;
      const stem = path.join(out, `${family}-${state}-sizes`);
      writeFileSync(stem + '.svg', svg);
      await writeFirstsPng(svg, stem + '.png');
      console.log(stem + '.png');
    }
  }
}
renderBoards().catch(error => { console.error(error); process.exitCode = 1; });
