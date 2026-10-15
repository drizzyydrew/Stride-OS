import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { FIRST_ACHIEVEMENT_DEFINITIONS } from '../src/achievements/firsts/firstsDefinitions';

const approvedDir = path.resolve('docs/handoff/badge-review/firsts-complete');
const serializer = new XMLSerializer();
const artwork: Record<string, string> = {};

for (const definition of FIRST_ACHIEVEMENT_DEFINITIONS) {
  const svg = readFileSync(path.join(approvedDir, `${definition.slug}-unlocked.svg`), 'utf8');
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const glyphNodes = [];
  for (let node = document.documentElement.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (element.tagName === 'text') break;
    if (element.tagName === 'defs' || element.tagName === 'ellipse') continue;
    if (element.tagName === 'path' && element.getAttribute('d')?.startsWith('M50 4 Q52.4')) continue;
    glyphNodes.push(element);
  }
  for (const node of glyphNodes) {
    for (const text of Array.from(node.getElementsByTagName('text'))) {
      const replacement = document.createElement('g');
      replacement.setAttribute('data-shield-text', 'canonical');
      replacement.appendChild(document.createTextNode('{{shieldText}}'));
      text.parentNode?.replaceChild(replacement, text);
    }
  }
  const content = glyphNodes.map(node => serializer.serializeToString(node)).join('\n')
    .replace(/#E7C486/g, 'currentColor')
    .replace(/#EED6A2/g, '{{highlight}}');
  if (/<text\b|<image\b/.test(content)) throw new Error(`Uncompiled glyph: ${definition.id}`);
  artwork[definition.id] = content;
}

const header = `// Generated from the user-approved Firsts vectors. Recreate with\n// npx tsx scripts/import-approved-firsts-artwork.ts after a new approval.\nimport type { FirstAchievementId } from './firstsDefinitions';\n\n`;
const shield = artwork.first_5k;
const entries = FIRST_ACHIEVEMENT_DEFINITIONS.map(definition => {
  if (definition.shieldLabel && artwork[definition.id] !== shield) {
    throw new Error('Approved race shields have drifted');
  }
  const value = definition.shieldLabel ? 'FIRSTS_RACE_SHIELD_ARTWORK' : JSON.stringify(artwork[definition.id]);
  return `  ${JSON.stringify(definition.id)}: ${value}`;
});
writeFileSync(path.resolve('src/achievements/firsts/firstsGlyphs.ts'), `${header}export const FIRSTS_RACE_SHIELD_ARTWORK = ${JSON.stringify(shield)};\n\nexport const FIRSTS_GLYPH_ARTWORK: Record<FirstAchievementId, string> = {\n${entries.join(',\n')}\n};\n`);
console.log(`Imported ${Object.keys(artwork).length} approved Firsts glyphs.`);
