import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createBackActionRegistry } from '../../src/utils/navigationEscape';
import { cardPlacementForTarget, highlightRectForTarget } from '../../src/utils/featureTours';

test('fixed Back invokes only the active leaf guard and restores the previous handler', () => {
  const registry = createBackActionRegistry();
  const calls: string[] = [];
  const leave = registry.register(Symbol(), { path: '/activity/manual', invoke: () => calls.push('save-draft') });
  const close = registry.register(Symbol(), { path: '/activity/manual', invoke: () => calls.push('cancel-modal') });
  registry.register(Symbol(), { path: '/different', invoke: () => calls.push('wrong-screen') });
  assert.equal(registry.handle('/activity/manual'), true);
  close();
  registry.handle('/activity/manual');
  leave();
  assert.equal(registry.handle('/activity/manual'), false);
  assert.deepEqual(calls, ['cancel-modal', 'save-draft']);
});

test('tour rejects invalid and offscreen targets and clamps highlights to viewport', () => {
  assert.equal(highlightRectForTarget({ x: NaN, y: 20, width: 20, height: 20 }, 320, 568), null);
  assert.equal(highlightRectForTarget({ x: 20, y: 900, width: 100, height: 100 }, 320, 568), null);
  const rect = highlightRectForTarget({ x: 280, y: 530, width: 80, height: 90 }, 320, 568)!;
  assert.ok(rect.x + rect.width <= 312);
  assert.ok(rect.y + rect.height <= 560);
});

test('tour fallback remains within safe areas on a short viewport', () => {
  const card = cardPlacementForTarget({ target: null, viewportWidth: 320, viewportHeight: 480, insets: { top: 100, bottom: 24 }, cardHeight: 300 });
  assert.ok(card.top >= 112);
  assert.ok(card.top + 300 <= 444);
});

test('modal escape and safe navigation retain explicit cancellation and reduced-motion paths', () => {
  const modal = readFileSync('src/components/ui/RecoverableModal.tsx', 'utf8');
  assert.match(modal, /onAccessibilityEscape=\{onRequestClose\}/);
  assert.match(modal, /reduceMotion \? 'none' : 'slide'/);
  const root = readFileSync('app/_layout.tsx', 'utf8');
  assert.match(root, /gestureEnabled: false/);
  assert.match(root, /FixedNavigationBanner/);
});

test('strength log escape paths preserve edits until explicit discard and leave Save intact', () => {
  const source = readFileSync('app/(tabs)/strength/[sessionIndex].tsx', 'utf8');
  const ast = ts.createSourceFile('strength-session.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let guard: ts.FunctionDeclaration | undefined;
  let modal: ts.JsxElement | undefined;
  const attribute = (opening: ts.JsxOpeningLikeElement, name: string) => opening.attributes.properties
    .find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(ast) === name)
    ?.initializer?.getText(ast);
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'closeStrengthLog') guard = node;
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Modal'
      && attribute(node.openingElement, 'visible') === '{showLogModal}') modal = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(guard);
  assert.ok(modal);
  assert.equal(attribute(modal.openingElement, 'onRequestClose'), '{closeStrengthLog}');
  const backdrop = modal.children.find(ts.isJsxElement);
  assert.ok(backdrop);
  assert.equal(attribute(backdrop.openingElement, 'onPress'), '{closeStrengthLog}');
  let form: ts.JsxSelfClosingElement | undefined;
  function findForm(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'SessionLogForm') form = node;
    ts.forEachChild(node, findForm);
  }
  findForm(modal);
  assert.ok(form);
  assert.equal(attribute(form, 'onCancel'), '{closeStrengthLog}');
  assert.equal(attribute(form, 'onSave'), '{handleLogSave}');

  type AlertAction = { text: string; style?: string; onPress?: () => void };
  let actions: AlertAction[] = [];
  const visibility: boolean[] = [];
  const close = runInNewContext(`(${guard.getText(ast)})`, {
    Alert: { alert: (_title: string, _message: string, buttons: AlertAction[]) => { actions = buttons; } },
    setShowLogModal: (visible: boolean) => visibility.push(visible),
  });
  close();
  assert.deepEqual(visibility, []);
  const keep = actions.find(action => action.text === 'Keep Editing');
  assert.equal(keep?.style, 'cancel');
  keep?.onPress?.();
  assert.deepEqual(visibility, []);
  const discard = actions.find(action => action.text === 'Discard Edits');
  assert.equal(discard?.style, 'destructive');
  assert.ok(discard?.onPress);
  discard.onPress();
  assert.deepEqual(visibility, [false]);
});

