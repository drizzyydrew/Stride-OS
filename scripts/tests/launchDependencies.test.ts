import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const query = routerRequire('query-string');
const expoRequire = createRequire(require.resolve('expo/package.json'));
const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
const metroConfigRoot = dirname(expoRequire.resolve('@expo/metro-config/package.json'));
const assetWorker = join(metroConfigRoot, 'build/transform-worker/getAssets.js');
const assetRequire = createRequire(assetWorker);
const expoAssetsPath = assetRequire.resolve('@expo/metro/metro/Assets');
const metroAssetsPath = createRequire(expoAssetsPath).resolve('metro/private/Assets');
const plistConsumers = [
  createRequire(require.resolve('@bacons/xcode')),
  createRequire(expoRequire.resolve('@expo/config-plugins')),
];
const lock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'));

/** Match the package actually resolved by a consumer to its lock record, even
 * when npm moves it between hoisted and nested locations. Absence always fails. */
function lockedPackage(entry: string, expectedName: string) {
  let directory = dirname(realpathSync(entry));
  for (;;) {
    const manifestPath = join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name === expectedName) {
        const key = relative(realpathSync(process.cwd()), directory).split(sep).join('/');
        assert.ok(lock.packages[key], `Missing lock record for resolved ${expectedName}: ${key}`);
        assert.equal(lock.packages[key].version, manifest.version, `${key}: installed/locked version mismatch`);
        return { manifest, directory, key };
      }
    }
    const parent = dirname(directory);
    assert.notEqual(parent, directory, `No ${expectedName} manifest for ${entry}`);
    directory = parent;
  }
}

test('the installed Expo Router retains named CommonJS query parsing and serialization', () => {
  assert.equal(typeof query.parse, 'function');
  assert.equal(typeof query.stringify, 'function');
  const parsed = query.parse('code=a%2Bb&label=easy+run&tag=one&tag=two&flag&empty=');
  assert.deepEqual({ ...parsed }, { code: 'a+b', empty: '', flag: null, label: 'easy run', tag: ['one', 'two'] });
  assert.equal(query.stringify({ code: 'a+b', route: '/run/one', tag: ['one', 'two'] }), 'code=a%2Bb&route=%2Frun%2Fone&tag=one&tag=two');
  assert.equal(query.parse('bad=%E0%A4%A&good=%F0%9F%8F%83').good, '\u{1f3c3}');
  assert.equal(typeof query.parse('bad=%E0%A4%A').bad, 'string');
});

test('patched upstream decoding remains bounded for both reported denial-of-service inputs', () => {
  // A child process has a hard deadline so a decoder regression cannot hang CI.
  const result = spawnSync(process.execPath, ['-e', `
    const q = require(${JSON.stringify(routerRequire.resolve('query-string'))});
    q.parse('value=' + '%C2'.repeat(2500) + '%zz');
    let payload = '';
    for (let i = 0; i < 32000; i++) payload += '%' + Math.floor(i / 256).toString(16).padStart(2, '0') + '%' + (i % 256).toString(16).padStart(2, '0') + 'x';
    q.parse('value=' + payload + '%zz');
    process.stdout.write('bounded');
  `], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'bounded');
});

