import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RUN_LEVEL_DEFINITIONS } from '../../../../src/achievements/runLevels/runLevelDefinitions';
import { RUN_LEVEL_MOUNTAIN, runLevelHexPath, runLevelRingInsets, runLevelRingPath } from '../../../../src/achievements/runLevels/runLevelArtwork';

const root = path.resolve(__dirname, '../../../..');
assert.equal(process.cwd(), root);
assert.equal(RUN_LEVEL_DEFINITIONS.length, 7);
assert.deepEqual(RUN_LEVEL_DEFINITIONS.map(value => value.ringCount), [5, 5, 5, 5, 6, 6, 6]);
const sources = Object.fromEntries([
  'src/achievements/runLevels/runLevelDefinitions.ts',
  'src/achievements/runLevels/runLevelThresholds.ts',
  'src/achievements/runLevels/runLevelArtwork.ts',
  'src/achievements/runLevels/runLevelColors.ts',
].map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')]));
writeFileSync(path.join(__dirname, 'definitions.json'), `${JSON.stringify({
  definitions: RUN_LEVEL_DEFINITIONS,
  sources,
  outer: runLevelHexPath(0), bevel: runLevelHexPath(7), mountain: RUN_LEVEL_MOUNTAIN,
  rings: Object.fromEntries(RUN_LEVEL_DEFINITIONS.map(value => [value.slug, runLevelRingInsets(value).map(inset => ({ inset, path: runLevelRingPath(inset) }))])),
}, null, 2)}\n`);
console.log('Read seven existing Run Levels and canonical frame/mountain/ring geometry; no app changes.');
