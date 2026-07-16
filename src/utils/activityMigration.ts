import type { Activity, ActivityType } from '../types/activity';
import type { CompletedWorkoutRecord, WorkoutType } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import type { MobilityCompletion } from '../types/mobility';
import { calculateActivityLoad, sanitizeActivityMetrics } from './activityLoad';

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
    scheduled: record.source === 'generated',
    scheduledSessionId: record.workoutId || undefined,
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
  const reps = completedSets.reduce((sum, set) => sum + set.reps, 0);
  return {
    id: `activity_strength_${record.id}`,
    activityType: 'strength',
    subtype: record.sessionType,
    source: legacyImport
      ? 'legacy_import'
      : record.source === 'generated' ? 'training_plan' : 'manual',
    status: record.skipped ? 'skipped' : 'completed',
    scheduled: record.source === 'generated',
    scheduledSessionId: record.sessionId,
    startTime: record.timestamp,
    endTime: record.timestamp + durationMinutes * 60_000,
    rpe: record.overallRpe,
    notes: record.notes,
    symptoms: [],
    indoor: true,
    metrics: sanitizeActivityMetrics('strength', {
      durationSeconds: durationMinutes * 60,
      strength: {
        exerciseCount: record.exercises.length,
        sets: completedSets.length,
        reps,
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
