import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { recordedRaceElapsedSeconds, RACE_RESULT_OPTIONS } from '../../src/utils/raceLink';
import { formatRaceTime } from '../../src/utils/calibrationEngine';
import { todayDateOnly } from '../../src/utils/dateOnly';
import { formatDistance } from '../../src/lib/units';
import { goalArchiveLink } from '../../src/utils/goal-archive-link';

type Node = { type: unknown; props: Record<string, any>; children: any[] };
const React = { createElement: (type: unknown, props: Record<string, any> | null, ...children: any[]): Node => ({ type, props: props ?? {}, children: children.flat(Infinity) }) };
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, visit); }
  visit(ast); assert.ok(found);
  return ts.transpile(`(${found.getText(ast).replace(/^export (?:default )?/, '')})`, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React });
}
function nodes(root: Node, closed = true): Node[] {
  return [root, ...(closed && root.type === 'GoalDisclosure' ? [] : root.children.filter(child => child && typeof child === 'object' && 'children' in child).flatMap(child => nodes(child, closed)))];
}
const componentMocks = Object.fromEntries(['View', 'Text', 'Host', 'Switch', 'IdentityField', 'GoalAction', 'GoalDisclosure', 'GoalMessage', 'GoalPicker', 'GoalField', 'GoalBackupStatus', 'RaceEventPicker', 'Collapsible', 'RNHostView'].map(name => [name, name]));
const base = { React, ...componentMocks, useColors: () => ({}), useThemeMode: () => 'dark', useEffect: () => {}, useRef: (current: unknown) => ({ current }), useState: (value: unknown) => [typeof value === 'function' ? (value as () => unknown)() : value, () => {}] };
const goalFile = 'src/components/goals/GoalLifecycleCard.tsx';

test('archived lifecycle card keeps primary result visible and secondary navigation/benign backup under closed options', () => {
  const destinations: unknown[] = [];
  const render = runInNewContext(sourceFunction(goalFile, 'GoalLifecycleCard'), { ...base, goalArchiveLink, useRouter: () => ({ push: (route: unknown) => destinations.push(route) }),
    useGoalLifecycle: () => ({ isDefaultAthlete: true, status: 'ready', pendingArchive: { id: 'archive-1', title: 'First half marathon' }, archives: [{}], syncStatus: 'synced' }),
  });
  const tree = render(), visible = nodes(tree);
  assert.deepEqual(visible.filter(node => node.type === 'GoalAction').map(node => node.props.label), ['View results']);
  assert.equal(visible.some(node => node.type === 'GoalBackupStatus'), false);
  const options = visible.find(node => node.type === 'GoalDisclosure')!;
  assert.equal(options.props.label, 'Training options');
  const secondary = nodes(options, false);
  assert.deepEqual(secondary.filter(node => node.type === 'GoalAction').map(node => node.props.label), ['Choose a new goal', 'Keep training without a plan', 'Training archive']);
  assert.equal(secondary.find(node => node.type === 'GoalBackupStatus')!.props.status, 'synced');
  secondary.find(node => node.props.label === 'Choose a new goal')!.props.onPress();
  assert.equal(destinations[0], '/(tabs)/settings/next-goal');
});

test('lifecycle errors and Retry stay outside disclosure, including backup errors', () => {
  let retries = 0;
  for (const runtimeError of [true, false]) {
    const render = runInNewContext(sourceFunction(goalFile, 'GoalLifecycleCard'), { ...base, goalArchiveLink, useRouter: () => ({}),
      useGoalLifecycle: () => ({ isDefaultAthlete: true, status: runtimeError ? 'error' : 'ready', error: 'Saved training unavailable', pendingArchive: null, mode: 'open', archives: [{}], syncStatus: 'error', retry: () => retries++ }),
    });
    const visible = nodes(render());
    if (runtimeError) {
      const retry = visible.find(node => node.props.label === 'Retry')!;
      assert.ok(retry); retry.props.onPress();
      assert.equal(visible.some(node => node.type === 'GoalMessage' && node.props.error), true);
    } else assert.equal(visible.find(node => node.type === 'GoalBackupStatus')!.props.status, 'error');
  }
  assert.equal(retries, 1);
});

