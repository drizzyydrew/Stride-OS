import type { Activity, ActivityType } from '../types/activity';
import type { CompletedWorkoutRecord, WorkoutType } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { MobilityCompletion } from '../types/mobility';
import { calculateActivityLoad, sanitizeActivityMetrics } from './activityLoad';
import { toYMD } from './calendarEngine';
import { runScheduledSessionId, strengthScheduledSessionId } from './scheduledSessionIds';
import { summarizeStrengthSession } from './strengthSummary';

// `completeWorkout`/`skipWorkout`/manual-log-from-day-detail all build their
// completionKey as `w${week}_${workoutId}_${dayIndex}` (see workoutStore.ts,
// [dayIndex].tsx, run-tracking.tsx). When a record's id matches that exact
// shape for its own week/workoutId, the trailing segment is a real dayIndex
// and we can derive the canonical scheduledSessionId used by
// scheduledSessions.ts. Ad-hoc completions (e.g. the Running tab's live GPS
// save, whose id is `gps_run_<timestamp>`) don't match and are left as-is —
// those paths stamp the canonical id directly at the call site instead.
function canonicalRunScheduledSessionId(record: CompletedWorkoutRecord): string | undefined {
  if (!record.workoutId) return undefined;
  const prefix = `w${record.week}_${record.workoutId}_`;
  if (!record.id.startsWith(prefix)) return undefined;
  const dayIndex = Number(record.id.slice(prefix.length));
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return undefined;
  return runScheduledSessionId(toYMD(new Date(record.timestamp)), record.workoutId, dayIndex);
}

// Strength completions logged via `logSession`/`skipSession` ([sessionIndex].tsx)
// pass the real StrengthSession id as `sessionId`, distinguishable from the
// `manualLog` path (strength/index.tsx finishSession) where `sessionId` is
// set to the completionKey itself. Only the former is a valid raw id to
// build a canonical scheduledSessionId from.
function canonicalStrengthScheduledSessionId(record: StrengthLogRecord): string | undefined {
  if (record.scheduledSessionId) return record.scheduledSessionId;
  if (!record.sessionId || record.sessionId === record.id) return undefined;
  return strengthScheduledSessionId(toYMD(new Date(record.timestamp)), record.sessionId);
}

const RUNNING_WORKOUT_TYPES = new Set<WorkoutType>([
  'easy_run', 'recovery_run', 'run_walk', 'long_run', 'progression_run',
  'tempo', 'threshold', 'marathon_pace', 'vo2', 'hill_repeats', 'fartlek',
  'norwegian_4x4', 'intervals', 'strides', 'sprint', 'taper_session',
  'deload_session', 'recovery',
]);

export function legacyWorkoutActivityType(type: WorkoutType): ActivityType {
  if (RUNNING_WORKOUT_TYPES.has(type)) return 'running';
  if (type === 'strength') return 'strength';
  if (type === 'mobility') return 'mobility';
  return 'other';
}

export function activityFromWorkoutRecord(
  record: CompletedWorkoutRecord,
  legacyImport = true,
): Activity {
  const activityType = legacyWorkoutActivityType(record.type);
  const durationMinutes = record.actualDurationMinutes ?? record.durationMinutes;
  const distanceMiles = record.actualDistanceMiles ?? record.estimatedDistanceMiles;
  const metrics = sanitizeActivityMetrics(activityType, {
    durationSeconds: durationMinutes * 60,
    elapsedTimeSeconds: durationMinutes * 60,
    activeTimeSeconds: durationMinutes * 60,
    distanceMeters: activityType === 'running' ? distanceMiles * 1609.344 : undefined,
    routeCoordinates: activityType === 'running'
      ? record.routeCoordinates?.map(point => ({
          latitude: point.lat,
          longitude: point.lng,
          timestamp: point.timestamp,
        }))
      : undefined,
    runWalkIntervals: record.type === 'run_walk' ? [] : undefined,
  });
  const load = record.skipped
    ? calculateActivityLoad({ activityType, durationMinutes: 0 })
    : calculateActivityLoad({
        activityType,
        durationMinutes,
        rpe: record.rpe,
      });

  return {
    id: `activity_workout_${record.id}`,
    activityType,
    subtype: record.type === 'run_walk' ? 'run_walk' : 'general',
    source: legacyImport
      ? 'legacy_import'
      : record.source === 'manual' ? 'manual' : 'training_plan',
    status: record.skipped ? 'skipped' : 'completed',
    completionClassification: record.skipped ? 'skipped' : 'completed_as_prescribed',
    scheduled: record.source === 'generated',
    scheduledSessionId: canonicalRunScheduledSessionId(record) ?? (record.workoutId || undefined),
    startTime: record.timestamp,
    endTime: record.timestamp + durationMinutes * 60_000,
    rpe: record.rpe,
    notes: record.notes,
    symptoms: [],
    indoor: activityType === 'strength' || activityType === 'mobility',
    metrics,
    trainingLoad: load,
    legacyWorkoutId: record.id,
    createdAt: record.timestamp,
    updatedAt: record.timestamp,
  };
}

