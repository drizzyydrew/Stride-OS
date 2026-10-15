import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { APPROVED_BADGE_ASSETS, APPROVED_BADGE_STATES } from '../lib/approvedBadgeFamilies';
import { ACHIEVEMENT_SYSTEM_REGISTRY, auditAchievementRegistry, evaluateAchievementSystem } from '../../src/utils/achievementSystem';
import { CHALLENGE_PRESENTATION_DEFINITIONS, CHALLENGE_REGISTRY_DEFINITIONS } from '../../src/achievements/challenges/challengesDefinitions';
import { achievementBadgePresentation, badgeFamilyPresentationRows } from '../../src/achievements/badgePresentation';
import { renderStreakBadgeSvg, streakNumberLayout, safeStreakDays } from '../../src/achievements/streaks/streakArtwork';
import { renderLifetimeDistanceRunningBadgeSvg } from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningArtwork';
import { renderChallengeBadgeSvg } from '../../src/achievements/challenges/challengesArtwork';
import type { Activity } from '../../src/types/activity';
import { validateLegacyChallengeAssets } from '../lib/legacyChallengeAssets';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

test('approved integration covers exactly nine additional families and 300 canonical state/unit pairs', () => {
  assert.equal(new Set(APPROVED_BADGE_ASSETS.map(entry => entry.family)).size, 9);
  assert.equal(APPROVED_BADGE_ASSETS.length * 3, 300);
  assert.equal(new Set(APPROVED_BADGE_ASSETS.map(entry => `${entry.family}:${entry.id}:${entry.units}`)).size, APPROVED_BADGE_ASSETS.length);
  assert.equal(auditAchievementRegistry().total, 99);
  assert.deepEqual(auditAchievementRegistry().duplicateIds, []);
  for (const id of ['monthly_run_150k', 'monthly_run_200k', 'first_structured_workout', 'challenge_5k_month']) assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.filter(entry => entry.id === id).length, 1);
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.find(entry => entry.id === 'first_structured_workout')?.family, 'firsts');
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.find(entry => entry.id === 'monthly_run_150k')?.threshold, 150_000);
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.find(entry => entry.id === 'monthly_run_200k')?.threshold, 200_000);
  assert.equal(ACHIEVEMENT_SYSTEM_REGISTRY.find(entry => entry.id === 'challenge_elevation_month')?.threshold, Infinity);
});

