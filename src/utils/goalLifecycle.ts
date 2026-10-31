import type { GeneratedBeginnerPlan, ActivePresetGoal } from '../types/beginnerPlan';
import type { GoalArchive, GoalArchiveDescriptor } from '../types/goalArchive';
import type { Race, TrainingGoalType } from '../types/plan';
import { isValidDateOnly } from './dateOnly';

export type GoalLifecyclePlan = {
  goalType: TrainingGoalType;
  programStartDate: string | null;
  races: Race[];
  activePresetGoal: ActivePresetGoal | null;
  goalBlockId: string | null;
  goalTitle: string | null;
  goalEndDate: string | null;
  goalRaceId?: string | null;
};

/** An archive is a durable snapshot, not a deactivation flag. A failed choice
 * can leave its old focus selected; only committed mode/pointer changes retire it. */
export function calendarRacesForPlan(plan: Pick<GoalLifecyclePlan, 'goalType' | 'goalRaceId' | 'programStartDate'> & { trainingMode: 'structured' | 'open' },
  races: readonly Race[], archives: readonly GoalArchive[]): Race[] {
  if (plan.trainingMode === 'open') return [];
  return races.filter(race => {
    const archived = archives.find(archive => archive.sourceKey === `race:${race.id}`);
    return !archived || (!!archived.closureReason && (plan.goalRaceId === race.id
      || (!plan.goalRaceId && plan.goalType === 'race_prep' && archived.startDate === plan.programStartDate)));
  });
}

/** Dates describe an observation window, not proof of prescribed adherence. */
export function endedGoalDescriptors(plan: GoalLifecyclePlan, beginner: GeneratedBeginnerPlan | null,
  ownerUserId: string, today: string): { descriptors: GoalArchiveDescriptor[]; primaryKey: string | null } {
  if (!isValidDateOnly(today)) throw new Error('A valid local date is required');
  const base = { ownerUserId, athleteId: 'athlete_default', goalType: plan.goalType };
  const descriptors: GoalArchiveDescriptor[] = [];
  const eligibleRaces = plan.races.filter(race => isValidDateOnly(race.date));
  for (const race of eligibleRaces.filter(race => race.date < today)) {
    descriptors.push({ ...base, sourceKey: `race:${race.id}`, kind: 'race', title: race.name,
      // A historical event added before the current program has no recoverable
      // block start. Keep its event-day record without inventing earlier training.
      startDate: isValidDateOnly(plan.programStartDate) && plan.programStartDate <= race.date ? plan.programStartDate : race.date,
      endDate: race.date, race });
  }
  const currentBeginner = beginner && plan.activePresetGoal?.planId === beginner.id ? beginner : null;
  if (currentBeginner && isValidDateOnly(currentBeginner.startDate) && isValidDateOnly(currentBeginner.targetDate)
    && currentBeginner.startDate <= currentBeginner.targetDate && currentBeginner.targetDate < today) {
    descriptors.push({ ...base, sourceKey: `beginner:${currentBeginner.id}`, kind: 'beginner',
      title: currentBeginner.goal.replaceAll('_', ' '), startDate: currentBeginner.startDate,
      endDate: currentBeginner.targetDate, beginnerPlan: currentBeginner });
  }
  if (plan.goalType !== 'race_prep' && plan.goalBlockId && isValidDateOnly(plan.programStartDate)
    && isValidDateOnly(plan.goalEndDate) && plan.programStartDate <= plan.goalEndDate && plan.goalEndDate < today) {
    descriptors.push({ ...base, sourceKey: `goal:${plan.goalBlockId}`, kind: 'goal',
      title: plan.goalTitle || 'Training goal', startDate: plan.programStartDate, endDate: plan.goalEndDate });
  }
  let primaryKey: string | null = null;
  if (currentBeginner) {
    if (currentBeginner.targetDate < today) primaryKey = `beginner:${currentBeginner.id}`;
  } else if (plan.goalType !== 'race_prep' && plan.goalBlockId) {
    if (descriptors.some(item => item.sourceKey === `goal:${plan.goalBlockId}`)) primaryKey = `goal:${plan.goalBlockId}`;
  } else if (plan.goalType === 'race_prep' && plan.goalRaceId) {
    if (descriptors.some(item => item.sourceKey === `race:${plan.goalRaceId}`)) primaryKey = `race:${plan.goalRaceId}`;
  } else if (plan.goalType === 'race_prep' && !eligibleRaces.some(race => race.date >= today)) {
    const last = [...eligibleRaces].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) primaryKey = `race:${last.id}`;
  }
  return { descriptors, primaryKey };
}
