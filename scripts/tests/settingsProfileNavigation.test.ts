import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { StackRouter, StackActions } = require(resolve('node_modules/expo-router/build/react-navigation/routers/StackRouter.js'));
const { TabRouter, TabActions } = require(resolve('node_modules/expo-router/build/react-navigation/routers/TabRouter.js'));
const settingsFile = 'app/(tabs)/settings/index.tsx';
const profileFile = 'app/(tabs)/profile/index.tsx';
function source(file: string) { return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function find(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node | undefined {
  if (predicate(root)) return root;
  return ts.forEachChild(root, child => find(child, predicate));
}
function attributes(node: ts.Node): ts.JsxAttributes | undefined {
  return ts.isJsxElement(node) ? node.openingElement.attributes : ts.isJsxSelfClosingElement(node) ? node.attributes : undefined;
}
function attr(node: ts.Node, name: string): ts.JsxAttribute | undefined {
  return attributes(node)?.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === name);
}
function handler(node: ts.Node, name: string, tree: ts.SourceFile): string {
  const init = attr(node, name)?.initializer;
  assert.ok(init && ts.isJsxExpression(init) && init.expression);
  return init.expression.getText(tree);
}
const profile = source(profileFile);
const context = find(profile, node => ts.isVariableDeclaration(node) && node.name.getText(profile) === 'withinSettings') as ts.VariableDeclaration;
assert.ok(context?.initializer);
function invoke(code: string, pathname: string, canGoBack = true) {
  const calls: { kind: string; href?: string }[] = [];
  const compiled = ts.transpileModule(`const withinSettings = ${context.initializer!.getText(profile)}; (${code})();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, { usePathname: () => pathname, router: {
    push: (href: string) => calls.push({ kind: 'push', href }),
    dismissTo: (href: string) => calls.push({ kind: 'dismissTo', href }),
    replace: (href: string) => calls.push({ kind: 'replace', href }),
    back: () => calls.push({ kind: 'back' }), canGoBack: () => canGoBack,
  } });
  assert.equal(calls.length, 1); return calls[0];
}
function config(routeNames: string[]) { return { routeNames, routeParamList: Object.fromEntries(routeNames.map(name => [name, undefined])), routeGetIdList: {} }; }
const settings = source(settingsFile);
const card = find(settings, node => attr(node, 'accessibilityLabel')?.initializer?.getText(settings) === '"Profile"')!;
const childNames = ['profile-identity', 'profile-calibration', 'profile-availability'];
const childHandlers = childNames.map(name => {
  const node = find(profile, item => attr(item, 'onPress')?.getText(profile).includes(`settings/${name}`) === true)!;
  assert.ok(node); return handler(node, 'onPress', profile);
});
const header = find(profile, node => attributes(node) != null && attr(node, 'onBack')?.getText(profile).includes('dismissTo') === true)!;
const back = handler(header, 'onBack', profile);

test('installed default TabRouter reproduces why a cross-tab Profile link returns Dashboard instead of Settings', () => {
  const router = TabRouter({}); const options = config(['dashboard', 'settings', 'profile']);
  let state = router.getInitialState(options);
  state = router.getStateForAction(state, TabActions.jumpTo('settings'), options);
  state = router.getStateForAction(state, TabActions.jumpTo('profile'), options);
  state = router.getStateForAction(state, { type: 'GO_BACK' }, options);
  assert.equal(state.routes[state.index].name, 'dashboard');
});

for (const [index, child] of childNames.entries()) test(`actual Settings/Profile/${child} actions stay in installed StackRouter and Back returns Profile then Settings`, () => {
  const aliases: Record<string, string> = { profile: 'index', 'profile-identity': 'edit-identity', 'profile-calibration': 'calibration', 'profile-availability': 'availability' };
  for (const [name, target] of Object.entries(aliases)) assert.match(readFileSync(`app/(tabs)/settings/${name}.tsx`, 'utf8'), new RegExp(`export \\{ default \\} from '../profile/${target}';`));
  const cardAction = invoke(handler(card, 'onPress', settings), '/settings');
  assert.equal(cardAction.href, '/(tabs)/settings/profile');
  const childAction = invoke(childHandlers[index], '/settings/profile');
  assert.equal(childAction.href, `/(tabs)/settings/${child}`);
  const router = StackRouter({ initialRouteName: 'index' }); const options = config(['index', 'profile', ...childNames]);
  let state = router.getInitialState(options);
  state = router.getStateForAction(state, StackActions.push(cardAction.href!.split('/').at(-1)), options);
  state = router.getStateForAction(state, StackActions.push(childAction.href!.split('/').at(-1)), options);
  const childBack = router.getStateForAction(state, { type: 'GO_BACK' }, options);
  assert.ok(childBack); assert.equal(childBack.routes[childBack.index].name, 'profile');
  const parentBack = invoke(back, '/settings/profile');
  assert.deepEqual(parentBack, { kind: 'dismissTo', href: '/(tabs)/settings' });
  const final = router.getStateForAction(childBack, StackActions.popTo('index'), options);
  assert.equal(final.index, 0); assert.equal(final.routes[0].name, 'index');
});

test('Settings Profile cold-root dismiss has an installed StackRouter replacement fallback; legacy Dashboard routes keep their old destinations and Back', () => {
  const router = StackRouter({ initialRouteName: 'profile' }); const options = config(['index', 'profile', ...childNames]);
  const cold = router.getInitialState(options);
  const fallback = router.getStateForAction(cold, StackActions.popTo('index'), options);
  assert.equal(fallback.routes[fallback.index].name, 'index');
  assert.deepEqual(invoke(back, '/profile'), { kind: 'back' });
  assert.deepEqual(invoke(back, '/profile', false), { kind: 'replace', href: '/(tabs)/settings' });
  assert.deepEqual(childHandlers.map(code => invoke(code, '/profile').href), [
    '/(tabs)/profile/edit-identity', '/(tabs)/profile/calibration', '/(tabs)/profile/availability',
  ]);
});
