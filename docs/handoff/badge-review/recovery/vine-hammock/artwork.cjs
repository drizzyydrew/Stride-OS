const master = require('../artwork.cjs');
const data = require('./glyph-data.json');
const { bounds } = require('./bounds.json');

function central(palette) {
  return `<g data-part="central-hammock" fill="none" stroke="${palette.highlight}"><path data-part="hammock-posts" d="${data.hammock.posts}" stroke-width="1"/><path data-part="hammock-ropes" d="${data.hammock.ropes}" stroke-width=".85"/><path data-part="hammock-fabric" d="${data.hammock.fabric}" fill="${palette.glyph}" fill-opacity=".22" stroke-width=".95"/><path data-part="hammock-stitching" d="${data.hammock.stitching}" stroke-width=".55"/></g>`;
}
function glyph(palette = { primary: '#FFFFFF', glyph: '#FFFFFF', detail: '#FFFFFF', highlight: '#FFFFFF' }, options = {}) {
  const vine = `<path data-part="vine-stem" d="${data.stem}" fill="none" stroke="${palette.primary}" stroke-width=".85"/>${data.leaves.map(d => `<path data-part="vine-leaf" d="${d}" fill="${palette.glyph}"/>`).join('')}<path data-part="vine-veins" d="${data.veins}" fill="none" stroke="${palette.detail}" stroke-width=".45"/>`;
  return `<g data-glyph="${options.glyphIdentity || 'vine-wreath-and-hammock'}" stroke-linecap="round" stroke-linejoin="round">
    <g data-vine="left">${vine}</g><g data-vine="right" transform="translate(100 0) scale(-1 1)">${vine}</g>
    ${options.central ? options.central(palette) : central(palette)}
  </g>`;
}
function render(variant = 'unlocked', size = 800, options = {}) {
  return master.render(variant, size, { identity: options.identity || 'recovery-week-vine-hammock', glyph: palette => glyph(palette, options), copy: options.copy, title: options.title });
}
module.exports = { render, glyph, central, bounds, master };
