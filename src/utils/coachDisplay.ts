const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;

export function sanitizeCoachDisplayText(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(EMOJI_PATTERN, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
