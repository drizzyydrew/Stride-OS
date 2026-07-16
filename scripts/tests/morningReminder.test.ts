import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  expectedReadinessNotificationCount,
  migrateMorningReminderPreferences,
  readinessReminderWeekdays,
} from '../../src/utils/notificationSchedule';

test('daily, weekday, and custom readiness schedules create deterministic counts', () => {
  assert.equal(expectedReadinessNotificationCount(true, 'daily'), 1);
  assert.deepEqual(readinessReminderWeekdays('weekdays'), [2, 3, 4, 5, 6]);
  assert.equal(expectedReadinessNotificationCount(true, 'weekdays'), 5);
  assert.deepEqual(readinessReminderWeekdays('custom', [7, 2, 2, 9]), [2, 7]);
  assert.equal(expectedReadinessNotificationCount(false, 'custom', [2, 4]), 0);
});

test('legacy enabled 5:00 AM reminders migrate without being disabled', () => {
  const migrated = migrateMorningReminderPreferences({
    notificationsEnabled: false,
    readinessNotifications: false,
    notificationTime: '07:30',
    readinessNotificationSchedule: 'custom',
    morningReminderMigratedV37: false,
  }, true);
  assert.deepEqual(migrated, {
    notificationsEnabled: true,
    readinessNotifications: true,
    notificationTime: '05:00',
    readinessNotificationSchedule: 'daily',
    morningReminderMigratedV37: true,
  });
});

test('users without the legacy reminder retain their configured notification preferences', () => {
  const migrated = migrateMorningReminderPreferences({
    notificationsEnabled: false,
    readinessNotifications: false,
    notificationTime: '08:15',
    readinessNotificationSchedule: 'weekdays',
    morningReminderMigratedV37: false,
  }, false);
  assert.deepEqual(migrated, { morningReminderMigratedV37: true });
});

test('Morning Reminder is removed from Today and controlled from Notifications settings', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  const today = read('app/(tabs)/dashboard/index.tsx');
  const settings = read('app/(tabs)/settings/index.tsx');
  const notifications = read('src/lib/notifications.ts');
  const rootLayout = read('app/_layout.tsx');
  assert.doesNotMatch(today, /MORNING REMINDER|Daily readiness nudge at 5:00 AM/);
  assert.match(settings, /Morning Readiness Reminder/);
  assert.match(settings, /Daily/);
  assert.match(settings, /Weekdays/);
  assert.match(settings, /Custom days/);
  assert.match(notifications, /cancelScheduledNotificationAsync/);
  assert.match(notifications, /LEGACY_DAILY_READINESS_REMINDER_ID/);
  assert.match(rootLayout, /migrateMorningReminderV37/);
  assert.match(rootLayout, /waitForHydration/);
  assert.match(settings, /Open Settings/);
  assert.match(settings, /Linking\.openSettings/);
});
