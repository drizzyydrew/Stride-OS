import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { STRENGTH_ACHIEVEMENT_DEFINITIONS } from '../../../../src/achievements/strength/strengthDefinitions';

const root = path.resolve(__dirname, '../../../..');
assert.equal(path.resolve(process.cwd()), root);
const definitions = STRENGTH_ACHIEVEMENT_DEFINITIONS.map(value => ({
  id: value.id, slug: value.slug, title: value.title, titleLines: value.titleLines,
  glyph: value.glyph, threshold: value.threshold, thresholdUnit: value.thresholdUnit,
  includeInGlobalRegistry: value.includeInGlobalRegistry,
  badgeNumber: value.badgeNumber, badgeUnit: value.badgeUnit,
}));
assert.equal(definitions.length, 10);
assert.equal(definitions[0].id, 'first_strength_session');
assert.deepEqual(definitions[0].titleLines, ['FIRST STRENGTH', 'SESSION']);
const sources = Object.fromEntries([
  'src/achievements/strength/strengthDefinitions.ts',
  'src/achievements/strength/strengthArtwork.ts',
  'src/achievements/strength/strengthTokens.ts',
  'src/achievements/strength/strengthUtils.ts',
  'src/achievements/firsts/firstsGlyphs.ts',
].map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
const baseline = Object.fromEntries(['unlocked', 'locked', 'transparent'].flatMap(state =>
  ['svg', 'png'].map(extension => {
    const file = `first-session-${state}.${extension}`;
    return [file, createHash('sha256').update(readFileSync(path.join(__dirname, file))).digest('hex')];
  }),
));
const baselinePath = path.join(__dirname, 'approved-first-session-hashes.json');
if (existsSync(baselinePath)) assert.deepEqual(JSON.parse(readFileSync(baselinePath, 'utf8')), baseline);
else writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({ definitions, sources }, null, 2)}\n`);
console.log('Read ten existing Strength badge definitions; no new achievements.');
