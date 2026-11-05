import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RACE_PR_DEFINITIONS, type RacePrBadgeState } from '../src/achievements/racePr/racePrDefinitions';
import { renderRacePrBadgeSvg } from '../src/achievements/racePr/racePrArtwork';
import { writeFirstsPng } from './lib/firstsRasterizer';
const directory = 'docs/handoff/badge-review/race-pr';
const states: RacePrBadgeState[] = ['unlocked','locked','transparent'];
function nested(id: typeof RACE_PR_DEFINITIONS[number]['id'], state: RacePrBadgeState, x: number, y: number, size: number, compact = false) {
  return renderRacePrBadgeSvg(id,state,{size,compact}).replace('<svg ',`<svg x="${x}" y="${y}" `);
}
async function review() {
 mkdirSync(directory,{recursive:true});
 const six = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="780" viewBox="0 0 960 780"><rect width="960" height="780" fill="#11100F"/><text x="32" y="40" fill="#F5F0E8" font-family="Arial" font-size="26">StrideOS · Personal Bests</text>'];
 RACE_PR_DEFINITIONS.forEach((definition,index)=>{
   const x=(index%3)*320+24;
   const y=70+Math.floor(index/3)*360;
   six.push(nested(definition.id,'unlocked',x,y,272));
   six.push(`<text x="${x+136}" y="${y+302}" text-anchor="middle" fill="#C3BBB1" font-family="Arial" font-size="16">${definition.distanceLabel}</text>`);
 });
 six.push('</svg>');
 writeFileSync(path.join(directory,'six-race-pr-badges.svg'),six.join('\n'));
 await writeFirstsPng(six.join('\n'),path.join(directory,'six-race-pr-badges.png'));
 const board = [`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1120" viewBox="0 0 1920 1120"><rect width="1920" height="1120" fill="#11100F"/><text x="32" y="40" fill="#F5F0E8" font-family="Arial" font-size="24">StrideOS • Race PR family • new derivative artwork</text>`];
 states.forEach((state,row)=>{
   const y=65+row*345;
   board.push(`<text x="24" y="${y+22}" fill="#C3BBB1" font-family="Arial" font-size="14">${state.toUpperCase()}</text>`);
   RACE_PR_DEFINITIONS.forEach((definition,column)=>{
     const x=column*320+24;
     if(state==='transparent')board.push(`<rect x="${x}" y="${y+30}" width="272" height="272" rx="12" fill="#263139"/>`);
     board.push(nested(definition.id,state,x,y+30,272));
     board.push(`<text x="${x+136}" y="${y+326}" text-anchor="middle" fill="#C3BBB1" font-family="Arial" font-size="14">${definition.distanceLabel}</text>`);
   });
 });board.push('</svg>');
 writeFileSync(path.join(directory,'family-contact-sheet.svg'),board.join('\n'));
 await writeFirstsPng(board.join('\n'),path.join(directory,'family-contact-sheet.png'));
 for(const state of states){
   const sizes=[48,64,96,128,256];
   const xPositions=[30,145,275,430,600];
   const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="1090" height="1830" viewBox="0 0 1090 1830"><rect width="1090" height="1830" fill="${state==='transparent'?'#263139':'#11100F'}"/><text x="24" y="32" fill="#F5F0E8" font-family="Arial" font-size="20">${state} • actual 48 / 64 / 96 / 128 / 256 px + compact 64</text>`];
   RACE_PR_DEFINITIONS.forEach((definition,row)=>{
     const y=60+row*290;
     parts.push(`<text x="24" y="${y+17}" fill="#C3BBB1" font-family="Arial" font-size="15">${definition.distanceLabel}</text>`);
     sizes.forEach((size,index)=>parts.push(nested(definition.id,state,xPositions[index],y+30,size)));
     parts.push(nested(definition.id,state,920,y+30,64,true));
   });parts.push('</svg>');
   writeFileSync(path.join(directory,`sizes-${state}.svg`),parts.join('\n'));
   await writeFirstsPng(parts.join('\n'),path.join(directory,`sizes-${state}.png`));
 }
 console.log('Rendered all-six/state and five-size review sheets from canonical renderer.');
}
void review().catch(error=>{console.error(error);process.exitCode=1;});
