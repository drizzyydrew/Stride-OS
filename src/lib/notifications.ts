import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  expectedReadinessNotificationCount,
  readinessReminderWeekdays,
  type ReadinessReminderSchedule,
} from '../utils/notificationSchedule';

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
const LEGACY_DAILY_READINESS_REMINDER_ID = 'strideos-daily-readiness-5am';

export type NotificationPrefs = {
  enabled: boolean;
  time: string;
  workout: boolean;
  readiness: boolean;
  readinessSchedule?: ReadinessReminderSchedule;
  readinessDays?: number[];
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
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const readinessIdentifiers = scheduled
    .map(notification => notification.identifier)
    .filter(identifier => identifier === READINESS_NOTIFICATION_ID || identifier.startsWith(`${READINESS_NOTIFICATION_ID}-`));
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(LEGACY_DAILY_READINESS_REMINDER_ID).catch(() => undefined),
    ...readinessIdentifiers.map(identifier =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)),
  ]);
}

export async function getTrainingNotificationScheduleStatus(
  prefs?: NotificationPrefs,
): Promise<TrainingNotificationScheduleStatus> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = new Set(scheduled.map(notification => notification.identifier));
  const workout = identifiers.has(WORKOUT_NOTIFICATION_ID);
  const readinessCount = [...identifiers].filter(identifier =>
    identifier === READINESS_NOTIFICATION_ID || identifier.startsWith(`${READINESS_NOTIFICATION_ID}-`)).length;
  const readiness = readinessCount > 0;

  const expected = prefs?.enabled
    ? Number(prefs.workout) + expectedReadinessNotificationCount(
      prefs.readiness,
      prefs.readinessSchedule ?? 'daily',
      prefs.readinessDays,
    )
    : 0;
  const actualExpected = Number(prefs?.workout ? workout : false) + (prefs?.readiness ? readinessCount : 0);
  const scheduledTraining = Number(workout) + readinessCount;

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
    const content = {
      title: 'Morning readiness check',
      body: 'Log sleep, soreness, and readiness before today’s training.',
      data: { url: '/(tabs)/dashboard' },
    };
    const schedule = prefs.readinessSchedule ?? 'daily';
    const days = readinessReminderWeekdays(schedule, prefs.readinessDays);
    if (schedule === 'daily') {
      await Notifications.scheduleNotificationAsync({
        identifier: READINESS_NOTIFICATION_ID,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    } else {
      await Promise.all(days.map(weekday => Notifications.scheduleNotificationAsync({
        identifier: `${READINESS_NOTIFICATION_ID}-${weekday}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      })));
    }
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
