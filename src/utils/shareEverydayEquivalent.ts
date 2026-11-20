import type { Activity } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import { activityPowerPresentation } from './activityPowerPresentation';
import { energyReferencePool, equivalentRuntimeSeconds, formatEquivalentTime, formatPowerRatio, pickPowerReference, powerReferencePool } from './powerEquivalents';

export type StoryIllustration = 'none' | 'route' | 'everyday';
export type EverydayShareEquivalent = {
  referenceId: string;
  quantity: 'climbing' | 'metabolic' | 'power';
  comparison: string;
  sourceLabel: string;
  caveat: string;
  accessibilityLabel: string;
};

// A stable illustration keeps the preview and captured canvas identical. It is
// only a reference choice, never a seed for fabricated workout measurements.
function activityReferenceDraw(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function shareEverydayEquivalent(activity: Activity | undefined, units: UnitSystem): EverydayShareEquivalent | null {
  if (!activity) return null;
  // Use only the same validated, saved quantities as the activity detail. No
  // profile lookup, persistence, calories conversion, or new model calculation.
  const result = activityPowerPresentation(activity, units);
  if (!result || result.value == null || !Number.isFinite(result.value) || result.value <= 0) return null;
  const value = result.value;
  const pool = result.quantity === 'climbing' ? energyReferencePool() : powerReferencePool(value);
  if (!pool.length) return null;
  // The narrow combined Story uses the same font for the amount and appliance.
  // Prefer one concise appliance rather than shrinking or clipping its name.
  const concise = pool.filter(item => item.parts.length === 1 && item.label.length <= 26);
  const fallback = energyReferencePool().filter(item => item.watts <= value && item.label.length <= 26);
  const reference = pickPowerReference(concise.length ? concise : fallback.length ? fallback : pool, activityReferenceDraw(activity.id));
  if (!reference) return null;
  let comparison: string;
  let caveat: string;
  let spoken: string;
  if (result.quantity === 'climbing') {
    const seconds = equivalentRuntimeSeconds(value, reference.watts);
    if (seconds == null) return null;
    comparison = `About ${formatEquivalentTime(seconds)}\n${reference.label}`;
    caveat = 'Uphill energy only. No electricity generated.';
    spoken = `Energy equivalent of running ${reference.label} for about ${formatEquivalentTime(seconds)}.`;
  } else {
    comparison = `About ${formatPowerRatio(value, reference.watts)}×\n${reference.label}`;
    caveat = result.quantity === 'metabolic' ? 'Metabolic power comparison, not electrical output.' : 'Reference power draw, not electrical output.';
    spoken = `About ${formatPowerRatio(value, reference.watts)} times the reference power draw of ${reference.label}.`;
  }
  return { referenceId: reference.id, quantity: result.quantity, comparison,
    sourceLabel: result.label, caveat,
    accessibilityLabel: `${result.label}. ${spoken} ${caveat}` };
}

export function availableStoryIllustration(selection: StoryIllustration, story: boolean, route: boolean, everyday: boolean): StoryIllustration {
  if (!story) return 'none';
  return selection === 'route' && route || selection === 'everyday' && everyday ? selection : 'none';
}

export function selectAllStoryIllustration(current: StoryIllustration, route: boolean, everyday: boolean): StoryIllustration {
  const available = availableStoryIllustration(current, true, route, everyday);
  // Keep a deliberate choice. Otherwise prefer the non-location illustration.
  return available !== 'none' ? available : everyday ? 'everyday' : route ? 'route' : 'none';
}