test('Expo Metro assets use the actual vendored image parser and reject the former ICNS attack within a deadline', () => {
  // SDK57's transformer uses @expo/metro, which resolves a nested Metro copy.
  // Metro 0.84.5 removed image-size in favor of vendored parsers (upstream #1860).
  assert.match(readFileSync(assetWorker, 'utf8'), /require\(["']@expo\/metro\/metro\/Assets["']\)/);
  const assets = assetRequire('@expo/metro/metro/Assets');
  const { getAssetSize } = assets;
  assert.equal(getAssetSize, require(metroAssetsPath).getAssetSize);
  const metro = lockedPackage(metroAssetsPath, 'metro');
  assert.equal(metro.manifest.dependencies['image-size'], undefined);
  const parserPath = createRequire(metroAssetsPath).resolve('./lib/imageSize');
  assert.match(readFileSync(metroAssetsPath, 'utf8'), /require\(["']\.\/lib\/imageSize["']\)/);
  assert.ok(require.cache[parserPath], 'the vendored parser must be loaded by the actual consumer');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7G8AAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(getAssetSize('png', png, 'test.png'), { width: 1, height: 1 });
  assert.throws(() => getAssetSize('png', Buffer.alloc(0), 'empty.png'));
  // Preserve the original zero-length ICNS attack. It is now unsupported and
  // must not enter a parser; the same bytes mislabeled as PNG must be rejected.
  // Both cases run through the real asset entry point with a hard deadline.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const assets = require(${JSON.stringify(expoAssetsPath)});
    const malformed = Buffer.alloc(16);
    malformed.write('icns'); malformed.writeUInt32BE(16, 4); malformed.write('ic07', 8);
    assert.equal(assets.isAssetTypeAnImage('icns'), false);
    assert.equal(assets.getAssetSize('icns', malformed, 'attack.icns'), null);
    assert.throws(() => assets.getAssetSize('png', malformed, 'attack.png'), /Invalid png image asset/);
    process.stdout.write('bounded');
  `], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'bounded');
});

test('the actual Expo CLI JSON schemas accept supported plugins and reject invalid output', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const cliRoot = dirname(expoRequire.resolve('@expo/cli/package.json'));
  const schemaPath = join(cliRoot, 'build/src/start/server/devtools/DevToolsPlugin.schema.js');
  const { PluginSchema, DevToolsPluginOutputSchema } = require(schemaPath);
  const { validate, ValidationError } = createRequire(schemaPath)('@expo/schema-utils');
  const plugin = { packageName: 'test-plugin', packageRoot: '/test', cliExtensions: { description: 'Test', entryPoint: 'index.js', commands: [{ name: 'status', title: 'Status', environments: ['cli', 'mcp'], parameters: [{ name: 'count', type: 'number' }] }] } };
  assert.doesNotThrow(() => validate(PluginSchema, plugin));
  assert.throws(() => validate(PluginSchema, { packageName: '', packageRoot: '/test' }), ValidationError);
  assert.doesNotThrow(() => validate(DevToolsPluginOutputSchema, [{ type: 'text', text: 'Ready', level: 'info' }]));
  assert.throws(() => validate(DevToolsPluginOutputSchema, [{ type: 'audio', url: 'not a URL' }]), ValidationError);
  const consumer = readFileSync(join(cliRoot, 'build/src/start/server/devtools/DevToolsPluginCliExtensionResults.js'), 'utf8');
  assert.match(consumer, /require\(["']@expo\/schema-utils["']\)/);
  assert.match(consumer, /\.validate\)\(_DevToolsPluginschema\.DevToolsPluginOutputSchema, output\)/);
});

test('both Expo plist consumers retain round-trip compatibility with the patched XML parser', () => {
  for (const rootRequire of plistConsumers) {
    const plistModule = rootRequire('@expo/plist');
    const plistPath = rootRequire.resolve('@expo/plist');
    lockedPackage(plistPath, '@expo/plist');
    const xml = lockedPackage(createRequire(plistPath).resolve('@xmldom/xmldom'), '@xmldom/xmldom');
    assert.equal(xml.manifest.version, '0.8.15', 'each real plist consumer must resolve the patched XML parser');
    const plist = plistModule.default ?? plistModule;
    const value = { CFBundleIdentifier: 'com.mooremovement.strideos', nested: { enabled: true, values: ['a & b', 42] } };
    // The maintained parser intentionally uses null-prototype dictionaries.
    assert.deepEqual(JSON.parse(JSON.stringify(plist.parse(plist.build(value)))), value);
  }
});

test('the dependency lock contains the patched upstream versions and local adapter in release source', () => {
  const decoder = lockedPackage(require.resolve('strideos-uri-decoder'), 'decode-uri-component');
  assert.equal(decoder.manifest.version, '0.5.1');
  assert.equal(lock.packages['node_modules/decode-uri-component'].resolved, 'vendor/decode-uri-component-cjs');
  const queryRequire = createRequire(routerRequire.resolve('query-string'));
  assert.equal(realpathSync(queryRequire.resolve('decode-uri-component')), realpathSync(require.resolve('decode-uri-component')));
  // image-size was removed upstream, so require its absence across the whole
  // graph rather than manufacturing a package merely to satisfy an old test.
  assert.deepEqual(Object.keys(lock.packages).filter(key => key.endsWith('/image-size')), []);
  assert.equal(require('./../../package.json').overrides.metro['image-size'], '2.0.4');
  // Expo CLI 57.0.33 replaced runtime Zod with its own JSON-schema validator.
  // Verify the actual replacement rather than installing an unused old parser.
  lockedPackage(cliRequire.resolve('@expo/schema-utils'), '@expo/schema-utils');
  assert.equal(cliRequire('./package.json').dependencies.zod, undefined);
  assert.deepEqual(Object.keys(lock.packages).filter(key => key.endsWith('/zod')), []);
  assert.ok(readFileSync(join(process.cwd(), 'vendor/decode-uri-component-cjs/index.cjs'), 'utf8').includes("require('strideos-uri-decoder')"));
});

test('RevenueCat stays on the Expo-compatible release with a published CocoaPods dependency', () => {
  const lock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages[''].dependencies['react-native-purchases'], '10.16.0');
  assert.equal(lock.packages['node_modules/react-native-purchases'].version, '10.16.0');
  const podspec = readFileSync(join(dirname(require.resolve('react-native-purchases/package.json')), 'RNPurchases.podspec'), 'utf8');
  // Verified in the CocoaPods registry; RevenueCat 11's 20.1.0 pod is unpublished.
  assert.match(podspec, /spec\.dependency\s+"PurchasesHybridCommon", '19\.17\.0'/);
});
