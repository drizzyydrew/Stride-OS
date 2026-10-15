const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));

const dir = __dirname;
const type = JSON.parse(fs.readFileSync(path.join(dir, 'typography.json'), 'utf8'));
const source = process.env.RUNNING_BADGE_REFERENCE || '/tmp/codex-remote-attachments/01a0e1ea-7f22-7553-aa6a-74ab0d53563c/B05BE646-580E-41B4-B2DC-D21F20501568/1-Photo-1.jpg';
const reference = path.join(dir, 'reference-sheet.jpg');
if (!fs.existsSync(reference)) fs.copyFileSync(source, reference);

const diamond = 'M50 7.5 Q52.4 7.5 54.4 9.6 L90.4 45.6 Q92.5 47.7 92.5 50 Q92.5 52.3 90.4 54.4 L54.4 90.4 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 90.4 L9.6 54.4 Q7.5 52.3 7.5 50 Q7.5 47.7 9.6 45.6 L45.6 9.6 Q47.7 7.5 50 7.5 Z';
const chevrons = 'M43.7 76.8 L50 81.2 L56.3 76.8 M44 81.4 L50 85.6 L56 81.4';
const palettes = {
  unlocked: { primary: '#9DB674', highlight: '#C6D39A', shadow: '#4E6435', text: '#BCD48C', background: '#080B07' },
  locked: { primary: '#888888', highlight: '#AAAAAA', shadow: '#555555', text: '#999999', background: '#090909' },
};

function normalize(variant) {
  const state = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!['unlocked', 'locked', 'transparent'].includes(state)) throw new Error(`Unknown state: ${state}`);
  return state;
}

function lettering(key, color, letterings = type) {
  const value = letterings[key];
  return `<path data-lettering="${key}" data-text="${value.text}" d="${value.path}" transform="translate(${value.translateX} 0)" fill="${color}"/>`;
}

