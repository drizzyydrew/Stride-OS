import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { RACE_PR_DEFINITIONS, racePrDefinitionFromAchievementId } from '../../src/achievements/racePr/racePrDefinitions';
import * as definitions from '../../src/achievements/racePr/racePrDefinitions';
import { renderRacePrBadgeSvg } from '../../src/achievements/racePr/racePrArtwork';
import { RACE_PR_BADGE_IDS } from '../../src/utils/racePrAwards';
import { ACHIEVEMENT_SYSTEM_REGISTRY, auditAchievementRegistry, evaluateAchievementSystem } from '../../src/utils/achievementSystem';
import type { RacePR } from '../../src/types/athlete';

const now = new Date(2026, 10, 5, 14).getTime();
const performance = (index: number, patch: Partial<RacePR> = {}): RacePR => {
  const def = RACE_PR_DEFINITIONS[index];
  return { id: `result-${def.id}`, distanceKey: def.distanceKey, distanceLabel: def.distanceLabel,
    distanceMeters: def.distanceMeters, timeSeconds: index === 0 ? 150 : index === 1 ? 270 : 1800 + index * 100,
    date: '2026-11-04', official: true, ...patch };
};
const evaluate = (racePRs: RacePR[], awarded: { id: string; awardedAt: number }[] = []) =>
  evaluateAchievementSystem({ activities: [], racePRs, awarded, units: 'imperial', now }).filter(item => item.ruleKind === 'race_pr');

test('six exact race classes have unique canonical art and registry identities, independent of legacy segment PRs', () => {
  assert.equal(RACE_PR_DEFINITIONS.length, 6);
  assert.deepEqual(new Set(RACE_PR_DEFINITIONS.map(def => def.distanceKey)), new Set(['800m', '1_mile', '5k', '10k', 'half_marathon', 'marathon']));
  assert.deepEqual(auditAchievementRegistry().duplicateIds, []);
  for (const def of RACE_PR_DEFINITIONS) {
    assert.equal(RACE_PR_BADGE_IDS[def.distanceKey], def.id);
    const entry = ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === def.id)!;
    assert.equal(entry.family, 'personal_records');
    assert.equal(entry.repeatability, 'record');
    assert.equal(entry.shareArtPath, def.unlockedPngPath);
    assert.equal(entry.shareOverlayPath, def.shareTransparentPngPath);
    for (const path of [def.artworkPath, def.lockedArtworkPath, def.unlockedPngPath, def.lockedPngPath, def.shareTransparentSvgPath, def.shareTransparentPngPath]) assert(existsSync(path), path);
  }
  assert.equal(racePrDefinitionFromAchievementId('pr_fastest_5k'), null, 'legacy continuous-segment awards keep their separate meaning');
});

test('confirmed results unlock all six; short 800m/mile finishes are not filtered by ordinary workout minimums', () => {
  const values = evaluate(RACE_PR_DEFINITIONS.map((_, index) => performance(index)));
  assert(values.every(value => value.state === 'earned'));
  assert.equal(values[0].personalBest?.timeSeconds, 150);
  assert.equal(values[1].personalBest?.timeSeconds, 270);
  assert.equal(values[0].displayTarget, '800 Meters');
  assert.equal(values[0].supportingActivityIds.length, 0, 'a manually recorded result does not fabricate an Activity link');
  assert.equal(evaluate([]).filter(value => value.state === 'locked').length, 6);
});

test('grid and detail describe the current exact-distance best without inventing a result from past award ownership', () => {
  const original = performance(2);
  const faster = performance(2, { id: 'faster', timeSeconds: 1100, date: '2026-11-05' });
  const values = evaluate([original, faster]);
  const best = values.find(value => value.id === 'race_pr_5k')!;
  assert.equal(best.personalBest?.timeSeconds, 1100);
  assert.equal(best.displayProgress, '18:20');
  const withdrawn = evaluate([], [{ id: 'race_pr_5k', awardedAt: now - 1000 }]).find(value => value.id === 'race_pr_5k')!;
  assert.equal(withdrawn.state, 'earned', 'historical badge ownership is preserved');
  assert.equal(withdrawn.personalBest, undefined);
  assert.equal(withdrawn.displayProgress, 'No current result');
});

test('mislabeled distance, future or invalid result cannot earn a race PR badge', () => {
  const invalid = [performance(2, { distanceMeters: 5100 }), performance(3, { timeSeconds: NaN }), performance(4, { date: '2099-01-01' })];
  assert(evaluate(invalid).every(value => value.state === 'locked'));
});

function loadComponent(file: string, mocks: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
    : name === 'react-native' ? { View: 'View', Text: 'Text', StyleSheet: { create: (value: unknown) => value } }
      : mocks[name] ?? {} });
  return exports.default;
}

test('actual app badge dispatch and native SvgXml use the same canonical renderer for all six states and sizes', () => {
  const nativeRaceBadge = loadComponent('src/achievements/racePr/RacePrBadge.tsx', {
    'react-native-svg': { SvgXml: 'SvgXml' },
    './racePrArtwork': { renderRacePrBadgeSvg, RACE_PR_VIEWBOX: 100 },
    './racePrDefinitions': definitions,
  });
  const badge = loadComponent('src/components/achievements/AchievementBadge.tsx', {
    '../../achievements/racePr': { RacePrBadge: nativeRaceBadge, racePrDefinitionFromAchievementId },
  });
  for (const definition of RACE_PR_DEFINITIONS) for (const state of ['unlocked', 'locked', 'transparent'] as const) for (const size of ['small', 'medium', 'large'] as const) {
    const dispatch = badge({ id: definition.id, earned: state !== 'locked', badgeState: state, size });
    assert.equal(dispatch.type, nativeRaceBadge);
    const rendered = nativeRaceBadge(dispatch.props);
    assert.equal(rendered.props.children.type, 'SvgXml');
    assert.equal(rendered.props.children.props.xml, renderRacePrBadgeSvg(definition.id, state, { compact: size === 'small', size: 100 }));
    assert.match(rendered.props.accessibilityLabel, /personal record/);
  }
});
