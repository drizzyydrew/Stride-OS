import type { RouteSection } from '../types/route';
type Point = { latitude: number; longitude: number };
export function routeLegMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude-a.latitude)*rad/2)**2
    + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((b.longitude-a.longitude)*rad/2)**2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function routeGeometryMeters(points: Point[]): number {
  return points.reduce((n,p,i)=>n+(i?routeLegMeters(points[i-1]!,p):0),0);
}
export function routePointAtMeters(points: Point[], target: number): Point | null {
  if (!points.length) return null;
  let remaining=Math.max(0,target);
  for(let i=1;i<points.length;i++) {
    const a=points[i-1]!,b=points[i]!,length=routeLegMeters(a,b);
    if(remaining<=length) { const ratio=length?remaining/length:0; return {latitude:a.latitude+(b.latitude-a.latitude)*ratio,longitude:a.longitude+(b.longitude-a.longitude)*ratio}; }
    remaining-=length;
  }
  return {...points[points.length-1]!};
}
export function routeSectionLine(points: Point[], start: number, end: number): Point[] {
  const first=routePointAtMeters(points,start),last=routePointAtMeters(points,end);
  if(!first||!last||end<=start) return [];
  const line=[first]; let distance=0;
  for(let i=1;i<points.length;i++) { distance+=routeLegMeters(points[i-1]!,points[i]!); if(distance>start&&distance<end) line.push(points[i]!); }
  return [...line,last];
}
export function routeSectionsError(sections: RouteSection[], length: number): string | null {
  const ids=new Set<string>(); let previousEnd=0;
  for(const s of [...sections].sort((a,b)=>a.startMeters-b.startMeters)) {
    if(!s.id||ids.has(s.id)||!s.name.trim()) return 'Give every segment a name.';
    ids.add(s.id);
    if(!Number.isFinite(s.startMeters)||!Number.isFinite(s.endMeters)||s.startMeters<0||s.endMeters<=s.startMeters
      ||s.endMeters>length+1||s.startMeters<previousEnd-0.1) return 'Segments need a start before their end, within this route, without overlaps.';
    if(s.targetPaceSecPerMile!==undefined&&(!Number.isFinite(s.targetPaceSecPerMile)||s.targetPaceSecPerMile<120||s.targetPaceSecPerMile>3600)) return 'Enter a pace between 2:00 and 60:00 per mile (or its kilometre equivalent).';
    if(s.targetHrZone!==undefined&&![1,2,3,4,5].includes(s.targetHrZone)) return 'Choose a heart-rate zone from 1 to 5.';
    if(s.targetRpe!==undefined&&(!Number.isFinite(s.targetRpe)||s.targetRpe<1||s.targetRpe>10)) return 'Choose an effort from 1 to 10.';
    previousEnd=s.endMeters;
  }
  return null;
}
export function reverseRouteSections(sections: RouteSection[], length: number): RouteSection[] {
  return sections.map(s=>({...s,startMeters:length-s.endMeters,endMeters:length-s.startMeters})).sort((a,b)=>a.startMeters-b.startMeters);
}
export function legacyRouteSections(markers: {label:string;distanceMiles:number}[], length: number): RouteSection[] {
  let start=0;
  return [...markers].sort((a,b)=>a.distanceMiles-b.distanceMiles).flatMap((marker,i)=>{
    const end=Math.min(length,marker.distanceMiles*1609.344);
    if(!Number.isFinite(end)||end<=start) return [];
    const section={id:`legacy-${i}`,name:marker.label,startMeters:start,endMeters:end}; start=end; return [section];
  });
}
export function routeSectionTarget(section: RouteSection, imperial: boolean): string {
  const parts:string[]=[];
  if(section.targetPaceSecPerMile) { const sec=Math.round(section.targetPaceSecPerMile/(imperial?1:1.609344));parts.push(`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}/${imperial?'mi':'km'}`); }
  if(section.targetHrZone) parts.push(`Zone ${section.targetHrZone}`);
  if(section.targetRpe) parts.push(`RPE ${section.targetRpe}`);
  return parts.join(' · ');
}
export function routeSectionSummary(sections:RouteSection[],imperial:boolean):string {
  const factor=imperial?1609.344:1000;
  return sections.map(s=>`${s.name}: ${(s.startMeters/factor).toFixed(2)}–${(s.endMeters/factor).toFixed(2)} ${imperial?'mi':'km'}${routeSectionTarget(s,imperial)?` · ${routeSectionTarget(s,imperial)}`:''}`).join('\n');
}
export function nextRouteSection(sections:RouteSection[],progressMeters:number):RouteSection|null {
  return sections.find(section=>section.startMeters>progressMeters+1)??null;
}
export function advanceRouteSectionProgress<T extends {maxProgressMeters:number}>(state:T,along:number,recordedMeters:number):T {
  if(!Number.isFinite(along)||along<0||along>recordedMeters+150||along<=state.maxProgressMeters) return state;
  return {...state,maxProgressMeters:along};
}
/** Monotonic progress + once-only section starts; turns get voice priority. */
export function routeSectionCue(input: {sections:RouteSection[];progressMeters:number;lastId:string|null;seenIds?:string[];lastAt:number;now:number;turnNear:boolean;imperial:boolean}): {id:string;cue:string}|null {
  if(input.turnNear||input.now-input.lastAt<15000) return null;
  const section=input.sections.find(s=>input.progressMeters>=s.startMeters&&input.progressMeters<s.endMeters);
  if(!section||section.id===input.lastId||input.seenIds?.includes(section.id)) return null;
  const target=routeSectionTarget(section,input.imperial);
  return {id:section.id,cue:`${section.name}${target?`. Target ${target}`:''}.`};
}
/** Deep capture keeps edits, reversals and deletion from changing a live route. */
export function snapshotRoute<T>(route:T):T { return route==null?route:JSON.parse(JSON.stringify(route)); }
