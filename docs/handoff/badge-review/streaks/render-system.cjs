const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser } = require('@xmldom/xmldom');
const sharp = require(process.env.STRIDEOS_SHARP_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const createFrame = require('./frame.js');
const createSystem = require('./ranked-artwork.js');
const artwork = require('./artwork.json'), digits = require('./digits.json'), system = require('./system.json');
const ranked = createSystem(artwork, digits, system, createFrame);
const dir = __dirname;
const states = ['unlocked', 'locked', 'transparent'];
const sizes = [48, 64, 96, 128, 256];
const samples = [...new Set([1, 3, 14, 30, 75, 1000, ...system.boundarySamples.map(item => item.days)])].sort((a, b) => a - b);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function png(svg) { return sharp(Buffer.from(svg)).png().toBuffer(); }
async function raw(svg) { return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
function isolated(markup, size) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${markup}</svg>`; }
function geometry(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('*')).filter(element => ['path', 'g'].includes(element.tagName)).map(element => ['d', 'transform', 'data-lettering', 'data-glyph', 'data-frame', 'data-chevrons', 'data-text', 'stroke-width'].map(key => element.getAttribute(key)));
}
async function write(name, value) {
  const target = path.join(dir, name), bytes = Buffer.from(value);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
}
async function board(name, entries, state, heading) {
  const columns = 5, tile = 185, gap = 20, top = 75, rowHeight = 245;
  const width = columns * (tile + gap) + gap, height = top + Math.ceil(entries.length / columns) * rowHeight;
  const layers = [];
  let text = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial" fill="#DDDDDD"><text x="${width / 2}" y="32" text-anchor="middle" font-size="21">${heading}</text>`;
  for (const [index, entry] of entries.entries()) {
    const x = gap + index % columns * (tile + gap), y = top + Math.floor(index / columns) * rowHeight;
    layers.push({ input: await png(ranked.render(entry.days, state, tile)), left: x, top: y });
    text += `<text x="${x + tile / 2}" y="${y + tile + 10}" text-anchor="middle" font-size="12">${entry.label}</text><text x="${x + tile / 2}" y="${y + tile + 29}" text-anchor="middle" font-size="11">${entry.range || ''}</text>`;
  }
  layers.push({ input: Buffer.from(text + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#303330' : '#070809' } }).composite(layers).png().toFile(path.join(dir, name));
}
async function smallBoard(state) {
  const width = 1540, height = 55 + system.tiers.length * 285;
  const layers = [];
  let text = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial" fill="#DDDDDD" font-size="12">`;
  for (const [column, size] of sizes.entries()) text += `<text x="${175 + column * 275 + 128}" y="27" text-anchor="middle">${size}px</text>`;
  for (const [row, tier] of system.tiers.entries()) {
    text += `<text x="12" y="${55 + row * 285 + 125}">${tier.label}</text>`;
    for (const [column, size] of sizes.entries()) layers.push({ input: await png(ranked.render(tier.minDays, state, size)), left: 175 + column * 275 + Math.round((256 - size) / 2), top: 55 + row * 285 + Math.round((256 - size) / 2) });
  }
  layers.push({ input: Buffer.from(text + '</g></svg>'), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: state === 'transparent' ? '#303330' : '#070809' } }).composite(layers).png().toFile(path.join(dir, `ranked-${state}-sizes.png`));
}
async function viewer() {
  const frameSource = fs.readFileSync(path.join(dir, 'frame.js'), 'utf8');
  const systemSource = fs.readFileSync(path.join(dir, 'ranked-artwork.js'), 'utf8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StrideOS Streaks Review</title><style>
  *{box-sizing:border-box}body{margin:0;background:#111312;color:#E8EAE8;font-family:Arial,sans-serif;letter-spacing:0}main{max-width:960px;margin:auto;padding:24px}h1{font-size:22px;margin:0 0 24px;font-weight:500}nav{display:flex;border-bottom:1px solid #424642;gap:24px;margin-bottom:24px}nav button{border:0;border-bottom:2px solid transparent;padding:12px 0;background:none;color:#A9AFAA;font:inherit;cursor:pointer}nav button[aria-selected=true]{border-color:#A5EC70;color:#E8EAE8}.controls{display:flex;gap:20px;flex-wrap:wrap}label{font-size:13px;display:grid;gap:8px}input,select{height:38px;background:#1E221F;color:#E8EAE8;border:1px solid #515A52;border-radius:4px;padding:7px 10px;font:inherit}input{width:130px}select{max-width:100%}[hidden]{display:none!important}#preview{width:min(100%,460px);aspect-ratio:1;margin:24px auto 0}#preview svg{width:100%;height:100%;display:block}.rank{text-align:center;font-size:15px;margin:0}.range{font-size:13px;color:#A9AFAA;text-align:center;margin:8px 0 24px}#tiers{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;border-top:1px solid #424642;padding-top:16px}#tiers button{background:none;border:0;color:#CDD3CD;font:inherit;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px}.swatch{width:10px;height:10px;display:inline-block;border-radius:50%}:focus-visible{outline:2px solid #A5EC70;outline-offset:3px}@media(max-width:480px){main{padding:18px}.controls{gap:12px}h1{margin-bottom:14px}nav{margin-bottom:18px}}
  </style></head><body><main><h1>Streaks</h1><nav role="tablist" aria-label="Badge view"><button id="daily" role="tab" aria-controls="preview" aria-selected="true">Daily Streak</button><button id="milestones" role="tab" aria-controls="preview" aria-selected="false">Milestone Awards</button></nav><div class="controls"><label id="day-field">Days<input id="days" type="number" min="1" max="99999" step="1" value="3"></label><label id="award-field" hidden>Award<select id="award"></select></label><label>State<select id="state"><option value="unlocked">Unlocked</option><option value="locked">Locked</option><option value="transparent">Transparent Share</option></select></label></div><div id="preview" role="tabpanel" aria-label="Selected streak badge"></div><p class="rank" id="rank"></p><p class="range" id="range"></p><div id="tiers" aria-label="Flame ranks"></div></main><script>
  ${frameSource}
  ${systemSource}
  const artwork=${JSON.stringify(artwork)},digits=${JSON.stringify(digits)},system=${JSON.stringify(system)};
  const ranked=createRankedStreakArtwork(artwork,digits,system,createStreakFrame);let mode='daily';
  const byId=id=>document.getElementById(id),dayInput=byId('days'),awardInput=byId('award'),stateInput=byId('state');
  system.milestones.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;awardInput.appendChild(option)});
  function update(){const days=mode==='daily'?ranked.safeDays(dayInput.valueAsNumber):system.milestones.find(item=>item.id===awardInput.value).day;const tier=ranked.tierForDays(days);byId('preview').innerHTML=ranked.render(days,stateInput.value,460);byId('rank').textContent=tier.label;byId('range').textContent=tier.rangeLabel;document.body.dataset.days=days;document.body.dataset.tier=tier.token;}
  function setMode(value){mode=value;byId('daily').setAttribute('aria-selected',String(mode==='daily'));byId('milestones').setAttribute('aria-selected',String(mode==='milestones'));byId('day-field').hidden=mode!=='daily';byId('award-field').hidden=mode!=='milestones';update()}
  byId('daily').onclick=()=>setMode('daily');byId('milestones').onclick=()=>setMode('milestones');[dayInput,awardInput,stateInput].forEach(input=>input.addEventListener('input',update));
  ['daily','milestones'].forEach(id=>byId(id).addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const next=mode==='daily'?'milestones':'daily';setMode(next);byId(next).focus()}}));
  system.tiers.forEach(tier=>{const button=document.createElement('button'),swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=tier.colors.primary;button.appendChild(swatch);button.appendChild(document.createTextNode(tier.label));button.onclick=()=>{dayInput.value=tier.minDays;setMode('daily')};byId('tiers').appendChild(button)});update();
  </script></body></html>`;
  await write('daily-viewer.html', html);
}
async function main() {
  const report = { scope: 'ranked daily and milestone review artwork, not app integration', tiers: system.tiers, milestones: system.milestones, samples, pixelChecks: [], files: [] };
  const approved = {};
  for (const state of states) for (const ext of ['svg', 'png']) approved[`three-day-${state}.${ext}`] = sha(fs.readFileSync(path.join(dir, `three-day-${state}.${ext}`)));
  const approvedFile = path.join(dir, 'approved-reference-hashes.json');
  if (fs.existsSync(approvedFile)) assert.deepEqual(JSON.parse(fs.readFileSync(approvedFile, 'utf8')), approved);
  else await write('approved-reference-hashes.json', JSON.stringify(approved, null, 2) + '\n');
  for (const state of states) {
    const svg = ranked.common.render(state);
    assert.equal(sha(Buffer.from(svg)), approved[`three-day-${state}.svg`]);
    assert.equal(sha(await png(svg)), approved[`three-day-${state}.png`]);
  }
  for (const source of system.sources) assert.equal(sha(fs.readFileSync(path.resolve(dir, '../../../..', source.path))), source.sha256);
  assert.equal(system.tiers.length, 9); assert.equal(system.milestones.length, 10);
  for (const sample of system.boundarySamples) assert.equal(ranked.tierForDays(sample.days).token, sample.token);
  for (const day of [...Array.from({ length: 400 }, (_, i) => i + 1), 1000, 99999, Number.MAX_SAFE_INTEGER]) {
    const layout = ranked.numberLayout(day), tier = ranked.tierForDays(day);
    assert(Math.abs(layout.bounds[0] - (100 - layout.bounds[2])) < 1e-7);
    assert(layout.bounds[1] > artwork.flame.bounds[3] + 2);
    assert(layout.bounds[3] + 2 < artwork.title.bounds[1]);
    assert.equal(ranked.render(day, 'share-opaque'), ranked.render(day, 'unlocked'));
    assert.equal(ranked.render(day, 'share-transparent'), ranked.render(day, 'transparent'));
    assert(ranked.render(day).includes(tier.colors.primary));
  }
  for (const day of samples) for (const size of sizes) {
    const glyph = await raw(isolated(ranked.numberMarkup(day, '#FFFFFF'), size));
    let left = size, right = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (glyph.data[(y * size + x) * 4 + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); }
    assert(left <= right && Math.abs(left - (size - 1 - right)) <= 1, `Off-center ${day}/${size}`);
    report.pixelChecks.push({ day, size, margins: [left, size - 1 - right] });
  }
  for (const item of [...samples.map(days => ({ group: 'daily', key: `day-${days}`, days })), ...system.milestones.map(item => ({ group: 'milestones', key: item.slug, days: item.day, id: item.id }))]) for (const state of states) {
    const svg = ranked.render(item.days, state);
    assert.deepEqual(geometry(svg), geometry(ranked.render(item.days)));
    assert(!/<text\b|<image\b|<mask\b|font-family=/.test(svg));
    if (item.id) assert.equal(svg, ranked.renderMilestone(item.id, state));
    const bytes = await png(svg), { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (state === 'locked') for (let i = 0; i < data.length; i += 4) if (data[i + 3]) assert(data[i] === data[i + 1] && data[i + 1] === data[i + 2]);
    if (state === 'transparent') for (const [x, y] of [[400, 110], [400, 368], [240, 460]]) assert.equal(data[(y * 800 + x) * 4 + 3], 0);
    const stem = `ranked-exports/${item.group}/${item.key}-${state}`;
    await write(stem + '.svg', svg); await write(stem + '.png', bytes);
    report.files.push({ ...item, state, svg: stem + '.svg', png: stem + '.png', svgHash: sha(Buffer.from(svg)), pngHash: sha(bytes) });
  }
  for (const state of states) {
    await board(`flame-ranks-${state}.png`, system.tiers.map(tier => ({ days: tier.minDays, label: tier.label, range: tier.rangeLabel })), state, 'STREAK FLAME RANKS');
    await board(`milestone-awards-${state}.png`, system.milestones.map(item => ({ days: item.day, label: item.title, range: item.subtitle })), state, 'STREAK MILESTONE AWARDS');
    await smallBoard(state);
  }
  await board('daily-boundaries.png', system.boundarySamples.map(sample => ({ days: sample.days, label: `${sample.days} days`, range: ranked.tierForDays(sample.days).label })), 'unlocked', 'DAILY STREAK - RANK TRANSITIONS');
  await viewer();
  report.changedProductionFiles = execFileSync('git', ['diff', '--name-only', '--', 'src/achievements/streaks', 'assets/achievements/streaks', 'targets/StrideOSWatch', 'modules/stride-watch-connectivity', 'src/components/watch/WatchWorkoutBridge.tsx'], { cwd: path.resolve(dir, '../../../..'), encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.equal(report.changedProductionFiles.length, 0);
  await write('ranked-validation.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ tiers: 9, milestones: 10, daysChecked: 403, rasterChecks: report.pixelChecks.length, exportPairs: report.files.length, changedProductionFiles: report.changedProductionFiles }));
}
module.exports = ranked;
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
