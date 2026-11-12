import type { GeneratedBeginnerPlan } from './beginnerPlan';
import type { MacroPlan, Race, TrainingGoalType } from './plan';

export type GoalArchive = {
  schemaVersion: 1;
  id: string;
  sourceKey: string;
  ownerUserId: string;
  athleteId: string;
  title: string;
  kind: 'race' | 'goal' | 'beginner';
  goalType: TrainingGoalType;
  startDate: string;
  endDate: string;
  archivedAt: number;
  closureReason?: 'replaced' | 'open_training';
  race?: Race;
  beginnerPlan?: GeneratedBeginnerPlan;
  macroPlan?: MacroPlan;
  summary: {
    completedActivities: number;
    partialActivities: number;
    activeDays: number;
    distanceMeters: number | null;
    durationSeconds: number | null;
    elevationGainMeters: number | null;
    trainingLoad: number | null;
    activityIds: string[];
    /** Populated calendar weeks only, ordered by their Sunday start date. */
    weeks: {
      startDate: string;
      activityCount: number;
      distanceMeters: number | null;
      durationSeconds: number | null;
    }[];
    coverage: {
      distanceActivities: number;
      durationActivities: number;
    };
  };
  result: {
    status: 'unrecorded' | 'finished' | 'did_not_finish' | 'did_not_start';
    timeSeconds?: number;
    source?: 'race_record' | 'user' | 'activity_link';
    /** A reference only; current outcome/time are derived from this Activity. */
    linkedActivityId?: string;
    updatedAt?: number;
  };
};

export type GoalArchiveDescriptor = Pick<GoalArchive,
  | 'sourceKey' | 'ownerUserId' | 'athleteId' | 'title' | 'kind' | 'goalType'
  | 'startDate' | 'endDate' | 'race' | 'beginnerPlan' | 'macroPlan'
>;
