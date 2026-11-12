import type { Activity, ActivityCoordinate } from '../types/activity';
import { STANDARD_DISTANCE_METERS, type RacePR, type StandardDistance } from '../types/athlete';
import { distanceMeters, MAX_SPEED_MPS, MAX_TRACKING_ACCURACY_METERS } from './activityTracking';
import { todayDateOnly } from './dateOnly';

const LABELS: Record<StandardDistance, string> = {
  '800m': '800m', '1_mile': '1 Mile', '5k': '5K', '10k': '10K',
  half_marathon: 'Half Marathon', marathon: 'Marathon',
};
type Fix = { meters: number; time: number };
const MAX_FIX_GAP_MS = 15_000;

/** Do not connect across pauses, missing fixes or rejected GPS observations. */
function continuousTraces(activity: Activity, endTime: number): Fix[][] {
  const groups: Fix[][] = [];
  let group: Fix[] = [];
  let previous: ActivityCoordinate | undefined;
  const flush = () => { if (group.length > 1) groups.push(group); group = []; previous = undefined; };
  for (const point of activity.metrics.routeCoordinates ?? []) {
    const accuracy = point.horizontalAccuracyMeters;
    if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90
      || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180
      || !Number.isFinite(point.timestamp) || point.timestamp < activity.startTime || point.timestamp > endTime
      || accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_TRACKING_ACCURACY_METERS) {
      flush(); continue;
    }
    let delta = 0;
    if (previous) {
      const ms = point.timestamp - previous.timestamp;
      delta = distanceMeters(previous, point);
      if (ms <= 0 || ms > MAX_FIX_GAP_MS || !Number.isFinite(delta)
        || delta / (ms / 1000) > MAX_SPEED_MPS.running!
        || activity.metrics.recordingPauses?.some(pause =>
          !Number.isFinite(pause.startTime) || !Number.isFinite(pause.endTime) || pause.endTime < pause.startTime
          || (pause.startTime < point.timestamp && pause.endTime > previous!.timestamp))) {
        flush(); delta = 0;
      }
    }
    group.push({ meters: (group.at(-1)?.meters ?? 0) + delta, time: point.timestamp });
    previous = point;
  }
  flush();
  return groups;
}

function interpolatedTime(a: Fix, b: Fix, meters: number): number {
  return a.time + (b.time - a.time) * ((meters - a.meters) / (b.meters - a.meters));
}

/** A piecewise-linear route's minimum window has a start or end at a vertex. */
function fastestWindow(points: Fix[], meters: number): number | null {
  if ((points.at(-1)?.meters ?? 0) < meters) return null;
  let best = Infinity;
  let end = 1;
  for (let start = 0; start < points.length; start++) {
    const target = points[start].meters + meters;
    while (end < points.length && points[end].meters < target) end++;
    if (end === points.length) break;
    const a = points[end - 1], b = points[end];
    if (b.meters > a.meters) best = Math.min(best, interpolatedTime(a, b, target) - points[start].time);
  }
  let start = 0;
  for (let endIndex = 1; endIndex < points.length; endIndex++) {
    const target = points[endIndex].meters - meters;
    if (target < 0) continue;
    while (start + 1 < endIndex && points[start + 1].meters <= target) start++;
    const a = points[start], b = points[start + 1];
    if (b.meters > a.meters) best = Math.min(best, points[endIndex].time - interpolatedTime(a, b, target));
  }
  // Whole seconds rounded upward: interpolation must not round a record faster.
  return Number.isFinite(best) && best > 0 ? Math.ceil(best / 1000) : null;
}

/**
 * Training bests use observed elapsed time over actual covered distance. Never
 * project a longer race from average pace or assume this was a maximal effort.
 * Present-but-invalid routes cannot fall back to their possibly corrupt total.
 */
export function recordedRunPerformances(activity: Activity, ownerUserId: string, now = Date.now()): RacePR[] {
  if (!Number.isFinite(now) || !ownerUserId || !activity.id || activity.activityType !== 'running' || activity.source !== 'tracked'
    || activity.status !== 'completed' || ['partial', 'stopped_early', 'skipped'].includes(activity.completionClassification ?? '')
    || !Number.isFinite(activity.startTime) || activity.startTime > now) return [];
  const elapsed = activity.metrics.elapsedTimeSeconds;
  const endTime = activity.endTime ?? (Number.isFinite(elapsed) ? activity.startTime + elapsed! * 1000 : NaN);
  const wallSeconds = (endTime - activity.startTime) / 1000;
  if (!Number.isFinite(endTime) || endTime > now || wallSeconds <= 0
    || (elapsed != null && (!Number.isFinite(elapsed) || Math.abs(elapsed - wallSeconds) > 2))) return [];
  const source = activity.metrics.distanceSource;
  const distance = activity.metrics.distanceMeters;
  if (!Number.isFinite(distance) || distance! <= 0) return [];
  const hasRoute = (activity.metrics.routeCoordinates?.length ?? 0) > 0;
  const groups = hasRoute && source === 'gps' ? continuousTraces(activity, endTime) : [];
  const measuredRouteDistance = groups.reduce((sum, group) => sum + group.at(-1)!.meters, 0);
  // Do not claim more route distance than the saved total supports. A shorter
  // partial trace can establish only the distances it actually contains.
  if (hasRoute && (source !== 'gps' || !groups.length || measuredRouteDistance > distance! * 1.05)) return [];
  if (!hasRoute && (activity.metrics.elapsedTimeSource !== 'recorded_wall_clock'
    || !['gps', 'foot_pod', 'treadmill_reported', 'equipment_display'].includes(source ?? ''))) return [];
  const records: RacePR[] = [];
  for (const key of Object.keys(LABELS) as StandardDistance[]) {
    if (activity.raceResult?.distanceKey === key) continue; // Explicit event result wins this class.
    const meters = STANDARD_DISTANCE_METERS[key]!;
    let seconds: number | null = null;
    if (hasRoute) {
      for (const group of groups) {
        const candidate = fastestWindow(group, meters);
        if (candidate != null && (seconds == null || candidate < seconds)) seconds = candidate;
      }
    } else if (Math.abs(distance! - meters) <= 0.000001) {
      seconds = Math.ceil(wallSeconds);
    }
    if (seconds == null) continue;
    records.push({ id: `recorded-effort:${activity.id}:${key}`, distanceKey: key, distanceLabel: LABELS[key],
      distanceMeters: meters, timeSeconds: seconds, date: todayDateOnly(new Date(activity.startTime)),
      recordedAt: endTime, official: false,
      source: { kind: 'recorded_effort', activityId: activity.id, ownerUserId, basis: hasRoute ? 'gps_segment' : 'whole_elapsed' } });
  }
  return records;
}
