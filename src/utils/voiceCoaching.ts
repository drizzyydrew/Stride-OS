export type VoiceCueMode = 'silent' | 'minimal' | 'standard' | 'coach';
export type VoiceCueCategory =
  | 'interval'
  | 'pace'
  | 'heartRate'
  | 'runWalk'
  | 'motivation'
  | 'technique'
  | 'fueling'
  | 'hydration';
export type VoiceCuePreferences = Record<VoiceCueCategory, boolean>;

const MINIMAL_CATEGORIES = new Set<VoiceCueCategory>([
  'interval',
  'runWalk',
  'fueling',
  'hydration',
]);

const STANDARD_CATEGORIES = new Set<VoiceCueCategory>([
  ...MINIMAL_CATEGORIES,
  'pace',
  'heartRate',
]);

export function shouldSpeakVoiceCue(
  mode: VoiceCueMode,
  preferences: VoiceCuePreferences,
  category: VoiceCueCategory,
): boolean {
  if (mode === 'silent' || !preferences[category]) return false;
  if (mode === 'minimal') return MINIMAL_CATEGORIES.has(category);
  if (mode === 'standard') return STANDARD_CATEGORIES.has(category);
  return true;
}
