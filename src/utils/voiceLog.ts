export const VOICE_LOG_CAP = 40;

export function trimVoiceLogEntries<T>(entries: readonly T[], cap = VOICE_LOG_CAP): T[] {
  return entries.slice(0, Math.max(0, cap));
}
