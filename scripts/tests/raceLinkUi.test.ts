import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { recordedRaceElapsedSeconds, resolveArchiveActivityResult, RACE_RESULT_OPTIONS } from '../../src/utils/raceLink';
import { formatRaceTime } from '../../src/utils/calibrationEngine';
import { formatDistance } from '../../src/lib/units';
import { todayDateOnly } from '../../src/utils/dateOnly';
import { parseRaceElapsedTime } from '../../src/utils/racePerformance';
import { formatArchivedCoverage } from '../../src/utils/goalArchiveCoverage';

function declared(file: string, name: string): string {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, visit); }
  visit(ast);
  assert.ok(found, name);
  return ts.transpile(`(${found.getText(ast).replace(/^export (?:default )?/, '')})`, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React });
}
const editor = 'src/components/activity/RaceLinkEditor.tsx';
function saveHarness(overrides: Record<string, unknown> = {}) {
  const calls: unknown[] = [], errors: string[] = [], messages: string[] = [];
  const context = {
    activity: { id: 'run%25opaque' }, event: { id: 'race-1' }, outcome: 'finished',
    timeEdited: false, useRecorded: true, recorded: 5000, time: '1:23:20', confirmDate: 'no', confirmReplacement: 'no',
    dateMismatch: false, needsReplacement: false, ownerUserId: 'owner-1', archive: { id: 'archive%opaque' },
    inFlight: { current: false }, alive: { current: true }, savedSnapshot: { current: '' }, snapshot: 'draft',
    setError: (value: string | null) => { if (value) errors.push(value); }, setMessage: (value: string | null) => { if (value) messages.push(value); }, setBusy: () => {},
    captureOwnerLease: () => ({ ownerUserId: 'owner-1' }), ownerLeaseIsCurrent: () => true,
    saveLink: async (input: unknown) => { calls.push(input); }, parseRaceElapsedTime, Error, ...overrides,
  };
  return { context, calls, errors, messages, save: runInNewContext(declared(editor, 'save'), context) as () => Promise<void> };
}

test('race-link UI uses recorded elapsed by omission and never patches recorded metrics', async () => {
  const h = saveHarness({ time: 'untrusted draft is ignored in recorded mode' });
  await h.save();
  const input = h.calls[0] as Record<string, unknown>;
  assert.equal(input.activityId, 'run%25opaque');
  assert.equal(input.archiveId, 'archive%opaque');
  assert.equal('elapsedTimeSeconds' in input, false);
  assert.equal('metrics' in input, false);
  assert.equal(h.messages.length, 1);
});

test('official elapsed entry is parsed separately from measured run timing', async () => {
  const h = saveHarness({ useRecorded: false, time: '1:23:45' });
  await h.save();
  assert.equal((h.calls[0] as { elapsedTimeSeconds: number }).elapsedTimeSeconds, 5025);
  const invalid = saveHarness({ useRecorded: false, time: '1:99:99' });
  await invalid.save();
  assert.equal(invalid.calls.length, 0);
  assert.match(invalid.errors[0], /positive elapsed/);
});

test('mismatched date and replacement each require their own explicit confirmation', async () => {
  for (const override of [{ dateMismatch: true }, { needsReplacement: true }, { dateMismatch: true, needsReplacement: true, confirmDate: 'yes' }]) {
    const h = saveHarness(override);
    await h.save();
    assert.equal(h.calls.length, 0);
    assert.equal(h.errors.length, 1);
  }
  const h = saveHarness({ dateMismatch: true, needsReplacement: true, confirmDate: 'yes', confirmReplacement: 'yes' });
  await h.save();
  assert.equal(h.calls.length, 1);
  assert.equal((h.calls[0] as { confirmDateMismatch: boolean }).confirmDateMismatch, true);
  assert.equal((h.calls[0] as { replaceExisting: boolean }).replaceExisting, true);
});

test('wrong owner, absent selection, and absent elapsed never call save', async () => {
  for (const override of [{ captureOwnerLease: () => ({ ownerUserId: 'owner-2' }) }, { activity: undefined }, { event: undefined }, { recorded: null }]) {
    const h = saveHarness(override);
    await h.save();
    assert.equal(h.calls.length, 0);
    assert.equal(h.messages.length, 0);
  }
});

test('save waits for durable service completion, prevents duplicate submission and preserves failed draft', async () => {
  let release!: () => void;
  let calls = 0;
  const h = saveHarness({ saveLink: async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); throw new Error('Disk write not confirmed'); } });
  const pending = h.save();
  await h.save();
  assert.equal(calls, 1);
  assert.equal(h.messages.length, 0);
  assert.equal(h.context.inFlight.current, true);
  release(); await pending;
  assert.equal(h.context.inFlight.current, false);
  assert.equal(h.context.time, '1:23:20');
  assert.equal(h.context.savedSnapshot.current, '');
  assert.match(h.errors[0], /Disk write not confirmed/);
});

