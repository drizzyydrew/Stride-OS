import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

type Manifest = { assets: { relativePath: string; status: string; inspectionStatus: string }[] };

test('Dion registry covers every approved production asset', () => {
  const root = process.cwd();
  const manifest = JSON.parse(readFileSync(join(root, 'assets/movement-lab/assets/movement_image_manifest.json'), 'utf8')) as Manifest;
  const registry = readFileSync(join(root, 'src/constants/dionImages.ts'), 'utf8');
  assert.equal(manifest.assets.length, 32);
  for (const asset of manifest.assets) {
    assert.equal(asset.status, 'approved');
    assert.match(asset.inspectionStatus, /^passed(?:_|$)/);
    assert.equal(existsSync(join(root, 'assets/movement-lab/assets', asset.relativePath)), true, asset.relativePath);
    assert.match(registry, new RegExp(asset.relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