function renderBadge(variant = 'unlocked', size = 800, options = {}) {
  const state = normalize(variant);
  const tokens = state === 'locked' ? palettes.locked : options.palette || palettes.unlocked;
  const identity = options.identity || 'one-mile';
  const letterings = options.letterings || type;
  const label = options.label || `Lifetime Distance Running, one mile, ${state}, review preview`;
  const edge = `${identity}-${state}-edge`, ambient = `${identity}-${state}-ambient`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${edge}" x1="18" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse"><stop stop-color="${tokens.highlight}"/><stop offset=".5" stop-color="${tokens.primary}"/><stop offset="1" stop-color="${tokens.shadow}"/></linearGradient>
    <radialGradient id="${ambient}" cx="50%" cy="35%" r="60%"><stop stop-color="${tokens.primary}" stop-opacity=".055"/><stop offset="1" stop-color="${tokens.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path data-frame="diamond" d="${diamond}" fill="${state === 'transparent' ? 'none' : tokens.background}" stroke="url(#${edge})" stroke-width=".95" stroke-linejoin="round"/>
  ${state === 'transparent' ? '' : `<path d="${diamond}" fill="url(#${ambient})"/>`}
  ${lettering('number', tokens.text, letterings)}
  ${lettering('unit', tokens.primary, letterings)}
  ${lettering('wordmark', tokens.primary, letterings)}
  <path data-chevrons="2" d="${chevrons}" stroke="${tokens.primary}" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n`;
}

function render(variant = 'unlocked', size = 800) {
  return renderBadge(variant, size);
}

async function png(svg) { return sharp(Buffer.from(svg)).png().toBuffer(); }
async function pixels(svg) { return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }

async function main() {
  const states = ['unlocked', 'locked', 'transparent'];
  const sizes = [48, 64, 96, 128, 256];
  const geometry = /<(?:path)\b[^>]*(?:data-frame|data-lettering|data-chevrons)[^>]*>/g;
  const canonical = [...render().matchAll(geometry)].map(match => match[0].replace(/(?:fill|stroke)="[^"]*"/g, '')).join('');
  const report = { achievement: 'lifetime-running-one-mile', scope: 'preview only; production unchanged', states, sizes, lettering: {}, pixelChecks: [] };
  for (const [key, value] of Object.entries(type)) {
    const [left, top, right, bottom] = value.bounds;
    assert(Math.abs(left - (100 - right)) < 1e-8, `${key} unequal margins`);
    assert(left > 20 && right < 80 && top > 20 && bottom < 75, `${key} exceeds safe zone`);
    report.lettering[key] = { bounds: value.bounds, leftMargin: left, rightMargin: 100 - right };
  }
  assert.equal(render('share-opaque'), render('unlocked'));
  assert.equal(render('share-transparent'), render('transparent'));
  for (const state of states) {
    const svg = render(state);
    const stateGeometry = [...svg.matchAll(geometry)].map(match => match[0].replace(/(?:fill|stroke)="[^"]*"/g, '')).join('');
    assert.equal(stateGeometry, canonical);
    assert(!/<text\b|<image\b|font-family=/.test(svg));
    const name = `one-mile-${state}`;
    fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
    fs.writeFileSync(path.join(dir, `${name}.png`), await png(svg));
    for (const size of [...sizes, 800]) {
      const { data, info } = await pixels(render(state, size));
      const alpha = (x, y) => data[(y * size + x) * 4 + 3];
      assert.equal(alpha(0, 0), 0);
      if (state === 'transparent') assert.equal(alpha(Math.floor(size / 2), Math.floor(size * .22)), 0);
      if (state === 'locked') for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
      }
      const number = lettering('number', '#FFFFFF');
      const isolated = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${number}</svg>`;
      const ink = await pixels(isolated);
      let min = size, max = -1;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (ink.data[(y * size + x) * 4 + 3] > 16) { min = Math.min(min, x); max = Math.max(max, x); }
      }
      assert(max >= min, 'Blank number');
      assert(Math.abs(min - (size - 1 - max)) <= 1, `Numeral is off-center at ${size}px`);
      report.pixelChecks.push({ state, size: info.width, numeralMargins: [min, size - 1 - max] });
    }
  }

  const panels = [];
  for (let index = 0; index < states.length; index++) panels.push({ input: await png(render(states[index], 340)), left: 20 + index * 370, top: 60 });
  const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="1130" height="430"><g font-family="Arial" font-size="17" fill="#DDDDDD" text-anchor="middle">${states.map((state, i) => `<text x="${190 + i * 370}" y="34">${state.toUpperCase()}</text>`).join('')}</g></svg>`;
  panels.push({ input: Buffer.from(labels), left: 0, top: 0 });
  await sharp({ create: { width: 1130, height: 430, channels: 3, background: '#141714' } }).composite(panels).png().toFile(path.join(dir, 'one-mile-states.png'));

  let x = 26;
  const sizeLayers = sizes.map(size => {
    const left = x;
    x += size + 30;
    return { input: Buffer.from(render('unlocked', size)), left, top: 30 + Math.round((256 - size) / 2) };
  });
  const sizesLabel = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g fill="#DDDDDD" font-family="Arial" font-size="14" text-anchor="middle">${sizes.map((size, i) => `<text x="${sizeLayers[i].left + size / 2}" y="310">${size}px</text>`).join('')}</g></svg>`;
  await sharp({ create: { width: 800, height: 330, channels: 3, background: '#080A08' } }).composite([...sizeLayers, { input: Buffer.from(sizesLabel), top: 0, left: 0 }]).png().toFile(path.join(dir, 'one-mile-sizes.png'));

  const crop = await sharp(reference).extract({ left: 24, top: 285, width: 71, height: 78 }).resize(355, 390).png().toBuffer();
  const comparisonLabel = `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="460"><g font-family="Arial" font-size="17" fill="#DDDDDD" text-anchor="middle"><text x="213" y="30">REFERENCE DETAIL</text><text x="625" y="30">ONE-MILE VECTOR PREVIEW</text></g></svg>`;
  await sharp({ create: { width: 850, height: 460, channels: 3, background: '#080A08' } }).composite([{ input: crop, top: 50, left: 35 }, { input: await png(render('unlocked', 390)), top: 50, left: 430 }, { input: Buffer.from(comparisonLabel), top: 0, left: 0 }]).png().toFile(path.join(dir, 'one-mile-comparison.png'));
  fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { render, renderBadge, normalize, lettering, diamond, chevrons, palettes };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
