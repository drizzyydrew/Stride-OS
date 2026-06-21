import type { UnitSystem } from '../store/settingsStore';

const MI_PER_KM   = 0.621371;
const KM_PER_MI   = 1.60934;
const LB_PER_KG   = 2.20462;
const INCHES_PER_CM = 0.393701;

// Distance: internal = miles
export function formatDistance(miles: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${(miles * KM_PER_MI).toFixed(1)} km`;
  }
  return `${miles.toFixed(1)} mi`;
}

// Pace: internal = seconds per mile
export function formatPaceSecPerMile(secPerMile: number, units: UnitSystem): string {
  if (secPerMile <= 0) return '—';
  let secPerUnit = secPerMile;
  let suffix = '/mi';
  if (units === 'metric') {
    secPerUnit = secPerMile * MI_PER_KM;
    suffix = '/km';
  }
  const min = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  return `${min}:${String(sec).padStart(2, '0')} ${suffix}`;
}

// Weight: internal = kg
export function formatWeightKg(kg: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${Math.round(kg)} kg`;
  }
  return `${Math.round(kg * LB_PER_KG)} lb`;
}

// Height: internal = cm
export function formatHeightCm(cm: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${Math.round(cm)} cm`;
  }
  const totalInches = cm * INCHES_PER_CM;
  const feet        = Math.floor(totalInches / 12);
  const inches      = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

// Speed: internal = meters per second
export function formatSpeedMps(mps: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${(mps * 3.6).toFixed(1)} km/h`;
  }
  return `${(mps * 2.23694).toFixed(1)} mph`;
}

// Weight for gym exercises: internal stored in lbs (user-entered)
export function formatExerciseWeightLb(lb: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${Math.round(lb / LB_PER_KG)} kg`;
  }
  return `${lb} lb`;
}

// Convert lb input to the display-unit label
export function weightUnitLabel(units: UnitSystem): string {
  return units === 'metric' ? 'kg' : 'lb';
}

// Convert a display weight back to lb for internal storage
export function displayWeightToLb(value: number, units: UnitSystem): number {
  if (units === 'metric') return value * LB_PER_KG;
  return value;
}

// Convert lb to display weight
export function lbToDisplayWeight(lb: number, units: UnitSystem): number {
  if (units === 'metric') return Math.round(lb / LB_PER_KG);
  return lb;
}

// Distance unit label shorthand
export function distanceUnitLabel(units: UnitSystem): string {
  return units === 'metric' ? 'km' : 'mi';
}
