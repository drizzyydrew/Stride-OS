// ─── Startup branding + live-weather wiring regression tests (Build 37) ──────
//
// Source-level assertions: one canonical startup treatment shared by the
// native splash config and the React brand splash, no tagline anywhere, no
// hardcoded dashboard weather, and hydration's manual-weather mode protected
// from live-weather overwrites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? __dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|json)$/.test(name)) out.push(full);
  }
  return out;
}

test('startup tagline is fully removed from the source tree', () => {
  const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    assert.ok(!content.includes('MOVE NOW'), `tagline text found in ${file}`);
    assert.ok(!content.includes('AGE GRACEFULLY'), `tagline text found in ${file}`);
  }
});

test('native splash and React brand splash share one canonical treatment', () => {
  const appJson = JSON.parse(read('app.json'));
  const splashPlugin = (appJson.expo.plugins as unknown[]).find(
    (p): p is [string, Record<string, unknown>] => Array.isArray(p) && p[0] === 'expo-splash-screen',
  );
  assert.ok(splashPlugin, 'expo-splash-screen plugin missing from app.json');
  const cfg = splashPlugin[1] as { image: string; imageWidth: number; backgroundColor: string; dark?: { image: string; backgroundColor: string } };

  // Native config: the logo-led dark treatment in both device appearances.
  assert.equal(cfg.image, './assets/images/splash-logo-transparent.png');
  assert.equal(cfg.backgroundColor, '#11100F');
  assert.equal(cfg.imageWidth, 220);
  assert.equal(cfg.dark?.image, './assets/images/splash-logo-transparent.png');
  assert.equal(cfg.dark?.backgroundColor, '#11100F');

  // React brand splash references the SAME asset, color, and size.
  const layout = read('app/_layout.tsx');
  assert.ok(layout.includes("require('../assets/images/splash-logo-transparent.png')"), 'React splash must render the native splash asset');
  assert.ok(layout.includes("'#11100F'"), 'React splash must use the native splash background');
  assert.ok(layout.includes('SPLASH_IMAGE_WIDTH = 220'), 'React splash must match the native 220pt image width');
  assert.ok(!layout.includes('AppLogo'), 'React splash must not render a second logo treatment');

  // The startup asset actually exists and gets bundled.
  assert.ok(existsSync(join(ROOT, 'assets/images/splash-logo-transparent.png')), 'splash-logo-transparent.png missing');
});

test('AppLogo no longer carries any tagline machinery', () => {
  const logo = read('src/components/ui/AppLogo.tsx');
  assert.ok(!/tagline/i.test(logo), 'AppLogo still references a tagline');
});

test('dashboard weather is live, not hardcoded', () => {
  const dash = read('app/(tabs)/dashboard/index.tsx');
  assert.ok(!dash.includes('62°F'), 'hardcoded demo temperature still present');
  assert.ok(!dash.includes('Humidity 45%'), 'hardcoded demo humidity still present');
  assert.ok(dash.includes('useWeather'), 'dashboard must consume the live weather hook');
  assert.ok(dash.includes('formatTemp'), 'dashboard must convert temps to the selected unit system');
  assert.ok(dash.includes('permission_denied'), 'dashboard must handle the permission-denied state');
  assert.ok(dash.includes('Linking.openSettings'), 'permission-denied state must offer Open Settings');
});

test('weather lib never ships an API key and handles distinct failure states', () => {
  const lib = read('src/lib/weather.ts');
  assert.ok(!/api[_-]?key|appid|token=/i.test(lib), 'weather client must not embed a secret');
  assert.ok(lib.includes('open-meteo.com'), 'keyless provider expected');
  for (const status of ['permission_denied', 'location_unavailable', 'service_unavailable']) {
    assert.ok(lib.includes(status), `weather lib missing status ${status}`);
  }
});

test('hydration manual-weather mode cannot be overwritten by live weather', () => {
  const hydration = read('app/(tabs)/training/hydration.tsx');
  // The only live-weather write is gated on current_location mode…
  assert.ok(
    /weather && weatherSource === 'current_location'/.test(hydration),
    'live weather write must be gated on current_location mode',
  );
  // …and every manual edit explicitly switches the source to manual.
  assert.ok(hydration.includes("setWeatherSource('manual')"), 'manual edits must switch weatherSource to manual');
});
