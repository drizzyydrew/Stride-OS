import {
  shouldSpeakVoiceCue,
  type VoiceCueCategory,
  type VoiceCueMode,
  type VoiceCuePreferences,
} from './voiceCoaching';

export type VoiceDeliveryState =
  | 'played'
  | 'queued'
  | 'suppressed'
  | 'cooldown'
  | 'failed'
  | 'unavailable';

export type VoiceCuePlanInput = {
  text: string;
  category: VoiceCueCategory;
  mode: VoiceCueMode;
  preferences: VoiceCuePreferences;
  now: number;
  lastCategoryPlayedAt?: Partial<Record<VoiceCueCategory, number>>;
  platform?: string;
};

export type VoiceCuePlan = {
  state: VoiceDeliveryState;
  reason?: string;
  priority: number;
  cooldownSeconds: number;
};

export const VOICE_CATEGORY_PRIORITY: Record<VoiceCueCategory, number> = {
  interval: 100,
  runWalk: 95,
  navigation: 90,
  heartRate: 80,
  pace: 75,
  fueling: 70,
  hydration: 70,
  technique: 45,
  motivation: 35,
};

export const VOICE_CATEGORY_COOLDOWN_SECONDS: Record<VoiceCueCategory, number> = {
  interval: 5,
  runWalk: 5,
  navigation: 12,
  heartRate: 60,
  pace: 45,
  fueling: 60,
  hydration: 60,
  technique: 90,
  motivation: 120,
};

export function planVoiceCueDelivery(input: VoiceCuePlanInput): VoiceCuePlan {
  const normalized = input.text.trim();
  const priority = VOICE_CATEGORY_PRIORITY[input.category];
  const cooldownSeconds = VOICE_CATEGORY_COOLDOWN_SECONDS[input.category];
  if (!normalized) return { state: 'suppressed', reason: 'empty_text', priority, cooldownSeconds };
  if (input.platform === 'web') return { state: 'unavailable', reason: 'web_voice_unavailable', priority, cooldownSeconds };
  if (!shouldSpeakVoiceCue(input.mode, input.preferences, input.category)) {
    return { state: 'suppressed', reason: 'settings_disabled', priority, cooldownSeconds };
  }
  const last = input.lastCategoryPlayedAt?.[input.category];
  if (typeof last === 'number' && input.now - last < cooldownSeconds * 1000) {
    return { state: 'cooldown', reason: 'category_cooldown', priority, cooldownSeconds };
  }
  return { state: 'queued', priority, cooldownSeconds };
}
