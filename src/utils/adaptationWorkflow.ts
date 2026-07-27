import type { ScheduledSession } from './scheduledSessions';
import { hasOverlappingHardStress, isHardLowerStrengthStress, isHardStress, isLongStress } from './sessionStress';

/**
 * A deliberately small, serializable overlay over the canonical schedule.
 * The generated WeekPlan remains the source of truth; confirmed overlays are
 * the only user-authored exception layer and are safe to replay on hydration.
 */
export type AdaptationAction =
  | 'unchanged'
  | 'reduced'
  | 'remove_intensity'
  | 'convert_easy'
  | 'convert_run_walk'
  | 'replace_walk'
  | 'replace_cycling'
  | 'replace_mobility'
  | 'treadmill_equivalent'
  | 'dumbbell_equivalent'
  | 'active_recovery'
  | 'rest'
  | 'moved'
  | 'rebuild_week'
  | 'replaced'
  | 'removed';
export type AdaptationReason =
  | 'missed_schedule'
  | 'schedule_conflict'
  | 'low_energy'
  | 'unusual_fatigue'
  | 'poor_sleep'
  | 'soreness'
  | 'workout_too_difficult'
  | 'illness_symptoms'
  | 'pain_or_injury'
  | 'life_stress'
  | 'weather_or_logistics'
  | 'travel'
  | 'motivation'
  | 'equipment_or_location'
  | 'completed_other_activity'
  | 'missed_multiple_sessions'
  | 'fewer_training_days'
  | 'move_long_run'
  | 'returning_after_time_off'
  | 'feeling_good'
  | 'no_reason'
  | 'only_20_minutes'
  | 'treadmill_available'
  | 'unsafe_weather'
  | 'no_gym_equipment'
  | 'dumbbells_only'
  | 'no_hills_available'
  | 'lower_impact_needed'
  | 'no_usual_location'
  | 'other';

export type AdaptationSessionOverlay = {
  id: string;
  scheduledSessionId: string;
  action: AdaptationAction;
  original: ScheduledSession;
  adapted: ScheduledSession | null;
  reason: AdaptationReason;
  explanation: string;
  intentPreserved: boolean;
  createdAt: number;
};

export type AdaptationPreview = {
  id: string;
  weekKey: string;
  reason: AdaptationReason;
  createdAt: number;
  overlays: AdaptationSessionOverlay[];
  unchangedSessionIds: string[];
  summary: string;
  conflicts: AdaptationConflict[];
};

export type ConfirmedAdaptation = AdaptationPreview & {
  confirmedAt: number;
  confirmation: 'confirmed';
};

export type AdaptationConflictCode =
  | 'duplicate_id'
  | 'two_primary_runs'
  | 'run_walk_plus_easy'
  | 'consecutive_hard'
  | 'long_after_hard_strength'
  | 'recovery_spacing'
  | 'stress_axis_overlap'
  | 'locked_day'
  | 'plan_boundary';

export type AdaptationConflict = {
  code: AdaptationConflictCode;
  sessionIds: string[];
  message: string;
};

export type AdaptationRequest = {
  scheduledSessionId: string;
  action: AdaptationAction;
  reason: AdaptationReason;
  moveToDate?: string;
};

export type ConflictValidationOptions = {
  lockedDates?: string[];
  planStartDate?: string;
  planEndDate?: string;
};

export const MEDICAL_ADAPTATION_DISCLAIMER =
  'StrideOS cannot determine whether an injury is present. Consider stopping and seeking appropriate medical assessment for severe, worsening, or concerning symptoms.';

export function adaptationWeekKey(weekStartDate: string): string {
  return `week:${weekStartDate}`;
}

function cloneSession(session: ScheduledSession): ScheduledSession {
  // ScheduledSession contains plain persisted data. JSON cloning avoids a
  // preview mutating a canonical plan object through a nested richWorkout.
  return JSON.parse(JSON.stringify(session)) as ScheduledSession;
}

function isRun(session: ScheduledSession): boolean {
  return ['run', 'run_walk', 'walk'].includes(session.activityType);
}

function isHard(session: ScheduledSession): boolean {
  return isHardStress(session);
}

