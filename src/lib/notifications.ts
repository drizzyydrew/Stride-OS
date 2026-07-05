import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const WORKOUT_NOTIFICATION_ID = 'strideos-workout-reminder';
const READINESS_NOTIFICATION_ID = 'strideos-readiness-reminder';

export type NotificationPrefs = {
  enabled: boolean;
  time: string;
  workout: boolean;
  readiness: boolean;
};

export type TrainingNotificationScheduleStatus = {
  workout: boolean;
  readiness: boolean;
  expected: number;
  scheduled: number;
  inSync: boolean;
};

function parseTime(time: string) {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Use 24-hour time like 07:00.');
  }
  return { hour, minute };
}

function hasNotificationAccess(status: Notifications.NotificationPermissionsStatus): boolean {
  if (status.status === 'granted') return true;
  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function requestNotificationAccess(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-training', {
      name: 'Daily training',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (hasNotificationAccess(existing)) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return hasNotificationAccess(requested);
}

export async function getNotificationAccessStatus(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  return hasNotificationAccess(existing);
}

export async function clearTrainingNotifications() {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(READINESS_NOTIFICATION_ID).catch(() => undefined),
  ]);
}

export async function getTrainingNotificationScheduleStatus(
  prefs?: NotificationPrefs,
): Promise<TrainingNotificationScheduleStatus> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = new Set(scheduled.map(notification => notification.identifier));
  const workout = identifiers.has(WORKOUT_NOTIFICATION_ID);
  const readiness = identifiers.has(READINESS_NOTIFICATION_ID);

  const expected = prefs?.enabled
    ? Number(prefs.workout) + Number(prefs.readiness)
    : 0;
  const actualExpected = Number(prefs?.workout ? workout : false) + Number(prefs?.readiness ? readiness : false);
  const scheduledTraining = Number(workout) + Number(readiness);

  return {
    workout,
    readiness,
    expected,
    scheduled: scheduledTraining,
    inSync: prefs ? scheduledTraining === expected && actualExpected === expected : scheduledTraining > 0,
  };
}

export async function scheduleTrainingNotifications(prefs: NotificationPrefs) {
  await clearTrainingNotifications();
  if (!prefs.enabled) return;

  const granted = await requestNotificationAccess();
  if (!granted) throw new Error('Notification permission was denied.');

  const { hour, minute } = parseTime(prefs.time);

  if (prefs.readiness) {
    await Notifications.scheduleNotificationAsync({
      identifier: READINESS_NOTIFICATION_ID,
      content: {
        title: 'StrideOS readiness check-in',
        body: 'Log sleep, soreness, and readiness before today’s training.',
        data: { url: '/(tabs)/dashboard' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  if (prefs.workout) {
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIFICATION_ID,
      content: {
        title: 'StrideOS workout reminder',
        body: 'Your training plan is ready when you are.',
        data: { url: '/(tabs)/training' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.min(hour + 1, 23),
        minute,
      },
    });
  }
}

// Fixed 5:00 AM daily readiness reminder — separate from the user-configurable
// workout/readiness reminders above (scheduleTrainingNotifications), which share
// a single toggle+time in Settings. This one is dedicated to the Dashboard's
// daily readiness check-in and always fires at 5:00 AM device-local time.
const DAILY_READINESS_REMINDER_ID = 'strideos-daily-readiness-5am';

export async function scheduleDailyReadinessReminder(): Promise<boolean> {
  const granted = await requestNotificationAccess();
  if (!granted) return false;

  // Cancel any existing schedule under this identifier first so re-enabling
  // (or calling this more than once) never results in duplicate reminders.
  await Notifications.cancelScheduledNotificationAsync(DAILY_READINESS_REMINDER_ID).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_READINESS_REMINDER_ID,
    content: {
      title: 'Morning readiness check',
      body: 'Log how you’re feeling so StrideOS can adjust today’s training.',
      data: { url: '/(tabs)/dashboard' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 5,
      minute: 0,
    },
  });

  return true;
}

export async function cancelDailyReadinessReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_READINESS_REMINDER_ID).catch(() => undefined);
}

export async function sendRunAlertNotification(body: string) {
  const granted = await requestNotificationAccess();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'StrideOS run alert',
      body,
      data: { url: '/(tabs)/training' },
    },
    trigger: null,
  });
}
