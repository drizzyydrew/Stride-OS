import type { ScheduledSession } from './scheduledSessions';

export type ScheduleMoveLedgerEntry = {
  targetDate: string;
  movedAt: number;
  reason?: string;
  snapshot?: ScheduledSession;
};

export type ScheduleMoveLedger = Record<string, ScheduleMoveLedgerEntry | undefined>;

export function legacyOverridesToMoveLedger(
  dateOverrides: Record<string, string | undefined> | undefined,
  movedAt = 0,
): ScheduleMoveLedger {
  const ledger: ScheduleMoveLedger = {};
  for (const [scheduledSessionId, targetDate] of Object.entries(dateOverrides ?? {})) {
    if (!targetDate) continue;
    ledger[scheduledSessionId] = { targetDate, movedAt, reason: 'legacy_date_override' };
  }
  return ledger;
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function withMovedDate(session: ScheduledSession, targetDate: string): ScheduledSession {
  return {
    ...session,
    date: targetDate,
    originalDate: session.originalDate ?? session.date,
    status: session.status === 'completed' || session.status === 'skipped' ? session.status : 'moved',
  };
}

export function projectMoveLedgerForWeek(
  weekSessions: readonly ScheduledSession[],
  moveLedger: ScheduleMoveLedger,
  options: {
    planStartDate: string;
    planEndDate: string;
    lockedDates?: readonly string[];
  },
): ScheduledSession[] {
  const lockedDates = new Set(options.lockedDates ?? []);
  const ledgerEntries = Object.entries(moveLedger).filter((entry): entry is [string, ScheduleMoveLedgerEntry] => Boolean(entry[1]?.targetDate));
  if (ledgerEntries.length === 0) return [...weekSessions];

  const byId = new Map(weekSessions.map(session => [session.scheduledSessionId, session]));
  const movedOut = new Set<string>();
  const incoming: ScheduledSession[] = [];

  for (const [scheduledSessionId, entry] of ledgerEntries) {
    if (lockedDates.has(entry.targetDate)) continue;

    const source = byId.get(scheduledSessionId) ?? entry.snapshot;
    if (!source) continue;

    const sourceInWeek = byId.has(scheduledSessionId);
    const targetInWeek = inRange(entry.targetDate, options.planStartDate, options.planEndDate);

    if (sourceInWeek && source.date !== entry.targetDate) movedOut.add(scheduledSessionId);
    if (targetInWeek) incoming.push(withMovedDate(source, entry.targetDate));
  }

  const result: ScheduledSession[] = [];
  const seen = new Set<string>();
  for (const session of weekSessions) {
    if (movedOut.has(session.scheduledSessionId)) continue;
    if (seen.has(session.scheduledSessionId)) continue;
    seen.add(session.scheduledSessionId);
    result.push(session);
  }
  for (const session of incoming) {
    if (seen.has(session.scheduledSessionId)) continue;
    seen.add(session.scheduledSessionId);
    result.push(session);
  }

  return result.sort((a, b) =>
    a.date === b.date
      ? a.scheduledSessionId.localeCompare(b.scheduledSessionId)
      : a.date.localeCompare(b.date),
  );
}
