const approved = require('./vine-hammock/artwork.cjs');
const centers = require('./central-glyphs.json');
const typography = require('./family-typography.json');
const { definitions, sources } = require('./definitions.json');
const white = { primary: '#FFFFFF', glyph: '#FFFFFF', detail: '#FFFFFF', highlight: '#FFFFFF' };

function star(cx, cy, radius) {
  return `M${cx} ${cy - radius} L${cx + radius * .3} ${cy - radius * .3} L${cx + radius} ${cy} L${cx + radius * .3} ${cy + radius * .3} L${cx} ${cy + radius} L${cx - radius * .3} ${cy + radius * .3} L${cx - radius} ${cy} L${cx - radius * .3} ${cy - radius * .3} Z`;
}
function shapeMarkup(shape, palette) {
  const line = shape.paint === 'line' || shape.paint === 'fabric';
  const attrs = `fill="${line ? shape.paint === 'fabric' ? palette.glyph : 'none' : palette.highlight}"${shape.paint === 'fabric' ? ' fill-opacity=".22"' : ''}${line ? ` stroke="${palette.highlight}" stroke-width="${shape.width}"` : ''}`;
  if (shape.kind === 'path') return `<path d="${shape.d}" ${attrs}/>`;
  if (shape.kind === 'star') return `<path d="${star(shape.cx, shape.cy, shape.r)}" fill="${palette.highlight}"/>`;
  if (shape.kind === 'circle') return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${attrs}/>`;
  return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${attrs}/>`;
}
function center(id, palette = white) {
  if (id === 'recovery_week_completed') return approved.central(palette);
  const definition = centers[id], fit = typography[id];
  return `<g data-center="${definition.subject}" transform="translate(${fit.centerOffsetX} 0)" stroke-linecap="round" stroke-linejoin="round">${definition.shapes.map(shape => shapeMarkup(shape, palette)).join('')}${definition.reuseHammock ? approved.central(palette) : ''}</g>`;
}
function glyph(id, palette = white) {
  if (id === 'recovery_week_completed') return approved.glyph(palette);
  return approved.glyph(palette, { central: color => center(id, color), glyphIdentity: `vine-wreath-${centers[id].subject}` });
}
function copy(id, color = '#FFFFFF') {
  return Object.entries(typography[id].copy).map(([key, value]) => approved.master.lettering(key, color, value)).join('\n  ');
}
function render(id, state = 'unlocked', size = 800) {
  const definition = definitions.find(value => value.id === id);
  if (!definition) throw new Error(`Unknown Recovery achievement: ${id}`);
  if (id === 'recovery_week_completed') return approved.render(state, size);
  return approved.render(state, size, { identity: `recovery-${definition.slug}-vines`, title: definition.title, glyphIdentity: `vine-wreath-${centers[id].subject}`, central: palette => center(id, palette), copy: color => copy(id, color) });
}
module.exports = { render, center, glyph, copy, definitions, sources, typography, approved, centers };
