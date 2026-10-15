require('tsx/cjs');
const master = require('./artwork.cjs');
const { definitions, sources } = require('./definitions.json');
const typography = require('./family-typography.json');
const { renderStrengthOutline } = require('../strength-preview-adapter.cjs');
const { FIRSTS_GLYPH_ARTWORK } = require('../../../../src/achievements/firsts/firstsGlyphs.ts');

function ink(value, color, key) { return master.lettering(key, color, value); }
function equipment(color, scale, x, y) {
  return `<g transform="translate(${x - 50 * scale} ${y - 38.9 * scale}) scale(${scale})">${renderStrengthOutline(color)}</g>`;
}
function glyph(definition, color = '#FFFFFF') {
  const data = typography[definition.id];
  const line = `stroke="${color}" stroke-linecap="round" stroke-linejoin="round"`;
  if (definition.id === 'first_strength_session') return master.glyph(color);
  if (definition.glyph === 'sessionDumbbell') return equipment(color, 1, 50, 34.9);
  if (definition.glyph === 'consistentWeeks') {
    return `<g data-glyph="consistency-progress" transform="translate(${data.glyphOffsetX} 0)">
      ${ink(data.glyphNumber, color, 'glyphNumber')}${ink(data.glyphTotal, color, 'glyphTotal')}
      <path d="M26 51 Q39 50 46 44 L52 47 L63 37 L73 28.9" fill="none" ${line} stroke-width=".95"/>
      <path d="M73 25.5 L74 27.9 L76.4 28.9 L74 29.9 L73 32.3 L72 29.9 L69.6 28.9 L72 27.9 Z" fill="${color}"/>
    </g>`;
  }
  if (definition.glyph === 'strengthRunWeek') {
    return `<g data-glyph="strength-and-run" transform="translate(-1.655 0)">
      <g data-glyph="custom-training-shoe" ${line} fill="none"><path d="M22 38.6 L25.1 27 Q25.5 25.7 26.8 27.3 L30.8 32.7 L34.4 31.6 L38.6 36 Q41.7 38.2 47.7 39.3 Q50.8 40 50.9 43.4 Q39.2 45.2 28.5 42.2 L22 40.5 Z" stroke-width=".95"/><path d="M22.7 37.6 Q35 42.9 50.8 41.9 M25.1 27 Q27.8 32.5 31.6 33.2 M32.9 33.9 L30.8 36 M36.2 35.4 L34.1 37.7 M39.5 37.1 L37.4 39.1" stroke-width=".65"/></g>
      ${equipment(color, .55, 67.5, 43)}
    </g>`;
  }
  if (definition.glyph === 'structuredWorkout') {
    return `<g transform="translate(0 2)">${FIRSTS_GLYPH_ARTWORK.first_structured_workout.replaceAll('currentColor', color)}</g>`;
  }
  return `<g data-glyph="prehab-resilience-shield" ${line} fill="none"><path d="M34.8 24 Q50 19.5 65.2 24 V39.5 Q65.2 48.5 50 54 Q34.8 48.5 34.8 39.5 Z" stroke-width=".95"/><path d="M42 31 L50 35.5 L58 31 M42 37.5 L50 42 L58 37.5 M42 44 L50 48.5 L58 44" stroke-width=".85"/></g>`;
}
function copy(definition, color = '#FFFFFF') {
  return Object.entries(typography[definition.id].copy).map(([key, value]) => ink(value, color, key)).join('\n  ');
}
function render(id, state = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Strength achievement: ${id}`);
  if (id === 'first_strength_session') return master.render(state, size);
  return master.render(state, size, { slug: definition.slug, title: definition.title, glyph: color => glyph(definition, color), copy: color => copy(definition, color) });
}
module.exports = { render, glyph, copy, definitions, sources, typography, master };
