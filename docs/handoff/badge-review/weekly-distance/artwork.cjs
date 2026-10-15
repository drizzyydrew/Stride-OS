const artwork = require('./typography.json');

const frame = 'M50 7.5 Q52.3 7.5 54.4 8.7 L82.9 25.1 Q85.2 26.4 85.2 29.1 L85.2 70.9 Q85.2 73.6 82.9 74.9 L54.4 91.3 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 91.3 L17.1 74.9 Q14.8 73.6 14.8 70.9 L14.8 29.1 Q14.8 26.4 17.1 25.1 L45.6 8.7 Q47.7 7.5 50 7.5 Z';
const chevrons = 'M43.5 81.6 L50 85.5 L56.5 81.6 M44 85 L50 88.6 L56 85';
const states = ['unlocked', 'locked', 'transparent'];
const colors = {
  unlocked: { primary: '#A4B787', highlight: '#CCD6A7', shadow: '#556747', text: '#C4D3A4', background: '#070B08' },
  locked: { primary: '#888888', highlight: '#AAAAAA', shadow: '#555555', text: '#AAAAAA', background: '#090909' },
};

function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!states.includes(state)) throw new Error(`Unknown Weekly Distance preview state: ${state}`);
  return state;
}

function lettering(key, fill = '#FFFFFF', value = artwork[key]) {
  return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${fill}"/>`;
}

function render(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant), palette = state === 'locked' ? colors.locked : options.colors || colors.unlocked;
  const slug = options.slug || '5k', kilometers = options.kilometers || 5;
  const edge = `weekly-${slug}-${state}-edge`, ambient = `weekly-${slug}-${state}-ambient`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${kilometers} kilometer weekly distance badge artwork preview, ${state}">
  <defs>
    <linearGradient id="${edge}" x1="20" y1="10" x2="80" y2="92" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.highlight}"/><stop offset=".55" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.shadow}"/></linearGradient>
    <radialGradient id="${ambient}"><stop stop-color="${palette.primary}" stop-opacity=".035"/><stop offset="1" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-frame="weekly-hexagon" d="${frame}" fill="${state === 'transparent' ? 'none' : palette.background}" stroke="url(#${edge})" stroke-width=".95" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<ellipse cx="50" cy="39" rx="29" ry="24" fill="url(#${ambient})"/>`}
  ${lettering('number', palette.text, options.number || artwork.number)}
  ${lettering('period', palette.text)}
  ${lettering('wordmark', palette.primary)}
  <path data-chevrons="2" d="${chevrons}" stroke="${palette.primary}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n`;
}

module.exports = { render, lettering, artwork, frame, chevrons, states, colors, normalize };
