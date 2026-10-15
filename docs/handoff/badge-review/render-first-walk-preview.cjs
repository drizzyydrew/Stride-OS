const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const { render: renderFrame } = require('./render-first-run-preview.cjs');

const dir = __dirname;
const walker = `  <g data-glyph="outlined-walker" stroke="#E7C486" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50.5" cy="21.8" r="3.2" stroke-width=".9"/>
    <path data-body="continuous-silhouette" d="M49 27.1 Q50.4 26.3 51.6 27 Q52.7 27.5 53 29.2 L54.7 35.4 L58.5 37.9 Q59.6 38.5 59.1 39.5 Q58.6 40.4 57.5 39.7 L52.9 36.8 Q52.2 36.4 52 35.5 L51.7 33.9 L51 38.8 L55.5 43.8 Q56 44.3 56.3 45.3 L58.1 52.1 L59.9 52.5 Q61.3 52.7 61.1 53.5 Q61 54.1 59.9 54.1 L56.6 54.1 Q55.5 54.1 55.6 53.2 L55.9 52.2 L53.7 45.9 L47.8 41.1 L46.8 45.3 Q46.6 46.1 45.9 46.8 L41.6 51.6 L42.2 52.5 Q42.9 53.4 41.9 53.9 Q41.3 54.2 40.7 53.7 L39.3 52.5 Q38.6 51.9 39.2 51 L43.7 44.9 L45.4 40.2 Q44.6 39.6 45 37.9 L46.1 30.9 L43.2 33.1 L41.6 38.9 Q41.3 40 40.2 39.7 Q39.3 39.4 39.6 38.3 L41.4 32.3 Q41.6 31.6 42.4 31.1 Z" stroke-width=".92"/>
    <path data-shoe="rear" d="M41.6 51.6 L42.2 52.5 Q42.9 53.4 41.9 53.9 Q41.3 54.2 40.7 53.7 L39.3 52.5 Q38.6 51.9 39.2 51 Z" fill="#E7C486" stroke-width=".2"/>
    <path data-shoe="front" d="M58.1 52.1 L59.9 52.5 Q61.3 52.7 61.1 53.5 Q61 54.1 59.9 54.1 L56.6 54.1 Q55.5 54.1 55.6 53.2 L55.9 52.2 Z" fill="#E7C486" stroke-width=".2"/>
  </g>
`;
const render = (variant='unlocked', size=800) => renderFrame(variant, size, walker, 'FIRST WALK', 'First Walk');

module.exports = { walker, render };

if (require.main === module) (async () => {
  for (const variant of ['unlocked','locked','transparent']) {
    const svg = render(variant);
    const name = variant === 'unlocked' ? 'first-walk-preview' : `first-walk-preview-${variant}`;
    fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir, `${name}.png`));
  }
  const ref = await sharp(path.join(dir,'first-walk-reference.png')).resize(440,440).png().toBuffer();
  const preview = await sharp(Buffer.from(render('unlocked',440))).png().toBuffer();
  const label = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520"><g font-family="Arial,sans-serif" fill="#eeeeee" font-size="19"><text x="260" y="34" text-anchor="middle">YOUR REFERENCE</text><text x="700" y="34" text-anchor="middle">FIRST WALK - VECTOR PREVIEW</text></g></svg>');
  await sharp({create:{width:960,height:520,channels:3,background:'#000000'}}).composite([{input:ref,left:40,top:55},{input:preview,left:480,top:55},{input:label,left:0,top:0}]).png().toFile(path.join(dir,'first-walk-comparison.png'));
  const layers = [];
  let left = 24;
  let text = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="330"><g font-family="Arial,sans-serif" font-size="14" fill="#dddddd">';
  for (const size of [48,64,96,128,256]) {
    layers.push({input:await sharp(Buffer.from(render('unlocked',size))).png().toBuffer(),left,top:24+Math.floor((256-size)/2)});
    text += `<text x="${left+size/2}" y="306" text-anchor="middle">${size}px</text>`;
    left += size+30;
  }
  layers.push({input:Buffer.from(text+'</g></svg>'),left:0,top:0});
  await sharp({create:{width:800,height:330,channels:3,background:'#000000'}}).composite(layers).png().toFile(path.join(dir,'first-walk-sizes.png'));
  const {data,info} = await sharp(path.join(dir,'first-walk-preview-transparent.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha = (x,y) => data[(y*info.width+x)*4+3];
  if(alpha(0,0)!==0||alpha(400,550)!==0)throw new Error('Transparent background failed');
  if(render().includes('data-motion-lines'))throw new Error('Walking badge contains motion lines');
  console.log(JSON.stringify({variants:3,dimensions:[info.width,info.height],alphaOutside:alpha(0,0),alphaInterior:alpha(400,550),motionLines:0,productionFilesChanged:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
