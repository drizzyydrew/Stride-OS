import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import type { Activity } from '../../src/types/activity';
import type { AchievementAwardReference } from '../../src/utils/achievements';
import { evaluateAchievementAwards } from '../../src/utils/achievements';
import { ACHIEVEMENT_SYSTEM_REGISTRY, achievementShareAllowed, evaluateAchievementSystem, getAchievementDefinition } from '../../src/utils/achievementSystem';
import type { EvaluatedAchievement } from '../../src/utils/achievementSystem';
import { achievementBadgePresentation, badgeFamilyPresentationRows } from '../../src/achievements/badgePresentation';

const retiredId = 'challenge_5k_month';
const now = new Date(2026, 9, 15, 12).getTime();
const earnedAt = new Date(2026, 6, 10, 12).getTime();
function run(meters: number): Activity {
  return { id: 'new-month-run', activityType: 'running', source: 'tracked', status: 'completed',
    startTime: now - 1800_000, endTime: now, metrics: { distanceMeters: meters, durationSeconds: 1800 } } as Activity;
}

function actualHubSelector() {
  const filename = 'app/(tabs)/more/achievements.tsx';
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selector = source.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'canonicalListForFilter');
  assert.ok(selector, 'test the actual hub selection used by totals and progress rows');
  const context = { badgeFamilyPresentationRows, select: undefined as undefined | ((rows: EvaluatedAchievement[], filter: string) => EvaluatedAchievement[]) };
  vm.runInNewContext(ts.transpileModule(`${selector.getText(source)}\nselect = canonicalListForFilter;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename });
  return context.select!;
}

test('retirement blocks new 5K awards in both evaluators without moving the 150K/200K thresholds', () => {
  const select = actualHubSelector();
  for (const units of ['metric', 'imperial'] as const) {
    for (const meters of [4999, 5000, 149_999, 150_000, 199_999, 200_000, 250_000]) {
      const activities = [run(meters)];
      const awards = evaluateAchievementAwards(activities, [], now);
      assert.equal(awards.some(item => item.id === retiredId), false);
      const evaluated = evaluateAchievementSystem({ activities, awarded: [], units, now });
      const retired = evaluated.find(item => item.id === retiredId)!;
      assert.equal(retired.state, 'locked');
      assert.equal(retired.threshold, 5000);
      assert.equal(retired.currentProgress, 0);
      assert.equal(retired.achievedDate, undefined);
      assert.deepEqual(retired.supportingActivityIds, []);
      assert.equal(achievementShareAllowed(retired), false);
      assert.equal(badgeFamilyPresentationRows(evaluated, 'all').some(item => item.id === retiredId), false);
      const active = select(evaluated, 'all');
      assert.equal(evaluated.length, 99, 'canonical lookup includes archival definitions');
      assert.equal(active.length, 98, 'active total excludes the unattainable retired goal');
      assert.equal(active.filter(item => item.state === 'locked').length, evaluated.filter(item => item.state === 'locked').length - 1);
      assert.equal(active.filter(item => item.state !== 'locked').length, evaluated.filter(item => item.state !== 'locked').length);
      assert.equal(active.filter(item => item.state === 'locked').some(item => item.id === retiredId), false);
      const challenges = badgeFamilyPresentationRows(evaluated, 'challenges');
      assert.equal(challenges.length, 13);
      assert.equal(challenges.some(item => item.id === retiredId), false);
      for (const threshold of [150_000, 200_000]) {
        const id = `monthly_run_${threshold / 1000}k`;
        assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.filter(item => item.id === id).length, 1);
        assert.equal(awards.filter(item => item.id === id).length, meters >= threshold ? 1 : 0);
        assert.equal(evaluated.find(item => item.id === id)?.state, meters >= threshold ? 'earned' : 'locked');
        const presentation = challenges.filter(item => item.id === id);
        assert.equal(presentation.length, 1);
        assert.equal(presentation[0]!.threshold, threshold);
        assert.equal(presentation[0]!.family, 'monthly_challenges');
      }
      assert.equal(awards.some(item => /^challenge_(150|200)k_month$/.test(item.id)), false);
    }
  }
});

test('historical string and object awards stay earned, addressable and shareable without new evidence', () => {
  const select = actualHubSelector();
  const references: AchievementAwardReference[] = [retiredId, { id: retiredId },
    { id: retiredId, awardedAt: 0 },
    { id: retiredId, awardedAt: earnedAt, supportingActivityIds: ['original-run'], supportingSessionIds: ['original-session'] }];
  for (const reference of references) {
    const awarded = [reference];
    const original = structuredClone(awarded);
    for (const activities of [[], [run(250_000)]]) {
      const evaluated = evaluateAchievementSystem({ activities, awarded, units: 'metric', now });
      const retired = evaluated.find(item => item.id === retiredId)!;
      assert.equal(retired.state, 'earned');
      assert.equal(retired.threshold, 5000);
      assert.equal(retired.currentProgress, 5000);
      assert.equal(retired.achievedDate, typeof reference === 'string' ? undefined : reference.awardedAt);
      assert.equal(achievementShareAllowed(retired), true);
      assert.equal(getAchievementDefinition(retiredId)?.artworkKey, retired.artworkKey);
      assert.equal(achievementBadgePresentation(retired, 'challenges'), retired);
      assert.equal(badgeFamilyPresentationRows(evaluated, 'all').filter(item => item.id === retiredId).length, 1);
      assert.equal(badgeFamilyPresentationRows(evaluated, 'recent').filter(item => item.id === retiredId).length, 1);
      assert.equal(select(evaluated, 'all').length, 99, 'earned archival badges remain in historical browsing totals');
      assert.equal(select(evaluated, 'recent').filter(item => item.id === retiredId).length, 1);
      if (typeof reference !== 'string' && reference.supportingActivityIds) {
        assert.deepEqual(retired.supportingActivityIds, reference.supportingActivityIds);
        assert.equal(retired.achievedActivityId, 'original-run');
      }
      assert.equal(evaluateAchievementAwards(activities, [retiredId], now).filter(item => item.id === retiredId).length, 1);
    }
    assert.deepEqual(awarded, original);
  }
});

test('actual award-store reconciliation preserves the historical record and never queues its unlock again', async () => {
  const original = { id: retiredId, awardedAt: earnedAt, supportingActivityIds: ['original-run'], supportingSessionIds: ['original-session'] };
  const values = new Map([['achievement-store', JSON.stringify({ state: { awarded: [original] }, version: 1 })]]);
  const storage = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const filename = path.resolve('src/store/achievementStore.ts');
  const require = createRequire(filename);
  const module = { exports: {} as { useAchievementStore?: typeof import('../../src/store/achievementStore').useAchievementStore } };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) => id === './persistStorage'
    ? { createAppJSONStorage: () => createJSONStorage(() => storage) } : require(id) }, { filename });
  const store = module.exports.useAchievementStore!;
  if (!store.persist.hasHydrated()) await new Promise<void>(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
  });
  for (let replay = 0; replay < 2; replay += 1) {
    store.getState().recordAwards(evaluateAchievementAwards([run(250_000)], store.getState().awarded.map(item => item.id), now), now);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(structuredClone(store.getState().awarded.filter(item => item.id === retiredId)), [original]);
  assert.equal(store.getState().unlockQueue.some(item => item.id === retiredId), false);
  const saved = JSON.parse(values.get('achievement-store')!).state.awarded;
  assert.deepEqual(saved.filter((item: { id: string }) => item.id === retiredId), [original]);
  for (const id of ['monthly_run_150k', 'monthly_run_200k']) {
    assert.equal(saved.filter((item: { id: string }) => item.id === id).length, 1);
    assert.equal(store.getState().unlockQueue.filter(item => item.id === id).length, 1);
  }
});
