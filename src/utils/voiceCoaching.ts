export type VoiceCueMode = 'silent' | 'minimal' | 'standard' | 'coach';
export type VoiceCueCategory =
  | 'interval'
  | 'pace'
  | 'heartRate'
  | 'runWalk'
  | 'motivation'
  | 'technique'
  | 'fueling'
  | 'hydration'
  | 'navigation';
export type VoiceCuePreferences = Record<VoiceCueCategory, boolean>;

const MINIMAL_CATEGORIES = new Set<VoiceCueCategory>([
  'interval',
  'runWalk',
  'fueling',
  'hydration',
  'navigation',
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

export type VoiceActivityContext =
  | 'running'
  | 'treadmill'
  | 'run_walk'
  | 'walking'
  | 'cycling'
  | 'indoor_cycling'
  | 'strength'
  | 'mobility'
  | 'other';

export function relevantVoiceCueCategories(context: VoiceActivityContext): VoiceCueCategory[] {
  const base: VoiceCueCategory[] = ['motivation', 'technique'];
  if (context === 'strength' || context === 'mobility') return base;
  if (context === 'cycling' || context === 'indoor_cycling') {
    return ['interval', 'heartRate', 'motivation', 'technique', 'fueling', 'hydration', 'navigation'];
  }
  if (context === 'walking') {
    return ['interval', 'heartRate', 'motivation', 'technique', 'fueling', 'hydration', 'navigation'];
  }
  if (context === 'run_walk') {
    return ['interval', 'heartRate', 'runWalk', 'motivation', 'technique', 'fueling', 'hydration', 'navigation'];
  }
  if (context === 'running' || context === 'treadmill') {
    return ['interval', 'pace', 'heartRate', 'runWalk', 'motivation', 'technique', 'fueling', 'hydration', 'navigation'];
  }
  return ['interval', ...base];
}
