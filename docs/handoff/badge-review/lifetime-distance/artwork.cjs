const { renderBadge, normalize, palettes } = require('../lifetime-running/render-preview.cjs');
const definitions = require('./definitions.json');
const typography = require('./typography.json');

const colors = {
  sage: palettes.unlocked,
  teal: { primary: '#69B6B7', highlight: '#A2DADD', shadow: '#326564', text: '#8FD3D3', background: '#070B0B' },
  blue: { primary: '#67AAD0', highlight: '#A4D0E7', shadow: '#365E77', text: '#96CBE9', background: '#070A0D' },
  violet: { primary: '#9A82D0', highlight: '#C9B1E8', shadow: '#55467D', text: '#BFA5E7', background: '#0A080E' },
  red: { primary: '#C8786D', highlight: '#E9AAA0', shadow: '#774137', text: '#E3998C', background: '#0D0807' },
  ice: { primary: '#80BFCC', highlight: '#BCDCE3', shadow: '#416A79', text: '#9DD3E0', background: '#070B0D' },
  indigo: { primary: '#9584D3', highlight: '#C3B4F0', shadow: '#514274', text: '#B8A2E8', background: '#09080E' },
  magenta: { primary: '#B77DC6', highlight: '#DCAFE6', shadow: '#724880', text: '#D29CDE', background: '#0D080E' },
  coolViolet: { primary: '#A885D3', highlight: '#CAB0EA', shadow: '#5F3D82', text: '#C1A0E4', background: '#0B080E' },
  coral: { primary: '#C56F62', highlight: '#E79C8F', shadow: '#763B33', text: '#DD8D7D', background: '#0D0807' },
  ember: { primary: '#D6815C', highlight: '#EFB391', shadow: '#7D4634', text: '#E79870', background: '#0D0907' },
  gold: { primary: '#CEAC53', highlight: '#E9D18A', shadow: '#806328', text: '#E9C667', background: '#0C0A06' },
  amber: { primary: '#D29E50', highlight: '#E5C489', shadow: '#7C531F', text: '#E7B76D', background: '#0C0906' },
};
const tiers = {
  running: ['sage', 'teal', 'blue', 'violet', 'red', 'ice', 'indigo', 'coolViolet', 'coral', 'gold'],
  cycling: ['sage', 'teal', 'blue', 'magenta', 'gold', 'teal', 'indigo', 'magenta', 'amber'],
};

function render(family, id, variant = 'unlocked', units = 'imperial', size = 800) {
  if (!['running', 'cycling'].includes(family)) throw new Error(`Unknown family: ${family}`);
  if (!['imperial', 'metric'].includes(units)) throw new Error(`Unknown units: ${units}`);
  const index = definitions[family].findIndex(definition => definition.id === id);
  if (index < 0) throw new Error(`Unknown ${family} achievement: ${id}`);
  const definition = definitions[family][index];
  const state = normalize(variant);
  const number = units === 'metric' ? definition.metricNumber : definition.imperialNumber;
  const unit = units === 'metric' ? definition.metricUnit : definition.imperialUnit;
  const letterings = { number: typography.numbers[number], unit: typography.units[unit], wordmark: typography.wordmark };
  if (!letterings.number) throw new Error(`Missing numeral: ${number}`);
  const preserveApproved = family === 'running' && definition.thresholdMiles === 1 && units === 'imperial';
  return renderBadge(state, size, {
    identity: preserveApproved ? 'one-mile' : `${family}-${definition.slug}-${units}`,
    palette: colors[tiers[family][index]],
    letterings,
    label: preserveApproved ? undefined : `Lifetime Distance ${family === 'running' ? 'Running' : 'Cycling'}, ${number} ${unit}, ${state}, review preview`,
  });
}

module.exports = { render, definitions, typography, tiers, colors };
