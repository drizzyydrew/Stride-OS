import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness(action = 'rebuild_week') {
  const filename = 'app/(tabs)/training/adapt.tsx';
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AdaptMyWeekScreen') as ts.FunctionDeclaration;
  const preview = screen.body!.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'preview')!;
  const js = ts.transpileModule(preview.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let owner = 'a', athlete = 'athlete_default', revision = 1, activities: object[] = [], confirmed = {};
  let reads = 0, writes = 0, generations = 0;
  const messages: string[] = [];
  const previewContext = { current: 'original' };
  const context = {
    action, session: { scheduledSessionId: 's1', date: '2026-11-16' },
    captureOwnerLease: () => ({ ownerUserId: owner }), ownerLeaseIsCurrent: (lease: any) => lease.ownerUserId === owner,
    useProfileStore: { getState: () => ({ activeAthleteId: athlete }) },
    useTrainingPlanStore: { getState: () => ({ revision }) },
    useActivityStore: { getState: () => ({ activities }) },
    useAdaptationStore: { getState: () => ({ confirmed }) }, previewContext,
    requireProAccess: async () => { reads++; await pending; },
    Alert: { alert: (_title: string, message: string) => { messages.push(message); } },
    scheduled: { weekSessions: [{ scheduledSessionId: 's1', date: '2026-11-16', title: 'Easy run', subtype: 'easy' }], canonicalWeekSessions: [] },
    weekPlan: { weekStartDate: new Date('2026-11-15T12:00:00'), metadata: { startsOn: '2026-11-15' } },
    selectedMoveDate: null, availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], weekKey: 'week:2026-11-15', reason: 'schedule_conflict',
    toYMD: (date: Date) => date.toISOString().slice(0, 10),
    addCalendarDays: (date: Date, count: number) => new Date(date.getTime() + count * 86_400_000),
    createAdaptationPreview: () => { generations++; return { overlays: [] }; },
    setPreview: () => { writes++; }, Date,
  };
  const run = vm.runInNewContext(`${js}\npreview`, context);
  return { run, release, messages, counts: () => ({ reads, writes, generations }),
    change: (kind: string) => {
      if (kind === 'owner') owner = 'b';
      if (kind === 'athlete') athlete = 'athlete_secondary';
      if (kind === 'screen') previewContext.current = 'different-session';
      if (kind === 'plan') revision++;
      if (kind === 'activity') activities = [{}];
      if (kind === 'adaptation') confirmed = { another: {} };
    } };
}

for (const kind of ['owner', 'athlete', 'screen', 'plan', 'activity', 'adaptation']) {
  test(`automatic week rebuild rejects stale ${kind} context after membership read`, async () => {
    const h = harness(); const pending = h.run();
    h.change(kind); h.release(); await pending;
    assert.equal(h.counts().generations, 0);
    assert.equal(h.counts().writes, 0);
    assert.match(h.messages[0], /changed/);
  });
}

test('an unchanged verified rebuild context can generate a preview', async () => {
  const h = harness(); const pending = h.run(); h.release(); await pending;
  assert.deepEqual(h.counts(), { reads: 1, generations: 1, writes: 1 });
  assert.equal(h.messages.length, 0);
});

test('rest does not contact billing and can still create its safety preview', async () => {
  const h = harness('rest'); await h.run();
  assert.deepEqual(h.counts(), { reads: 0, generations: 1, writes: 1 });
});
