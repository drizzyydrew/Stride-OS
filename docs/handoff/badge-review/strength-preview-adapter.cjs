require('tsx/cjs');
const { DOMParser } = require('@xmldom/xmldom');
const crypto = require('node:crypto');
const { STRENGTH_DUMBBELL_SIGNATURE } = require('../../../src/achievements/strength/strengthArtwork.ts');

const sourceHash = crypto.createHash('sha256').update(STRENGTH_DUMBBELL_SIGNATURE).digest('hex');
const document = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${STRENGTH_DUMBBELL_SIGNATURE}</svg>`, 'image/svg+xml');
const paths = Array.from(document.getElementsByTagName('path'));
if (paths.length !== 3) throw new Error('Strength signature changed; inspect adapter');
const width = Number(paths[1].getAttribute('stroke-width'));
const plates = Array.from(paths[1].getAttribute('d').matchAll(/M([\d.]+) ([\d.]+) V([\d.]+)/g), m=>({x:Number(m[1]),top:Number(m[2]),bottom:Number(m[3])})).sort((a,b)=>a.x-b.x);
const shaft = paths[0].getAttribute('d').match(/^M([\d.]+) ([\d.]+) H([\d.]+)$/);
if (plates.length !== 6 || !shaft || width !== 2.25) throw new Error('Unsupported canonical equipment geometry');

function renderStrengthOutline(color='#E7C486') {
  const line = `stroke="${color}" stroke-linecap="round" stroke-linejoin="round"`;
  let start = Number(shaft[1]);
  const y = Number(shaft[2]);
  const segments = [];
  for (const plate of plates) {
    segments.push(`M${start} ${y} H${plate.x-width/2}`);
    start = plate.x+width/2;
  }
  segments.push(`M${start} ${y} H${shaft[3]}`);
  return `<g data-glyph="canonical-strength-dumbbell-outline" data-source-sha256="${sourceHash}" ${line}><path d="${segments.join(' ')}" stroke-width="1.15"/>${plates.map(p=>`<rect x="${p.x-width/2}" y="${p.top}" width="${width}" height="${p.bottom-p.top}" rx=".55" stroke-width=".75"/>`).join('')}</g>`;
}

module.exports = { renderStrengthOutline, sourceHash, plates };