function readTsx(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function sourceFunction(ast: ts.SourceFile, name: string): ts.FunctionDeclaration {
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `${name} must exist in ${ast.fileName}`);
  return found;
}

function loadFunctions(ast: ts.SourceFile, names: string[], scope: Record<string, unknown>): Record<string, (...args: unknown[]) => unknown> {
  const code = names.map(name => sourceFunction(ast, name).getText(ast)).join('\n');
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return runInNewContext(`${compiled}\n({${names.join(',')}})`, Object.assign(scope, { exports: {} }));
}

function jsxOpenings(ast: ts.SourceFile, tag: string): ts.JsxOpeningLikeElement[] {
  const found: ts.JsxOpeningLikeElement[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === tag) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

function jsxAttribute(ast: ts.SourceFile, opening: ts.JsxOpeningLikeElement, name: string): string | undefined {
  return opening.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(ast) === name)?.initializer?.getText(ast);
}

type GuardAction = { text: string; style?: string; onPress?: () => void };

test('marker cancellation compares the opening snapshot, guards tiny edits and only discards explicitly', () => {
  const ast = readTsx('src/components/movement/LandmarkEditor.tsx');
  const initial = [{ name: 'left_knee', x: 0.4, y: 0.5, confidence: 0.9 }];
  let cancelled = 0;
  let saved = 0;
  let actions: GuardAction[] = [];
  const scope = {
    draft: initial.map(joint => ({ ...joint })),
    initialLandmarks: { current: structuredClone(initial) },
    autoLandmarks: [{ ...initial[0]!, x: 0.3 }],
    onCancel: () => { cancelled += 1; },
    onSave: () => { saved += 1; },
    Alert: { alert: (_title: string, _message: string, buttons: GuardAction[]) => { actions = buttons; } },
  };
  const { requestCancel } = loadFunctions(ast, ['sameLandmarks', 'requestCancel'], scope);
  requestCancel();
  assert.equal(cancelled, 1, 'Previously saved corrections are clean relative to the opening snapshot');
  assert.equal(actions.length, 0);
  scope.draft[0]!.x += 0.0001;
  requestCancel();
  assert.equal(cancelled, 1);
  assert.equal(actions.find(action => action.text === 'Keep Editing')?.style, 'cancel');
  actions.find(action => action.text === 'Keep Editing')?.onPress?.();
  assert.equal(cancelled, 1);
  assert.equal(saved, 0);
  assert.equal(scope.draft[0]!.x, 0.4001);
  assert.deepEqual(scope.initialLandmarks.current, initial);
  const discard = actions.find(action => action.text === 'Discard Changes');
  assert.equal(discard?.style, 'destructive');
  assert.ok(discard?.onPress);
  discard.onPress();
  assert.equal(cancelled, 2);
  assert.equal(saved, 0);
});

test('marker reset back to the opening snapshot is clean and confidence-only changes are dirty', () => {
  const ast = readTsx('src/components/movement/LandmarkEditor.tsx');
  const initial = [{ name: 'left_knee', x: 0.4, y: 0.5, confidence: 0.9 }];
  let cancelled = 0;
  let prompts = 0;
  const scope = {
    draft: structuredClone(initial), initialLandmarks: { current: structuredClone(initial) },
    onCancel: () => { cancelled += 1; }, Alert: { alert: () => { prompts += 1; } },
  };
  const { requestCancel } = loadFunctions(ast, ['sameLandmarks', 'requestCancel'], scope);
  scope.draft[0]!.confidence = 0.95;
  requestCancel();
  assert.equal(prompts, 1);
  assert.equal(cancelled, 0);
  scope.draft = structuredClone(initial);
  requestCancel();
  assert.equal(cancelled, 1);
  assert.equal(prompts, 1);
});

