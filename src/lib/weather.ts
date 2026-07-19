// ─── Weather ──────────────────────────────────────────────────────────────────
//
// Real local weather for the dashboard and hydration planner. Location comes
// from expo-location (foreground permission only), weather from Open-Meteo
// (keyless public API — no client secret required). Canonical storage is °F;
// display converts to the user's unit preference via formatTemp().
//
// Honesty rules: a result is 'ok' only when it holds real fetched weather for
// the resolved location. Permission/location/service failures surface as
// distinct statuses, optionally carrying the LAST REAL result flagged stale —
// never a fabricated or placeholder reading.
//
// Pure logic (types, conversion, staleness, outcome merge) lives in
// src/utils/weatherLogic.ts so it stays unit-testable without RN.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import {
  hasLocationMeaningfullyChanged,
  isWeatherStale,
  mergeWeatherOutcome,
  runAdvice,
  wmoLookup,
  classifyAqi,
  type Coords,
  type WeatherData,
  type WeatherReport,
} from '../utils/weatherLogic';

export {
  formatTemp,
  fToC,
  isWeatherStale,
  LOCATION_CHANGE_KM,
  WEATHER_TTL_MS,
} from '../utils/weatherLogic';
export type { WeatherData, WeatherReport, WeatherStatus } from '../utils/weatherLogic';

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATION_TIMEOUT_MS = 8_000;
const FETCH_TIMEOUT_MS    = 8_000;
const CACHE_KEY           = 'strideos-weather-cache-v1';

// ─── Cache (module + AsyncStorage; minimum necessary state) ──────────────────

type CacheEntry = { data: WeatherData; fetchedAt: number; coords: Coords };

let memoryCache: CacheEntry | null = null;
let storageLoaded = false;
let inFlight: Promise<WeatherReport> | null = null;

async function loadPersistedCache(): Promise<void> {
  if (storageLoaded) return;
  storageLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed?.data && typeof parsed.fetchedAt === 'number' && parsed.coords) {
      // Only adopt if nothing fresher fetched this session.
      if (!memoryCache || parsed.fetchedAt > memoryCache.fetchedAt) memoryCache = parsed;
    }
  } catch {
    // Corrupt cache is discarded; next fetch rebuilds it.
  }
}

async function persistCache(entry: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Persistence is best-effort; in-memory cache still works this session.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err   => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/** No-GPS-fix movement check: last known position only, never a prompt. */
async function movedSinceCache(cachedCoords: Coords): Promise<boolean> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return false;
    const last = await Location.getLastKnownPositionAsync();
    return hasLocationMeaningfullyChanged(cachedCoords, last?.coords ?? null);
  } catch {
    return false;
  }
}

async function resolvePermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

async function resolveCoords(): Promise<Coords | null> {
  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      LOCATION_TIMEOUT_MS,
    );
    return loc.coords;
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync();
      return last?.coords ?? null;
    } catch {
      return null;
    }
  }
}

async function resolvePlaceName(coords: Coords): Promise<string | undefined> {
  try {
    const results = await withTimeout(Location.reverseGeocodeAsync(coords), LOCATION_TIMEOUT_MS);
    const p = results[0];
    return p?.city ?? p?.subregion ?? p?.region ?? undefined;
  } catch {
    return undefined;
  }
}

async function fetchOpenMeteo(coords: Coords): Promise<Omit<WeatherData, 'placeName'>> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`weather http ${res.status}`);
    const json = await res.json();
    const c = json.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new Error('weather payload malformed');

    const code = c.weather_code as number;
    const wmo = wmoLookup(code);
    const tempF = Math.round(c.temperature_2m);
    return {
      tempF,
      feelsLikeF:     Math.round(c.apparent_temperature),
      humidity:       Math.round(c.relative_humidity_2m),
      windMph:        Math.round(c.wind_speed_10m),
      conditionCode:  code,
      conditionLabel: wmo.label,
      icon:           wmo.icon,
      runAdvice:      runAdvice(tempF, code),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenMeteoAqi(coords: Coords): Promise<WeatherData['aqi'] | undefined> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${coords.latitude}&longitude=${coords.longitude}` +
    `&current=us_aqi&timezone=auto`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`aqi http ${res.status}`);
    const json = await res.json();
    const value = json.current?.us_aqi;
    if (typeof value !== 'number') return undefined;
    return { ...classifyAqi(value), updatedAt: json.current?.time };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the current local weather report.
 * - Deduplicates concurrent calls (one shared in-flight promise).
 * - Fresh cache (< TTL) is returned without touching location, unless `force`.
 * - A meaningful location change (≥ 20 km) always refetches weather.
 * - Failures return the last real result flagged stale — never fake weather.
 */
export async function getWeatherReport(options?: { force?: boolean }): Promise<WeatherReport> {
  if (inFlight) return inFlight;

  const run = (async (): Promise<WeatherReport> => {
    await loadPersistedCache();

    const cached = memoryCache;
    if (!options?.force && cached && !isWeatherStale(cached.fetchedAt)) {
      // Fresh cache short-circuits — unless a cheap last-known-position check
      // shows the user has meaningfully moved (≥ 20 km), which invalidates it.
      const moved = await movedSinceCache(cached.coords);
      if (!moved) {
        return { status: 'ok', data: cached.data, fetchedAt: cached.fetchedAt, isStale: false };
      }
    }

    const granted = await resolvePermission();
    if (!granted) {
      return mergeWeatherOutcome(cached, { kind: 'failure', status: 'permission_denied' });
    }

    const coords = await resolveCoords();
    if (!coords) {
      return mergeWeatherOutcome(cached, { kind: 'failure', status: 'location_unavailable' });
    }

    try {
      const [base, placeName, aqi] = await Promise.all([fetchOpenMeteo(coords), resolvePlaceName(coords), fetchOpenMeteoAqi(coords)]);
      const data: WeatherData = { ...base, placeName, aqi };
      const fetchedAt = Date.now();
      memoryCache = { data, fetchedAt, coords };
      void persistCache(memoryCache);
      return mergeWeatherOutcome(null, { kind: 'success', data, fetchedAt });
    } catch {
      // The cached entry is the last REAL reading — surfaced as stale under
      // the failure status, never replaced with fake data.
      return mergeWeatherOutcome(cached, { kind: 'failure', status: 'service_unavailable' });
    }
  })();

  inFlight = run.finally(() => { inFlight = null; });
  return inFlight;
}

/** Legacy shape kept for callers that only need data-or-null (hydration). */
export async function fetchWeather(): Promise<WeatherData | null> {
  const report = await getWeatherReport();
  return report.status === 'ok' ? report.data : null;
}
