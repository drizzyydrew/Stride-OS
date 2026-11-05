import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { RACE_PR_DEFINITIONS } from '../src/achievements/racePr/racePrDefinitions';
import { renderRacePrBadgeSvg } from '../src/achievements/racePr/racePrArtwork';
import { FIRSTS_HEXAGON_PATH } from '../src/achievements/firsts/firstsArtwork';
import { FIRSTS_WORDMARK_PATH } from '../src/achievements/firsts/firstsTypography';
import { firstsRasterizer } from './lib/firstsRasterizer';
import { RACE_PR_TYPOGRAPHY } from '../src/achievements/racePr/racePrTypography';
const states = ['unlocked','locked','transparent'] as const;
const sizes = [48,64,96,128,256];
const sha = (buffer: Buffer | string) => createHash('sha256').update(buffer).digest('hex');
const directory = 'assets/achievements/race-pr';
const geometry = (svg:string) => [...svg.matchAll(/<(?:path|circle|rect)\b[^>]*>/g)].map(match =>
  [...match[0].matchAll(/\b(d|x|y|cx|cy|r|width|height|transform|stroke-width)="([^"]*)"/g)].map(value => `${value[1]}=${value[2]}`).join(';'));
const pixel = (png: PNG,x:number,y:number) => png.data[(Math.round(y)*png.width+Math.round(x))*4+3];
async function validate() {
 assert.equal(RACE_PR_DEFINITIONS.length,6);
 assert.equal(new Set(RACE_PR_DEFINITIONS.map(d=>d.id)).size,6);
 assert.equal(readdirSync(directory).filter(name=>name.endsWith('.svg')).length,18);
 assert.equal(readdirSync(directory).filter(name=>name.endsWith('.png')).length,18);
 const hashes: Record<string,string> = {};
 let stateGeometryChecks=0,pngParityChecks=0,smallRenderChecks=0;
 const sharp = firstsRasterizer() as any;
 for(const definition of RACE_PR_DEFINITIONS){
   const unlocked = renderRacePrBadgeSvg(definition.id,'unlocked');
   assert.deepEqual(renderRacePrBadgeSvg(definition.id,'share-opaque'),unlocked);
   assert.deepEqual(renderRacePrBadgeSvg(definition.id,'share-transparent'),renderRacePrBadgeSvg(definition.id,'transparent'));
   assert.ok(unlocked.includes(`d="${FIRSTS_HEXAGON_PATH}"`),'Firsts canonical frame differs');
   assert.ok(unlocked.includes(FIRSTS_WORDMARK_PATH.replace(/currentColor/g,'#EED6A2')),'Firsts canonical wordmark differs');
   for(const state of states){
     const svgPath=`${directory}/race-pr-${definition.slug}-${state}.svg`;
     const pngPath=`${directory}/race-pr-${definition.slug}-${state}.png`;
     const svg=readFileSync(svgPath,'utf8');
     assert.equal(svg,renderRacePrBadgeSvg(definition.id,state));
     assert.match(svg,/viewBox="0 0 100 100"/);
     assert.ok(!/<text\b|<image\b|<foreignObject\b|<script\b|href=|font-family=/.test(svg),'Runtime text or external data in badge');
     assert.ok(svg.includes(definition.distanceLabel),'Missing accessible full event identity');
     assert.deepEqual(geometry(svg),geometry(unlocked),'State geometry differs');
     assert.deepEqual(geometry(renderRacePrBadgeSvg(definition.id,state,{compact:true})),geometry(renderRacePrBadgeSvg(definition.id,'unlocked',{compact:true})),'Compact state geometry differs');
     assert.ok(renderRacePrBadgeSvg(definition.id,state,{compact:true}).includes('translate(50 52.5) scale(1.3) translate(-50 -34)'));stateGeometryChecks++;
     const buffer=readFileSync(pngPath),png=PNG.sync.read(buffer);
     assert.equal(png.width,1024);assert.equal(png.height,1024);
     for(const [x,y] of [[0,0],[1023,0],[0,1023],[1023,1023],[4,4],[8,8]])assert.equal(pixel(png,x,y),0,'Opaque exterior/checkerboard');
     const inside=pixel(png,512,100);
     assert.equal(inside,state==='transparent'?0:255,'Incorrect interior alpha');
     if(state==='locked')for(let i=0;i<png.data.length;i+=4)if(png.data[i+3]){
       assert.equal(png.data[i],png.data[i+1]);assert.equal(png.data[i+1],png.data[i+2]);
     }
     const expected=await sharp(Buffer.from(renderRacePrBadgeSvg(definition.id,state,{size:1024}))).ensureAlpha().raw().toBuffer();
     assert.deepEqual(expected,png.data,'PNG differs from fresh canonical SVG raster');pngParityChecks++;
     hashes[svgPath]=sha(svg);hashes[pngPath]=sha(buffer);
     for(const size of sizes){
       for(const compact of [false,true]){
         const raster=await sharp(Buffer.from(renderRacePrBadgeSvg(definition.id,state,{size,compact}))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
         const {data,info}=raster;
         assert.equal(info.width,size);assert.equal(info.height,size);
         let minX=size,minY=size,maxX=-1,maxY=-1;
         for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[(y*size+x)*4+3]>=16){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
         assert.ok(minX>0&&minY>0&&maxX<size-1&&maxY<size-1,'Artwork touches export edge');
         assert.ok(Math.abs(minX-(size-1-maxX))<=1,'Visible side margins differ');
         smallRenderChecks++;
       }
     }
   }
 }
 const labels=[RACE_PR_TYPOGRAPHY.newPr,...Object.values(RACE_PR_TYPOGRAPHY.badges).flatMap(value=>[value.face,value.title])];
 for(const label of labels){
   assert.ok(Math.abs((label.bounds[0]+label.bounds[2])/2-50)<1e-7,'Typography ink not centered');
   assert.ok(label.bounds[0]>=25 && label.bounds[2]<=75.000001,'Lettering collides with frame region');
 }
 const frozenFiles=['src/achievements/firsts/firstsArtwork.ts','src/achievements/firsts/firstsTokens.ts','src/achievements/firsts/firstsTypography.ts'];
 const result={verdict:'PASS',badgeCount:6,canonicalStates:3,svgCount:18,pngCount:18,stateGeometryChecks,pngParityChecks,smallRenderChecks,sizes,shareAliasesMatch:true,noRuntimeFontOrExternalImage:true,lockedGrayscale:true,trueInteriorAndExteriorAlpha:true,typographyCenteredByInk:true,existingFirstsSources:Object.fromEntries(frozenFiles.map(file=>[file,sha(readFileSync(file))])),assetSha256:hashes,scope:'Artwork and local exports; native device rendering and release not tested.'};
 writeFileSync('docs/handoff/badge-review/race-pr/validation.json',JSON.stringify(result,null,2)+'\n');
 console.log(`PASS: six badges,18stategeometrychecks,18freshPNGcomparisons,${smallRenderChecks}small-size renders,alpha/grayscale/share parity.`);
}
void validate().catch(error=>{console.error(error);process.exitCode=1;});
