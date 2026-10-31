import { create } from 'zustand';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { waitForPersistedStoreHydration } from './trackingTaskHydration';
import { useTrainingPlanStore, persistTrainingPlanChanges, saveTrainingPlanChoice, recoverTrainingPlanChoice } from '../store/trainingPlanStore';
import { useBeginnerPlanStore, saveBeginnerPlanChoice } from '../store/beginnerPlanStore';
import { useGoalArchiveStore } from '../store/goalArchiveStore';
import { useActivityStore } from '../store/activityStore';
import { useProfileStore } from '../store/profileStore';
import { useAthleteStore } from '../store/athleteStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useActiveRunStore } from '../store/activeRunStore';
import { useActiveActivityStore } from '../store/activeActivityStore';
import { useActiveIndoorRideStore } from '../store/activeIndoorRideStore';
import { useActiveStrengthSessionStore } from '../store/activeStrengthSessionStore';
import { buildGoalArchive } from '../utils/goalArchive';
import { endedGoalDescriptors } from '../utils/goalLifecycle';
import { buildMacroPlan } from '../utils/plan/macroPlanner';
import { isValidDateOnly, todayDateOnly } from '../utils/dateOnly';
import type { TrainingGoalType, Race } from '../types/plan';
import type { GoalArchive, GoalArchiveDescriptor } from '../types/goalArchive';
import type { GeneratedBeginnerPlan } from '../types/beginnerPlan';
import { repeatBeginnerWeek, BEGINNER_PLAN_DEFINITIONS } from '../utils/beginnerPlans';
import { readGoalTransition, saveGoalTransition, type GoalTransition } from './goalTransitionJournal';

export function currentBeginnerPlan(): GeneratedBeginnerPlan | null {
  return useTrainingPlanStore.getState().activePresetPlan ?? useBeginnerPlanStore.getState().activePlan;
}

export const useGoalLifecycleRuntime = create<{ status: 'loading' | 'ready' | 'error'; error: string | null }>(() => ({ status: 'loading', error: null }));
let inFlight: Promise<void> | null = null;
let unconfirmedPlanRevision: number | null = null;
let choices: Promise<unknown> = Promise.resolve();
function serializeChoice<T>(work: () => Promise<T>): Promise<T> {
  const next = choices.then(work);
  choices = next.catch(() => undefined);
  return next;
}

function requireOwner(lease: OwnerLease) {
  if (!ownerLeaseIsCurrent(lease)) throw new Error('The account changed. Your history was retained.');
  if (useProfileStore.getState().activeAthleteId !== 'athlete_default') throw new Error('The athlete changed. Your history was retained.');
}

function sessionInProgress(): boolean {
  return useActiveRunStore.getState().isActive || useActiveActivityStore.getState().isActive
    || useActiveIndoorRideStore.getState().isActive || !!useActiveStrengthSessionStore.getState().session;
}

async function ready(lease: OwnerLease) {
  const stores = [useTrainingPlanStore, useBeginnerPlanStore, useActivityStore, useProfileStore,
    useAthleteStore, useOnboardingStore, useActiveRunStore, useActiveActivityStore,
    useActiveIndoorRideStore, useActiveStrengthSessionStore];
  const hydrated = await Promise.all(stores.map(store => waitForPersistedStoreHydration(store)));
  requireOwner(lease);
  if (hydrated.some(value => !value) || useActivityStore.getState().hydrationStatus !== 'ready') {
    throw new Error('Training history is still loading. Unlock the device and retry.');
  }
  if (useProfileStore.getState().activeAthleteId !== 'athlete_default') {
    throw new Error('Goal archives currently use your primary athlete profile. No history has been reassigned.');
  }
  const archive = useGoalArchiveStore.getState();
  if (archive.ownerUserId !== lease.ownerUserId || archive.status !== 'ready') {
    await archive.load(lease);
    requireOwner(lease);
  }
  await recoverTransition(lease);
  requireOwner(lease);
}

