export type CoachUsage = { used: number; limit: number; remaining: number; resetsAt: string };

export function parseCoachUsage(value: unknown): CoachUsage {
  const usage = (value as { usage?: CoachUsage } | null)?.usage;
  const midnight = usage && new Date(usage.resetsAt);
  if (!usage || !Number.isSafeInteger(usage.used) || usage.used < 0
    || !Number.isSafeInteger(usage.limit) || usage.limit <= 0
    || usage.remaining !== Math.max(0, usage.limit - usage.used)
    || typeof usage.resetsAt !== 'string' || !Number.isFinite(midnight?.getTime())
    || midnight?.toISOString() !== usage.resetsAt || midnight?.getUTCHours() !== 0
    || midnight?.getUTCMinutes() !== 0 || midnight?.getUTCSeconds() !== 0
    || midnight?.getUTCMilliseconds() !== 0) throw new Error('Usage is temporarily unavailable.');
  return usage;
}

export function coachUsageLabel(usage: CoachUsage | null, now = Date.now()): string {
  if (!usage || Date.parse(usage.resetsAt) <= now) return 'Usage unavailable';
  return `${usage.used} of ${usage.limit} requests used today`;
}

export function coachUsageExample(limit: number): string {
  const example = Math.min(3, limit);
  return `Example: send ${example} messages and you have used ${example} requests, leaving ${limit - example} for that day.`;
}
