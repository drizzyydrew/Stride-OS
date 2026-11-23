type Entry = { type: string; completed?: boolean; missed?: boolean };
export type CalendarStatus = 'empty'|'rest'|'planned'|'completed'|'missed'|'partial';
/** Today/phase/race describe context, never override completion status. */
export function calendarDayStatus(entries: Entry[], beforeStart:boolean, past:boolean): CalendarStatus {
  if(beforeStart) return 'empty';
  if(!entries.length) return 'rest';
  const completed=entries.filter(e=>e.completed).length;
  if(completed===entries.length) return 'completed';
  if(completed>0) return 'partial';
  if(entries.some(e=>e.missed)||past) return 'missed';
  return 'planned';
}
export const CALENDAR_STATUS_LABEL:Record<CalendarStatus,string>={empty:'Not started',rest:'Rest',planned:'Planned',completed:'Completed',missed:'Missed',partial:'Partly completed'};
export function calendarActivityIcon(type:string): 'barbell-outline'|'walk-outline'|'bicycle-outline'|'water-outline'|'flag-outline'|'snow-outline'|'trail-sign-outline'|'fitness-outline'|'footsteps-outline' {
  if(type==='strength') return 'barbell-outline';
  if(type==='race') return 'flag-outline';
  if(type==='walk') return 'walk-outline';
  if(type==='cycling') return 'bicycle-outline';
  if(type==='swimming') return 'water-outline';
  if(['skiing','downhill_skiing','snowboarding','cross_country_skiing'].includes(type)) return 'snow-outline';
  if(['hiking','mountaineering'].includes(type)) return 'trail-sign-outline';
  if(['run','run_walk'].includes(type)) return 'footsteps-outline';
  return 'fitness-outline';
}