test('every marker escape shares the dirty guard and Save retains its original correction semantics', () => {
  const ast = readTsx('src/components/movement/LandmarkEditor.tsx');
  const modal = jsxOpenings(ast, 'Modal')[0]!;
  assert.equal(jsxAttribute(ast, modal, 'onRequestClose'), '{requestCancel}');
  const cancel = jsxOpenings(ast, 'Pressable').find(node => jsxAttribute(ast, node, 'accessibilityLabel') === '"Cancel marker adjustments"')!;
  const save = jsxOpenings(ast, 'Pressable').find(node => jsxAttribute(ast, node, 'accessibilityLabel') === '"Save marker adjustments"')!;
  assert.equal(jsxAttribute(ast, cancel, 'onPress'), '{requestCancel}');
  assert.equal(jsxAttribute(ast, save, 'onPress'), '{save}');
  const draft = [{ name: 'left_knee', x: 0.4, y: 0.5, confidence: 0.9 }];
  const calls: { markers: unknown; corrected: unknown }[] = [];
  let cancelled = false;
  const scope = {
    draft, autoLandmarks: [{ ...draft[0]!, x: 0.3 }], onCancel: () => { cancelled = true; },
    onSave: (markers: unknown, corrected: unknown) => calls.push({ markers, corrected }),
  };
  const functions = loadFunctions(ast, ['sameLandmarks', 'save'], scope);
  functions.save!();
  assert.equal(calls[0]!.markers, draft);
  assert.equal(calls[0]!.corrected, true);
  scope.autoLandmarks = [{ ...draft[0]! }];
  functions.save!();
  assert.equal(calls[1]!.corrected, false);
  assert.equal(cancelled, false);
  for (const path of ['app/(tabs)/movement/analysis-detail.tsx', 'app/(tabs)/movement/video-analysis.tsx']) {
    const consumer = readTsx(path);
    const editor = jsxOpenings(consumer, 'LandmarkEditor')[0]!;
    assert.ok(editor, path);
    assert.ok(jsxAttribute(consumer, editor, 'onSave'));
    assert.ok(jsxAttribute(consumer, editor, 'onCancel'));
  }
});

test('marker body uses one top safe-area owner and retains the full bottom inset', () => {
  const editor = readTsx('src/components/movement/LandmarkEditor.tsx');
  assert.match(editor.getText(), /import Modal from '\.\.\/ui\/RecoverableModal'/);
  const body = jsxOpenings(editor, 'View').find(node => jsxAttribute(editor, node, 'style')?.includes('styles.modalRoot'))!;
  const bodyStyle = body.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(editor) === 'style')!.initializer as ts.JsxExpression;
  const wrapper = readTsx('src/components/ui/RecoverableModal.tsx');
  const bar = jsxOpenings(wrapper, 'View').find(node => jsxAttribute(wrapper, node, 'style')?.includes('styles.bar'))!;
  const barStyle = bar.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(wrapper) === 'style')!.initializer as ts.JsxExpression;
  for (const insets of [{ top: 47, bottom: 34 }, { top: 0, bottom: 0 }]) {
    const bodyStyles = runInNewContext(`(${bodyStyle.expression!.getText(editor)})`, { insets, spacing: { sm: 8 }, styles: { modalRoot: {} } });
    const barStyles = runInNewContext(`(${barStyle.expression!.getText(wrapper)})`, { insets, C: { bg: '#000000' }, styles: { bar: {} } });
    assert.equal(barStyles[1].paddingTop, insets.top);
    assert.equal(bodyStyles[1].paddingTop, 8);
    assert.equal(bodyStyles[1].paddingBottom, insets.bottom + 8);
  }
});

function strengthBackFixture(overrides: Record<string, unknown> = {}) {
  const ast = readTsx('app/(tabs)/strength/[sessionIndex].tsx');
  let left = 0;
  let logClose = 0;
  let pickerClose = 0;
  let skipClose = 0;
  let actions: GuardAction[] = [];
  const scope = {
    showLogModal: false, weightPickerFor: null, showSkipModal: false, isActive: false, isComplete: false,
    exerciseStatus: {}, exerciseWeightsLb: {},
    closeStrengthLog: () => { logClose += 1; },
    setWeightPickerFor: () => { pickerClose += 1; },
    setShowSkipModal: () => { skipClose += 1; },
    router: { back: () => { left += 1; } },
    Alert: { alert: (_title: string, _message: string, buttons: GuardAction[]) => { actions = buttons; } },
    ...overrides,
  };
  const { handleBack } = loadFunctions(ast, ['handleBack'], scope);
  return { ast, scope, handleBack, state: () => ({ left, logClose, pickerClose, skipClose, actions }) };
}

