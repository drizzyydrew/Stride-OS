import { isValidDateOnly, todayDateOnly, dateOnlyToLocalTimestamp } from './dateOnly';

export type MeasurementField = 'dateOfBirth' | 'heightCm' | 'weightKg';
export type MeasurementDraft = { field: MeasurementField; value: string | number | null; changed: boolean };
export type AgeSource = { age: number; dateOfBirth?: string | null };
export const KG_TO_LB = 2.2046226218487757;

/** Calendar components, never a UTC instant. Feb 29 birthdays advance on March
 * 1 in a non-leap year; this is an age convention, not a jurisdictional rule. */
export function ageFromDateOfBirth(value: string | null | undefined, now = new Date()): number | null {
  if (!isValidDateOnly(value) || value > todayDateOnly(now)) return null;
  const [year, month, day] = value.split('-').map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function profileAge(source: AgeSource, now = new Date()): number {
  return ageFromDateOfBirth(source.dateOfBirth, now) ?? source.age;
}

export function birthDatePickerValue(value?: string | null): Date {
  // Only a calendar cursor. This value is never saved until a person selects a date.
  return value && isValidDateOnly(value) ? new Date(dateOnlyToLocalTimestamp(value)) : new Date(2000, 0, 1, 12);
}

export function heightParts(cm: number, imperial: boolean): [number, number] {
  const whole = Math.round(imperial ? cm / 2.54 : cm);
  const base = imperial ? 12 : 100;
  return [Math.floor(whole / base), whole % base];
}
export function heightFromParts(major: number, minor: number, imperial: boolean): number {
  return imperial ? (major * 12 + minor) * 2.54 : major * 100 + minor;
}
export function weightDigits(kg: number, imperial: boolean): [number, number, number] {
  const whole = Math.round(imperial ? kg * KG_TO_LB : kg);
  return [Math.floor(whole / 100), Math.floor(whole / 10) % 10, whole % 10];
}
export function weightFromDigits(digits: readonly number[], imperial: boolean): number {
  const whole = digits[0] * 100 + digits[1] * 10 + digits[2];
  return imperial ? whole / KG_TO_LB : whole;
}
export function formatProfileHeight(cm: number, imperial: boolean): string {
  if (!Number.isFinite(cm) || cm <= 0) return 'Not added';
  const [major, minor] = heightParts(cm, imperial);
  return imperial ? `${major}′ ${minor}″` : `${major} m ${String(minor).padStart(2, '0')} cm`;
}
export function formatProfileWeight(kg: number | undefined, imperial: boolean): string {
  return kg == null ? 'Not added' : `${Math.round(imperial ? kg * KG_TO_LB : kg)} ${imperial ? 'lb' : 'kg'}`;
}
