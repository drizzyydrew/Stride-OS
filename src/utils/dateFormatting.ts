import { addDays, parseYMD, toYMD } from './calendarEngine';

export function formatYMDForDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${month}-${day}-${year}`;
}

export function parseDisplayDateToYMD(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return toYMD(parsed);
}

export function addDaysToYMD(value: string, days: number): string {
  return toYMD(addDays(parseYMD(value), days));
}

export function isTodayOrFutureYMD(value: string, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parseYMD(value).getTime() >= today.getTime();
}