test('strength Back protects running and paused local timers plus unsaved status and weight edits', () => {
  for (const overrides of [
    { isActive: true }, { isActive: true, isPaused: true },
    { exerciseStatus: { squat: 'done' } }, { exerciseStatus: { squat: 'skipped' } },
    { exerciseWeightsLb: { squat: 45 } },
  ]) {
    const fixture = strengthBackFixture(overrides);
    const original = structuredClone(overrides);
    fixture.handleBack!();
    assert.equal(fixture.state().left, 0);
    const keep = fixture.state().actions.find(action => action.text === 'Keep Training');
    assert.equal(keep?.style, 'cancel');
    keep?.onPress?.();
    assert.equal(fixture.state().left, 0);
    assert.deepEqual(overrides, original);
    const leave = fixture.state().actions.find(action => action.text === 'Leave Without Saving');
    assert.equal(leave?.style, 'destructive');
    assert.ok(leave?.onPress);
    leave.onPress();
    assert.equal(fixture.state().left, 1);
  }
});

test('strength Back leaves clean or saved sessions directly and is registered with the fixed banner', () => {
  for (const overrides of [{}, { exerciseStatus: { squat: 'pending' } }, { isComplete: true, exerciseStatus: { squat: 'done' }, exerciseWeightsLb: { squat: 45 } }]) {
    const fixture = strengthBackFixture(overrides);
    fixture.handleBack!();
    assert.equal(fixture.state().left, 1);
    assert.equal(fixture.state().actions.length, 0);
    const control = jsxOpenings(fixture.ast, 'LegacyBackControl')[0]!;
    assert.equal(jsxAttribute(fixture.ast, control, 'onBack'), '{handleBack}');
  }
  const fixture = strengthBackFixture({ isActive: true });
  const registry = createBackActionRegistry();
  const unregister = registry.register(Symbol(), { path: '/strength/0', invoke: () => fixture.handleBack!() });
  assert.equal(registry.handle('/strength/0'), true);
  assert.equal(fixture.state().left, 0);
  assert.ok(fixture.state().actions.length);
  unregister();
  assert.equal(registry.handle('/strength/0'), false);
});

test('strength Back dismisses the local overlay before considering session navigation', () => {
  for (const [overrides, expected] of [
    [{ showLogModal: true }, 'logClose'],
    [{ weightPickerFor: 'squat' }, 'pickerClose'],
    [{ showSkipModal: true }, 'skipClose'],
  ] as const) {
    const fixture = strengthBackFixture({ ...overrides, isActive: true });
    fixture.handleBack!();
    assert.equal(fixture.state()[expected], 1);
    assert.equal(fixture.state().left, 0);
    assert.equal(fixture.state().actions.length, 0);
  }
});

test('modal and tour structural Pressables expose their child controls to accessibility', () => {
  function tsxFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
    });
  }
  let wrapperCount = 0;
  const coveredFiles = new Set<string>();
  for (const path of [...tsxFiles('app'), ...tsxFiles('src/components')]) {
    const source = readFileSync(path, 'utf8');
    if (!source.includes('stopPropagation')) continue;
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const wrappers = new Set<ts.JsxOpeningLikeElement>();
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'Pressable'
        && jsxAttribute(ast, node.openingElement, 'onPress')?.includes('stopPropagation')) {
        wrappers.add(node.openingElement);
        for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
          if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'Pressable') {
            wrappers.add(parent.openingElement);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    for (const wrapper of wrappers) {
      const line = ast.getLineAndCharacterOfPosition(wrapper.getStart(ast)).line + 1;
      assert.equal(jsxAttribute(ast, wrapper, 'accessible'), '{false}', `${path}:${line} must not group child controls`);
      wrapperCount += 1;
      coveredFiles.add(path);
    }
    for (const tag of ['Pressable', 'TouchableOpacity', 'Button']) {
      for (const control of jsxOpenings(ast, tag)) {
        if (wrappers.has(control)) continue;
        if (tag === 'Button' || jsxAttribute(ast, control, 'onPress')) {
          assert.notEqual(jsxAttribute(ast, control, 'accessible'), '{false}', `${path}: ${tag} action must remain accessible`);
        }
      }
    }
  }
  assert.ok(wrapperCount > 0, 'Regression scan must find structural wrappers');
  for (const path of ['src/components/featureTour/FeatureTourProvider.tsx', 'src/components/ui/PickerWheel.tsx',
    'src/components/ui/Dialog.tsx', 'src/components/ui/BottomSheet.tsx', 'app/(tabs)/training/route-builder.tsx']) {
    assert.ok(coveredFiles.has(path), path);
  }
  const modal = readTsx('src/components/ui/RecoverableModal.tsx');
  const close = jsxOpenings(modal, 'Pressable').find(control => jsxAttribute(modal, control, 'accessibilityLabel') === '"Close window"');
  assert.ok(close);
  assert.notEqual(jsxAttribute(modal, close, 'accessible'), '{false}');
  assert.equal(jsxAttribute(modal, close, 'onPress'), '{onRequestClose}');
});

