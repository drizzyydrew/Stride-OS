import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Exercise the real Babel export used by the installed Expo Metro transformer.
// No filesystem mocks, application accounts, private files, or network inputs.
const projectRequire = createRequire(resolve('package.json'));
const metroRoot = dirname(projectRequire.resolve('@expo/metro-config/package.json'));
const metroBabel = projectRequire(join(metroRoot, 'build/babel-core.js')) as {
  transformSync: (code: string, options: Record<string, unknown>) => {
    code: string | null;
    map: { sources: string[]; sourcesContent?: (string | null)[] } | null;
  } | null;
};

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), 'strideos-babel-map-'));
  const root = join(temporary, 'synthetic-package');
  mkdirSync(root);
  writeFileSync(join(root, 'package.json'), '{"name":"synthetic-babel-regression","private":true}');
  const filename = join(root, 'input.js');
  const options = { filename, cwd: root, root, configFile: false, babelrc: false, sourceMaps: true };
  return { temporary, root, options };
}

// Reproduces the maintainer advisory's sourceMappingURL boundary using only
// a source map created by this test. Old Babel imports the outside marker.
for (const reference of ['relative', 'absolute'] as const) {
  test(`Expo Metro Babel ignores ${reference} sourceMappingURL outside the input package`, () => {
    const f = fixture();
    try {
      const marker = 'SYNTHETIC_OUTSIDE_PACKAGE_MAP_CONTENT';
      const outsideMap = join(f.temporary, 'outside.map');
      writeFileSync(outsideMap, JSON.stringify({
        version: 3, file: 'input.js', sources: ['outside-original.ts'], names: [],
        mappings: 'AAAA', sourcesContent: [marker],
      }));
      const url = reference === 'relative' ? '../outside.map' : outsideMap;
      const output = metroBabel.transformSync(`const answer = 42;\n//# sourceMappingURL=${url}`, f.options);
      assert.ok(output?.code && output.map, 'transformation and output map must still succeed');
      assert.ok(!output.map.sourcesContent?.some(content => content?.includes(marker)),
        'external package map content must not enter the output source map');
      assert.ok(output.map.sources.includes('input.js'), 'fall back to the compiled input source');
    } finally {
      rmSync(f.temporary, { recursive: true, force: true });
    }
  });
}

test('Expo Metro Babel preserves trusted adjacent input maps and transform semantics', () => {
  const f = fixture();
  try {
    const original = 'const square = (value) => value * value;';
    writeFileSync(join(f.root, 'input.js.map'), JSON.stringify({
      version: 3, file: 'input.js', sources: ['original.ts'], names: [],
      mappings: 'AAAA', sourcesContent: [original],
    }));
    const output = metroBabel.transformSync(`${original}\nglobalThis.answer = square(6);\n//# sourceMappingURL=input.js.map`, {
      ...f.options, plugins: [projectRequire.resolve('@babel/plugin-transform-arrow-functions')],
    });
    assert.ok(output?.code && output.map);
    assert.doesNotMatch(output.code, /=>/);
    const context: { answer?: number } = {};
    runInNewContext(output.code, context, { timeout: 1000 });
    assert.equal(context.answer, 36);
    assert.ok(output.map.sources.includes('original.ts'));
    assert.ok(output.map.sourcesContent?.includes(original));
  } finally {
    rmSync(f.temporary, { recursive: true, force: true });
  }
});
