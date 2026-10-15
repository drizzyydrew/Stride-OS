const fs = require('node:fs');
const path = require('node:path');
const { render: frame } = require('./render-first-run-preview.cjs');
const { walker } = require('./render-first-walk-preview.cjs');
const { renderStrengthOutline } = require('./strength-preview-adapter.cjs');

const dir = __dirname;
const activity = fs.readFileSync(path.join(dir, 'first-activity-preview.svg'), 'utf8');
const activityGlyph = activity.slice(activity.indexOf('  <g stroke="#E7C486"'), activity.indexOf('  <text x="50"'));
const runSvg = frame();
const runner = runSvg.slice(runSvg.indexOf('  <g data-glyph='), runSvg.indexOf('  <text x="50"'));
const runningPerson = runner.replace(/    <path data-motion-lines[^>]*\/>\n/, '');
const color = '#E7C486';
const line = `stroke="${color}" stroke-linecap="round" stroke-linejoin="round"`;

function shield(label) {
  return `<g data-glyph="race-shield" transform="translate(0 -3)"><path d="M34 23.1 Q42 25 50 20.8 Q58 25 66 23.1 L66 39.3 Q66 47.2 50 54 Q34 47.2 34 39.3 Z" ${line} stroke-width=".94"/><text x="50" y="42.8" text-anchor="middle" font-family="Arial Narrow,sans-serif" font-size="${label.length >= 4 ? 14.4 : 15.5}" font-weight="400" fill="${color}">${label}</text></g>`;
}

const bicycle = `<g data-glyph="bicycle" transform="translate(-.5 0)" ${line} stroke-width=".94"><circle cx="33" cy="42" r="9.5"/><circle cx="68" cy="42" r="9.5"/><path d="M33 42 L44.5 29 L51 42 H33 M44.5 29 H61 L51 42 M61 29 L68 42 M44.5 29 L43 26 M39.5 26 H46 M61 29 L60 24 H63.5 Q66.5 24 65 26.8 L62.7 28.6"/><circle cx="51" cy="42" r="1.5" stroke-width=".7"/><path d="M51 42 L53.7 44.4 H55.5" stroke-width=".7"/></g>`;

const mobility = `<g data-glyph="outlined-mobility" transform="translate(0 -1.5)" ${line}><path data-range-arc="upper" d="M29.5 40 C29.5 27 36.5 18.5 48.6 18.5 C62.4 18.5 69.1 30.4 66.5 44.6" stroke-width=".65"/><circle data-head="floating" cx="44.4" cy="29" r="2.6" stroke-width=".85"/><path data-body="continuous-silhouette" d="M47.4 34.3 L55.1 22.3 Q56.4 22.1 56.8 23.4 L50 36.1 L47.6 42.8 L56.8 43.1 Q58 43.1 58.4 44.7 L60 51.8 L62.5 52.1 Q64 52.4 63.4 53.1 L58.1 53.1 Q57.5 53.1 57.2 52.1 L55.7 46.2 L44.3 46.2 Q43.3 46.2 42.6 45.7 L38.7 48.6 Q38 49.1 37.2 49.4 L28 52.6 L25.7 52.7 Q24.2 52.8 24.2 51.9 Q24.3 51.3 25.7 51 L27.4 50.6 L36.4 46.9 L41.7 42.9 L44 37.2 Q44.1 36.7 43.7 36.6 L41.3 40.7 Q41 41.3 40.4 41.7 L36.5 43.8 Q35.5 44.5 34.9 43.8 Q34.4 43.1 35.3 42.4 L39.1 39.1 L41.6 35.1 Q42.1 34.3 43.3 34.3 Z" stroke-width=".82"/><path data-shoe="rear" d="M27.4 50.6 L28 52.6 L25.7 52.7 Q24.2 52.8 24.2 51.9 Q24.3 51.3 25.7 51 Z" fill="${color}" stroke-width=".15"/><path data-shoe="front" d="M60 51.8 L62.5 52.1 Q64 52.4 63.4 53.1 L58.1 53.1 Q57.5 53.1 57.2 52.1 Z" fill="${color}" stroke-width=".15"/></g>`;

