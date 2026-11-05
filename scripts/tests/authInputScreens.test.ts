import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { authInputProps, resetEmailFromParam } from '../../src/lib/authInput';

type Element = { type: string; props: Record<string, any>; children: any[] };
type Screen = 'sign-in' | 'sign-up' | 'forgot-password' | 'new-password';
const transpile = (source: string) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.React, jsxFactory: 'h', esModuleInterop: true,
} }).outputText;

// Execute the actual screen source, mocking only React/native/navigation/service
// boundaries. No real credentials, provider requests or native save dialogs.
function screen(name: Screen, options: {
  platform?: string; params?: Record<string, unknown>;
  result?: string | null; session?: any; canAccess?: boolean;
  update?: () => Promise<string | null>;
  finish?: () => Promise<void>;
} = {}) {
  let cursor = 0, tree: Element;
  const slots: any[] = [], navigation: any[] = [], calls: { name: string; args: any[] }[] = [];
  let autofill = 0;
  let authState = {
    session: options.session ?? null, canAccessLocalData: options.canAccess ?? true,
    localAccessReason: null,
    ...Object.fromEntries(['signIn', 'signUp', 'resetPassword', 'resendConfirmation', 'updatePassword'].map(action => [action,
      async (...args: any[]) => {
        calls.push({ name: action, args });
        return action === 'updatePassword' && options.update ? options.update() : options.result ?? null;
      }])),
  } as any;
  const useAuthStore = Object.assign((selector: (state: any) => unknown) => selector(authState), { getState: () => authState });
  const mocks: Record<string, any> = {
    react: { useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    } },
    'expo-router': { useLocalSearchParams: () => options.params ?? {}, router: {
      push: (path: any) => navigation.push(path), replace: (path: any) => navigation.push(path), back() {},
    } },
    'react-native': { Platform: { OS: options.platform ?? 'ios' }, StyleSheet: { create: (value: unknown) => value },
      ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(value => [value, value])),
      Linking: { openURL: async () => undefined } },
    '../../src/store/authStore': { useAuthStore },
    '../../src/lib/authInput': { authInputProps, resetEmailFromParam },
    '../../src/lib/credentialAutofill': { finishCredentialAutofill: async () => {
      // The native framework must still be able to inspect entered values.
      assert.ok(nodes().some(node => node.type === 'TextInput' && node.props.secureTextEntry && node.props.value));
      autofill++;
      await options.finish?.();
    } },
    '../../src/components/auth/SocialAuthButtons': { SocialAuthButtons: 'SocialAuthButtons' },
    '../../src/components/layout/NavigationEscape': { LegacyBackControl: 'LegacyBackControl' },
    '../../src/theme/colors': { colors: {} }, '../../src/theme/spacing': { spacing: {} },
    '../../src/theme/tokens': { FontSize: {}, FontWeight: {}, Radius: {} },
    '../../src/utils/legal': { LEGAL_URLS: {} },
  };
  const mod = { exports: {} as any };
  runInNewContext(transpile(readFileSync(`app/auth/${name}.tsx`, 'utf8')), {
    module: mod, exports: mod.exports,
    require: (path: string) => { assert.ok(Object.hasOwn(mocks, path), `Unmocked screen import: ${path}`); return mocks[path]; },
    h: (type: string, props: Record<string, any> | null, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  function render() { cursor = 0; tree = mod.exports.default(); }
  function nodes() {
    const all: Element[] = [];
    const visit = (node: any) => { if (node && typeof node === 'object' && node.children) { all.push(node); node.children.forEach(visit); } };
    visit(tree); return all;
  }
  const inputs = () => nodes().filter(node => node.type === 'TextInput');
  const text = (node: Element): string => node.children.map(child => typeof child === 'string' ? child : child?.children ? text(child) : '').join('');
  const press = async (label: string) => {
    const button = nodes().find(node => node.type === 'Pressable' && text(node) === label);
    assert.ok(button, `Missing button ${label}`); await button.props.onPress(); render();
  };
  render();
  return { render, nodes, inputs, press, navigation, calls, autofill: () => autofill,
    fill(index: number, value: string) { inputs()[index].props.onChangeText(value); render(); },
    setAuthState(next: Record<string, unknown>) { authState = { ...authState, ...next }; render(); },
    text: () => nodes().filter(node => node.type === 'Text').map(text).join(' '),
  };
}

test('forgot-password receives only the trimmed email draft, remains editable, and reset uses edits', async () => {
  const ui = screen('sign-in');
  ui.fill(0, '  athlete@example.invalid  '); ui.fill(1, 'synthetic-password');
  await ui.press('Forgot password?');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.navigation)), [{ pathname: '/auth/forgot-password', params: { email: 'athlete@example.invalid' } }]);
  assert.ok(!JSON.stringify(ui.navigation).includes('synthetic-password'));
  const reset = screen('forgot-password', { params: ui.navigation[0].params });
  assert.equal(reset.inputs()[0].props.value, 'athlete@example.invalid');
  reset.fill(0, '  corrected@example.invalid '); await reset.press('Send Reset Link');
  assert.deepEqual(reset.calls, [{ name: 'resetPassword', args: ['corrected@example.invalid'] }]);
  assert.match(reset.text(), /Check your email/);
});

