const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const dir = __dirname;
const frame = fs.readFileSync(path.join(dir, 'first-activity-preview.svg'), 'utf8');
const glyphStart = frame.indexOf('  <g stroke="#E7C486"');
const glyphEnd = frame.indexOf('  <text x="50"', glyphStart);
if (glyphStart < 0 || glyphEnd < 0) throw new Error('Approved preview frame changed');

const runner = `  <g data-glyph="outlined-runner" stroke="#E7C486" stroke-linecap="round" stroke-linejoin="round">
    <path data-motion-lines="4" d="M26 28.1 H39 M23 32.3 H37 M20 36.5 H40 M26 40.7 H38" stroke-width=".72"/>
    <circle cx="57.1" cy="22.5" r="3.2" stroke-width=".9"/>
    <path data-body="continuous-silhouette" d="M48 26.4 Q48.7 26.2 49.6 26.4 L54.8 27.5 Q55.6 27.7 56.1 28.4 L59.4 33 L65 30.4 Q66.3 29.8 66.7 30.8 Q67.3 31.9 66.3 32.5 L59.5 35.8 Q58.6 36.3 57.9 35.5 L55.7 32.7 L52 38.4 L57.9 41.3 Q59.4 42.1 58.6 43.7 L53.4 51 Q54.1 51.6 53.8 52.2 Q53.4 52.7 52.7 52.2 L51.3 51.2 Q50.8 50.8 51.3 50.1 L55.6 43.6 L48.9 40.8 L45.8 45.5 Q45.4 46.3 44.6 46.9 L37.7 51.4 L37.8 52.5 Q37.8 53.6 36.8 53.4 Q36.3 53.4 36 52.7 L35.5 50.8 Q35.3 50.1 36 49.7 L42.8 44.6 L45.7 40.4 Q44.5 39.7 45.3 37.9 L49.1 29.8 L44 30.5 L42 33 Q41.3 33.8 40.4 33.1 Q39.8 32.5 40.4 31.7 L43 28.6 Q43.4 28.1 44.1 27.8 Z" stroke-width=".92"/>
    <path data-shoe="rear" d="M36 49.7 L37.7 51.4 L37.8 52.5 Q37.8 53.6 36.8 53.4 Q36.3 53.4 36 52.7 L35.5 50.8 Q35.3 50.1 36 49.7 Z" fill="#E7C486" stroke-width=".2"/>
    <path data-shoe="front" d="M51.3 50.1 L53.4 51 Q54.1 51.6 53.8 52.2 Q53.4 52.7 52.7 52.2 L51.3 51.2 Q50.8 50.8 51.3 50.1 Z" fill="#E7C486" stroke-width=".2"/>
  </g>
`;

function render(variant = 'unlocked', size = 800, glyph = runner, title = 'FIRST RUN', name = 'First Run') {
  variant = variant === 'share-opaque' ? 'unlocked' : variant === 'share-transparent' ? 'transparent' : variant;
  if (!['unlocked', 'locked', 'transparent'].includes(variant)) throw new Error(`Unknown Firsts preview state: ${variant}`);
  let svg = (frame.slice(0, glyphStart) + glyph + frame.slice(glyphEnd))
    .replace(/FIRST ACTIVITY/g, title)
    .replace(/First Activity unapproved vector preview/g, `${name} ${variant} vector preview`)
    .replace('width="800" height="800"', `width="${size}" height="${size}"`);
  if (variant === 'transparent') {
    svg = svg.replace('fill="#090A07"', 'fill="none"')
      .replace(/  <ellipse[^>]*\/>\n/, '');
  }
  if (variant === 'locked') {
    const colors = {'#EED6A2':'#B7B7B7','#E7C486':'#929292','#BD9560':'#727272','#090A07':'#090909'};
    svg = svg.replace(/#(?:EED6A2|E7C486|BD9560|090A07)/g, c => colors[c]);
  }
  return svg;
}

module.exports = { render };

if (require.main === module) (async () => {
  for (const variant of ['unlocked', 'locked', 'transparent']) {
    const svg = render(variant);
    const name = variant === 'unlocked' ? 'first-run-preview' : `first-run-preview-${variant}`;
    fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir, `${name}.png`));
  }
  const ref = await sharp(path.join(dir, 'first-run-reference.png')).resize(440,440).png().toBuffer();
  const preview = await sharp(Buffer.from(render('unlocked',440))).png().toBuffer();
  const labels = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520"><g font-family="Arial,sans-serif" fill="#eeeeee" font-size="19"><text x="260" y="34" text-anchor="middle">YOUR REFERENCE</text><text x="700" y="34" text-anchor="middle">FIRST RUN - VECTOR PREVIEW</text></g></svg>');
  await sharp({create:{width:960,height:520,channels:3,background:'#000000'}}).composite([{input:ref,left:40,top:55},{input:preview,left:480,top:55},{input:labels,left:0,top:0}]).png().toFile(path.join(dir,'first-run-comparison.png'));
  const sizes = [48,64,96,128,256];
  const layers = [];
  let left = 24;
  let text = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial,sans-serif" font-size="14" fill="#dddddd">';
  for (const size of sizes) {
    layers.push({input:await sharp(Buffer.from(render('unlocked',size))).png().toBuffer(),left,top:24+Math.floor((256-size)/2)});
    text += `<text x="${left+size/2}" y="306" text-anchor="middle">${size}px</text>`;
    left += size+30;
  }
  layers.push({input:Buffer.from(text+'</g></svg>'),left:0,top:0});
  await sharp({create:{width:800,height:330,channels:3,background:'#000000'}}).composite(layers).png().toFile(path.join(dir,'first-run-sizes.png'));
  const {data,info} = await sharp(path.join(dir,'first-run-preview-transparent.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha = (x,y) => data[(y*info.width+x)*4+3];
  if(alpha(0,0)!==0||alpha(400,550)!==0)throw new Error('Transparent background failed');
  for (const variant of ['unlocked','locked','transparent']) {
    if(!render(variant).includes('data-body="continuous-silhouette"'))throw new Error('Body geometry missing');
  }
  console.log(JSON.stringify({variants:3,dimensions:[info.width,info.height],alphaOutside:alpha(0,0),alphaInterior:alpha(400,550),motionLines:4,productionFilesChanged:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
