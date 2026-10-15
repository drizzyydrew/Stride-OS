const { definitions, sources } = require('./definitions.json');
const { numbers } = require('./family-typography.json');
const master = require('./artwork.cjs');

const palettes = {
  '5k': master.colors.unlocked,
  '10k': { primary: '#73B3B4', highlight: '#A6D7D6', shadow: '#365F65', text: '#99CECC', background: '#070B0B' },
  '15k': { primary: '#928BD0', highlight: '#BAB3E9', shadow: '#51497D', text: '#ADA6E2', background: '#09090D' },
  '25k': { primary: '#B982C0', highlight: '#DCADDF', shadow: '#714878', text: '#D3A2D9', background: '#0C080D' },
  '30k': { primary: '#7DA9C0', highlight: '#BAD5E0', shadow: '#466875', text: '#ACC9D7', background: '#080B0D' },
  '50k': { primary: '#7D93BA', highlight: '#B2C4E0', shadow: '#434F71', text: '#A5B9D3', background: '#090A0E' },
  '75k': { primary: '#C87D73', highlight: '#EAA79A', shadow: '#75443C', text: '#E19A8D', background: '#0D0908' },
  '100k': { primary: '#C6A65A', highlight: '#E6CF8D', shadow: '#77602E', text: '#DEC47E', background: '#0D0B07' },
};

function render(id, variant = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Weekly Distance achievement: ${id}`);
  return master.render(variant, size, {
    slug: definition.slug,
    kilometers: definition.kilometers,
    colors: palettes[definition.slug],
    number: numbers[definition.label],
  });
}

module.exports = { render, definitions, sources, numbers, palettes, master };
