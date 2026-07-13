// ─── Weather logic regression tests (Build 37) ────────────────────────────────
//
// Pure-core coverage: unit conversion, staleness, movement threshold, WMO
// fallback, and the outcome-merge state machine that guarantees failures
// preserve the last REAL reading (flagged stale) and never fabricate weather.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  coordsDistanceKm,
  formatTemp,
  fToC,
  hasLocationMeaningfullyChanged,
  isWeatherStale,
  mergeWeatherOutcome,
  runAdvice,
  WEATHER_TTL_MS,
  wmoLookup,
  type WeatherData,
} from '../../src/utils/weatherLogic';

const sample: WeatherData = {
  tempF: 62, feelsLikeF: 60, humidity: 45, windMph: 6,
  conditionCode: 2, conditionLabel: 'Partly Cloudy', icon: 'partly-sunny-outline',
  runAdvice: 'Good running conditions', placeName: 'Testville',
};

test('fToC converts and rounds correctly', () => {
  assert.equal(fToC(32), 0);
  assert.equal(fToC(212), 100);
  assert.equal(fToC(62), 17);   // 16.67 → 17
  assert.equal(fToC(-40), -40);
});

test('formatTemp respects the unit system', () => {
  assert.equal(formatTemp(62, 'imperial'), '62°F');
  assert.equal(formatTemp(62, 'metric'), '17°C');
  assert.equal(formatTemp(31.6, 'imperial'), '32°F');
});

test('isWeatherStale boundaries', () => {
  const now = 1_000_000_000;
  assert.equal(isWeatherStale(null, now), true);
  assert.equal(isWeatherStale(now, now), false);
  assert.equal(isWeatherStale(now - WEATHER_TTL_MS + 1, now), false);
  assert.equal(isWeatherStale(now - WEATHER_TTL_MS, now), true);
});

test('coordsDistanceKm and meaningful-change threshold', () => {
  const sf   = { latitude: 37.7749, longitude: -122.4194 };
  const oak  = { latitude: 37.8044, longitude: -122.2712 };  // ~13.5 km
  const sj   = { latitude: 37.3382, longitude: -121.8863 };  // ~67 km
  assert.ok(coordsDistanceKm(sf, oak) > 10 && coordsDistanceKm(sf, oak) < 20);
  assert.equal(hasLocationMeaningfullyChanged(sf, oak), false); // within 20 km
  assert.equal(hasLocationMeaningfullyChanged(sf, sj), true);   // real move
  assert.equal(hasLocationMeaningfullyChanged(null, sf), false);
  assert.equal(hasLocationMeaningfullyChanged(sf, null), false);
});

test('wmoLookup falls back to Unknown for unmapped codes', () => {
  assert.equal(wmoLookup(2).label, 'Partly Cloudy');
  assert.equal(wmoLookup(9999).label, 'Unknown');
  assert.equal(wmoLookup(9999).icon, 'cloud-outline');
});

test('runAdvice bands stay evidence-safe and temperature-driven', () => {
  assert.match(runAdvice(95, 0), /heat/i);
  assert.match(runAdvice(60, 0), /Good running conditions/);
  assert.match(runAdvice(20, 0), /cold/i);
  assert.match(runAdvice(60, 95), /Thunderstorm/);
});

test('mergeWeatherOutcome: success produces a fresh ok report', () => {
  const r = mergeWeatherOutcome(null, { kind: 'success', data: sample, fetchedAt: 123 });
  assert.equal(r.status, 'ok');
  assert.equal(r.data, sample);
  assert.equal(r.fetchedAt, 123);
  assert.equal(r.isStale, false);
});

test('mergeWeatherOutcome: failure with a cached reading preserves it as stale', () => {
  for (const status of ['permission_denied', 'location_unavailable', 'service_unavailable'] as const) {
    const r = mergeWeatherOutcome({ data: sample, fetchedAt: 55 }, { kind: 'failure', status });
    assert.equal(r.status, status);
    assert.equal(r.data, sample);        // last REAL reading, not fabricated
    assert.equal(r.fetchedAt, 55);
    assert.equal(r.isStale, true);       // clearly flagged as old
  }
});

test('mergeWeatherOutcome: failure with no cache never fabricates data', () => {
  const r = mergeWeatherOutcome(null, { kind: 'failure', status: 'permission_denied' });
  assert.equal(r.data, null);
  assert.equal(r.fetchedAt, null);
  assert.notEqual(r.status, 'ok');       // 'ok' is impossible without real data
});
