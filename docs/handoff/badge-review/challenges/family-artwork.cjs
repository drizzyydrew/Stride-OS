require('tsx/cjs');
const master = require('./artwork.cjs');
const { presentations: definitions, sources, definitions: sourceDefinitions } = require('./definitions.json');
const typography = require('./family-typography.json');
const { renderStrengthOutline } = require('../strength-preview-adapter.cjs');
const strength = require('../strength/family-artwork.cjs');
const { FIRSTS_GLYPH_ARTWORK } = require('../../../../src/achievements/firsts/firstsGlyphs.ts');
const themes = {
  challengeAugust: master.colors.unlocked,
  challengeSeptember: ['#5CA69B', '#B2D4BD', '#315F59', '#A1C9B5', '#090F0E'],
  challengeWinter: ['#7BA8C3', '#C2D8E3', '#3D6075', '#BAD0DE', '#090D12'],
  challengeSpring: ['#A8AE66', '#D8DCA4', '#626936', '#CBD19B', '#0D100A'],
  challengeSummer: ['#C67968', '#F1BC8E', '#763D3A', '#E1A193', '#130B0B'],
  challengeElevation: ['#9977BD', '#D7C1E8', '#56406F', '#C4ACDA', '#100C14'],
  challenge150kMonth: ['#BA7FA7', '#E4BDCF', '#6D435D', '#D4A8C6', '#110C11'],
  challenge200kMonth: ['#7196BE', '#BBD0E5', '#405775', '#ADC5DE', '#0B0E14'],
  challenge25kWeek: ['#8C91C6', '#C7CDE6', '#4C5178', '#B5BDDF', '#0C0D13'],
  challenge50kMonth: ['#62AAA5', '#ACD4C9', '#365F61', '#A0CEC7', '#090F10'],
  challenge100kMonth: ['#C3A052', '#E8D39D', '#786027', '#DFCA8D', '#110F09'],
  challengeStrengthRun: ['#BE7A96', '#E7B6C7', '#704452', '#D5A3B9', '#120C10'],
  challengeRecovery: ['#A5B36B', '#D8DDA8', '#5E6B38', '#CBD49D', '#0C100A'],
};
function palette(definition) {
  const value = themes[definition.colorToken];
  if (!value) throw new Error(`Missing Challenges theme: ${definition.colorToken}`);
  if (!Array.isArray(value)) return value;
  const [primary, highlight, shadow, text, background] = value;
  return { primary, highlight, shadow, text, background, ridge: primary, foothill: shadow, near: shadow };
}
function ink(value, color, key) {
  return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${color}"/>`;
}
function glyph(definition, p = master.colors.unlocked) {
  const line = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (definition.glyph) {
    case 'augustBaseBuilder': return master.scene(p);
    case 'septemberConsistency':
      return `<g data-glyph="consistency-calendar" transform="translate(-7.5 -4.25) scale(1.15)" color="${p.highlight}">${FIRSTS_GLYPH_ARTWORK.first_structured_workout}</g>`;
    case 'winterStrengthBlock':
      return `<g data-glyph="winter-strength" transform="translate(0 -2)">${renderStrengthOutline(p.highlight)}</g>`;
    case 'springMileageBuild':
      return `<g data-glyph="spring-mountain-path"><path d="M24 45 L35 32 L40 36 L50 23 L62 38 L67 34 L76 45 Z" fill="${p.primary}"/><path d="M35 32 L40 36 L37 35 Z M50 23 L62 38 L52 31 L48 34 L45 32 Z M67 34 L73 42 L68 39 Z" fill="${p.highlight}"/><path d="M25 47 Q38 41 49 45 Q62 43 75 47 L75 49 H25 Z" fill="${p.shadow}"/><path d="M48 44 C40 47 56 47 56 50 C56 52 40 51.5 42 54" ${line} stroke="${p.primary}" stroke-width="1.9"/></g>`;
    case 'summerLongRun':
      return `<g data-glyph="summer-sunset-path"><path d="M42 33 A8 8 0 0 1 58 33 Z" fill="${p.highlight}"/><path d="M25 33 H75" ${line} stroke="${p.highlight}" stroke-width=".75"/><path d="M50 20 V23 M39 24 L41 26 M61 24 L59 26" ${line} stroke="${p.highlight}" stroke-width=".55" opacity=".7"/><path d="M50 34 C37 39 64 39 58 44 C54 47 38 48 40 54 C44 51 60 49 62 45 C65 39 45 38 51 34 Z" fill="${p.primary}"/><path d="M27 42 H38 M64 42 H73 M29 49 H35 M64 49 H71" ${line} stroke="${p.highlight}" stroke-width=".4" opacity=".45"/></g>`;
    case 'elevationMonth':
      return `<g data-glyph="challenge-alpine-peaks"><path d="M24 51 L36 37 L41 41 L50 22 L61 40 L66 34 L76 51 Z" fill="${p.primary}"/><path d="M50 22 L61 40 L53 34 L50 40 L46 34 L43 37 Z M36 37 L41 41 L37 40 Z M66 34 L73 46 L67 42 Z" fill="${p.highlight}"/><path d="M24 51 L42 45 L48 48 L55 40 L63 47 L76 51 Z" fill="${p.shadow}"/><path d="M28 53 H72" stroke="${p.primary}" stroke-width=".5"/></g>`;
    case 'numericBadge':
      return `<g data-glyph="challenge-distance">${ink(typography[definition.id].number, p.highlight, 'number')}</g>`;
    case 'strengthRun':
      return strength.glyph(strength.definitions.find(value => value.id === 'strength_run_week_completed'), p.highlight);
    case 'recoveryConsistency':
      return `<g data-glyph="recovery-heart-cycle"><path d="M29 43 A22 22 0 0 1 64 24 M71 32 A22 22 0 0 1 36 51" ${line} stroke="${p.primary}" stroke-width="1.6"/><path d="M64 19 L63 27 L56 25 Z M36 56 L37 48 L44 50 Z" fill="${p.primary}"/><path d="M50 46 L40 36 C33 27 45 23 50 30 C55 23 67 27 60 36 Z" fill="${p.highlight}"/></g>`;
    default: throw new Error(`Unknown Challenges glyph: ${definition.glyph}`);
  }
}
function copy(definition, p) {
  return Object.entries(typography[definition.id].copy).map(([key, value]) => ink(value, p.text, key)).join('\n');
}
function render(id, state = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Challenges ID: ${id}`);
  if (id === definitions[0].id) return master.render(state, size);
  return master.render(state, size, { slug: definition.slug, title: definition.title, palette: palette(definition), glyph: p => glyph(definition, p), copy: p => copy(definition, p) });
}
module.exports = { render, glyph, copy, palette, definitions, sources, sourceDefinitions, typography, master };
