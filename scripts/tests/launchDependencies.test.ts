import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const query = routerRequire('query-string');

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
    const q = require(${JSON.stringify(require.resolve('query-string'))});
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

test('Metro image assets use the patched decoder through its real import path', () => {
  const metroRoot = dirname(require.resolve('metro/package.json'));
  const { getAssetSize } = require(join(metroRoot, 'src/Assets.js'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7G8AAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(getAssetSize('png', png, 'test.png'), { width: 1, height: 1 });
  assert.throws(() => getAssetSize('png', Buffer.alloc(0), 'empty.png'));
  const metroRequire = createRequire(require.resolve('metro/package.json'));
  const image = metroRequire('image-size');
  assert.equal(typeof image.default, 'function');
  // The patched ICNS parser must reject a zero-length entry instead of looping.
  const malformed = Buffer.alloc(16);
  malformed.write('icns'); malformed.writeUInt32BE(16, 4); malformed.write('ic07', 8);
  assert.throws(() => image.default(malformed));
});

test('the actual Expo CLI schemas accept supported plugins and reject invalid output after Zod update', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const cliRoot = dirname(expoRequire.resolve('@expo/cli/package.json'));
  const { PluginSchema, DevToolsPluginOutputSchema } = require(join(cliRoot, 'build/src/start/server/DevToolsPlugin.schema.js'));
  const plugin = { packageName: 'test-plugin', packageRoot: '/test', cliExtensions: { description: 'Test', entryPoint: 'index.js', commands: [{ name: 'status', title: 'Status', environments: ['cli', 'mcp'], parameters: [{ name: 'count', type: 'number' }] }] } };
  assert.equal(PluginSchema.safeParse(plugin).success, true);
  assert.equal(PluginSchema.safeParse({ packageName: '', packageRoot: '/test' }).success, false);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 'Ready', level: 'info' }]).success, true);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'audio', url: 'not a URL' }]).success, false);
});

test('both Expo plist consumers retain round-trip compatibility with the patched XML parser', () => {
  const roots = [
    createRequire(require.resolve('@bacons/xcode')),
    createRequire(require.resolve('@expo/config-plugins')),
  ];
  for (const rootRequire of roots) {
    const plistModule = rootRequire('@expo/plist');
    const plist = plistModule.default ?? plistModule;
    const value = { CFBundleIdentifier: 'com.mooremovement.strideos', nested: { enabled: true, values: ['a & b', 42] } };
    // The maintained parser intentionally uses null-prototype dictionaries.
    assert.deepEqual(JSON.parse(JSON.stringify(plist.parse(plist.build(value)))), value);
  }
});

test('the dependency lock contains the patched upstream versions and local adapter in release source', () => {
  const lock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/strideos-uri-decoder'].version, '0.5.1');
  assert.equal(lock.packages['node_modules/decode-uri-component'].resolved, 'vendor/decode-uri-component-cjs');
  assert.equal(lock.packages['node_modules/image-size'].version, '2.0.4');
  assert.equal(lock.packages['node_modules/zod'].version, '4.6.7');
  assert.equal(lock.packages['node_modules/@bacons/xcode/node_modules/@xmldom/xmldom'], undefined);
  assert.ok(readFileSync(join(process.cwd(), 'vendor/decode-uri-component-cjs/index.cjs'), 'utf8').includes("require('strideos-uri-decoder')"));
});