test('manual page insets remove only the root-owned top and preserve standalone and rotated edges', () => {
  const ast = readTsx('src/components/layout/PageSafeAreaView.tsx');
  let fixed = false;
  let insets: Readonly<{ top: number; bottom: number; left: number; right: number }> = Object.freeze({ top: 47, bottom: 34, left: 3, right: 7 });
  let previousDeps: unknown[] | undefined;
  let memoized: unknown;
  const { usePageSafeAreaInsets } = loadFunctions(ast, ['usePageSafeAreaInsets'], {
    useSafeAreaInsets: () => insets,
    useHasFixedNavigationBanner: () => fixed,
    useMemo: (create: () => unknown, deps: unknown[]) => {
      if (!previousDeps || deps.some((dep, index) => !Object.is(dep, previousDeps![index]))) {
        memoized = create();
        previousDeps = [...deps];
      }
      return memoized;
    },
  });
  assert.equal(usePageSafeAreaInsets!(), insets, 'Standalone pages retain the original insets object');
  fixed = true;
  const page = usePageSafeAreaInsets!();
  assert.deepEqual({ ...page as object }, { top: 0, bottom: 34, left: 3, right: 7 });
  assert.equal(insets.top, 47, 'The real window insets must never be mutated');
  assert.equal(usePageSafeAreaInsets!(), page, 'Unchanged inputs retain the memoized object');

  insets = Object.freeze({ top: 0, bottom: 21, left: 59, right: 11 });
  const rotated = usePageSafeAreaInsets!();
  assert.notEqual(rotated, page);
  assert.deepEqual({ ...rotated as object }, { top: 0, bottom: 21, left: 59, right: 11 });
  fixed = false;
  assert.equal(usePageSafeAreaInsets!(), insets, 'Removing the fixed banner restores all real edges');
  insets = Object.freeze({ top: 59, bottom: 0, left: 0, right: 0 });
  assert.equal(usePageSafeAreaInsets!(), insets, 'Standalone insets continue updating after rotation');
  fixed = true;
  assert.deepEqual({ ...usePageSafeAreaInsets!() as object }, { top: 0, bottom: 0, left: 0, right: 0 });
});

test('manual inset consumers use the page hook while window-coordinate and header owners retain real insets', () => {
  function tsxFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith('.tsx') ? [path] : [];
    });
  }
  const pageModule = resolve('src/components/layout/PageSafeAreaView');
  const migrated = new Set<string>();
  for (const path of [...tsxFiles('app'), 'src/components/movement/TimedCaptureCamera.tsx']) {
    const ast = readTsx(path);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const binding of bindings.elements) {
        const exported = (binding.propertyName ?? binding.name).text;
        assert.ok(!(statement.moduleSpecifier.text === 'react-native-safe-area-context'
          && exported === 'useSafeAreaInsets'), `${path} must not add the root-owned top inset again`);
        if (exported === 'usePageSafeAreaInsets') {
          assert.equal(resolve(dirname(path), statement.moduleSpecifier.text), pageModule, path);
          assert.equal(binding.name.text, 'useSafeAreaInsets', `${path} must preserve existing hook call sites`);
          migrated.add(path);
        }
      }
    }
  }
  for (const path of ['app/(tabs)/training/index.tsx', 'app/(tabs)/training/run-tracking.tsx',
    'src/components/movement/TimedCaptureCamera.tsx']) assert.ok(migrated.has(path), path);

  for (const path of ['src/components/layout/NavigationEscape.tsx', 'src/components/ui/RecoverableModal.tsx',
    'src/components/featureTour/FeatureTourProvider.tsx']) {
    const ast = readTsx(path);
    const rawImport = ast.statements.filter(ts.isImportDeclaration).some(statement => {
      const bindings = statement.importClause?.namedBindings;
      return ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === 'react-native-safe-area-context'
        && bindings && ts.isNamedImports(bindings)
        && bindings.elements.some(binding => (binding.propertyName ?? binding.name).text === 'useSafeAreaInsets');
    });
    assert.ok(rawImport, `${path} needs real window insets for its own header or target coordinates`);
    assert.doesNotMatch(ast.text, /usePageSafeAreaInsets/);
  }
  const camera = readTsx('src/components/movement/TimedCaptureCamera.tsx');
  assert.ok(camera.statements.filter(ts.isImportDeclaration).some(statement => ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === '../ui/RecoverableModal'), 'The camera modal must retain its own safe-area header');
});
