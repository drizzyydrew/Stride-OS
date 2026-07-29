// ─── Units Utility ─────────────────────────────────────────────────────────
//
// Pure conversion + formatting helpers shared by anything that needs to move
// between imperial and metric, or between speed and pace. Every conversion
// guards NaN/Infinity/negative input: invalid input returns `null` rather
// than propagating NaN/Infinity into UI or stored data. Callers decide the
// fallback display (e.g. '--').

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePositive(value: number): boolean {
  return isFiniteNumber(value) && value > 0;
}

// ── Distance ──────────────────────────────────────────────────────────────

// Single canonical constant, used both directions (via division) so
// mi->km->mi round-trips land back on the exact starting float rather than
// drifting through two independently-rounded constants.
const KM_PER_MILE = 1.609344;
const METERS_PER_MILE = 1609.344;

export type UnitPreference = 'imperial' | 'metric';

export function milesToKm(miles: number): number | null {
  if (!isFiniteNumber(miles) || miles < 0) return null;
  return miles * KM_PER_MILE;
}

export function kmToMiles(km: number): number | null {
  if (!isFiniteNumber(km) || km < 0) return null;
  return km / KM_PER_MILE;
}

export function milesToMeters(miles: number): number | null {
  if (!isFiniteNumber(miles) || miles < 0) return null;
  return miles * METERS_PER_MILE;
}

export function metersToMiles(meters: number): number | null {
  if (!isFiniteNumber(meters) || meters < 0) return null;
  return meters / METERS_PER_MILE;
}

export function kmToMeters(km: number): number | null {
  if (!isFiniteNumber(km) || km < 0) return null;
  return km * 1000;
}

export function metersToKm(meters: number): number | null {
  if (!isFiniteNumber(meters) || meters < 0) return null;
  return meters / 1000;
}

export function composeDistanceHundredths(whole: number, tenths: number, hundredths: number): number {
  const safeWhole = Math.max(0, Math.min(100, Math.trunc(whole)));
  const safeTenths = Math.max(0, Math.min(9, Math.trunc(tenths)));
  const safeHundredths = Math.max(0, Math.min(9, Math.trunc(hundredths)));
  return Number(`${safeWhole}.${safeTenths}${safeHundredths}`);
}

export function decomposeDistanceHundredths(value: number): { whole: number; tenths: number; hundredths: number } {
  const cents = Math.max(0, Math.min(10000, Math.round((Number.isFinite(value) ? value : 0) * 100)));
  return {
    whole: Math.floor(cents / 100),
    tenths: Math.floor((cents % 100) / 10),
    hundredths: cents % 10,
  };
}

function formatMetersTrack(meters: number): string {
  if (meters === 1000) return '1 km';
  if (meters === 1600) return '1.6 km';
  if (Math.abs(meters - METERS_PER_MILE) < 0.01) return '1 mile';
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatPairedTrackDistance(meters: number, preference: UnitPreference): string {
  if (!isFinitePositive(meters)) return '--';
  const miles = meters / METERS_PER_MILE;
  const metricLabel = formatMetersTrack(meters);
  const imperialLabel = `${miles.toFixed(2)} mi`;
  if (preference === 'metric') return `${metricLabel} (${imperialLabel})`;
  return `${imperialLabel} (${metricLabel})`;
}

// ── Weight ────────────────────────────────────────────────────────────────

// Single canonical constant (kg -> lb), used both directions via division —
// same pattern as KM_PER_MILE above, so lb->kg->lb round-trips don't drift.
const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number | null {
  if (!isFiniteNumber(kg) || kg < 0) return null;
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number | null {
  if (!isFiniteNumber(lb) || lb < 0) return null;
  return lb / LB_PER_KG;
}

// ── Speed ─────────────────────────────────────────────────────────────────

export function mphToKmh(mph: number): number | null {
  if (!isFiniteNumber(mph) || mph < 0) return null;
  return mph * KM_PER_MILE;
}

export function kmhToMph(kmh: number): number | null {
  if (!isFiniteNumber(kmh) || kmh < 0) return null;
  return kmh / KM_PER_MILE;
}

// meters/second -> miles/hour
export function mpsToMph(mps: number): number | null {
  if (!isFiniteNumber(mps) || mps < 0) return null;
  return mps * 2.236936;
}

export function mphToMps(mph: number): number | null {
  if (!isFiniteNumber(mph) || mph < 0) return null;
  return mph / 2.236936;
}

// ── Pace <-> speed ────────────────────────────────────────────────────────
//
// Pace is seconds required to cover one distance unit (mile or km). Speed is
// distance units covered per hour. They are reciprocal via 3600 seconds/hr,
// so a single pair of helpers covers both mile and km as long as the speed
// and pace share the same distance unit.

// speed (unit/hr) -> pace (sec/unit). 0 speed has no defined pace.
export function speedToPaceSecPerUnit(speedPerHour: number): number | null {
  if (!isFinitePositive(speedPerHour)) return null;
  return 3600 / speedPerHour;
}

// pace (sec/unit) -> speed (unit/hr). 0 or negative pace has no defined speed.
export function paceToSpeedPerUnit(secPerUnit: number): number | null {
  if (!isFinitePositive(secPerUnit)) return null;
  return 3600 / secPerUnit;
}

// mph -> pace expressed as sec/mile
export function speedMphToPaceSecPerMile(mph: number): number | null {
  return speedToPaceSecPerUnit(mph);
}

// pace sec/mile -> mph
export function paceSecPerMileToSpeedMph(secPerMile: number): number | null {
  return paceToSpeedPerUnit(secPerMile);
}

// pace sec/mile -> pace sec/km
export function paceSecPerMileToSecPerKm(secPerMile: number): number | null {
  if (!isFinitePositive(secPerMile)) return null;
  return secPerMile / KM_PER_MILE;
}

// pace sec/km -> pace sec/mile
export function paceSecPerKmToSecPerMile(secPerKm: number): number | null {
  if (!isFinitePositive(secPerKm)) return null;
  return secPerKm * KM_PER_MILE;
}

// ── Formatting ────────────────────────────────────────────────────────────

// "m:ss" pace string. Invalid/zero input renders as '--:--' rather than throw.
export function formatPaceSec(secPerUnit: number | null | undefined): string {
  if (secPerUnit == null || !isFinitePositive(secPerUnit)) return '--:--';
  const totalSec = Math.round(secPerUnit);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSpeed(speedPerHour: number | null | undefined, digits = 1): string {
  if (speedPerHour == null || !isFiniteNumber(speedPerHour) || speedPerHour < 0) return '--';
  return speedPerHour.toFixed(digits);
}

export function formatDistance(distance: number | null | undefined, digits = 2): string {
  if (distance == null || !isFiniteNumber(distance) || distance < 0) return '--';
  return distance.toFixed(digits);
}