const route = `<g data-glyph="completed-route" ${line}><path d="M52 20.5 C46.9 20.5 43.8 24 43.8 28.3 C43.8 32.2 52 41.7 52 41.7 C52 41.7 60.2 32.2 60.2 28.3 C60.2 24 57.1 20.5 52 20.5 Z" stroke-width=".94"/><circle cx="52" cy="28.2" r="3.2" stroke-width=".8"/><path d="M64.5 50.4 C56 50.5 35.6 54.2 33.4 48.2 C31.1 42 47.4 43.8 54.3 40.3" stroke-width=".75" stroke-dasharray="2.4 2.1"/><circle cx="64.5" cy="50.4" r="1.8" fill="${color}" stroke="none"/></g>`;

const calendar = `<g data-glyph="training-calendar" ${line} stroke-width=".94"><path d="M39.4 22.8 H36.5 Q35 22.8 35 24.3 V48.4 Q35 50 36.5 50 H63.5 Q65 50 65 48.4 V24.3 Q65 22.8 63.5 22.8 H60.6 M44.2 22.8 H55.8 M35 30.2 H65"/><path d="M41.6 20.1 V25.6 M58.4 20.1 V25.6" stroke-width="1.3"/>${[35.6,43.1].map(y=>[39.2,48.2,57.2].map(x=>`<rect x="${x}" y="${y}" width="3.6" height="3.6" rx=".35" stroke-width=".72"/>`).join('')).join('')}</g>`;

const pencil = `<g data-glyph="adaptation-pencil" ${line} stroke-width=".94"><path d="M36 52.5 L38.5 43.8 L60 22.4 Q61 21.4 62.1 22.4 L66.4 26.7 Q67.6 27.9 66.5 29 L45 50.5 Z"/><path d="M58.3 24.1 L64.8 30.7 M56.8 25.6 L63.3 32.2 M38.5 43.8 L45 50.5 M41.7 44.1 L60.6 25.2" stroke-width=".65"/><path d="M36 52.5 L37.3 48.2 L40.3 51.2 Z" fill="${color}" stroke="none"/></g>`;

const strength = renderStrengthOutline();

const landmarks = [[50,25.3],[44.4,26.5],[55.6,26.5],[40.3,33.1],[59.7,33.1],[36.4,39.7],[63.6,39.7],[50,37.4],[46.2,39],[53.8,39],[44.7,46],[55.3,46],[43.1,52.8],[56.9,52.8]];
const movement = `<g data-glyph="neutral-landmark-analysis" ${line}><path d="M28.8 24 H34.3 M28.8 24 V29.5 M71.2 24 H65.7 M71.2 24 V29.5 M28.8 52 H34.3 M28.8 52 V46.5 M71.2 52 H65.7 M71.2 52 V46.5" stroke-width=".8"/><circle cx="50" cy="19.6" r="2.6" stroke-width=".85"/><path d="M44.4 26.5 L50 25.3 L55.6 26.5 M44.4 26.5 H55.6 M44.4 26.5 L40.3 33.1 L36.4 39.7 M55.6 26.5 L59.7 33.1 L63.6 39.7 M50 25.3 V37.4 L46.2 39 L44.7 46 L43.1 52.8 M50 37.4 L53.8 39 L55.3 46 L56.9 52.8 M46.2 39 H53.8" stroke-width=".48"/>${landmarks.map(([x,y],i)=>`<circle data-landmark="${i+2}" cx="${x}" cy="${y}" r="${i>=12?1.4:1.15}" fill="${color}" stroke="none"/>`).join('')}</g>`;

const runWalk = `<g data-glyph="run-walk-transition"><g transform="translate(-1 10) scale(.7)">${runningPerson}</g><g transform="translate(31 10) scale(.7)">${walker}</g><path d="M35.5 53 C43.5 47.9 51.7 47.9 58 52.4" ${line} stroke-width=".65" stroke-dasharray="2 2.3"/></g>`;

