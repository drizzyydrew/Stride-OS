import { addDays, parseYMD, toYMD } from './calendarEngine';
import { formatDateOnly, parseDateOnlyDisplay } from './dateOnly';

export function formatYMDForDisplay(value: string | null | undefined): string {
  return formatDateOnly(value) || value || '';
}

export function parseDisplayDateToYMD(value: string): string | null {
  return parseDateOnlyDisplay(value);
}

export function addDaysToYMD(value: string, days: number): string {
  return toYMD(addDays(parseYMD(value), days));
}

export function isTodayOrFutureYMD(value: string, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parseYMD(value).getTime() >= today.getTime();
}
