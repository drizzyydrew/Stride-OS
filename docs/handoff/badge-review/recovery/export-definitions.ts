import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RECOVERY_ACHIEVEMENT_DEFINITIONS } from '../../../../src/achievements/recovery/recoveryDefinitions';

const root = path.resolve(__dirname, '../../../..');
assert.equal(path.resolve(process.cwd()), root);
const definitions = RECOVERY_ACHIEVEMENT_DEFINITIONS.map(value => ({
  id: value.id, slug: value.slug, title: value.title, titleLines: value.titleLines,
  glyph: value.glyph, threshold: value.threshold, thresholdUnit: value.thresholdUnit,
  progressKind: value.progressKind,
}));
assert.equal(definitions.length, 7);
assert.equal(definitions[0].id, 'recovery_week_completed');
const approved = Object.fromEntries(['unlocked', 'locked', 'transparent'].flatMap(state => ['svg', 'png'].map(extension => {
  const file = `vine-hammock/recovery-week-vines-${state}.${extension}`;
  return [file, createHash('sha256').update(readFileSync(path.join(__dirname, file))).digest('hex')];
})));
const approvedPath = path.join(__dirname, 'approved-vine-hammock-hashes.json');
if (existsSync(approvedPath)) assert.deepEqual(JSON.parse(readFileSync(approvedPath, 'utf8')), approved);
else writeFileSync(approvedPath, `${JSON.stringify(approved, null, 2)}\n`);
const sources = Object.fromEntries([
  'src/achievements/recovery/recoveryDefinitions.ts',
  'src/achievements/recovery/recoveryArtwork.ts',
  'src/achievements/recovery/recoveryTokens.ts',
  'src/achievements/recovery/recoveryUtils.ts',
].map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({ definitions, sources }, null, 2)}\n`);
console.log('Read seven existing Recovery definitions; first preview is Recovery Week Completed.');
