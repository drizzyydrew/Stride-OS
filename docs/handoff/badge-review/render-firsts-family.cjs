const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const sharp = require('/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const { DEFINITIONS, renderBadge } = require('./firsts-family-preview.cjs');
const { FIRST_ACHIEVEMENT_DEFINITIONS } = require('../../../src/achievements/firsts/firstsDefinitions.ts');

const out = path.join(__dirname,'firsts-complete');
const states = ['unlocked','locked','transparent'];
const hashes = {
  first_activity:'d4ed184aa30eea120daa231d5a4e1df65a001a7f21f4f21fcc3ca798972f7a69',
  first_run:'02b0e8d9e3592ffdb85a4e42eb6a873fc0c1f6214d5d43de3b7a04a8d3716e8a',
  first_walk:'e88aecb7531976ea49fbc017e4fccf9600cb5d9dbaef975909fa8ac99af93c62',
};
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const frozenPath=path.join(out,'approved-non-mobility-hashes.json');
const frozen=fs.existsSync(frozenPath)?JSON.parse(fs.readFileSync(frozenPath,'utf8')):{};
function writeExport(file,data) {
  const expected=frozen[path.basename(file)];
  if(expected&&hash(data)!==expected)throw new Error(`Approved non-Mobility export changed: ${file}`);
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
  if(fs.existsSync(file)&&fs.readFileSync(file).equals(bytes))return;
  fs.writeFileSync(file,bytes);
}
const esc = s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function wrap(s) {
  const lines=[''];
  for(const word of s.split(' ')) {
    if(lines.at(-1).length+word.length+1>26)lines.push(word);
    else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;
  }
  return lines;
}
function parse(svg) {
  const errors=[];
  const doc=new DOMParser({onError:(level,message)=>errors.push(message)}).parseFromString(svg,'image/svg+xml');
  if(errors.length)throw new Error(errors.join('\n'));
  return doc;
}
function geometry(svg) {
  const doc=parse(svg);
  return Array.from(doc.getElementsByTagName('*')).filter(n=>n.tagName!=='ellipse').map(n=>({tag:n.tagName,attrs:Array.from(n.attributes).filter(a=>['d','x','y','cx','cy','r','rx','ry','width','height','transform','viewBox','font-family','font-size','font-weight','letter-spacing','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','mask','maskUnits','maskContentUnits','mask-type','fill-rule','clip-rule'].includes(a.name)).map(a=>[a.name,a.value]),text:n.tagName==='text'?n.textContent:''}));
}
function masks(svg) {
  const serializer=new XMLSerializer();
  return Array.from(parse(svg).getElementsByTagName('mask')).map(n=>serializer.serializeToString(n));
}
function bounds(data,info) {
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>25){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return {minX,minY,maxX,maxY};
}

async function titleBounds(svg) {
  const doc=parse(svg), serializer=new XMLSerializer();
  const titles=Array.from(doc.getElementsByTagName('text')).filter(n=>n.textContent!=='STRIDEOS'&&Number(n.getAttribute('y'))>55);
  const only=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 100 100">${titles.map(n=>serializer.serializeToString(n)).join('')}</svg>`;
  const {data,info}=await sharp(Buffer.from(only)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return bounds(data,info);
}

async function glyphBounds(svg) {
  const doc=parse(svg), serializer=new XMLSerializer();
  const nodes=[];
  for(let n=doc.documentElement.firstChild;n;n=n.nextSibling) {
    if(n.nodeType!==1)continue;
    if(n.tagName==='text')break;
    if(n.tagName==='ellipse'||(n.tagName==='path'&&n.getAttribute('d').startsWith('M50 4 Q52.4')))continue;
    nodes.push(serializer.serializeToString(n));
  }
  const only=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 100 100" fill="none">${nodes.join('')}</svg>`;
  const {data,info}=await sharp(Buffer.from(only)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return bounds(data,info);
}

async function mobilityArcOverlap(size) {
  const doc=parse(renderBadge('first_mobility_workout','transparent',size));
  const serializer=new XMLSerializer();
  const paths=Array.from(doc.getElementsByTagName('path'));
  const arc=paths.find(n=>n.getAttribute('data-range-arc')==='upper');
  const body=paths.find(n=>n.getAttribute('data-body')==='continuous-silhouette');
  const head=Array.from(doc.getElementsByTagName('circle')).find(n=>n.getAttribute('data-head')==='floating');
  if(!arc||!body||!head)throw new Error('Missing Mobility anatomical outline');
  const raster=async node=>sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none"><g stroke="#E7C486" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -1.5)">${serializer.serializeToString(node)}</g></svg>`)).ensureAlpha().raw().toBuffer();
  const a=await raster(arc),b=await raster(body),h=await raster(head);
  let overlap=0,headOverlap=0;
  for(let p=3;p<a.length;p+=4){if(a[p]>16&&b[p]>16)overlap++;if(h[p]>16&&b[p]>16)headOverlap++;}
  if(overlap)throw new Error(`Mobility arm/range arc overlap at ${size}px: ${overlap}`);
  if(headOverlap)throw new Error(`Mobility head/body overlap at ${size}px: ${headOverlap}`);
  return {size,overlappingPixels:overlap,headBodyOverlappingPixels:headOverlap};
}

async function board(state) {
  const width=1400,height=1060,cellW=268,cellH=310;
  const background=state==='transparent'?'#454846':'#000000';
  const layers=[];
  let text=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial,sans-serif" fill="#eeeeee"><text x="40" y="39" font-size="25">Firsts - ${state}</text><text x="40" y="66" font-size="14">15 canonical badges / approved visual direction / vector previews</text>`;
  for(let i=0;i<DEFINITIONS.length;i++) {
    const d=DEFINITIONS[i],x=30+(i%5)*cellW,y=90+Math.floor(i/5)*cellH;
    layers.push({input:await sharp(Buffer.from(renderBadge(d.id,state,244))).png().toBuffer(),left:x+12,top:y});
    wrap(`${String(i+1).padStart(2,'0')}. ${d.title}`).forEach((label,j)=>{text+=`<text x="${x+cellW/2}" y="${y+267+j*19}" font-size="16" text-anchor="middle">${esc(label)}</text>`;});
  }
  layers.push({input:Buffer.from(text+'</g></svg>'),left:0,top:0});
  await sharp({create:{width,height,channels:3,background}}).composite(layers).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(out,`firsts-${state}-board.jpg`));
}

async function sizeBoard(state) {
  const sizes=[48,64,96,128,256],width=1570,height=DEFINITIONS.length*288+55;
  const layers=[];
  let labels=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="#eeeeee" font-family="Arial,sans-serif" font-size="13">`;
  sizes.forEach((size,i)=>{labels+=`<text x="${220+i*280}" y="27" text-anchor="middle">${size}px</text>`;});
  for(let row=0;row<DEFINITIONS.length;row++) {
    const d=DEFINITIONS[row],top=45+row*288;
    wrap(d.title).forEach((line,j)=>{labels+=`<text x="12" y="${top+123+j*18}">${esc(line)}</text>`;});
    for(let col=0;col<sizes.length;col++) {
      const size=sizes[col];
      layers.push({input:await sharp(Buffer.from(renderBadge(d.id,state,size))).png().toBuffer(),left:220+col*280-Math.floor(size/2),top:top+Math.floor((256-size)/2)});
    }
  }
  layers.push({input:Buffer.from(labels+'</g></svg>'),left:0,top:0});
  await sharp({create:{width,height,channels:3,background:state==='transparent'?'#454846':'#000000'}}).composite(layers).jpeg({quality:95}).toFile(path.join(out,`firsts-${state}-sizes.jpg`));
}

async function metricBoard() {
  const layers=[];
  for(const [i,id] of ['first_half_marathon','first_marathon'].entries()) {
    layers.push({input:await sharp(Buffer.from(renderBadge(id,'unlocked',400,'metric'))).png().toBuffer(),left:20+i*420,top:70});
  }
  layers.push({input:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="860" height="490"><g font-family="Arial,sans-serif" font-size="19" fill="#eeeeee"><text x="220" y="38" text-anchor="middle">Half Marathon - Metric</text><text x="640" y="38" text-anchor="middle">Marathon - Metric</text></g></svg>'),left:0,top:0});
  await sharp({create:{width:860,height:490,channels:3,background:'#000000'}}).composite(layers).jpeg({quality:95}).toFile(path.join(out,'firsts-metric-races.jpg'));
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  if(JSON.stringify(DEFINITIONS.map(d=>d.id))!==JSON.stringify(FIRST_ACHIEVEMENT_DEFINITIONS.map(d=>d.id)))throw new Error('Canonical ID coverage mismatch');
  const report=[];
  for(const d of DEFINITIONS) {
    const unlocked=renderBadge(d.id);
    if(hashes[d.id]&&hash(unlocked)!==hashes[d.id])throw new Error(`Approved badge changed: ${d.id}`);
    if(renderBadge(d.id,'share-opaque')!==unlocked||renderBadge(d.id,'share-transparent')!==renderBadge(d.id,'transparent'))throw new Error('State alias drift');
    const canonical=FIRST_ACHIEVEMENT_DEFINITIONS.find(x=>x.id===d.id);
    if(JSON.stringify(d.lines)!==JSON.stringify(canonical.titleLines))throw new Error('Title identity drift');
    const title=await titleBounds(unlocked);
    if(title.minX<136||title.maxX>664)throw new Error(`Title approaches border: ${d.id} ${JSON.stringify(title)}`);
    const glyph=await glyphBounds(unlocked);
    if(title.minY-glyph.maxY<25)throw new Error(`Glyph/title crowding: ${d.id} ${JSON.stringify({title,glyph})}`);
    for(const state of states) {
      const svg=renderBadge(d.id,state);
      if(JSON.stringify(geometry(svg))!==JSON.stringify(geometry(unlocked)))throw new Error(`Geometry state drift: ${d.id}`);
      if(JSON.stringify(masks(svg))!==JSON.stringify(masks(unlocked)))throw new Error(`Mask state drift: ${d.id}`);
      if(/<image\b|href=/.test(svg))throw new Error('Embedded or external image');
      writeExport(path.join(out,`${d.slug}-${state}.svg`),svg);
      const png=await sharp(Buffer.from(svg)).png().toBuffer();
      writeExport(path.join(out,`${d.slug}-${state}.png`),png);
      const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      if(info.width!==800||info.height!==800)throw new Error('Export size mismatch');
      if(state==='locked')for(let p=0;p<data.length;p+=4)if(data[p+3]&&(data[p]!==data[p+1]||data[p+1]!==data[p+2]))throw new Error(`Colored locked pixel: ${d.id}`);
      if(state==='transparent') {
        const alpha=(x,y)=>data[(y*info.width+x)*4+3];
        for(const [x,y] of [[0,0],[400,570],[120,400],[680,400]])if(alpha(x,y)!==0)throw new Error(`Opaque empty background: ${d.id} ${x},${y}`);
        if(d.id==='first_strength_workout')for(const x of [27.1,31.1,36.2,63.8,68.9,72.9])if(alpha(Math.round(x*8),311)!==0)throw new Error('Opaque strength plate interior');
        if(d.id==='first_mobility_workout'&&alpha(368,312)!==0)throw new Error('Opaque hollow mobility torso');
      }
    }
    report.push({id:d.id,titleBounds:title,glyphBounds:glyph,glyphTitleGapPixels:title.minY-glyph.maxY,approvedBaselineUnchanged:Boolean(hashes[d.id]),states:states.slice()});
  }
  for(const id of ['first_5k','first_10k','first_half_marathon','first_marathon']) {
    const d=DEFINITIONS.find(x=>x.id===id);
    for(const units of ['imperial','metric']) {
      const label=FIRST_ACHIEVEMENT_DEFINITIONS.find(x=>x.id===id).shieldLabel(units);
      if(!renderBadge(id,'unlocked',800,units).includes(`>${label}</text>`))throw new Error('Race label mismatch');
    }
    if(id==='first_half_marathon'||id==='first_marathon') {
      for(const state of states) {
        const svg=renderBadge(id,state,800,'metric');
        writeExport(path.join(out,`${d.slug}-${state}-metric.svg`),svg);
        writeExport(path.join(out,`${d.slug}-${state}-metric.png`),await sharp(Buffer.from(svg)).png().toBuffer());
      }
    }
  }
  for(const state of states){await board(state);await sizeBoard(state);}
  await metricBoard();
  const mobilityArcChecks=[];
  for(const size of [48,64,96,128,256,800])mobilityArcChecks.push(await mobilityArcOverlap(size));
  const productionDiff=execFileSync('git',['diff','--name-only','HEAD','--','src','assets','targets','modules','app','app.json'],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}).trim().split('\n').filter(Boolean);
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({badges:15,canonicalStatePairs:45,additionalMetricStatePairs:6,approvedHashes:hashes,frozenNonMobilityExports:Object.keys(frozen).length,mobilityArcChecks,checks:report,productionFilesChanged:productionDiff.length>0,productionPathsDifferentFromHead:productionDiff},null,2));
  console.log(JSON.stringify({badges:15,canonicalStatePairs:45,additionalMetricStatePairs:6,approvedBaselinesUnchanged:3,boards:out,validation:'PASS'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