test('owner changes during a save cannot produce a success message', async () => {
  let current = true;
  const h = saveHarness({ ownerLeaseIsCurrent: () => current, saveLink: async () => { current = false; } });
  await h.save();
  assert.equal(h.messages.length, 0);
  assert.match(h.errors[0], /account changed/);
});

test('Back preserves an unsaved draft and blocks leaving during persistence', () => {
  let closed = 0;
  let actions: { text: string; onPress?: () => void }[] = [];
  const context = { inFlight: { current: false }, dirty: true, onClose: () => closed++, Alert: { alert: (_title: string, _message: string, next: typeof actions) => { actions = next ?? []; } } };
  const close = runInNewContext(declared(editor, 'close'), context) as () => void;
  close();
  assert.equal(closed, 0);
  assert.equal(actions[0].text, 'Keep editing');
  actions.find(action => action.text === 'Leave')!.onPress!();
  assert.equal(closed, 1);
  context.inFlight.current = true;
  close();
  assert.equal(closed, 1);
});

test('Calendar sends exact race and opaque archive identity before generic activity routes', () => {
  const pushes: unknown[] = [];
  const handler = runInNewContext(declared('app/(tabs)/calendar/index.tsx', 'handleEntryPress'), {
    router: { push: (value: unknown) => pushes.push(value) },
  }) as (entry: unknown, date: string, today: boolean) => void;
  handler({ type: 'race', raceId: 'race%opaque', raceArchiveKey: 'v1_0061', completedActivityId: 'run-1' }, '2026-11-11', false);
  const route = pushes[0] as { pathname: string; params: { raceId: string; archiveKey: string } };
  assert.equal(route.pathname, '/(tabs)/activity/link-race');
  assert.equal(route.params.raceId, 'race%opaque');
  assert.equal(route.params.archiveKey, 'v1_0061');
});


test('opening an automatic result preserves recorded timing only when its trusted elapsed matches', () => {
  const select = runInNewContext(declared(editor, 'usesRecordedRaceTime'), {}) as (activity: unknown, recorded: number | null) => boolean;
  assert.equal(select({ raceResult: { timingSource: 'recorded_elapsed', elapsedTimeSeconds: 5000 } }, 5000), true);
  assert.equal(select({ raceResult: { timingSource: 'recorded_elapsed', elapsedTimeSeconds: 4900 } }, 5000), false);
  assert.equal(select({ raceResult: { timingSource: 'user_entered', elapsedTimeSeconds: 5000 } }, 5000), false);
  assert.equal(select({}, 5000), true);
  assert.equal(select({}, null), false);
});

test('an untouched automatic result with changed elapsed cannot become an entered official time', async () => {
  const h = saveHarness({ activity: { id: 'run-1', raceResult: { timingSource: 'recorded_elapsed', elapsedTimeSeconds: 4900 } }, useRecorded: false, timeEdited: false });
  await h.save();
  assert.equal(h.calls.length, 0);
  assert.match(h.errors[0], /recorded elapsed time has changed/);
});


type Element = { type: unknown; props: Record<string, any>; children: any[] };
const ReactFixture = { createElement: (type: unknown, props: Record<string, any> | null, ...children: any[]): Element => ({ type, props: props ?? {}, children }) };
function elements(tree: Element): Element[] { return [tree, ...tree.children.flat(Infinity).filter(child => child && typeof child === 'object' && 'type' in child).flatMap(elements)]; }

test('existing Activity race snapshot wins over a later catalog edit, including saved-run selection', () => {
  const event = { id: 'race-1', name: 'Original race', date: '2026-11-10', distance: '10k', distanceMeters: 10000 };
  const edited = { ...event, name: 'Edited plan name', date: '2026-11-11', distance: '5k', distanceMeters: 5000 };
  const activity = { id: 'run-1', activityType: 'running', startTime: Date.now() - 5000000, endTime: Date.now() - 1000000, metrics: {}, raceLink: { ownerUserId: 'owner-1', event, outcome: 'finished' } };
  for (const selectedAfterMount of [false, true]) {
    let hook = 0;
    const context = { React: ReactFixture, useColors: () => ({}), useRef: (current: unknown) => ({ current }), useEffect: () => {}, useFixedBackAction: () => true,
      useState: (value: unknown) => { const at = hook++; return [selectedAfterMount && at === 0 ? 'run-1' : selectedAfterMount && at === 1 ? 'race-1' : value, () => {}]; },
      usesRecordedRaceTime: () => false, recordedRaceElapsedSeconds, formatRaceTime, todayDateOnly, formatDistance, goalDate: (value: string) => value,
      View: 'View', Text: 'Text', GoalMessage: 'GoalMessage', GoalPicker: 'GoalPicker', GoalField: 'GoalField', GoalAction: 'GoalAction', GoalDisclosure: 'GoalDisclosure', RaceEventPicker: 'RaceEventPicker', OUTCOMES: [], CONFIRM: [],
    };
    const render = runInNewContext(declared(editor, 'RaceLinkEditor'), context);
    const tree = render({ ownerUserId: 'owner-1', units: 'imperial', events: [edited], activities: [activity], archives: [], initialActivityId: selectedAfterMount ? undefined : 'run-1', onClose() {} });
    const picker = elements(tree).find(node => node.type === 'RaceEventPicker')!;
    assert.equal(picker.props.events[0].name, 'Original race');
    assert.equal(picker.props.events[0].distanceMeters, 10000);
  }
});

