import { addDays, parseYMD, toYMD } from './calendarEngine';

export type DateOnly = string;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function todayDateOnly(now = new Date()): DateOnly {
  return toYMD(now);
}

export function isValidDateOnly(value: string | null | undefined): value is DateOnly {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value || !isValidDateOnly(value)) return '';
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}

export function parseDateOnlyDisplay(value: string): DateOnly | null {
  const trimmed = value.trim();
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const dash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return isValidDateOnly(trimmed) ? trimmed : null;
  const match = slash ?? dash;
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const candidate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDateOnly(candidate) ? candidate : null;
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function addDaysToDateOnly(value: DateOnly, days: number): DateOnly {
  return toYMD(addDays(parseYMD(value), days));
}

export function dateOnlyToLocalTimestamp(value: DateOnly, hour = 12): number {
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw), hour, 0, 0, 0);
  return date.getTime();
}

export function timestampToDateOnly(timestamp: number): DateOnly {
  const date = new Date(timestamp);
  return toYMD(date);
}

export function startOfMonth(value: DateOnly): Date {
  const parsed = parseYMD(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDateOnly(value: DateOnly, minDate?: DateOnly, maxDate?: DateOnly): DateOnly {
  if (minDate && compareDateOnly(value, minDate) < 0) return minDate;
  if (maxDate && compareDateOnly(value, maxDate) > 0) return maxDate;
  return value;
}

export function dateOnlyFromParts(year: number, monthIndex: number, day: number): DateOnly | null {
  const candidate = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDateOnly(candidate) ? candidate : null;
}
