const data = require('./definitions.json');
const type = require('./typography.json');
const states = ['unlocked', 'locked', 'transparent'];
const colors = {
  unlocked: { primary: '#D4C4A7', highlight: '#F1E6CF', mid: '#A18E6D', shadow: '#655B4B', background: '#090B0A' },
  locked: { primary: '#929292', highlight: '#BFBFBF', mid: '#747474', shadow: '#454545', background: '#090909' },
};
function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!states.includes(state)) throw new Error(`Unknown Run Level state: ${state}`);
  return state;
}
const scale = 100 / 256;
function lettering(key, color, value = type[key]) {
  return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${color}"/>`;
}
function mountain(p) {
  const fills = {
    rearMass: p.shadow, leftRear: p.shadow, leftFace: 'url(#foundation-face)',
    centerShadow: p.shadow, centerFace: 'url(#foundation-face)',
    centerHighlight: p.mid, rightRear: p.mid, rightFace: p.shadow,
  };
  // Canonical mountain ink spans x=61..197. Center that ink and fit its width to the reference.
  return `<g data-part="mountain" transform="translate(7.16796875 0) scale(.33203125 ${scale})">${Object.entries(fills).map(([key, fill]) => `<path data-facet="${key}" d="${data.mountain[key]}" fill="${fill}"/>`).join('')}<path data-facet="ridge" d="${data.mountain.ridge}" fill="none" stroke="${p.highlight}" stroke-width="1.15" stroke-opacity=".6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function rings(slug = 'foundation') {
  return `<g data-part="rings" transform="scale(${scale})">${data.rings[slug].map((ring, i) => `<path data-ring="${i + 1}" d="${ring.path}" stroke="url(#foundation-rings)" stroke-width="${i === 0 ? 1.32 : 1.08}" stroke-linecap="round"/>`).join('')}</g>`;
}
function chevrons(p) {
  return `<path data-part="chevrons" d="M42 79 L50 83.6 L58 79 M43 83.2 L50 87.2 L57 83.2" stroke="${p.primary}" stroke-width=".72" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function render(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant), p = state === 'locked' ? colors.locked : options.palette || colors.unlocked;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${options.title || 'Foundation'} Run Level artwork preview, ${state}">
  <defs>
    <linearGradient id="foundation-edge" x1="61" y1="18" x2="197" y2="243" gradientUnits="userSpaceOnUse"><stop stop-color="${p.highlight}"/><stop offset=".48" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.shadow}"/></linearGradient>
    <linearGradient id="foundation-upper" x1="128" y1="14" x2="128" y2="166" gradientUnits="userSpaceOnUse"><stop stop-color="${p.mid}" stop-opacity=".62"/><stop offset=".62" stop-color="${p.mid}" stop-opacity=".26"/><stop offset="1" stop-color="${p.mid}" stop-opacity="0"/></linearGradient>
    <linearGradient id="foundation-rings" x1="128" y1="20" x2="128" y2="157" gradientUnits="userSpaceOnUse"><stop stop-color="${p.highlight}" stop-opacity=".88"/><stop offset=".6" stop-color="${p.primary}" stop-opacity=".68"/><stop offset="1" stop-color="${p.mid}" stop-opacity="0"/></linearGradient>
    <linearGradient id="foundation-face" x1="111" y1="101" x2="148" y2="143" gradientUnits="userSpaceOnUse"><stop stop-color="${p.highlight}"/><stop offset=".5" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.shadow}"/></linearGradient>
  </defs>
  <path data-part="frame" d="${data.outer}" transform="scale(${scale})" fill="${state === 'transparent' ? 'none' : p.background}" stroke="url(#foundation-edge)" stroke-width="2.8"/>
  ${state === 'transparent' ? '' : `<path data-background="upper" d="${data.outer}" transform="scale(${scale})" fill="url(#foundation-upper)"/>`}
  <path data-part="bevel" d="${data.bevel}" transform="scale(${scale})" stroke="${p.primary}" stroke-width=".65" stroke-opacity=".35"/>
  ${rings(options.slug)}
  ${mountain(p)}
  ${lettering('title', p.highlight, options.titleArtwork || type.title)}
  ${lettering('wordmark', p.primary)}
  ${chevrons(p)}
  </svg>\n`;
  return options.slug ? svg.replaceAll('foundation-', `${options.slug}-`) : svg;
}
module.exports = { render, data, type, scale, states, normalize, colors, mountain, rings, chevrons, lettering };
