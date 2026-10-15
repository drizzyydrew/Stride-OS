const { definitions, sources } = require('./definitions.json');
const type = require('./typography.json');
const shared = require('../weekly-distance/artwork.cjs');
const palettes = {
  '25k': { primary: '#A4B787', highlight: '#CCD6A7', shadow: '#556747', text: '#C4D3A4', background: '#070B08' },
  '50k': { primary: '#73B6B1', highlight: '#ABDAD1', shadow: '#3D6965', text: '#A0D0C8', background: '#080C0C' },
  '100k': { primary: '#7BA9CC', highlight: '#BAD5E8', shadow: '#415D7C', text: '#ABCBE0', background: '#090C10' },
  '150k': { primary: '#9889CD', highlight: '#C9BDE9', shadow: '#564D7B', text: '#BDB0DF', background: '#0B090F' },
  '200k': { primary: '#BB83C1', highlight: '#DDB7E2', shadow: '#704B77', text: '#D4A7D9', background: '#0D090F' },
  '250k': { primary: '#CA8170', highlight: '#EAB7A2', shadow: '#79483D', text: '#E0A18E', background: '#100B09' },
  '300k': { primary: '#C9A259', highlight: '#E8CF97', shadow: '#7A5D31', text: '#DEC186', background: '#100D08' },
};
function lettering(key, fill, value = type[key]) { return shared.lettering(key, fill, value); }
function render(id, variant = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Monthly Distance ID: ${id}`);
  const state = shared.normalize(variant), p = state === 'locked' ? shared.colors.locked : palettes[definition.slug];
  const prefix = `monthly-${definition.slug}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${definition.thresholdKm} kilometer Monthly Distance badge review, ${state}">
  <defs>
    <linearGradient id="${prefix}-edge" x1="20" y1="10" x2="80" y2="92" gradientUnits="userSpaceOnUse"><stop stop-color="${p.highlight}"/><stop offset=".55" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.shadow}"/></linearGradient>
    <radialGradient id="${prefix}-ambient"><stop stop-color="${p.primary}" stop-opacity=".035"/><stop offset="1" stop-color="${p.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-part="frame" d="${shared.frame}" fill="${state === 'transparent' ? 'none' : p.background}" stroke="url(#${prefix}-edge)" stroke-width=".95" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<ellipse data-background="ambient" cx="50" cy="39" rx="29" ry="24" fill="url(#${prefix}-ambient)"/>`}
  ${lettering('number', p.text, type.numbers[id])}
  ${lettering('period', p.text)}
  ${lettering('wordmark', p.primary)}
  <path data-part="chevrons" data-chevrons="2" d="${shared.chevrons}" stroke="${p.primary}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>\n`;
}
module.exports = { render, definitions, sources, palettes, type, shared, lettering };
