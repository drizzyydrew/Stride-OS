import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = process.cwd();

function filesUnder(dir: string): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap(name => {
    const path = join(absolute, name);
    return statSync(path).isDirectory()
      ? filesUnder(path.slice(ROOT.length + 1))
      : /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

const appSource = [...filesUnder('app'), ...filesUnder('src')]
  .map(path => readFileSync(path, 'utf8'))
  .join('\n');

test('removed integrations and obsolete movement labels stay absent', () => {
  assert.doesNotMatch(appSource, /apple\s*music|musickit|connect music/i);
  assert.doesNotMatch(appSource, /45°|Front 45/);
  assert.doesNotMatch(appSource, /Lunge \/ Single-Leg/);
});

test('forbidden certainty and injury-causation language stays out of Movement Lab', () => {
  const movementEngine = readFileSync(join(ROOT, 'src/utils/movementEngine.ts'), 'utf8');
  assert.doesNotMatch(movementEngine, /\b(?:bad form|causes injury|high injury risk|high risk for|guaranteed)\b/i);
});

test('the retired stick-figure component is absent', () => {
  assert.equal(existsSync(join(ROOT, 'src/components/movement/CaptureSilhouette.tsx')), false);
});