async function confirmPlan(lease: OwnerLease) {
  unconfirmedPlanRevision = useTrainingPlanStore.getState().revision;
  await persistTrainingPlanChanges(lease);
  requireOwner(lease);
  unconfirmedPlanRevision = null;
}

/** Explicitly changing an unfinished focus preserves its plan outline too. */
function captureCurrentFocus(lease: OwnerLease, closureReason: 'replaced' | 'open_training'): GoalArchive[] {
  const plan = useTrainingPlanStore.getState();
  if (plan.trainingMode === 'open') return [];
  const revision = plan.revision;
  const today = todayDateOnly();
  const startDate = isValidDateOnly(plan.programStartDate) && plan.programStartDate < today ? plan.programStartDate : today;
  const beginner = currentBeginnerPlan();
  const base = { ownerUserId: lease.ownerUserId, athleteId: 'athlete_default', goalType: plan.goalType, startDate, endDate: today };
  let descriptors: GoalArchiveDescriptor[];
  if (beginner && beginner.id === plan.activePresetGoal?.planId) {
    descriptors = [{ ...base, sourceKey: `beginner:${beginner.id}`, title: beginner.goal.replaceAll('_', ' '), kind: 'beginner', beginnerPlan: beginner }];
  } else if (plan.goalType === 'race_prep' && plan.races.some(race => race.date >= today)) {
    descriptors = plan.races.filter(race => isValidDateOnly(race.date) && race.date >= today)
      .map(race => ({ ...base, sourceKey: `race:${race.id}`, kind: 'race', title: race.name, race }));
  } else {
    descriptors = [{ ...base, sourceKey: `goal:${plan.goalBlockId ?? `legacy:${plan.goalType}:${plan.programStartDate ?? today}`}`,
      kind: 'goal', title: plan.goalTitle ?? plan.goalType.replaceAll('_', ' ') }];
  }
  const onboarding = useOnboardingStore.getState().data;
  const macroPlan = isValidDateOnly(plan.programStartDate) ? buildMacroPlan({ goalType: plan.goalType,
    startDate: plan.programStartDate, races: plan.races, progressionLevel: useAthleteStore.getState().progressionLevel,
    yearsRunning: onboarding.yearsRunning, weeklyMileage: onboarding.weeklyMileage }) : undefined;
  const snapshots: GoalArchive[] = [];
  for (const descriptor of descriptors) {
    requireOwner(lease);
    if (sessionInProgress() || useTrainingPlanStore.getState().revision !== revision) throw new Error('Training changed while saving. Please retry.');
    if (useGoalArchiveStore.getState().archives.some(archive => archive.sourceKey === descriptor.sourceKey)) continue;
    const snapshot = buildGoalArchive({ ...descriptor, macroPlan }, useActivityStore.getState().activities,
      useProfileStore.getState().profiles.athlete_default?.racePRs ?? []);
    snapshots.push({ ...snapshot, closureReason });
  }
  if (sessionInProgress() || useTrainingPlanStore.getState().revision !== revision) throw new Error('Training changed while saving. Please retry.');
  return snapshots;
}

function applyCurrentGoalContext() {
  const state = useTrainingPlanStore.getState();
  if (state.trainingMode === 'open') return;
  const beginner = state.activePresetPlan;
  const race = state.races.find(item => item.id === state.goalRaceId);
  const title = beginner ? BEGINNER_PLAN_DEFINITIONS[beginner.goal].title : state.goalTitle || 'General Fitness';
  useOnboardingStore.getState().updateData({ goalType: state.goalType, programStartDate: state.programStartDate ?? todayDateOnly(),
    primaryGoal: race?.distance ?? 'general_fitness', goalRaceLabel: race ? `${race.name} · ${race.distance.replaceAll('_', ' ')}` : '',
    raceName: race?.name ?? '', raceDate: race?.date ?? '',
    ...(race ? { raceDistance: race.distance, racePriority: race.priority } : {}),
  });
  useAthleteStore.getState().setGoalRace(race ? `${race.name} · ${race.distance.replaceAll('_', ' ')}` : title);
}

