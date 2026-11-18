// Must match consume_stride_coach_allowance in the database. The contract test
// checks the migration so a future allowance change cannot silently drift.
export const COACH_DAILY_LIMIT = 20;

export async function readCoachAllowance(
  owner: string,
  readCount: (owner: string, day: string) => Promise<number | null>,
  now = new Date(),
) {
  const day = now.toISOString().slice(0, 10);
  const resetsAt = new Date(`${day}T00:00:00.000Z`);
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
  const count = await readCount(owner, day);
  const used = count === null ? 0 : count;
  if (!Number.isSafeInteger(used) || used < 0) throw new Error('Usage unavailable');
  return { used, limit: COACH_DAILY_LIMIT, remaining: Math.max(0, COACH_DAILY_LIMIT - used), resetsAt: resetsAt.toISOString() };
}
