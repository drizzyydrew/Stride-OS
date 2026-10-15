const artwork = require('./artwork.json');
const { frame } = require('../strength/artwork.cjs');
const states = ['unlocked', 'locked', 'transparent'];
const colors = {
  unlocked: { primary: '#A0B78E', highlight: '#C7D5B3', shadow: '#566D4B', text: '#BFD1AF', glyph: '#B4CA9F', detail: '#64835C', background: '#090E0B' },
  locked: { primary: '#7E7E7E', highlight: '#A4A4A4', shadow: '#4C4C4C', text: '#999999', glyph: '#959595', detail: '#606060', background: '#090909' },
};
function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!states.includes(state)) throw new Error(`Unknown Recovery preview state: ${state}`);
  return state;
}
function lettering(key, fill = '#FFFFFF', value = artwork[key]) {
  return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${fill}"/>`;
}
function glyph(palette = { primary: '#FFFFFF', glyph: '#FFFFFF', detail: '#FFFFFF', highlight: '#FFFFFF' }) {
  const node = artwork.glyph.node;
  return `<g data-glyph="leaf-renewal-cycle" transform="translate(${artwork.glyph.translateX} ${artwork.glyph.translateY})" stroke-linecap="round" stroke-linejoin="round">${artwork.glyph.paths.map(shape => {
    const stroked = shape.strokeWidth !== undefined;
    const color = shape.kind === 'vein' ? palette.detail : shape.kind === 'ring' ? palette.primary : palette.glyph;
    return `<path data-part="${shape.kind}" d="${shape.d}" fill="${stroked ? 'none' : color}"${stroked ? ` stroke="${color}" stroke-width="${shape.strokeWidth}"` : ''}/>`;
  }).join('')}<circle data-part="central-node" cx="${node.cx}" cy="${node.cy}" r="${node.r}" fill="${palette.highlight}"/></g>`;
}
function render(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant), palette = colors[state === 'locked' ? 'locked' : 'unlocked'];
  const identity = options.identity || 'recovery-week';
  const label = (options.title || 'Recovery Week Completed').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const edge = `${identity}-${state}-edge`, ambient = `${identity}-${state}-ambient`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${label} artwork preview, ${state}">
  <defs>
    <linearGradient id="${edge}" x1="18" y1="7" x2="82" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.highlight}"/><stop offset=".55" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.shadow}"/></linearGradient>
    <radialGradient id="${ambient}"><stop stop-color="${palette.primary}" stop-opacity=".04"/><stop offset="1" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-frame="recovery-hexagon" d="${frame}" fill="${state === 'transparent' ? 'none' : palette.background}" stroke="url(#${edge})" stroke-width="1" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<ellipse cx="50" cy="37" rx="29" ry="24" fill="url(#${ambient})"/>`}
  ${options.glyph ? options.glyph(palette) : glyph(palette)}
  ${options.copy ? options.copy(palette.text) : `${lettering('title1', palette.text)}\n  ${lettering('title2', palette.text)}`}
</svg>\n`;
}
module.exports = { render, glyph, lettering, artwork, frame, states, colors, normalize };
