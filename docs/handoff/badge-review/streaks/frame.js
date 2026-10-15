function createStreakFrame(artwork) {
  const frame = 'M50 4 Q51.8 4 53.5 5.1 L78.2 20.1 Q80 21.2 80 23.6 L80 75.4 Q80 77.8 78.2 78.9 L53.5 93.9 Q51.8 95 50 95 Q48.2 95 46.5 93.9 L21.8 78.9 Q20 77.8 20 75.4 L20 23.6 Q20 21.2 21.8 20.1 L46.5 5.1 Q48.2 4 50 4 Z';
  const chevrons = 'M44.5 84.4 L50 87.5 L55.5 84.4 M44.8 87.8 L50 90.7 L55.2 87.8';
  const states = ['unlocked', 'locked', 'transparent'];
  const colors = {
    unlocked: { primary: '#CBB899', highlight: '#DDCCAD', shadow: '#927956', text: '#E4D8C0', flameTop: '#D6C1A1', flameBottom: '#BEA180', background: '#090907' },
    locked: { primary: '#888888', highlight: '#AAAAAA', shadow: '#5E5E5E', text: '#AAAAAA', flameTop: '#999999', flameBottom: '#777777', background: '#090909' },
  };
  function normalize(variant) {
    const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
    if (!states.includes(state)) throw new Error(`Unknown streak preview state: ${state}`);
    return state;
  }
  function lettering(key, color) {
    const value = artwork[key];
    return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${color}"/>`;
  }
  function flame(fill = '#FFFFFF') {
    return `<path data-glyph="custom-three-tongue-flame" d="${artwork.flame.path}" transform="${artwork.flame.transform}" fill="${fill}"/>`;
  }
  function render(variant = 'unlocked', size = 800, options = {}) {
    const state = normalize(variant), tokens = state === 'locked' ? colors.locked : options.colors || colors.unlocked;
    const identity = options.identity || 'streak-three';
    const edge = `${identity}-${state}-edge`, fire = `${identity}-${state}-flame`, ambient = `${identity}-${state}-ambient`;
    const label = options.label || `Three-day streak artwork preview, ${state}, not a new achievement`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${edge}" x1="25" y1="4" x2="75" y2="95" gradientUnits="userSpaceOnUse"><stop stop-color="${tokens.highlight}"/><stop offset=".5" stop-color="${tokens.primary}"/><stop offset="1" stop-color="${tokens.shadow}"/></linearGradient>
    <linearGradient id="${fire}" x1="50" y1="20.5" x2="50" y2="47.64" gradientUnits="userSpaceOnUse"><stop stop-color="${tokens.flameTop}"/><stop offset="1" stop-color="${tokens.flameBottom}"/></linearGradient>
    <radialGradient id="${ambient}"><stop stop-color="${tokens.primary}" stop-opacity=".022"/><stop offset="1" stop-color="${tokens.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-frame="narrow-vertical-hexagon" d="${frame}" fill="${state === 'transparent' ? 'none' : tokens.background}" stroke="url(#${edge})" stroke-width=".9" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<ellipse cx="50" cy="36" rx="23" ry="25" fill="url(#${ambient})"/>`}
  ${flame(`url(#${fire})`)}
  ${options.numberMarkup ? options.numberMarkup(tokens.text) : lettering('number', tokens.text)}
  ${lettering('title', tokens.text)}
  ${lettering('wordmark', tokens.primary)}
  <path data-chevrons="2" d="${chevrons}" stroke="${tokens.primary}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n`;
  }
  return { render, normalize, lettering, flame, frame, chevrons, colors };
}
if (typeof module !== 'undefined') module.exports = createStreakFrame;
