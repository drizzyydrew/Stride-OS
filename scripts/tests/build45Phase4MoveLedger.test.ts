import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  legacyOverridesToMoveLedger,
  projectMoveLedgerForWeek,
} from '../../src/utils/scheduleMoveLedger';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

const read = (path: string) => readFileSync(path, 'utf8');

function session(overrides: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    scheduledSessionId: overrides.scheduledSessionId ?? 'week:2026-08-03:run:easy_run:1',
    date: overrides.date ?? '2026-08-03',
    originalDate: overrides.originalDate ?? overrides.date ?? '2026-08-03',
    activityType: overrides.activityType ?? 'run',
    subtype: overrides.subtype ?? 'easy_run',
    title: overrides.title ?? 'Easy Aerobic Run',
    purpose: overrides.purpose ?? 'Aerobic base.',
    priority: overrides.priority ?? 'primary',
    durationMinutes: overrides.durationMinutes ?? 30,
    target: overrides.target ?? 'Easy',
    status: overrides.status ?? 'upcoming',
    ...overrides,
  };
}

test('legacy date overrides migrate losslessly into the v2 move ledger shape', () => {
  assert.deepEqual(legacyOverridesToMoveLedger({ a: '2026-08-04', b: undefined }, 123), {
    a: { targetDate: '2026-08-04', movedAt: 123, reason: 'legacy_date_override' },
  });
  const storeSource = read('src/store/scheduledSessionSelectionStore.ts');
  assert.match(storeSource, /SCHEDULED_SESSION_SELECTION_VERSION\s*=\s*2/);
  assert.match(storeSource, /legacyOverridesToMoveLedger\(state\.dateOverrides\)/);
});

test('move ledger projects same-week moves once without changing scheduled-session identity', () => {
  const moved = session({ scheduledSessionId: 'move-me', date: '2026-08-03', originalDate: '2026-08-03' });
  const stable = session({ scheduledSessionId: 'stay', date: '2026-08-05', originalDate: '2026-08-05' });
  const projected = projectMoveLedgerForWeek([moved, stable], {
    'move-me': { targetDate: '2026-08-06', movedAt: 1, snapshot: moved },
  }, { planStartDate: '2026-08-02', planEndDate: '2026-08-08' });
  assert.equal(projected.filter(item => item.scheduledSessionId === 'move-me').length, 1);
  const movedProjected = projected.find(item => item.scheduledSessionId === 'move-me');
  assert.equal(movedProjected?.date, '2026-08-06');
  assert.equal(movedProjected?.originalDate, '2026-08-03');
  assert.equal(movedProjected?.status, 'moved');
});

test('move ledger hides moved-out sessions and injects moved-in snapshots safely', () => {
  const movedOut = session({ scheduledSessionId: 'out', date: '2026-08-03' });
  const incomingSnapshot = session({ scheduledSessionId: 'in', date: '2026-07-31', originalDate: '2026-07-31', title: 'Incoming Long Run' });
  const projected = projectMoveLedgerForWeek([movedOut], {
    out: { targetDate: '2026-08-10', movedAt: 1, snapshot: movedOut },
    in: { targetDate: '2026-08-04', movedAt: 1, snapshot: incomingSnapshot },
  }, { planStartDate: '2026-08-02', planEndDate: '2026-08-08' });
  assert.equal(projected.some(item => item.scheduledSessionId === 'out'), false);
  const incoming = projected.find(item => item.scheduledSessionId === 'in');
  assert.equal(incoming?.date, '2026-08-04');
  assert.equal(incoming?.originalDate, '2026-07-31');
  assert.equal(incoming?.title, 'Incoming Long Run');
});

test('move ledger does not fabricate unknown cross-week sessions or inject onto locked days', () => {
  const stable = session({ scheduledSessionId: 'stable', date: '2026-08-03' });
  const lockedSnapshot = session({ scheduledSessionId: 'locked', date: '2026-07-31' });
  const projected = projectMoveLedgerForWeek([stable], {
    unknown: { targetDate: '2026-08-04', movedAt: 1 },
    locked: { targetDate: '2026-08-05', movedAt: 1, snapshot: lockedSnapshot },
  }, { planStartDate: '2026-08-02', planEndDate: '2026-08-08', lockedDates: ['2026-08-05'] });
  assert.deepEqual(projected.map(item => item.scheduledSessionId), ['stable']);
});

test('useScheduledSessions consumes the v2 move ledger projection helper', () => {
  const hookSource = read('src/hooks/useScheduledSessions.ts');
  assert.match(hookSource, /projectMoveLedgerForWeek/);
  assert.match(hookSource, /moveLedger/);
});
