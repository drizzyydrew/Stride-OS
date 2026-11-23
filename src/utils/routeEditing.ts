import type { RunRoute,RoutePoint } from '../store/routeStore';
import { snapshotRoute } from './routeSections';
/** Older records retain the exact line; sampled controls are used only on edit. */
export function routeEditWaypoints(route:RunRoute):RoutePoint[] {
  if(route.waypoints?.length) return snapshotRoute(route.waypoints);
  const line=route.points;
  if(line.length<=40) return snapshotRoute(line);
  return Array.from({length:40},(_,i)=>({...line[Math.round(i*(line.length-1)/39)]!}));
}
export function routeEditCanCommit(ownerCurrent:boolean, original:RunRoute|null, current:RunRoute|undefined, saveAsNew:boolean):boolean {
  return ownerCurrent && (!original || saveAsNew || !!current && current.updatedAt===original.updatedAt);
}