test('profile fields and privacy switches remain visible while explanatory history/local details are disclosed', () => {
  const changes: unknown[] = [];
  const render = runInNewContext(sourceFunction('src/components/profile/profile-identity-fields.tsx', 'ProfileIdentityFields'), { ...base, s: { copy: {} } });
  const tree = render({ draft: { firstName: 'A', lastName: 'B', username: 'runner', showName: false, showUsername: true }, onChange: (patch: unknown) => changes.push(patch), disabled: false });
  const visible = nodes(tree);
  assert.deepEqual(visible.filter(node => node.type === 'IdentityField').map(node => node.props.label), ['First name', 'Last name', 'Username']);
  const switches = visible.filter(node => node.type === 'Switch');
  assert.deepEqual(switches.map(node => node.props.label), ['Show my name', 'Show my username']);
  switches[0].props.onValueChange(true);
  assert.equal((changes[0] as { showName: boolean }).showName, true);
  const visibleCopy = visible.filter(node => node.type === 'Text').flatMap(node => node.children).join(' ');
  assert.match(visibleCopy, /display alias.*email/);
  assert.doesNotMatch(visibleCopy, /earlier messages|availability/);
  const info = visible.find(node => node.type === 'GoalDisclosure')!;
  assert.equal(info.props.label, 'About profile visibility');
  assert.match(nodes(info, false).flatMap(node => node.children).join(' '), /earlier messages/);
});

test('actual disclosure starts closed and reveals its original child actions through the existing native callback', () => {
  let open = false;
  const originalAction = React.createElement('GoalAction', { label: 'Training archive', onPress() {} });
  const render = runInNewContext(sourceFunction(goalFile, 'GoalDisclosure'), { ...base, process: { env: { EXPO_OS: 'ios' } }, useWindowDimensions: () => ({ fontScale: 1.35 }), useState: () => [open, (value: boolean) => { open = value; }] });
  const props = { label: 'Training options', children: originalAction };
  let tree = render(props);
  assert.equal(nodes(tree, false).some(node => node.type === 'GoalAction'), false);
  nodes(tree, false).find(node => node.type === 'Collapsible')!.props.onOpenChange(true);
  tree = render(props);
  assert.equal(nodes(tree, false).find(node => node.type === 'GoalAction'), originalAction);
});

test('race form shows reset only after entered-time editing and keeps unlink inside More options', () => {
  const event = { id: 'event-1', name: 'Race', date: todayDateOnly(), distance: '5k', distanceMeters: 5000 };
  const start = Date.now() - 7200000, end = start + 3600000;
  const activity = { id: 'run-1', activityType: 'running', status: 'completed', startTime: start, endTime: end,
    metrics: { distanceMeters: 5000, elapsedTimeSeconds: 3600, elapsedTimeSource: 'recorded_wall_clock' },
    raceLink: { ownerUserId: 'owner-1', event, outcome: 'finished' },
    raceResult: { elapsedTimeSeconds: 3600, timingSource: 'recorded_elapsed' } };
  const state: any[] = []; let cursor = 0;
  const context = { ...base, recordedRaceElapsedSeconds, formatRaceTime, todayDateOnly, formatDistance, goalDate: (value: string) => value,
    useFixedBackAction: () => true, OUTCOMES: RACE_RESULT_OPTIONS.filter(option => option.value !== 'did_not_start'), CONFIRM: [],
    useState: (value: unknown) => { const at = cursor++; if (!(at in state)) state[at] = typeof value === 'function' ? (value as () => unknown)() : value; return [state[at], (next: unknown) => { state[at] = next; }]; },
    useRef: (value: unknown) => { const at = cursor++; return state[at] ??= { current: value }; },
  };
  const useRecordedFn = sourceFunction('src/components/activity/RaceLinkEditor.tsx', 'usesRecordedRaceTime');
  const render = runInNewContext(sourceFunction('src/components/activity/RaceLinkEditor.tsx', 'RaceLinkEditor'), { ...context, usesRecordedRaceTime: runInNewContext(useRecordedFn, {}) });
  const props = { ownerUserId: 'owner-1', units: 'imperial', events: [event], activities: [activity], archives: [], initialActivityId: 'run-1', onClose() {} };
  const draw = () => { cursor = 0; return render(props); };
  let tree = draw();
  assert.equal(nodes(tree).some(node => node.props.label === 'Use recorded elapsed time'), false);
  assert.equal(nodes(tree).some(node => node.props.label === 'Unlink race'), false);
  assert.deepEqual(nodes(tree).filter(node => node.type === 'GoalAction').map(node => node.props.label), ['Save race result', 'Done']);
  assert.equal(nodes(tree).find(node => node.type === 'GoalDisclosure')!.props.label, 'More options');
  nodes(tree).find(node => node.type === 'GoalField')!.props.onChange('59:45');
  tree = draw();
  const reset = nodes(tree).find(node => node.props.label === 'Use recorded elapsed time')!;
  assert.ok(reset); reset.props.onPress();
  tree = draw();
  assert.equal(nodes(tree).find(node => node.type === 'GoalField')!.props.value, '1:00:00');
  assert.equal(nodes(tree).some(node => node.props.label === 'Use recorded elapsed time'), false);
});
