export type CoachUsage = { used: number; limit: number; remaining: number; resetsAt: string;
  version?: 2; timezone?: string; pro?: boolean; purchasedRemaining?: number;
  purchasedExpiresAt?: string | null; packsEnabled?: boolean; canPurchase?: boolean; timezoneChangePending?: boolean; requestedTimezone?: string; timezoneFallback?: 'server_tzdata_outdated' };

export function parseCoachUsage(value: unknown): CoachUsage {
  const usage = (value as { usage?: CoachUsage } | null)?.usage;
  const midnight = usage && new Date(usage.resetsAt);
  const v2 = usage?.version === 2;
  if (!usage || !Number.isSafeInteger(usage.used) || usage.used < 0
    || !Number.isSafeInteger(usage.limit) || (v2 ? ![0, 20].includes(usage.limit) : usage.limit <= 0)
    || usage.remaining !== Math.max(0, usage.limit - usage.used)
    || typeof usage.resetsAt !== 'string' || !Number.isFinite(midnight?.getTime())
    || midnight?.toISOString() !== usage.resetsAt
    || (!v2 && (midnight?.getUTCHours() !== 0 || midnight?.getUTCMinutes() !== 0
      || midnight?.getUTCSeconds() !== 0 || midnight?.getUTCMilliseconds() !== 0))) throw new Error('Usage is temporarily unavailable.');
  if (v2) {
    if (usage.timezoneFallback !== undefined && (usage.timezoneFallback !== 'server_tzdata_outdated' || typeof usage.requestedTimezone !== 'string')) throw new Error('Usage is temporarily unavailable.');
    if (typeof usage.pro !== 'boolean' || usage.limit !== (usage.pro ? 20 : 0)
      || typeof usage.timezone !== 'string' || typeof usage.packsEnabled !== 'boolean' || typeof usage.canPurchase !== 'boolean'
      || (usage.canPurchase && (!usage.packsEnabled || usage.purchasedRemaining !== 0))
      || !Number.isSafeInteger(usage.purchasedRemaining) || usage.purchasedRemaining! < 0
      || (usage.purchasedExpiresAt !== null && (typeof usage.purchasedExpiresAt !== 'string'
        || !Number.isFinite(Date.parse(usage.purchasedExpiresAt))))
      || (usage.purchasedRemaining! > 0 && !usage.purchasedExpiresAt)) throw new Error('Usage is temporarily unavailable.');
    try { new Intl.DateTimeFormat('en-US', { timeZone: usage.timezone }); } catch { throw new Error('Usage is temporarily unavailable.'); }
  }
  return usage;
}

export function coachUsageLabel(usage: CoachUsage | null, now = Date.now()): string {
  if (!usage || Date.parse(usage.resetsAt) <= now) return 'Usage unavailable';
  return usage.version === 2 && !usage.pro ? `${usage.purchasedRemaining} purchased messages remaining`
    : `${usage.used} of ${usage.limit} messages used today`;
}

export function coachUsageExample(limit: number): string {
  const example = Math.min(3, limit);
  return `Example: send ${example} messages and you have ${limit - example} included messages left for that day.`;
}

export function canBuyCoachPack(usage: CoachUsage | null, now = Date.now()): boolean {
  return !!usage && usage.version === 2 && usage.packsEnabled === true && usage.canPurchase === true
    && Date.parse(usage.resetsAt) > now && usage.purchasedRemaining === 0;
}

export function coachLowBalanceNotices(usage: CoachUsage | null, now = Date.now()): { key: string; text: string }[] {
  if (!usage || Date.parse(usage.resetsAt) <= now) return [];
  const notices: { key: string; text: string }[] = [];
  if (usage.limit > 0 && usage.remaining > 0 && usage.remaining <= 5) notices.push({
    key: `included:${usage.resetsAt}`, text: `You have ${usage.remaining} included messages left today${usage.purchasedRemaining ? ` and ${usage.purchasedRemaining} purchased messages available` : ''}.`,
  });
  if ((usage.purchasedRemaining ?? 0) > 0 && usage.purchasedRemaining! <= 5) notices.push({
    key: `purchased:${usage.purchasedExpiresAt}`, text: `You have ${usage.purchasedRemaining} purchased messages left. Another pack becomes available when these are used up or expire.`,
  });
  return notices;
}