export function migrateLegacyWorkoutHistory(
  records: CompletedWorkoutRecord[],
  existingActivities: Activity[] = [],
): Activity[] {
  const byId = new Map(existingActivities.map(activity => [activity.id, activity]));
  for (const record of records) {
    const migrated = activityFromWorkoutRecord(record);
    if (!byId.has(migrated.id)) byId.set(migrated.id, migrated);
  }
  return [...byId.values()];
}

export function activityFromStrengthRecord(
  record: StrengthLogRecord,
  legacyImport = true,
): Activity {
  const durationMinutes = record.actualDuration ?? record.plannedDuration;
  const completedSets = record.exercises.flatMap(exercise => exercise.sets)
    .filter(set => set.completed);
  const reps = completedSets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const executionAvailable = record.exercises.some(exercise =>
    exercise.name || exercise.equipmentType || exercise.skipped || exercise.substitutedFromExerciseId || exercise.added
    || exercise.sets.some(set => set.weight !== undefined || set.holdSeconds !== undefined || set.bandLevel || set.isWarmup),
  );
  const executionSummary = executionAvailable
    ? summarizeStrengthSession({
      exercises: record.exercises.map(exercise => ({
        id: exercise.exerciseId,
        name: exercise.name ?? exercise.exerciseId,
        equipmentType: exercise.equipmentType,
        skipped: exercise.skipped,
        setEntries: exercise.sets.map((set, index) => ({ ...set, id: set.id ?? `${exercise.exerciseId}_${index}` })),
      })),
      durationSeconds: durationMinutes * 60,
    })
    : undefined;
  return {
    id: `activity_strength_${record.id}`,
    activityType: 'strength',
    subtype: record.sessionType,
    source: legacyImport
      ? 'legacy_import'
      : record.source === 'generated' ? 'training_plan' : 'manual',
    status: record.skipped ? 'skipped' : 'completed',
    completionClassification: record.skipped
      ? 'skipped'
      : record.completionClassification ?? 'completed_as_prescribed',
    scheduled: record.source === 'generated',
    scheduledSessionId: canonicalStrengthScheduledSessionId(record) ?? record.sessionId,
    startTime: record.timestamp,
    endTime: record.timestamp + durationMinutes * 60_000,
    rpe: record.overallRpe,
    notes: record.notes,
    symptoms: [],
    indoor: true,
    metrics: sanitizeActivityMetrics('strength', {
      durationSeconds: durationMinutes * 60,
      strength: {
        exerciseCount: executionSummary?.exerciseCount ?? record.exercises.length,
        sets: executionSummary?.completedSets ?? completedSets.length,
        reps: executionSummary?.totalReps ?? reps,
        ...(executionSummary?.hasExternalLoadVolume
          ? { externalLoadVolumeLb: executionSummary.externalLoadVolumeLb }
          : {}),
        ...(executionSummary?.bandSetsCount
          ? { bandSetsCount: executionSummary.bandSetsCount }
          : {}),
        ...(executionSummary?.bodyweightSetsCount
          ? { bodyweightSetsCount: executionSummary.bodyweightSetsCount }
          : {}),
        ...(executionSummary?.totalHoldSeconds
          ? { totalHoldSeconds: executionSummary.totalHoldSeconds }
          : {}),
        ...(executionSummary?.averageRpe !== null && executionSummary?.averageRpe !== undefined
          ? { averageRpe: executionSummary.averageRpe }
          : {}),
        ...(executionSummary?.warmupSetsCount
          ? { warmupSetsCount: executionSummary.warmupSetsCount }
          : {}),
        ...(executionAvailable ? { exercises: record.exercises } : {}),
      },
    }),
    trainingLoad: record.skipped
      ? calculateActivityLoad({ activityType: 'strength', durationMinutes: 0 })
      : calculateActivityLoad({
          activityType: 'strength',
          durationMinutes,
          rpe: record.overallRpe,
        }),
    legacyWorkoutId: record.id,
    createdAt: record.timestamp,
    updatedAt: record.timestamp,
  };
}