const DEFINITIONS = [
  {id:'first_activity',slug:'first-activity',title:'First Activity',lines:['FIRST ACTIVITY'],font:8.8,glyph:()=>activityGlyph},
  {id:'first_run',slug:'first-run',title:'First Run',lines:['FIRST RUN'],font:8.8,glyph:()=>runner},
  {id:'first_walk',slug:'first-walk',title:'First Walk',lines:['FIRST WALK'],font:8.8,glyph:()=>walker},
  {id:'first_run_walk',slug:'first-run-walk',title:'First Run/Walk',lines:['FIRST RUN/WALK'],font:8,glyph:()=>runWalk},
  {id:'first_ride',slug:'first-ride',title:'First Ride',lines:['FIRST RIDE'],font:8.8,glyph:()=>bicycle},
  {id:'first_mobility_workout',slug:'first-mobility-workout',title:'First Mobility Workout',lines:['FIRST MOBILITY','WORKOUT'],font:7.9,glyph:()=>mobility},
  {id:'first_5k',slug:'first-5k',title:'First 5K',lines:['FIRST 5K'],font:8.8,glyph:()=>shield('5K')},
  {id:'first_10k',slug:'first-10k',title:'First 10K',lines:['FIRST 10K'],font:8.8,glyph:()=>shield('10K')},
  {id:'first_half_marathon',slug:'first-half-marathon',title:'First Half Marathon',lines:['FIRST HALF','MARATHON'],font:8,glyph:units=>shield(units==='metric'?'21.1':'13.1')},
  {id:'first_marathon',slug:'first-marathon',title:'First Marathon',lines:['FIRST MARATHON'],font:7.9,glyph:units=>shield(units==='metric'?'42.2':'26.2')},
  {id:'first_route_completed',slug:'first-route-completed',title:'First Route Completed',lines:['FIRST ROUTE','COMPLETED'],font:8,glyph:()=>route},
  {id:'first_structured_workout',slug:'first-structured-workout',title:'First Structured Workout',lines:['FIRST STRUCTURED','WORKOUT'],font:7.4,glyph:()=>calendar},
  {id:'first_adapted_workout',slug:'first-adapted-workout',title:'First Adapted Workout',lines:['FIRST ADAPTED','WORKOUT'],font:8,glyph:()=>`<g transform="translate(-1.5 -1)">${pencil}</g>`},
  {id:'first_strength_workout',slug:'first-strength-workout',title:'First Strength Workout',lines:['FIRST STRENGTH','WORKOUT'],font:7.7,glyph:()=>strength},
  {id:'first_movement_lab_analysis',slug:'first-movement-lab-analysis',title:'First Movement Lab Analysis',lines:['FIRST MOVEMENT','LAB ANALYSIS'],font:7.4,glyph:()=>`<g transform="translate(0 -1.5)">${movement}</g>`},
];

function renderBadge(id, variant='unlocked', size=800, units='imperial') {
  const definition = DEFINITIONS.find(d=>d.id===id);
  if(!definition)throw new Error(`Unknown Firsts id: ${id}`);
  const state = variant==='share-opaque'?'unlocked':variant==='share-transparent'?'transparent':variant;
  if(!['unlocked','locked','transparent'].includes(state))throw new Error(`Unknown state: ${variant}`);
  if(id==='first_activity'&&state==='unlocked'&&size===800)return activity;
  let svg = frame('unlocked',size,definition.glyph(units),definition.lines.join(' '),definition.title);
  if(definition.lines.length>1 || definition.font!==8.8) {
    const title = definition.lines.map((label,i)=>`  <text x="50" y="${definition.lines.length>1?61.3+i*7.8:66.7}" text-anchor="middle" font-family="Arial Narrow, sans-serif" font-size="${definition.font}" font-weight="400" fill="#EED6A2">${label}</text>`).join('\n');
    svg = svg.replace(/  <text x="50" y="66\.7"[^>]*>[^<]*<\/text>/,title);
  }
  if(state==='transparent') {
    svg = svg.replace(/fill="#090A07"/g,'fill="none"').replace(/  <ellipse[^>]*\/>\n/,'');
  }
  if(state==='locked') {
    const colors={'#EED6A2':'#B7B7B7','#E7C486':'#929292','#BD9560':'#727272','#090A07':'#090909'};
    svg = svg.replace(/#(?:EED6A2|E7C486|BD9560|090A07)/g,c=>colors[c]);
  }
  return svg.replace(/(First [^"<>]+) unlocked vector preview/,`$1 ${state} vector preview`);
}

module.exports = { DEFINITIONS, renderBadge };