test('an archive derived from its linked Activity shows link actions rather than a conflicting manual form', () => {
  const race = { id: 'race-1', name: 'Race', date: '2026-11-10', distance: '10k', priority: 'A' };
  const archive = { id: 'archive-1', ownerUserId: 'owner-1', athleteId: 'athlete_default', title: 'Race', startDate: '2026-10-01', endDate: '2026-11-10', archivedAt: Date.now(), kind: 'race', race, result: { status: 'unrecorded', source: 'race_record' }, summary: { coverage: { distanceActivities: 0, durationActivities: 0 }, weeks: [], activityIds: [] } };
  const activity = { id: 'run-1', activityType: 'running', status: 'completed', startTime: Date.now() - 3600000, metrics: {}, raceLink: { ownerUserId: 'owner-1', athleteId: 'athlete_default', event: { ...race, distanceMeters: 10000 }, outcome: 'finished', linkedAt: Date.now() }, raceResult: { kind: 'race', distanceKey: '10k', distanceMeters: 10000, elapsedTimeSeconds: 3600 } };
  const store = Object.assign((select: (state: unknown) => unknown) => select({ activities: [activity], hydrationStatus: 'ready' }), { getState: () => ({ activities: [activity] }) });
  const context = { React: ReactFixture, useColors: () => ({}), useRouter: () => ({}), useActivityStore: store, useSettingsStore: (select: any) => select({ units: 'imperial' }), useGoalArchiveStore: (select: any) => select({ saveResult() {} }),
    useState: (value: unknown) => [typeof value === 'function' ? (value as () => unknown)() : value, () => {}], useRef: (current: unknown) => ({ current }),
    resolveArchiveActivityResult, formatArchivedCoverage, RESULTS: RACE_RESULT_OPTIONS, elapsed: (value: unknown) => String(value), goalDate: (value: string) => value,
    View: 'View', Text: 'Text', GoalMessage: 'GoalMessage', GoalPicker: 'GoalPicker', GoalField: 'GoalField', GoalAction: 'GoalAction', GoalDisclosure: 'GoalDisclosure',
  };
  const render = runInNewContext(declared('app/(tabs)/settings/goal-archive-detail.tsx', 'ArchiveBody'), context);
  const tree = render({ archive });
  const actions = elements(tree).filter(node => node.type === 'GoalAction').map(node => node.props.label);
  assert.equal(actions.includes('Open linked run'), true);
  assert.equal(actions.includes('Edit race link'), true);
  assert.equal(actions.includes('Save race result'), false);
  assert.equal(elements(tree).some(node => node.type === 'GoalPicker'), false);
});

test('actual race-selection effects take precedence over a selected custom workout and leave active recording alone', () => {
  const source = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const ast = ts.createSourceFile('running.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const effects: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes('setPendingMode(')
      && node.arguments[0]?.getText(ast).includes('raceParams')) effects.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(effects.length, 2);
  const script = ts.transpile(effects.map(effect => effect.getText(ast)).join(';\n'), { target: ts.ScriptTarget.ES2022 });
  const event = { id: 'race-1', name: 'Chosen calendar race' };
  for (const scenario of [
    { raceId: 'race-1', isActive: false, modes: ['race'] },
    { raceId: undefined, isActive: false, modes: ['workout'] },
    { raceId: 'race-1', isActive: true, modes: [] },
  ]) {
    const modes: string[] = [], selected: unknown[] = [];
    runInNewContext(script, {
      useEffect: (callback: () => void) => callback(), isActive: scenario.isActive,
      raceParams: { raceId: scenario.raceId }, raceEvents: [event], selectedRaceParam: { current: null },
      selectedCustomWorkout: { id: 'builder-today' }, setPendingMode: (mode: string) => modes.push(mode),
      setPendingRaceEvent: (value: unknown) => selected.push(value),
    });
    assert.deepEqual(modes, scenario.modes);
    if (scenario.raceId && !scenario.isActive) assert.equal(selected[0], event);
    else assert.equal(selected.length, 0);
  }
});
