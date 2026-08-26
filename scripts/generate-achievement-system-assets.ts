import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ACHIEVEMENT_SYSTEM_REGISTRY, type AchievementDefinitionV2 } from '../src/utils/achievementSystem';

const SIZE = 256;
const CENTER = 128;

function hex(radius: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 6;
    return `${(CENTER + radius * Math.cos(angle)).toFixed(1)},${(CENTER + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function lockColor(color: string): string {
  return color.startsWith('#') ? '#8C887F' : '#8C887F';
}

function textFor(def: AchievementDefinitionV2): string {
  if (def.family === 'run_levels') return def.title.toUpperCase();
  if (def.family === 'weekly_distance') return def.shortTitle ?? def.title.replace(' Week', '');
  if (def.family === 'lifetime_running' || def.family === 'lifetime_cycling') return def.shortTitle?.replace(' mi', '') ?? String(def.threshold);
  if (def.family === 'strength') return def.title.match(/\d+/)?.[0] ?? 'STR';
  if (def.family === 'recovery') return String(def.tier ?? '');
  if (def.family === 'challenges') return def.shortTitle ?? def.title.split(' ')[0].toUpperCase();
  return def.shortTitle ?? def.title.replace(/^First /, '').replace(' Marathon', '').replace(' Session', '').replace(' Completed', '');
}

function rings(def: AchievementDefinitionV2, color: string, locked: boolean): string {
  const count = Math.min(5, Math.max(1, def.tier ?? 1));
  const opacityBase = locked ? 0.42 : 0.92;
  return Array.from({ length: Math.ceil(count / 2) }, (_, index) => {
    const radius = 111 - index * 15;
    return `<polygon points="${hex(radius)}" fill="none" stroke="${color}" stroke-width="${index === 0 ? 5 : 2.4}" stroke-opacity="${Math.max(0.18, opacityBase - index * 0.16).toFixed(2)}" ${locked ? 'stroke-dasharray="6 8"' : ''}/>`;
  }).join('\n  ');
}

function chevrons(color: string, y = 206): string {
  return [94, 111, 128, 145].map(x => `<path d="M${x} ${y}l8 6-8 6" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('\n  ');
}