test('direct or ambiguous forgot-password links start blank without trusting credential params', () => {
  for (const value of [undefined, ['first@example.invalid', 'second@example.invalid'], 'x'.repeat(321), 'x\n@example.invalid', {}]) {
    assert.equal(screen('forgot-password', { params: { email: value, password: 'ignored' } }).inputs()[0].props.value, '');
  }
});

test('actual iOS and Android screens identify existing and new credentials using one hint API', () => {
  for (const platform of ['ios', 'android']) {
    const current = screen('sign-in', { platform }).inputs();
    const signup = screen('sign-up', { platform }).inputs();
    const reset = screen('new-password', { platform, session: { user: { id: 'owner-A', email: 'athlete@example.invalid' } } }).inputs();
    assert.equal(reset[0].props.editable, false);
    for (const input of [...current, ...signup, ...reset]) {
      assert.equal(input.props.autoCapitalize, 'none'); assert.equal(input.props.autoCorrect, false);
      assert.ok(!(input.props.autoComplete && input.props.textContentType));
      if (platform === 'android') assert.equal(input.props.importantForAutofill, 'yes');
    }
    assert.equal(current[0].props[platform === 'ios' ? 'textContentType' : 'autoComplete'], 'username');
    assert.equal(current[1].props[platform === 'ios' ? 'textContentType' : 'autoComplete'], platform === 'ios' ? 'password' : 'current-password');
    for (const input of [signup[1], reset[1], reset[2]]) {
      assert.equal(input.props[platform === 'ios' ? 'textContentType' : 'autoComplete'], platform === 'ios' ? 'newPassword' : 'new-password');
      assert.equal(input.props.secureTextEntry, true);
    }
  }
});

test('sign-in and sign-up finish native credential context only after provider success', async () => {
  for (const name of ['sign-in', 'sign-up'] as const) {
    for (const result of [null, 'Synthetic provider failure']) {
      const ui = screen(name, { result, session: name === 'sign-in'
        ? { user: { id: 'owner-A', email: 'athlete@example.invalid' } } : null });
      ui.fill(0, 'athlete@example.invalid'); ui.fill(1, 'synthetic-password');
      await ui.press(name === 'sign-in' ? 'Sign In' : 'Create Account');
      assert.equal(ui.autofill(), result ? 0 : 1);
      assert.equal(ui.calls[0].args[1], 'synthetic-password');
      if (result) { assert.match(ui.text(), /Synthetic provider failure/); assert.equal(ui.inputs()[1].props.value, 'synthetic-password'); }
      else if (name === 'sign-in') assert.equal(ui.inputs()[1].props.value, '');
      else assert.match(ui.text(), /Check your email/);
    }
  }
});