function isLong(session: ScheduledSession): boolean {
  return isLongStress(session);
}

function isHardLowerStrength(session: ScheduledSession): boolean {
  return isHardLowerStrengthStress(session);
}

function shortDate(date: string): string {
  return date.slice(5);
}

function calendarDayGap(earlier: string, later: string): number {
  const earlierMs = Date.parse(`${earlier}T00:00:00.000Z`);
  const laterMs = Date.parse(`${later}T00:00:00.000Z`);
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) return Number.POSITIVE_INFINITY;
  return Math.round((laterMs - earlierMs) / 86_400_000);
}

function hasUnsafeSameDayStressOverlap(items: ScheduledSession[]): ScheduledSession[] {
  const hardRuns = items.filter(item =>
    item.priority === 'primary'
    && isHard(item)
    && ['run', 'run_walk'].includes(item.activityType));
  const hardLowerStrength = items.filter(isHardLowerStrength);
  return hardRuns.length && hardLowerStrength.length ? [...hardRuns, ...hardLowerStrength] : [];
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function isTrueRecoveryDay(items: ScheduledSession[]): boolean {
  if (items.length === 0) return true;
  return items.every(item => {
    const stress = item.stress;
    if (stress) return stress.classification === 'recovery' || stress.classification === 'easy';
    return !isHard(item) && !isLong(item);
  });
}

function adaptedSessionFor(request: AdaptationRequest, original: ScheduledSession): ScheduledSession | null {
  const adapted = cloneSession(original);
  if (request.action === 'unchanged') return adapted;
  if (request.action === 'removed') return null;
  if (request.action === 'moved') {
    adapted.date = request.moveToDate ?? original.date;
    adapted.status = 'moved';
    return adapted;
  }
  if (request.action === 'reduced' || request.action === 'rebuild_week') {
    adapted.durationMinutes = request.reason === 'only_20_minutes'
      ? Math.min(20, original.durationMinutes)
      : Math.max(10, Math.round(original.durationMinutes * 0.7));
    if (adapted.runWalk) {
      const cycleSeconds = adapted.runWalk.runSeconds + adapted.runWalk.walkSeconds;
      const availableSeconds = Math.max(
        cycleSeconds,
        (adapted.durationMinutes - adapted.runWalk.warmupMinutes - adapted.runWalk.cooldownMinutes) * 60,
      );
      const rounds = Math.max(1, Math.floor(availableSeconds / Math.max(1, cycleSeconds)));
      const totalMinutes = adapted.runWalk.warmupMinutes
        + adapted.runWalk.cooldownMinutes
        + Math.round((rounds * cycleSeconds) / 60);
      adapted.runWalk = { ...adapted.runWalk, rounds, totalMinutes };
      adapted.durationMinutes = totalMinutes;
      adapted.mainSet = `${rounds} reduced run/walk rounds at the original work-to-recovery ratio`;
    } else {
      adapted.mainSet = `Reduced session: stop when total workout time reaches ${adapted.durationMinutes} minutes.`;
    }
    const retainedTarget = original.target
      .replace(/^\s*\d+\s*min(?:utes?)?\s*(?:[-:·]\s*)?/i, '')
      .trim();
    adapted.target = `${adapted.durationMinutes} min · reduced from ${original.durationMinutes} min${retainedTarget ? ` · ${retainedTarget}` : ''}`;
    adapted.adaptationReason = 'Reduced volume to protect recovery; keep the effort easy.';
    if (adapted.richWorkout) {
      adapted.richWorkout.durationMinutes = adapted.durationMinutes;
      adapted.richWorkout.mainSet = [{
        ...adapted.richWorkout.mainSet[0],
        label: 'Reduced main set',
        duration: `${Math.max(1, adapted.durationMinutes - 10)} min`,
        instructions: adapted.mainSet,
      }];
    }
    return adapted;
  }
  if (request.action === 'remove_intensity' || request.action === 'convert_easy') {
    adapted.activityType = 'run';
    adapted.subtype = 'easy_run';
    adapted.title = 'Easy Aerobic Run';
    adapted.target = `${adapted.durationMinutes} min at a comfortable, conversational effort`;
    adapted.mainSet = 'Continuous easy running. Remove all faster repetitions.';
    adapted.runWalk = undefined;
    adapted.richWorkout = undefined;
    adapted.adaptationReason = 'Faster work removed while preserving easy aerobic time.';
    return adapted;
  }
  if (request.action === 'convert_run_walk') {
    const workMinutes = Math.max(10, adapted.durationMinutes - 10);
    adapted.activityType = 'run_walk';
    adapted.subtype = 'run_walk';
    adapted.title = 'Easy Run/Walk';
    adapted.runWalk = {
      totalMinutes: adapted.durationMinutes,
      warmupMinutes: 5,
      runSeconds: 60,
      walkSeconds: 60,
      rounds: Math.max(5, Math.floor(workMinutes / 2)),
      cooldownMinutes: 5,
      hrZone: 'Easy aerobic HR',
      rpe: '2-4',
      pace: 'Conversational',
      voicePrompts: ['Run easy.', 'Walk and reset your effort.'],
    };
    adapted.target = `${adapted.durationMinutes} min using 60 sec run / 60 sec walk`;
    adapted.mainSet = `${adapted.runWalk.rounds} controlled run/walk rounds`;
    adapted.richWorkout = undefined;
    adapted.adaptationReason = 'Converted to run/walk to lower continuous impact and effort.';
    return adapted;
  }
  if (request.action === 'rest') {
    adapted.activityType = 'rest';
    adapted.subtype = 'rest';
    adapted.title = 'Rest and Reassess';
    adapted.priority = 'optional';
    adapted.durationMinutes = 0;
    adapted.target = 'Rest today and reassess later';
    adapted.mainSet = undefined;
    adapted.richWorkout = undefined;
    adapted.strengthSession = undefined;
    adapted.adaptationReason = 'Replaced with rest after the athlete confirmed the change.';
    return adapted;
  }
  if (request.action === 'treadmill_equivalent') {
    adapted.subtype = 'treadmill';
    adapted.title = /hill/i.test(original.title)
      ? original.title.replace(/hill/gi, 'Treadmill Incline')
      : `${original.title} — Treadmill`;
    adapted.target = original.target;
    adapted.mainSet = original.mainSet
      ? `${original.mainSet} Use treadmill incline to replace outdoor grade; keep the prescribed work and recovery durations.`
      : 'Match the prescribed work and recovery durations using a controlled treadmill incline.';
    adapted.adaptationReason = 'Moved indoors while preserving the scheduled work-to-recovery structure and aerobic purpose.';
    if (adapted.richWorkout) {
      adapted.richWorkout.title = adapted.title;
      adapted.richWorkout.description = adapted.adaptationReason;
    }
    return adapted;
  }
  if (request.action === 'dumbbell_equivalent') {
    adapted.title = `${original.title} — Dumbbell Option`;
    adapted.target = `${original.target}. Use the listed dumbbell substitutions at a controlled effort.`;
    adapted.mainSet = original.mainSet
      ? `${original.mainSet} Substitute dumbbell variations without adding sets.`
      : 'Use dumbbell variations that match the same movement patterns; do not add volume.';
    adapted.adaptationReason = 'Equipment changed while preserving movement patterns, set count, and intended effort where possible.';
    return adapted;
  }

  // Replacements stay conservative and never invent pace, distance, or load.
  const replacement = request.action === 'replace_cycling' ? 'cycling'
    : request.action === 'replace_mobility' || request.action === 'active_recovery' ? 'mobility'
      : 'walk';
  adapted.activityType = replacement;
  adapted.subtype = request.action === 'active_recovery' ? 'active_recovery' : `recovery_${replacement}`;
  adapted.title = request.action === 'replace_cycling' ? 'Easy Indoor Cycling'
    : request.action === 'replace_mobility' ? 'Recovery Mobility'
      : request.action === 'active_recovery' ? 'Active Recovery'
        : 'Easy Recovery Walk';
  adapted.priority = 'optional';
  adapted.durationMinutes = Math.min(30, Math.max(10, Math.round(original.durationMinutes * 0.6)));
  adapted.target = `${adapted.durationMinutes} min at a very easy, controlled effort`;
  adapted.mainSet = 'Keep this easy. Stop if symptoms, pain, or dizziness increase.';
  adapted.purpose = 'Preserve routine while reducing load; this does not make up the missed workout.';
  adapted.richWorkout = undefined;
  adapted.strengthSession = undefined;
  adapted.adaptationReason = 'Replaced with a low-load recovery option.';
  return adapted;
}

function explanationFor(action: AdaptationAction, original: ScheduledSession, adapted: ScheduledSession | null): string {
  if (action === 'removed') return `Removed ${original.title}; missed work is not automatically made up.`;
  if (action === 'moved') return `Moved ${original.title} to ${shortDate(adapted?.date ?? original.date)} within this week.`;
  if (action === 'reduced') return `Reduced ${original.title} from ${original.durationMinutes} to ${adapted?.durationMinutes ?? original.durationMinutes} minutes.`;
  if (action === 'rebuild_week') return `Reduced ${original.title} while rebuilding the remainder of this week.`;
  if (action === 'remove_intensity') return `Removed faster work from ${original.title}; easy aerobic work remains.`;
  if (action === 'convert_easy') return `Converted ${original.title} to easy running.`;
  if (action === 'convert_run_walk') return `Converted ${original.title} to run/walk.`;
  if (action === 'replace_walk') return `Replaced ${original.title} with easy walking.`;
  if (action === 'replace_cycling') return `Replaced ${original.title} with easy cycling.`;
  if (action === 'replace_mobility') return `Replaced ${original.title} with mobility.`;
  if (action === 'treadmill_equivalent') return `Moved ${original.title} to a treadmill equivalent while preserving its work-to-recovery structure.`;
  if (action === 'dumbbell_equivalent') return `Converted ${original.title} to a dumbbell-equipment option without adding volume.`;
  if (action === 'active_recovery') return `Replaced ${original.title} with active recovery.`;
  if (action === 'rest') return `Replaced ${original.title} with rest and reassessment.`;
  if (action === 'replaced') return `Replaced ${original.title} with ${adapted?.title ?? 'a recovery option'}.`;
  return `${original.title} is unchanged.`;
}

function intentPreservedFor(action: AdaptationAction, original: ScheduledSession): boolean {
  if (['unchanged', 'reduced', 'remove_intensity', 'convert_easy', 'convert_run_walk', 'moved', 'rebuild_week', 'treadmill_equivalent', 'dumbbell_equivalent'].includes(action)) return true;
  if (action === 'replace_cycling') return !isHard(original) && isRun(original);
  if (action === 'replace_walk') return !isHard(original) && isRun(original);
  if (action === 'replace_mobility' || action === 'active_recovery') return original.activityType === 'mobility' || original.priority === 'optional';
  return false;
}

export function createAdaptationPreview(
  weekKey: string,
  sessions: ScheduledSession[],
  requests: AdaptationRequest[],
  createdAt = Date.now(),
  options: ConflictValidationOptions = {},
): AdaptationPreview {
  const byId = new Map(sessions.map(session => [session.scheduledSessionId, session]));
  const overlays: AdaptationSessionOverlay[] = requests
    .flatMap(request => {
      const original = byId.get(request.scheduledSessionId);
      if (!original) return [];
      const adapted = adaptedSessionFor(request, original);
      return [{
        id: `${weekKey}:${request.scheduledSessionId}`,
        scheduledSessionId: request.scheduledSessionId,
        action: request.action,
        original: cloneSession(original),
        adapted,
        reason: request.reason,
        explanation: explanationFor(request.action, original, adapted),
        intentPreserved: intentPreservedFor(request.action, original),
        createdAt,
      } satisfies AdaptationSessionOverlay];
    });
  const projected = applyAdaptationOverlays(sessions, overlays);
  const conflicts = validateAdaptationSchedule(projected, options);
  const changed = overlays.filter(item => item.action !== 'unchanged').length;
  const changedIds = new Set(overlays.map(item => item.scheduledSessionId));
  const unchangedSessionIds = sessions
    .filter(session => !changedIds.has(session.scheduledSessionId) || overlays.some(item => item.scheduledSessionId === session.scheduledSessionId && item.action === 'unchanged'))
    .map(session => session.scheduledSessionId);
  const reason = overlays[0]?.reason ?? 'other';
  return {
    id: `preview:${weekKey}:${reason}:${overlays.map(item => item.scheduledSessionId).sort().join(',')}`,
    weekKey,
    reason,
    createdAt,
    overlays,
    unchangedSessionIds,
    summary: changed === 0 ? 'No sessions changed.' : `${changed} session${changed === 1 ? '' : 's'} ready to review.`,
    conflicts,
  };
}

export function applyAdaptationOverlays(
  sessions: ScheduledSession[],
  overlays: AdaptationSessionOverlay[] | undefined,
): ScheduledSession[] {
  if (!overlays?.length) return sessions;
  const byId = new Map(overlays.map(overlay => [overlay.scheduledSessionId, overlay]));
  const result: ScheduledSession[] = [];
  for (const session of sessions) {
    const overlay = byId.get(session.scheduledSessionId);
    if (!overlay) { result.push(session); continue; }
    if (overlay.action === 'removed' || !overlay.adapted) continue;
    result.push({
      ...cloneSession(overlay.adapted),
      scheduledSessionId: session.scheduledSessionId,
      originalDate: session.originalDate,
      completedActivityId: session.completedActivityId,
      completionState: session.completionState,
      adaptationReason: overlay.explanation,
    });
  }
  return dedupeByScheduledSessionId(result);
}

export function dedupeByScheduledSessionId(sessions: ScheduledSession[]): ScheduledSession[] {
  const seen = new Set<string>();
  return sessions.filter(session => {
    if (seen.has(session.scheduledSessionId)) return false;
    seen.add(session.scheduledSessionId);
    return true;
  });
}

export function validateAdaptationSchedule(
  sessions: ScheduledSession[],
  options: ConflictValidationOptions = {},
): AdaptationConflict[] {
  const conflicts: AdaptationConflict[] = [];
  const ids = new Set<string>();
  for (const session of sessions) {
    if (ids.has(session.scheduledSessionId)) conflicts.push({ code: 'duplicate_id', sessionIds: [session.scheduledSessionId], message: 'A session appears more than once. Keep one stable scheduled-session ID.' });
    ids.add(session.scheduledSessionId);
    if (options.lockedDates?.includes(session.date) && session.date !== session.originalDate) conflicts.push({ code: 'locked_day', sessionIds: [session.scheduledSessionId], message: `${session.date} is locked and cannot receive a moved session.` });
    if ((options.planStartDate && session.date < options.planStartDate) || (options.planEndDate && session.date > options.planEndDate)) conflicts.push({ code: 'plan_boundary', sessionIds: [session.scheduledSessionId], message: 'Adaptations must stay inside the active plan boundary.' });
  }
  const byDate = new Map<string, ScheduledSession[]>();
  for (const session of sessions) byDate.set(session.date, [...(byDate.get(session.date) ?? []), session]);
  for (const [date, items] of byDate) {
    const primaryRuns = items.filter(item => item.priority === 'primary' && isRun(item));
    if (primaryRuns.length > 1) conflicts.push({ code: 'two_primary_runs', sessionIds: primaryRuns.map(item => item.scheduledSessionId), message: `${date} has more than one primary run.` });
    const hasRunWalk = items.some(item => item.activityType === 'run_walk');
    const easyRuns = items.filter(item => item.activityType === 'run' && /easy/.test(`${item.subtype} ${item.title}`.toLowerCase()));
    if (hasRunWalk && easyRuns.length) conflicts.push({ code: 'run_walk_plus_easy', sessionIds: items.filter(item => item.activityType === 'run_walk' || easyRuns.includes(item)).map(item => item.scheduledSessionId), message: `${date} cannot stack run/walk and an easy run.` });
    const unsafeOverlap = hasUnsafeSameDayStressOverlap(items);
    if (unsafeOverlap.length && !isTrueRecoveryDay(byDate.get(nextDate(date)) ?? [])) conflicts.push({ code: 'stress_axis_overlap', sessionIds: unsafeOverlap.map(item => item.scheduledSessionId), message: `${date} stacks hard running with hard lower-body strength. Consolidate only if the following day is true recovery.` });
  }
  const days = [...byDate.keys()].sort();
  for (let index = 1; index < days.length; index += 1) {
    if (calendarDayGap(days[index - 1], days[index]) !== 1) continue;
    const previous = byDate.get(days[index - 1]) ?? [];
    const current = byDate.get(days[index]) ?? [];
    const previousHard = previous.filter(isHard);
    const currentHard = current.filter(isHard);
    // Consecutive hard days only conflict when the two days drain the same
    // system (leg/cardio/neuromuscular/upper overlap) — hard upper-body work
    // followed by intervals is an acceptable pairing and must not warn.
    const overlappingConsecutive = previousHard.filter(prev => currentHard.some(curr => hasOverlappingHardStress(prev, curr)));
    if (overlappingConsecutive.length) {
      const overlappingCurrent = currentHard.filter(curr => previousHard.some(prev => hasOverlappingHardStress(prev, curr)));
      conflicts.push({ code: 'consecutive_hard', sessionIds: [...overlappingConsecutive, ...overlappingCurrent].map(item => item.scheduledSessionId), message: 'Hard sessions that stress the same systems need a recovery day between them.' });
    }
    if (previous.some(isHardLowerStrength) && current.some(isLong)) conflicts.push({ code: 'long_after_hard_strength', sessionIds: [...previous, ...current].filter(item => isHardLowerStrength(item) || isLong(item)).map(item => item.scheduledSessionId), message: 'Do not place a long run the day after hard lower-body strength.' });
    const spacingTargets = current.filter(item => (isLong(item) || isHard(item)) && previousHard.some(prev => hasOverlappingHardStress(prev, item)));
    if (spacingTargets.length) conflicts.push({ code: 'recovery_spacing', sessionIds: [...previousHard.filter(prev => spacingTargets.some(item => hasOverlappingHardStress(prev, item))), ...spacingTargets].map(item => item.scheduledSessionId), message: 'Protect recovery spacing after a hard session.' });
  }
  return conflicts;
}

export function alternativesForSession(session: ScheduledSession, reason: AdaptationReason): AdaptationRequest[] {
  const base = { scheduledSessionId: session.scheduledSessionId, reason };
  return [
    { ...base, action: 'unchanged' },
    { ...base, action: 'reduced' },
    ...((reason === 'treadmill_available' || reason === 'unsafe_weather' || reason === 'no_hills_available' || reason === 'no_usual_location') && isRun(session)
      ? [{ ...base, action: 'treadmill_equivalent' as const }]
      : []),
    ...((reason === 'dumbbells_only' || reason === 'no_gym_equipment') && session.activityType === 'strength'
      ? [{ ...base, action: 'dumbbell_equivalent' as const }]
      : []),
    ...(isRun(session) ? [
      { ...base, action: 'remove_intensity' as const },
      { ...base, action: 'convert_easy' as const },
      { ...base, action: 'convert_run_walk' as const },
      { ...base, action: 'replace_walk' as const },
      { ...base, action: 'replace_cycling' as const },
    ] : []),
    { ...base, action: 'replace_mobility' },
    { ...base, action: 'active_recovery' },
    { ...base, action: 'rest' },
    { ...base, action: 'removed' },
  ];
}

export function missedWorkoutActions(session: ScheduledSession, reason: AdaptationReason): AdaptationRequest[] {
  // Missed hard work is never moved automatically. A move is offered only for
  // easy/recovery work and remains constrained to the current week by the UI.
  const actions = alternativesForSession(session, reason);
  if (!isHard(session) && isRun(session)) actions.unshift({ scheduledSessionId: session.scheduledSessionId, action: 'moved', reason, moveToDate: session.date });
  return actions;
}

export function serializeConfirmedAdaptations(value: unknown): Record<string, ConfirmedAdaptation> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, ConfirmedAdaptation> = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    const item = candidate as Partial<ConfirmedAdaptation>;
    if (!item || item.confirmation !== 'confirmed' || !Array.isArray(item.overlays) || typeof item.weekKey !== 'string') continue;
    result[key] = item as ConfirmedAdaptation;
  }
  return result;
}
