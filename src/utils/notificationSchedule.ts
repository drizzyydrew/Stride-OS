export type ReadinessReminderSchedule = 'daily' | 'weekdays' | 'custom';

export type MorningReminderMigrationState = {
  notificationsEnabled: boolean;
  readinessNotifications: boolean;
  notificationTime: string;
  readinessNotificationSchedule: ReadinessReminderSchedule;
  morningReminderMigratedV37: boolean;
};

/** Preserve the old fixed reminder as an actually enabled daily 5:00 AM
 * notification. Users without the legacy reminder keep every current setting;
 * migration only records that the compatibility step has run. */
export function migrateMorningReminderPreferences(
  state: MorningReminderMigrationState,
  legacyEnabled: boolean,
): Partial<MorningReminderMigrationState> {
  if (state.morningReminderMigratedV37) return {};
  if (!legacyEnabled) return { morningReminderMigratedV37: true };
  return {
    notificationsEnabled: true,
    readinessNotifications: true,
    notificationTime: '05:00',
    readinessNotificationSchedule: 'daily',
    morningReminderMigratedV37: true,
  };
}

export function readinessReminderWeekdays(
  schedule: ReadinessReminderSchedule,
  customDays: number[] = [],
): number[] {
  if (schedule === 'daily') return [];
  const candidates = schedule === 'weekdays' ? [2, 3, 4, 5, 6] : customDays;
  const normalized = Array.from(new Set(candidates))
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);
  return normalized.length ? normalized : [2, 3, 4, 5, 6];
}

export function expectedReadinessNotificationCount(
  enabled: boolean,
  schedule: ReadinessReminderSchedule,
  customDays: number[] = [],
): number {
  if (!enabled) return 0;
  return schedule === 'daily' ? 1 : readinessReminderWeekdays(schedule, customDays).length;
}