test('null sign-in result without current matching owner access does not finish autofill', async () => {
  for (const options of [
    { session: null },
    { session: { user: { id: 'owner-B', email: 'other@example.invalid' } } },
    { session: { user: { id: 'owner-A', email: 'athlete@example.invalid' } }, canAccess: false },
  ]) {
    const ui = screen('sign-in', options); ui.fill(0, 'athlete@example.invalid'); ui.fill(1, 'synthetic-password');
    await ui.press('Sign In'); assert.equal(ui.autofill(), 0);
    assert.equal(ui.inputs()[1].props.value, 'synthetic-password');
  }
});

test('password update offers only current account context and finishes after successful guarded update', async () => {
  const session = { user: { id: 'owner-A', email: 'athlete@example.invalid' } };
  assert.equal(screen('new-password', { session, canAccess: false }).inputs().length, 2);
  for (const result of [null, 'Synthetic reset failure']) {
    const ui = screen('new-password', { session, result });
    ui.fill(1, 'synthetic-new-password'); ui.fill(2, 'synthetic-new-password'); await ui.press('Update Password');
    assert.equal(ui.autofill(), result ? 0 : 1);
    assert.deepEqual(ui.calls, [{ name: 'updatePassword', args: ['synthetic-new-password'] }]);
    assert.match(ui.text(), result ? /Synthetic reset failure/ : /Password updated/);
  }
});

test('password update never finishes credential context for changed account or validation failure', async () => {
  let ui: ReturnType<typeof screen>;
  ui = screen('new-password', { session: { user: { id: 'owner-A', email: 'athlete@example.invalid' } }, update: async () => {
    ui.setAuthState({ session: { user: { id: 'owner-B', email: 'other@example.invalid' } } }); return null;
  } });
  ui.fill(1, 'synthetic-new-password'); ui.fill(2, 'synthetic-new-password'); await ui.press('Update Password');
  assert.equal(ui.autofill(), 0); assert.match(ui.text(), /account changed/);
  const invalid = screen('new-password'); invalid.fill(0, 'short'); invalid.fill(1, 'short'); await invalid.press('Update Password');
  assert.equal(invalid.calls.length, 0); assert.equal(invalid.autofill(), 0);
});

test('successful reset continues without retyping; a later account change cannot use stale Continue', async () => {
  const session = { user: { id: 'owner-A', email: 'athlete@example.invalid' } };
  for (const changed of [false, true]) {
    const ui = screen('new-password', { session });
    ui.fill(1, 'synthetic-new-password'); ui.fill(2, 'synthetic-new-password'); await ui.press('Update Password');
    assert.doesNotMatch(ui.text(), /Sign in to continue/);
    const continueButton = ui.nodes().find(node => node.type === 'Pressable');
    assert.ok(continueButton);
    if (changed) ui.setAuthState({ session: null, canAccessLocalData: false });
    await continueButton.props.onPress();
    assert.deepEqual(ui.navigation, [changed ? '/auth/sign-in' : '/(tabs)/dashboard']);
    assert.ok(!JSON.stringify(ui.navigation).includes('synthetic-new-password'));
  }
});

test('account change during native finish cannot display reset success for the new owner', async () => {
  let ui: ReturnType<typeof screen>;
  ui = screen('new-password', { session: { user: { id: 'owner-A', email: 'athlete@example.invalid' } }, finish: async () => {
    ui.setAuthState({ session: { user: { id: 'owner-B', email: 'other@example.invalid' } } });
  } });
  ui.fill(1, 'synthetic-new-password'); ui.fill(2, 'synthetic-new-password'); await ui.press('Update Password');
  assert.equal(ui.autofill(), 1); assert.match(ui.text(), /account changed/);
  assert.doesNotMatch(ui.text(), /Password updated/);
});
