import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { useActivityStore } from '../store/activityStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useStrengthStore } from '../store/strengthStore';
import { useMobilityStore } from '../store/mobilityStore';
import { useCustomWorkoutStore } from '../store/customWorkoutStore';
import { workoutWasDeleted } from '../utils/workoutDeletion';

/** Projection cleanup is repeatable after interrupted saves and legacy hydration. */
export function pruneDeletedWorkoutProjections(lease: OwnerLease) {
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Workout owner changed');
  const deletions = useActivityStore.getState().confirmedDeletedActivities;
  const workouts = useWorkoutStore.getState();
  const history = workouts.history.filter(row => !workoutWasDeleted(deletions, 'workout_logs', row, lease.ownerUserId));
  if (history.length !== workouts.history.length) {
    const removed = new Set(workouts.history.filter(row => !history.includes(row)).flatMap(row => [row.id, ...(row.completionKey ? [row.completionKey] : [])]));
    useWorkoutStore.setState({ history, completedWorkouts: workouts.completedWorkouts.filter(id => !removed.has(id)) });
  }
  const strength = useStrengthStore.getState();
  const strengthHistory = strength.history.filter(row => !workoutWasDeleted(deletions, 'strength_logs', row, lease.ownerUserId));
  if (strengthHistory.length !== strength.history.length) {
    const removed = new Set(strength.history.filter(row => !strengthHistory.includes(row)).flatMap(row => [row.id, ...(row.completionKey ? [row.completionKey] : [])]));
    useStrengthStore.setState({ history: strengthHistory, completedSessions: strength.completedSessions.filter(id => !removed.has(id)) });
  }
  const mobility = useMobilityStore.getState();
  const completions = mobility.completions.filter(row => !workoutWasDeleted(deletions, 'mobility', row, lease.ownerUserId));
  if (completions.length !== mobility.completions.length) useMobilityStore.setState({ completions });
  const custom = useCustomWorkoutStore.getState();
  const logs = custom.logs.filter(row => !workoutWasDeleted(deletions, 'custom_workout_logs', row, lease.ownerUserId));
  if (logs.length !== custom.logs.length) useCustomWorkoutStore.setState({ logs });
}

/** Persist intent first. A failed/restarted cleanup cannot resurrect the workout. Health is untouched. */
export async function deleteCompletedWorkout(id: string, expectedOwner?: OwnerLease) {
  const lease = expectedOwner ?? captureOwnerLease();
  if (!lease || !ownerLeaseIsCurrent(lease)) throw new Error('Sign in with the owner of this workout before deleting it');
  await useActivityStore.getState().removeActivityAndPersist(id, lease);
  if (!ownerLeaseIsCurrent(lease)) throw new Error('Account changed while deleting the workout');
  pruneDeletedWorkoutProjections(lease);
}