function firstGlyph(def: AchievementDefinitionV2, color: string): string {
  const id = def.id;
  if (id.includes('route')) return `<path d="M82 128c24-34 69 32 92-4" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/><circle cx="82" cy="128" r="8" fill="${color}"/><circle cx="174" cy="124" r="8" fill="${color}"/>`;
  if (id.includes('structured')) return `<rect x="83" y="78" width="90" height="92" rx="8" fill="none" stroke="${color}" stroke-width="7"/><path d="M101 105h54M101 128h54M101 151h35" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
  if (id.includes('adapted')) return `<path d="M84 91h88v82H84zM101 78v26M155 78v26M105 139h28l-9-10M133 139l-9 10" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (id.includes('strength')) return `<path d="M78 128h100M92 103v50M164 103v50M60 113v30M196 113v30" stroke="${color}" stroke-width="10" stroke-linecap="round"/>`;
  if (id.includes('ride')) return `<circle cx="91" cy="146" r="22" fill="none" stroke="${color}" stroke-width="7"/><circle cx="165" cy="146" r="22" fill="none" stroke="${color}" stroke-width="7"/><path d="M91 146l32-45 42 45M123 101h28" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (id.includes('walk')) return `<path d="M112 77l19 31-21 29-22 34M132 108l29 20M110 137l38 35" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="108" cy="61" r="11" fill="${color}"/>`;
  return `<path d="M71 145c28-5 42-41 70-41 16 0 28 10 44 30" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/><path d="M154 107l31 27-36 10" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function strengthGlyph(def: AchievementDefinitionV2, color: string): string {
  if (def.id.includes('weeks')) {
    return `<path d="M78 161v-35h18v35M112 161v-58h18v58M146 161v-81h18v81" fill="none" stroke="${color}" stroke-width="8" stroke-linejoin="round"/><path d="M73 158c35-31 70-44 104-78" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/><path d="M177 70l5 11 12 4-12 4-5 11-5-11-12-4 12-4z" fill="${color}"/>`;
  }
  if (def.id.includes('prehab')) return `<path d="M128 78l47 18v35c0 28-18 47-47 62-29-15-47-34-47-62V96z" fill="none" stroke="${color}" stroke-width="7"/><path d="M102 130h52M128 104v69" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  if (def.id.includes('run_week')) return `<path d="M77 151c25-35 57-47 102-51M78 151h102M91 117l37 34 35-41" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<path d="M74 128h108M89 105v46M167 105v46M57 115v26M199 115v26" stroke="${color}" stroke-width="11" stroke-linecap="round"/>`;
}

function recoveryGlyph(def: AchievementDefinitionV2, color: string): string {
  const i = def.tier ?? 1;
  const variants = [
    `<path d="M77 153c21-31 38-45 51-45s30 14 51 45" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><path d="M94 99h68" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M128 166c-34-25-38-62-5-82 33 20 39 58 5 82z" fill="none" stroke="${color}" stroke-width="7"/><path d="M128 86v84" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`,
    `<path d="M73 133c18-25 35-25 54 0s37 25 56 0" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><circle cx="128" cy="91" r="16" fill="none" stroke="${color}" stroke-width="7"/>`,
    `<path d="M73 130c25 31 85 31 110 0M91 130l-11 31M165 130l11 31" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M82 153c22-44 57-62 95-56l-14 13M177 97l-7-16" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="128" cy="128" r="15" fill="none" stroke="${color}" stroke-width="7"/><path d="M128 80v26M128 150v26M80 128h26M150 128h26" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M78 160h26l17-25h26l31-43M78 160l43-25 26-4" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  ];
  return variants[i - 1] ?? variants[0];
}

function challengeGradient(def: AchievementDefinitionV2, color: string, locked: boolean): string {
  if (locked) return '';
  const id = `g-${def.id}`;
  return `<defs><linearGradient id="${id}" x1="18" x2="238" y1="30" y2="224"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#DCC9B1"/></linearGradient></defs>`;
}

function render(def: AchievementDefinitionV2, locked: boolean): string {
  const base = locked ? lockColor(def.dominantColor) : def.dominantColor;
  const text = escape(textFor(def));
  const isDiamond = def.family === 'lifetime_running' || def.family === 'lifetime_cycling';
  const strokeOpacity = locked ? 0.5 : 1;
  const fillOpacity = locked ? 0.08 : 0.16;
  const gradient = def.family === 'challenges' ? challengeGradient(def, base, locked) : '';
  const accent = def.family === 'challenges' && !locked ? `url(#g-${def.id})` : base;
  const shape = isDiamond
    ? `<path d="M128 22l106 106-106 106L22 128z" fill="#0E0E0F" fill-opacity="${locked ? 0.46 : 0.96}" stroke="${accent}" stroke-width="5" stroke-opacity="${strokeOpacity}"/>
  <path d="M128 47l81 81-81 81-81-81z" fill="${base}" fill-opacity="${fillOpacity}" stroke="${base}" stroke-width="2.5" stroke-opacity="${locked ? 0.28 : 0.62}" ${locked ? 'stroke-dasharray="6 8"' : ''}/>`
    : `<polygon points="${hex(118)}" fill="#0E0E0F" fill-opacity="${locked ? 0.46 : 0.96}" stroke="${accent}" stroke-width="5" stroke-opacity="${strokeOpacity}" ${locked ? 'stroke-dasharray="8 9"' : ''}/>
  ${rings(def, base, locked)}`;
  const glyph = def.family === 'firsts'
    ? firstGlyph(def, base)
    : def.family === 'strength'
      ? strengthGlyph(def, base)
      : def.family === 'recovery'
        ? recoveryGlyph(def, base)
        : '';
  const familyText = escape(def.family.replace(/_/g, ' ').toUpperCase());
  const numberSize = text.length > 5 ? 26 : text.length > 3 ? 36 : 52;
  const lower = def.family === 'run_levels'
    ? `<text x="128" y="132" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="1.2" fill="#F3F1EB">${text}</text>${chevrons(base)}`
    : glyph
      ? `${glyph}<text x="128" y="203" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="11" font-weight="900" letter-spacing="1.2" fill="#F3F1EB">${familyText}</text>`
      : `<text x="128" y="137" text-anchor="middle" dominant-baseline="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${numberSize}" font-weight="900" fill="#F3F1EB">${text}</text><path d="M92 163h72" stroke="${base}" stroke-width="4" stroke-linecap="round"/>${chevrons(base, 184)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" role="img" aria-label="${escape(def.title)} ${locked ? 'locked' : 'earned'} StrideOS achievement badge">
  ${gradient}
  ${shape}
  ${lower}
</svg>
`;
}

function writeAsset(assetPath: string, svg: string): void {
  const target = path.resolve(process.cwd(), assetPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, svg, 'utf8');
}

let written = 0;
for (const definition of ACHIEVEMENT_SYSTEM_REGISTRY) {
  if (!definition.artworkPath.startsWith('assets/achievements/system/')) continue;
  writeAsset(definition.artworkPath, render(definition, false));
  writeAsset(definition.lockedArtworkPath ?? definition.artworkPath, render(definition, true));
  written += 2;
}

console.log(`Generated ${written} achievement SVG assets.`);
