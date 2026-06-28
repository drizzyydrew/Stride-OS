import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';
import { useIntegrationsStore } from '../store/integrationsStore';
import { writeStrengthSession, writeWorkout } from './healthKit';

function reportIntegrationFailures(results: PromiseSettledResult<unknown>[], label: string): void {
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn(`[${label}]`, result.reason);
    }
  });
}

export async function syncCompletedWorkoutToExternalServices(record: CompletedWorkoutRecord): Promise<void> {
  if (record.skipped) return;

  const { healthKitEnabled } = useIntegrationsStore.getState();
  const jobs: Promise<unknown>[] = [];

  if (healthKitEnabled) {
    jobs.push(writeWorkout(record));
  }

  const results = await Promise.allSettled(jobs);
  reportIntegrationFailures(results, 'Workout integration sync failed');
}

export async function syncStrengthSessionToExternalServices(record: StrengthLogRecord): Promise<void> {
  if (record.skipped) return;

  const { healthKitEnabled } = useIntegrationsStore.getState();
  if (!healthKitEnabled) return;

  const results = await Promise.allSettled([writeStrengthSession(record)]);
  reportIntegrationFailures(results, 'Strength integration sync failed');
}
