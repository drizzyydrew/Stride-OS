import type { CompletedWorkoutRecord } from '../types/training';
import type { StrengthLogRecord } from '../types/strength';

function reportIntegrationFailures(results: PromiseSettledResult<unknown>[], label: string): void {
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn(`[${label}]`, result.reason);
    }
  });
}

export async function syncCompletedWorkoutToExternalServices(record: CompletedWorkoutRecord): Promise<void> {
  if (record.skipped) return;

  // Apple Health writes now happen once per Activity-log entry (with GPS
  // route) in HealthActivityWriter; writing here too would duplicate runs.
  void record;
}

export async function syncStrengthSessionToExternalServices(record: StrengthLogRecord): Promise<void> {
  if (record.skipped) return;

  // Written once from the Activity log by HealthActivityWriter.
  void record;
}
