const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { frame } = require('../strength/artwork.cjs');
const source = require('./definitions.json');
const type = require('./typography.json');
const states = ['unlocked', 'locked', 'transparent'];
const colors = {
  unlocked: { primary: '#CB8E59', highlight: '#EFBC85', shadow: '#774637', text: '#E3B784', background: '#110C0A', ridge: '#B3774E', foothill: '#774C39', near: '#432B25' },
  locked: { primary: '#898989', highlight: '#B0B0B0', shadow: '#535353', text: '#A1A1A1', background: '#0C0C0C', ridge: '#858585', foothill: '#585858', near: '#343434' },
};
function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!states.includes(state)) throw new Error(`Unknown Challenges state: ${state}`);
  return state;
}
const parsed = new DOMParser().parseFromString(source.runner, 'image/svg+xml');
const motion = Array.from(parsed.getElementsByTagName('path')).find(node => node.hasAttribute('data-motion-lines'));
motion.parentNode.removeChild(motion);
const runner = new XMLSerializer().serializeToString(parsed.documentElement);
const silhouette = parsed.documentElement.cloneNode(true);
silhouette.setAttribute('stroke', '#000000');
for (const element of Array.from(silhouette.getElementsByTagName('*'))) {
  if (['path', 'circle'].includes(element.tagName)) {
    element.setAttribute('fill', '#000000');
    element.setAttribute('stroke', '#000000');
  }
}
const knockout = new XMLSerializer().serializeToString(silhouette);
const runnerTransform = 'translate(14 10) scale(.83)';

function scene(palette, identity = 'august-base-builder') {
  // Knock landscape out behind the hollow athlete, rather than painting it black.
  return `<defs><mask id="${identity}-landscape-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="white"/><g transform="${runnerTransform}">${knockout}</g></mask></defs>
  <g data-part="landscape" mask="url(#${identity}-landscape-mask)">
    <circle data-part="sun" cx="40" cy="30" r="7.1" fill="${palette.highlight}"/>
    <path data-part="sun-rays" d="M40 19 V21 M31.5 22 L33 23.5 M28.5 29 H30.5 M48.5 22 L47 23.5" stroke="${palette.primary}" stroke-width=".55" stroke-linecap="round"/>
    <path data-part="far-ridge" d="M23 47 L31 40 L36 43 L42 35 L49 43 L55 38 L62 44 L67 40 L77 48 L77 50 H23 Z" fill="${palette.ridge}"/>
    <path data-part="ridge-light" d="M31 40 L36 43 L33 42 Z M42 35 L49 43 L44 40 Z M55 38 L62 44 L57 42 Z M67 40 L72 44 L68 43 Z" fill="${palette.highlight}" fill-opacity=".65"/>
    <path data-part="middle-hills" d="M23 49 Q29 45 36 47 Q42 43 49 47 Q55 45 61 48 Q70 45 77 49 V51 H23 Z" fill="${palette.foothill}"/>
    <path data-part="near-hills" d="M24 52 Q32 48 40 51 Q50 48 59 51 Q69 49 76 53 L76 54 H24 Z" fill="${palette.near}"/>
  </g>
  <g data-part="athlete" color="${palette.highlight}" transform="${runnerTransform}">${runner}</g>`;
}
function lettering(palette) {
  return Object.entries(type).map(([key, value]) => `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${palette.text}"/>`).join('\n');
}
function render(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant), palette = state === 'locked' ? colors.locked : options.palette || colors.unlocked;
  const edge = `${options.slug || 'august-base-builder'}-edge`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${options.title || 'August Base Builder'} preview, ${state}">
    <defs><linearGradient id="${edge}" x1="18" y1="7" x2="82" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.highlight}"/><stop offset=".55" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.shadow}"/></linearGradient><radialGradient id="august-ambient"><stop stop-color="${palette.primary}" stop-opacity=".13"/><stop offset="1" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient></defs>
    <path data-frame="challenge-hexagon" d="${frame}" fill="${state === 'transparent' ? 'none' : palette.background}" stroke="url(#${edge})" stroke-width="1"/>
    ${state === 'transparent' ? '' : '<ellipse data-background="ambient" cx="50" cy="34" rx="31" ry="25" fill="url(#august-ambient)"/>'}
    ${options.glyph ? options.glyph(palette) : scene(palette)}
    ${options.copy ? options.copy(palette) : lettering(palette)}
  </svg>\n`;
}
module.exports = { render, scene, lettering, frame, states, colors, normalize, source, type };
