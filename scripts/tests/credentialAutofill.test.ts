import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness(os: string, available = true, fail = false) {
  let commits = 0, lookups = 0, dismissals = 0;
  const args: unknown[][] = [];
  const module = { exports: {} as { finishCredentialAutofill(): Promise<void> } };
  const filename = resolve('src/lib/credentialAutofill.ts');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(id: string) {
    if (id === 'react-native') return { Platform: { OS: os }, Keyboard: { dismiss() { dismissals++; } } };
    if (id.endsWith('/StrideCredentialAutofillModule')) return { __esModule: true, default: () => {
      lookups++;
      return available ? { async commitAsync(...values: unknown[]) {
        commits++; args.push(values); if (fail) throw new Error('provider unavailable'); return true;
      } } : null;
    } };
    throw new Error(`Unexpected dependency ${id}`);
  } }, { filename });
  return { finish: module.exports.finishCredentialAutofill, values: () => ({ commits, lookups, dismissals, args }) };
}

test('Android completes native autofill with no credential arguments', async () => {
  const h = harness('android'); await h.finish();
  assert.deepEqual(h.values(), { commits: 1, lookups: 1, dismissals: 0, args: [[]] });
});
test('disabled or unavailable native autofill never prevents successful authentication', async () => {
  for (const h of [harness('android', false), harness('android', true, true)]) await assert.doesNotReject(h.finish());
});
test('iOS ends editing without requiring the Android module', async () => {
  const h = harness('ios'); await h.finish();
  assert.deepEqual(h.values(), { commits: 0, lookups: 0, dismissals: 1, args: [] });
});
test('web does not request native password-provider actions', async () => {
  const h = harness('web'); await h.finish();
  assert.deepEqual(h.values(), { commits: 0, lookups: 0, dismissals: 0, args: [] });
});