export function activityFromMobilityCompletion(
  completion: MobilityCompletion,
  legacyImport = true,
): Activity {
  const durationMinutes = completion.durationMin ?? 0;
  return {
    id: `activity_mobility_${completion.id}`,
    activityType: 'mobility',
    subtype: 'general',
    source: legacyImport ? 'legacy_import' : 'manual',
    status: 'completed',
    scheduled: false,
    scheduledSessionId: completion.workoutId,
    startTime: completion.completedAt,
    endTime: completion.completedAt + durationMinutes * 60_000,
    notes: completion.notes,
    symptoms: [],
    indoor: true,
    metrics: sanitizeActivityMetrics('mobility', {
      durationSeconds: durationMinutes * 60,
    }),
    trainingLoad: calculateActivityLoad({
      activityType: 'mobility',
      durationMinutes,
      rpe: completion.feedback === 'hard' ? 6 : completion.feedback === 'right' ? 4 : 2,
    }),
    legacyWorkoutId: completion.id,
    createdAt: completion.completedAt,
    updatedAt: completion.completedAt,
  };
}

function mergeActivities(
  migrated: Activity[],
  existingActivities: Activity[],
): Activity[] {
  const byId = new Map(existingActivities.map(activity => [activity.id, activity]));
  for (const activity of migrated) {
    if (!byId.has(activity.id)) byId.set(activity.id, activity);
  }
  return [...byId.values()];
}

export function migrateLegacyStrengthHistory(
  records: StrengthLogRecord[],
  existingActivities: Activity[] = [],
): Activity[] {
  return mergeActivities(records.map(record => activityFromStrengthRecord(record)), existingActivities);
}

export function migrateLegacyMobilityHistory(
  completions: MobilityCompletion[],
  existingActivities: Activity[] = [],
): Activity[] {
  return mergeActivities(
    completions.map(completion => activityFromMobilityCompletion(completion)),
    existingActivities,
  );
}

// ─── Activity store schema v1 → v2 ────────────────────────────────────────────
//
// Before this fix, activityFromWorkoutRecord/activityFromStrengthRecord wrote
// bare `workoutId`/`sessionId` values into Activity.scheduledSessionId
// instead of the canonical `week:${date}:...` id scheduledSessions.ts
// actually derives — so completion overlays never matched. This remaps
// already-persisted activities to the canonical id whenever it's safely
// derivable from the record's own legacyWorkoutId + startTime. Never
// deletes or merges activities; if a remap happens to collide with an
// existing canonical-id activity, both are kept — overlay resolution
// (getCompletedActivityForScheduledSession) already picks the most
// recently updated one. Idempotent: already-canonical ids (containing ':')
// are left untouched, so running this repeatedly is a no-op after the
// first pass.
function looksCanonical(scheduledSessionId: string): boolean {
  return scheduledSessionId.includes(':');
}

const RUN_LEGACY_ID_PATTERN = /^w\d+_(.+)_(\d+)$/;

export function remapLegacyScheduledSessionId(activity: Activity): Activity {
  const { scheduledSessionId, legacyWorkoutId } = activity;
  if (!scheduledSessionId || !legacyWorkoutId || looksCanonical(scheduledSessionId)) return activity;

  const dateYMD = toYMD(new Date(activity.startTime));

  if (activity.activityType === 'strength') {
    // Strength legacyWorkoutId is the completionKey itself (`activityFrom
    // StrengthRecord` sets it to `record.id`). When scheduledSessionId
    // differs from it, scheduledSessionId is the raw strength session id
    // (the [sessionIndex].tsx logSession/skipSession path) and safe to
    // canonicalize. When they're equal (the manualLog path), there's no raw
    // id to derive from — leave it for the explicit scheduledSessionId
    // field (added going forward) to carry the link instead.
    if (scheduledSessionId === legacyWorkoutId) return activity;
    return { ...activity, scheduledSessionId: strengthScheduledSessionId(dateYMD, scheduledSessionId) };
  }

  const match = legacyWorkoutId.match(RUN_LEGACY_ID_PATTERN);
  if (!match || match[1] !== scheduledSessionId) return activity;
  const dayIndex = Number(match[2]);
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return activity;
  return { ...activity, scheduledSessionId: runScheduledSessionId(dateYMD, scheduledSessionId, dayIndex) };
}

export function remapLegacyScheduledSessionIds(activities: Activity[]): Activity[] {
  return activities.map(remapLegacyScheduledSessionId);
}
