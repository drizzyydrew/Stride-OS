import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { archiveFromLink, goalArchiveLink } from '../../src/utils/goal-archive-link';

function routerLocalParams(params: Record<string, unknown>) {
  // Execute the installed SDK's actual hook: its extra decode caused the failure.
  const exports: any = {};
  vm.runInNewContext(fs.readFileSync('node_modules/expo-router/build/hooks/useLocalSearchParams.js', 'utf8'), {
    exports, require: (name: string) => name === 'react'
      ? { use: () => params } : name.includes('PreviewRouteContext') ? { usePreviewInfo: () => ({}) } : {},
  });
  return exports.useLocalSearchParams();
}

test('archive links survive the installed Router hook without changing encoded storage IDs', () => {
  for (const source of ['race:rome', 'goal:2026/11:one', 'race:100% effort', 'race:東京 🏃', 'race:%3Aliteral']) {
    const archive = { id: `goal-archive:athlete_default:${encodeURIComponent(source)}` };
    const params = routerLocalParams(goalArchiveLink(archive.id).params);
    assert.equal(archiveFromLink([archive], params), archive);
  }
});

test('legacy View Results link is recovered by unique single-decode matching', () => {
  const archive = { id: 'goal-archive:athlete_default:race%3Arome' };
  const params = routerLocalParams({ id: archive.id });
  assert.notEqual(params.id, archive.id);
  assert.equal(archiveFromLink([archive], params), archive);
});

test('new archive key preserves literal percent identity and does not repeatedly decode', () => {
  const archives = [{ id: 'race%253Aa' }, { id: 'race%3Aa' }, { id: 'race:a' }, { id: 'race%' }];
  for (const archive of archives) assert.equal(archiveFromLink(archives, routerLocalParams(goalArchiveLink(archive.id).params)), archive);
  assert.equal(archiveFromLink(archives, { id: 'race:a' }), undefined, 'ambiguous legacy aliases fail closed');
  assert.equal(archiveFromLink([{ id: 'race%253Aa' }], { id: 'race:a' }), undefined, 'no repeated decoding');
});

test('missing malformed repeated and unknown archive keys never select another snapshot', () => {
  const archive = { id: 'known' };
  for (const archiveKey of ['', 'v1_', 'v1_zzzz', 'v1_0061x', ['v1_006b'], null, 'v2_006b']) {
    assert.equal(archiveFromLink([archive], { archiveKey, id: 'known' }), undefined);
  }
  assert.equal(archiveFromLink([], goalArchiveLink('known').params), undefined, 'owner-filtered collection stays authoritative');
  assert.equal(archiveFromLink([archive], { id: ['known'] }), undefined);
  assert.equal(archiveFromLink([archive, archive], goalArchiveLink('known').params), undefined);
  assert.equal(archiveFromLink([archive], {}), undefined);
});
