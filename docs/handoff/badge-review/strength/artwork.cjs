const typography = require('./typography.json');
const { renderStrengthOutline, sourceHash, plates } = require('../strength-preview-adapter.cjs');

const frame = 'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
const chevrons = 'M43.5 83 L50 86.8 L56.5 83 M44 86.5 L50 90 L56 86.5';
const states = ['unlocked', 'locked', 'transparent'];
const colors = {
  unlocked: { primary: '#A5ABA8', highlight: '#D9DDD7', shadow: '#555C58', text: '#D4D8CF', glyph: '#CFD5CE', background: '#090B0A' },
  locked: { primary: '#797979', highlight: '#A4A4A4', shadow: '#464646', text: '#959595', glyph: '#929292', background: '#090909' },
};
function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!states.includes(state)) throw new Error(`Unknown Strength preview state: ${state}`);
  return state;
}
function lettering(key, fill = '#FFFFFF', value = typography[key]) {
  const label = value.text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<path data-lettering="${key}" data-text="${label}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${fill}"/>`;
}
function glyph(color = '#FFFFFF') { return `<g transform="translate(10 7.78) scale(.8)">${renderStrengthOutline(color)}</g>`; }
function render(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant), palette = colors[state === 'locked' ? 'locked' : 'unlocked'];
  const identity = options.slug || 'first';
  const label = (options.title || 'First Strength Session').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const edge = `strength-${identity}-${state}-edge`, ambient = `strength-${identity}-${state}-ambient`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${label} artwork preview, ${state}">
  <defs>
    <linearGradient id="${edge}" x1="18" y1="7" x2="82" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.highlight}"/><stop offset=".55" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.shadow}"/></linearGradient>
    <radialGradient id="${ambient}"><stop stop-color="${palette.primary}" stop-opacity=".04"/><stop offset="1" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-frame="strength-hexagon" d="${frame}" fill="${state === 'transparent' ? 'none' : palette.background}" stroke="url(#${edge})" stroke-width="1" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<ellipse cx="50" cy="37" rx="29" ry="24" fill="url(#${ambient})"/>`}
  ${options.glyph ? options.glyph(palette.glyph) : glyph(palette.glyph)}
  ${options.copy ? options.copy(palette.text) : `${lettering('title1', palette.text)}\n  ${lettering('title2', palette.text)}`}
  ${lettering('wordmark', palette.primary)}
  <path data-chevrons="2" d="${chevrons}" stroke="${palette.primary}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n`;
}
module.exports = { render, lettering, glyph, typography, frame, chevrons, colors, states, normalize, sourceHash, plates };