async function finishTransition(transition: GoalTransition, lease: OwnerLease) {
  requireOwner(lease);
  if (useTrainingPlanStore.getState().lastTransitionId !== transition.id) return;
  for (const snapshot of transition.snapshots) {
    await useGoalArchiveStore.getState().addArchive(snapshot, lease);
    requireOwner(lease);
  }
  await saveGoalTransition({ ...transition, status: 'complete' }, lease);
  requireOwner(lease);
}

async function recoverTransition(lease: OwnerLease) {
  const transition = await readGoalTransition(lease);
  requireOwner(lease);
  if (!transition || transition.status === 'complete' || sessionInProgress()) return;
  const recovered = await recoverTrainingPlanChoice(transition.id, lease,
    () => !sessionInProgress() && useProfileStore.getState().activeAthleteId === 'athlete_default');
  requireOwner(lease);
  if (recovered) {
    applyCurrentGoalContext();
    await finishTransition(transition, lease);
  }
}

async function commitChoice(lease: OwnerLease, requestKey: string, snapshots: GoalArchive[],
  choice: Parameters<typeof saveTrainingPlanChoice>[1], alreadySelected: () => boolean) {
  const revision = useTrainingPlanStore.getState().revision;
  const previous = await readGoalTransition(lease);
  requireOwner(lease);
  if (previous?.status === 'complete' && previous.requestKey === requestKey
    && useTrainingPlanStore.getState().lastTransitionId === previous.id && alreadySelected()) return;
  if (useTrainingPlanStore.getState().revision !== revision) throw new Error('Training changed while saving. Please retry.');
  const transition: GoalTransition = { schemaVersion: 1, id: `goal_transition_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    ownerUserId: lease.ownerUserId, requestKey, snapshots, status: 'prepared' };
  // This recovery copy is durable BEFORE changing programming, but it is not
  // published as a final archive unless the intended primary choice commits.
  await saveGoalTransition(transition, lease);
  requireOwner(lease);
  if (sessionInProgress() || useTrainingPlanStore.getState().revision !== revision) throw new Error('Training changed while saving. Please retry.');
  await saveTrainingPlanChoice(lease, choice,
    () => !sessionInProgress() && useProfileStore.getState().activeAthleteId === 'athlete_default', transition.id);
  requireOwner(lease);
  applyCurrentGoalContext();
  await finishTransition(transition, lease);
}

/** Run from the foreground training surface, never inside a derived-plan hook. */
export function reconcileGoalLifecycle(now = new Date()): Promise<void> {
  if (inFlight) return inFlight;
  const lease = captureOwnerLease();
  if (!lease) return Promise.resolve();
  const work = (async () => {
    try {
      await ready(lease);
      requireOwner(lease);
      if (sessionInProgress()) {
        useGoalLifecycleRuntime.setState({ status: 'ready', error: null });
        return;
      }
      const plan = useTrainingPlanStore.getState();
      const revision = plan.revision;
      const { descriptors, primaryKey } = endedGoalDescriptors(plan,
        currentBeginnerPlan(), lease.ownerUserId, todayDateOnly(now));
      const profile = useProfileStore.getState().profiles.athlete_default;
      const onboarding = useOnboardingStore.getState().data;
      const macroPlan = isValidDateOnly(plan.programStartDate) ? buildMacroPlan({
        goalType: plan.goalType, startDate: plan.programStartDate, races: plan.races,
        progressionLevel: useAthleteStore.getState().progressionLevel,
        yearsRunning: onboarding.yearsRunning, weeklyMileage: onboarding.weeklyMileage,
      }) : undefined;
      for (const descriptor of descriptors) {
        requireOwner(lease);
        if (sessionInProgress() || useTrainingPlanStore.getState().revision !== revision) return;
        if (useGoalArchiveStore.getState().archives.some(archive => archive.sourceKey === descriptor.sourceKey && archive.athleteId === descriptor.athleteId)) continue;
        const snapshot = buildGoalArchive({ ...descriptor, macroPlan: macroPlan && macroPlan.startDate <= descriptor.endDate ? macroPlan : undefined },
          useActivityStore.getState().activities, profile?.racePRs ?? [], now.getTime());
        await useGoalArchiveStore.getState().addArchive(snapshot, lease);
        requireOwner(lease);
      }
      const primary = useGoalArchiveStore.getState().archives.find(archive => archive.sourceKey === primaryKey);
      if (primary && plan.trainingMode === 'structured' && !sessionInProgress()
        && useTrainingPlanStore.getState().revision === revision) {
        // Crash before here: next reconciliation finds the existing durable archive.
        // Crash after here: the archive still owns the complete frozen summary.
        useTrainingPlanStore.getState().retireBlock(primary.id, revision);
        await confirmPlan(lease);
      } else if (unconfirmedPlanRevision !== null) {
        await confirmPlan(lease);
      }
      requireOwner(lease);
      useGoalLifecycleRuntime.setState({ status: 'ready', error: null });
      if (captureOwnerLease(true) && useGoalArchiveStore.getState().syncStatus !== 'synced') {
        void useGoalArchiveStore.getState().sync(lease).catch(() => undefined);
      }
    } catch (error) {
      if (ownerLeaseIsCurrent(lease)) useGoalLifecycleRuntime.setState({ status: 'error', error: error instanceof Error ? error.message : 'Goal archives could not be saved. Please retry.' });
      throw error;
    }
  })();
  inFlight = work.finally(() => { inFlight = null; });
  return inFlight;
}

export function continueOpenTraining(): Promise<void> { return serializeChoice(continueOpen); }
async function continueOpen(): Promise<void> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Sign in to the account that owns this training history.');
  await ready(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  await reconcileGoalLifecycle();
  requireOwner(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  const snapshots = captureCurrentFocus(lease, 'open_training');
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  await commitChoice(lease, 'open', snapshots, { open: true }, () => useTrainingPlanStore.getState().trainingMode === 'open');
}

type NextGoal = { title: string; goalType: TrainingGoalType; endDate: string; race?: Omit<Race, 'id'> };
export function startNextGoal(input: NextGoal): Promise<void> {
  const captured = JSON.parse(JSON.stringify(input)) as NextGoal;
  return serializeChoice(() => startGoal(captured));
}
async function startGoal(input: NextGoal): Promise<void> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Sign in to the account that owns this training history.');
  const today = todayDateOnly();
  if (!input.title.trim() || !isValidDateOnly(input.endDate) || input.endDate < today
    || (input.goalType === 'race_prep' && (!input.race || input.race.date !== input.endDate))) {
    throw new Error('Choose a goal name and a valid target date today or later.');
  }
  await ready(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  await reconcileGoalLifecycle();
  requireOwner(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  const snapshots = captureCurrentFocus(lease, 'replaced');
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  const choice = { ...input, title: input.title.trim(), startDate: today };
  const requestKey = JSON.stringify({ kind: 'goal', title: choice.title, type: input.goalType, end: input.endDate, start: today,
    race: input.race ? { name: input.race.name, date: input.race.date, distance: input.race.distance, priority: input.race.priority } : null });
  await commitChoice(lease, requestKey, snapshots, choice, () => {
    const state = useTrainingPlanStore.getState();
    return state.trainingMode === 'structured' && !state.activePresetGoal && state.goalType === input.goalType
      && state.goalTitle === choice.title && state.goalEndDate === input.endDate && state.programStartDate === today;
  });
}

export function activateBeginnerGoal(plan: GeneratedBeginnerPlan): Promise<void> {
  const captured = JSON.parse(JSON.stringify(plan)) as GeneratedBeginnerPlan;
  return serializeChoice(() => activateBeginner(captured));
}
async function activateBeginner(plan: GeneratedBeginnerPlan): Promise<void> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Sign in to the account that owns this training history.');
  await ready(lease);
  await reconcileGoalLifecycle();
  requireOwner(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  const snapshots = captureCurrentFocus(lease, 'replaced');
  requireOwner(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  const previous = currentBeginnerPlan();
  // Older app versions could leave a retained path without its active-preset
  // pointer. Preserve that source too before replacing the single stored plan.
  if (previous && previous.id !== plan.id && !useGoalArchiveStore.getState().archives.some(archive => archive.sourceKey === `beginner:${previous.id}`)) {
    const today = todayDateOnly();
    const snapshot = buildGoalArchive({ ownerUserId: lease.ownerUserId, athleteId: 'athlete_default',
      sourceKey: `beginner:${previous.id}`, kind: 'beginner', goalType: 'general_running',
      title: previous.goal.replaceAll('_', ' '), startDate: previous.startDate <= today ? previous.startDate : today,
      endDate: previous.targetDate < today ? previous.targetDate : today, beginnerPlan: previous },
    previous.startDate <= today ? useActivityStore.getState().activities : [],
    useProfileStore.getState().profiles.athlete_default?.racePRs ?? []);
    if (!snapshots.some(item => item.sourceKey === snapshot.sourceKey)) snapshots.push({ ...snapshot, closureReason: 'replaced' });
    requireOwner(lease);
    if (sessionInProgress()) throw new Error('Finish your current workout before changing your training goal.');
  }
  const canChange = () => !sessionInProgress() && useProfileStore.getState().activeAthleteId === 'athlete_default';
  const requestKey = JSON.stringify({ kind: 'beginner', goal: plan.goal, start: plan.startDate, end: plan.targetDate,
    mode: plan.primaryEnduranceMode, completion: plan.completionGoal, weeks: plan.weeks.map(week => ({ ...week,
      sessions: week.sessions.map(({ id: _id, replacesSessionId: _source, ...session }) => session) })) });
  await commitChoice(lease, requestKey, snapshots, { startDate: plan.startDate, plan, beginner: {
      goal: plan.goal, planId: plan.id, selectedAt: Date.now(), targetDate: plan.targetDate,
      acceleratedAcknowledgedAt: plan.acceleratedAcknowledgedAt,
    } }, () => {
      const state = useTrainingPlanStore.getState();
      return state.trainingMode === 'structured' && state.activePresetGoal?.goal === plan.goal
        && state.activePresetPlan?.targetDate === plan.targetDate && state.activePresetPlan?.startDate === plan.startDate;
    });
  requireOwner(lease);
  // Legacy readers may use this cache. Failure cannot orphan the new selection:
  // its complete plan and active pointer are already in one confirmed record.
  const selected = useTrainingPlanStore.getState().activePresetPlan;
  if (selected) await saveBeginnerPlanChoice(selected, lease, canChange).catch(() => undefined);
}

export async function repeatCurrentBeginnerWeek(weekNumber: number): Promise<void> {
  const lease = captureOwnerLease();
  if (!lease) throw new Error('Sign in to the account that owns this training history.');
  await ready(lease);
  requireOwner(lease);
  if (sessionInProgress()) throw new Error('Finish your current workout before changing the path.');
  const plan = currentBeginnerPlan();
  const preset = useTrainingPlanStore.getState().activePresetGoal;
  if (!plan || preset?.planId !== plan.id || useTrainingPlanStore.getState().trainingMode !== 'structured') throw new Error('There is no active beginner path to repeat.');
  const repeated = repeatBeginnerWeek(plan, weekNumber);
  const canChange = () => !sessionInProgress() && useProfileStore.getState().activeAthleteId === 'athlete_default';
  await saveTrainingPlanChoice(lease, { plan: repeated, startDate: repeated.startDate,
    beginner: { ...preset, targetDate: repeated.targetDate } }, canChange);
  requireOwner(lease);
  await saveBeginnerPlanChoice(repeated, lease, canChange).catch(() => undefined);
}
