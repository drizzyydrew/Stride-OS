import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(path: string, mocks: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', esModuleInterop: true,
  } }).outputText;
  runInNewContext(source, { module, exports: module.exports,
    require: (name: string) => mocks[name] ?? {
      __esModule: true, default: name.split('/').at(-1),
      useState: (v: any) => [v, () => {}],
      View: 'View', Text: 'Text', StyleSheet: { create: (s: any) => s },
    },
    h: (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  return module.exports.default;
}

function nodes(tree: any): any[] {
  return tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
}

test('badge exports contain only canonical badge and fixed wordmark in every format and variant', () => {
  const render = load('src/components/share/BadgeShareCanvas.tsx');
  for (const id of ['challenge_august_base_builder', 'monthly_run_200k', 'run_level_1', 'first_run']) {
    for (const format of ['square', 'story']) for (const variant of ['minimal_card', 'transparent_overlay', 'editorial_card']) {
      const ref = { current: null };
      const tree = render({ achievement: { id, title: 'Synthetic badge', category: 'challenges', state: 'earned', displayTarget: '3' },
        units: 'metric', variant, format, canvasRef: ref });
      const all = nodes(tree);
      assert.equal(tree.props.ref, ref);
      assert.equal(tree.props.collapsable, false);
      const badge = all.filter(n => n.type === 'AchievementBadge');
      assert.equal(badge.length, 1);
      assert.equal(badge[0].props.id, id);
      assert.equal(badge[0].props.badgeState, variant === 'transparent_overlay' ? 'transparent' : 'unlocked');
      const brand = all.filter(n => n.type === 'ShareBrandMark');
      assert.equal(brand.length, 1);
      assert.equal(brand[0].props.showChevrons, false);
      assert.equal(brand[0].props.darkInk, variant === 'editorial_card');
      assert.equal(all.some(n => ['Text', 'MovableLayer', 'TouchableOpacity'].includes(n.type)), false);
      assert.equal(all.some(n => Object.keys(n.props).some(k => /Responder|onPress|onTouch/.test(k))), false);
      assert.equal(tree.props.style[1].aspectRatio, format === 'story' ? 9 / 16 : 1);
      assert.equal(tree.props.style[1].backgroundColor, variant === 'transparent_overlay' ? 'transparent' : variant === 'editorial_card' ? '#F3F1EB' : '#0E0E0F');
    }
  }
});

test('wordmark-only branding removes decorative row without changing other share branding', () => {
  const render = load('src/components/share/ShareBrandMark.tsx');
  const text = (tree: any) => nodes(tree).flatMap(n => n.children.filter((v: any) => typeof v === 'string')).join('');
  assert.equal(text(render({ showChevrons: false })), 'StrideOS');
  assert.equal(text(render({})), 'StrideOS>>>>>');
});

test('locked previews retain dormant artwork even on transparent style; hub captures inner canvas', () => {
  const render = load('src/components/share/BadgeShareCanvas.tsx');
  const tree = render({ achievement: { id: 'first_run', title: 'First Run', state: 'locked' },
    variant: 'transparent_overlay', format: 'square', units: 'imperial' });
  assert.equal(nodes(tree).find(n => n.type === 'AchievementBadge').props.badgeState, 'locked');
  const hubRender = load('src/components/achievements/AchievementShareCard.tsx');
  const ref = { current: null };
  const hub = hubRender({ achievement: { id: 'first_run', title: 'First Run' }, variant: 'photo_overlay', canvasRef: ref });
  assert.equal(hub.type, 'BadgeShareCanvas');
  assert.equal(hub.props.canvasRef, ref);
  assert.equal(hub.props.variant, 'transparent_overlay');
  const page = readFileSync('app/(tabs)/more/achievements.tsx', 'utf8');
  assert.doesNotMatch(page, /<View ref=\{shareRef\}/);
  assert.match(page, /canvasRef=\{shareRef\}/);
});

test('achievement entry point cannot reintroduce related activity metrics or editing controls', () => {
  const page = readFileSync('app/(tabs)/more/achievement-detail.tsx', 'utf8');
  assert.doesNotMatch(page, /activity=\{relatedActivity\}|SHARE_STUDIO_ACHIEVEMENT_VARIANT|onInteractionActiveChange|shareInteractionActive/);
  assert.match(page, /<ScreenHeader[\s\S]*onBack=/);
  const studio = readFileSync('src/components/share/ShareStudio.tsx', 'utf8');
  assert.match(studio, /props\.achievement && props\.variant !== 'activity_achievement'/);
  assert.match(studio, /return <BadgeShareCanvas/);
  assert.match(studio, /return <ActivityShareStudio \{\.\.\.props\}/);
});
