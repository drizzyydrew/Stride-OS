const master = require('./artwork.cjs');
const titles = require('./family-typography.json');
const { definitions, sources } = require('./definitions.json');
const palettes = {
  foundation: master.colors.unlocked,
  rhythm: { primary: '#BF875A', highlight: '#E4B98C', mid: '#955C37', shadow: '#583B2A', background: '#0D0A08' },
  momentum: { primary: '#A7B28A', highlight: '#D2D8B1', mid: '#788557', shadow: '#434B34', background: '#090D09' },
  durability: { primary: '#94ADC4', highlight: '#CAD8E3', mid: '#627E97', shadow: '#364858', background: '#090C10' },
  engine: { primary: '#ABABA5', highlight: '#D4D4CE', mid: '#5B5D59', shadow: '#383A37', background: '#090B0A' },
  peak: { primary: '#8A9BAE', highlight: '#C7D1DD', mid: '#526478', shadow: '#2C3541', background: '#090B0E' },
  summit: { primary: '#CAA25B', highlight: '#ECD29A', mid: '#A47732', shadow: '#5D4525', background: '#0E0C08' },
};
function render(id, variant = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Run Level ID: ${id}`);
  if (definition.slug === 'foundation') return master.render(variant, size);
  return master.render(variant, size, { slug: definition.slug, title: definition.title, palette: palettes[definition.slug], titleArtwork: titles[id] });
}
module.exports = { render, definitions, sources, palettes, titles, master };