test('every approved render and compact render has exact aliases, outlined copy and resolved namespace references', () => {
  for (const entry of APPROVED_BADGE_ASSETS) for (const compact of [false, true]) {
    assert.equal(entry.render('share-opaque', 100, compact), entry.render('unlocked', 100, compact));
    assert.equal(entry.render('share-transparent', 100, compact), entry.render('transparent', 100, compact));
    for (const state of APPROVED_BADGE_STATES) {
      const svg = entry.render(state, 100, compact);
      assert.doesNotMatch(svg, /<text\b|<image\b|font-family=|\{\{[^}]+\}\}/);
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const nodes = Array.from(doc.getElementsByTagName('*'));
      const ids = nodes.map(node => node.getAttribute('id')).filter(Boolean);
      assert.equal(ids.length, new Set(ids).size);
      for (const ref of svg.matchAll(/url\(#([^()]+)\)/g)) assert(ids.includes(ref[1]), `${entry.id}: broken reference ${ref[1]}`);
      assert(svg.includes('viewBox="0 0 100 100"'));
    }
  }
});

test('compiled geometry provenance retains the exact frozen reference SVGs', () => {
  for (const entry of APPROVED_BADGE_ASSETS) for (const source of Object.values(entry.artwork.sources)) assert.equal(sha(readFileSync(source.path)), source.sha256);
});

test('Challenges and Strength galleries reuse earned IDs without registering presentation awards', () => {
  const canonical = evaluateAchievementSystem({ activities: [], units: 'metric' });
  const challenges = badgeFamilyPresentationRows(canonical, 'challenges');
  assert.equal(challenges.length, 13);
  const approvedOrder = JSON.parse(readFileSync('docs/handoff/badge-review/challenges/individual-exports/manifest.json', 'utf8')).definitions.map((entry: { id: string }) => entry.id);
  assert.deepEqual(challenges.map(item => item.id), approvedOrder);
  assert.equal(new Set(challenges.map(item => item.id)).size, 13);
  assert(!challenges.some(item => item.id === 'challenge_5k_month'));
  for (const item of challenges) {
    const original = canonical.find(value => value.id === item.id)!;
    assert.equal(item.category, 'challenges');
    for (const key of ['id', 'family', 'state', 'threshold', 'thresholdUnit', 'ruleKind', 'period', 'unitBehavior', 'currentProgress', 'achievedDate'] as const) assert.equal(item[key], original[key]);
  }
  const strength = badgeFamilyPresentationRows(canonical, 'strength');
  assert.equal(strength.length, 10);
  assert.equal(strength.find(item => item.id === 'first_structured_workout')?.category, 'strength');
  assert.equal(badgeFamilyPresentationRows(canonical, 'all').length, canonical.length - 1);
  const firstRun = canonical.find(item => item.id === 'first_run')!;
  assert.equal(achievementBadgePresentation(firstRun, 'challenges'), firstRun);
  assert.equal(achievementBadgePresentation(firstRun, 'invalid'), firstRun);
  assert.equal(CHALLENGE_REGISTRY_DEFINITIONS.length, 7);
  assert.equal(CHALLENGE_PRESENTATION_DEFINITIONS.filter(item => item.includeInGlobalRegistry).length, 6);
});

test('retired 5K remains addressable but cannot be newly earned; 150K/200K retain Monthly thresholds', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const activity: Activity = {
    id: 'legacy-five-k', activityType: 'running', subtype: 'general', source: 'manual', status: 'completed',
    scheduled: false, indoor: false, startTime: now - 1800_000, endTime: now, createdAt: now, updatedAt: now,
    metrics: { distanceMeters: 5000, durationSeconds: 1800 },
    trainingLoad: { method: 'estimated', wholeBody: 0, running: 0, walking: 0, strength: 0, crossTraining: 0, impactBearing: 0, nonImpactAerobic: 0, confidence: 'low' },
  };
  const evaluated = evaluateAchievementSystem({ activities: [activity], units: 'imperial', now });
  assert.equal(evaluated.find(item => item.id === 'challenge_5k_month')?.state, 'locked');
  assert.equal(evaluated.find(item => item.id === 'monthly_run_150k')?.state, 'locked');
  assert.equal(evaluated.find(item => item.id === 'monthly_run_200k')?.state, 'locked');
  assert(renderChallengeBadgeSvg('challenge_5k_month').includes('5K'));
  assert.match(renderChallengeBadgeSvg('monthly_run_150k'), /data-text="150K"/);
  assert.match(renderChallengeBadgeSvg('monthly_run_200k'), /data-text="200K"/);
});

test('legacy 5K uses font-free archival SVG/PNG exports and reports historical raster variance', async () => {
  const manifest = JSON.parse(readFileSync('assets/achievements/challenges/manifest.json', 'utf8'));
  assert.equal((await validateLegacyChallengeAssets(manifest.legacy)).length, 6);
});

test('daily flame counts fit optically through safe-integer limits without creating awards', () => {
  const before = ACHIEVEMENT_SYSTEM_REGISTRY.map(item => item.id);
  for (const count of [...Array.from({ length: 400 }, (_, index) => index + 1), 1000, 99999, Number.MAX_SAFE_INTEGER]) {
    const layout = streakNumberLayout(count);
    assert(Math.abs(layout.bounds[0] - (100 - layout.bounds[2])) < 1e-7);
    assert(layout.bounds[2] - layout.bounds[0] <= 34.000001);
    assert(layout.bounds[1] > 48 && layout.bounds[3] < 65);
    for (const state of APPROVED_BADGE_STATES) assert.match(renderStreakBadgeSvg(count, state), /data-glyph="custom-three-tongue-flame"/);
  }
  assert.equal(safeStreakDays(Infinity), 1);
  assert.equal(safeStreakDays(1e30), Number.MAX_SAFE_INTEGER);
  assert.deepEqual(ACHIEVEMENT_SYSTEM_REGISTRY.map(item => item.id), before);
});

test('distance artwork selection uses canonical IDs and unit settings, not locale-formatted lookup strings', () => {
  const locale = Number.prototype.toLocaleString;
  try {
    Number.prototype.toLocaleString = function () { return 'localized-support'; };
    assert.match(renderLifetimeDistanceRunningBadgeSvg(1, 'unlocked', { unitSystem: 'metric' }), /data-text="1.6"/);
    assert.match(renderLifetimeDistanceRunningBadgeSvg(1, 'unlocked', { unitSystem: 'imperial' }), /data-text="1"/);
  } finally { Number.prototype.toLocaleString = locale; }
});

test('production artwork imports contain no build-time Node, docs or font-engine dependencies', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  }
  for (const file of walk('src/achievements').filter(file => /\.(ts|tsx)$/.test(file))) {
    const source = readFileSync(file, 'utf8');
    for (const imported of source.matchAll(/(?:from\s+|require\()['"]([^'"]+)['"]/g)) assert(!/node:|docs\/|scripts\/|fonttools|fontkit|sharp|xmldom/.test(imported[1]), `${file}: build-only import ${imported[1]}`);
  }
  for (const file of ['runLevels/RunLevelBadge.tsx', 'weeklyDistance/WeeklyDistanceBadge.tsx', 'monthlyDistance/MonthlyDistanceBadge.tsx', 'streaks/StreakBadge.tsx']) {
    const source = readFileSync(`src/achievements/${file}`, 'utf8');
    assert.match(source, /<SvgXml/);
    assert.doesNotMatch(source, /<SvgText|<LinearGradient|<Path\b/);
  }
});
