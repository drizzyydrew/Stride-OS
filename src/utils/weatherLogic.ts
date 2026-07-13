// ─── Weather Logic ────────────────────────────────────────────────────────────
//
// Pure, RN-free core of the weather system: types, WMO mapping, unit
// conversion, staleness, movement detection, and the outcome-merge state
// transition. src/lib/weather.ts layers location/fetch/caching on top.
// Unit tested in scripts/tests/weatherLogic.test.ts.

export type WeatherData = {
  tempF:          number;
  feelsLikeF:     number;
  humidity:       number;
  windMph:        number;
  conditionCode:  number;
  conditionLabel: string;
  icon:           string;   // Ionicons name
  runAdvice:      string;
  placeName?:     string;   // reverse-geocoded city/area when available
};

export type WeatherStatus = 'ok' | 'permission_denied' | 'location_unavailable' | 'service_unavailable';

export type WeatherReport = {
  status:    WeatherStatus;
  /** Real fetched weather. On non-'ok' statuses this is the last successful
   *  result (flagged stale) when one exists — never invented values. */
  data:      WeatherData | null;
  fetchedAt: number | null;
  isStale:   boolean;
};

export const WEATHER_TTL_MS = 15 * 60 * 1000;
/** Coordinate delta considered a real move (≈20 km) — forces a refetch. */
export const LOCATION_CHANGE_KM = 20;

// WMO weather interpretation codes → label + Ionicons name
const WMO: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Clear',           icon: 'sunny-outline'       },
  1:  { label: 'Mostly Clear',    icon: 'sunny-outline'       },
  2:  { label: 'Partly Cloudy',   icon: 'partly-sunny-outline'},
  3:  { label: 'Overcast',        icon: 'cloudy-outline'      },
  45: { label: 'Foggy',           icon: 'cloud-outline'       },
  48: { label: 'Icy Fog',         icon: 'cloud-outline'       },
  51: { label: 'Light Drizzle',   icon: 'rainy-outline'       },
  53: { label: 'Drizzle',         icon: 'rainy-outline'       },
  55: { label: 'Heavy Drizzle',   icon: 'rainy-outline'       },
  61: { label: 'Light Rain',      icon: 'rainy-outline'       },
  63: { label: 'Rain',            icon: 'rainy-outline'       },
  65: { label: 'Heavy Rain',      icon: 'rainy-outline'       },
  71: { label: 'Light Snow',      icon: 'snow-outline'        },
  73: { label: 'Snow',            icon: 'snow-outline'        },
  75: { label: 'Heavy Snow',      icon: 'snow-outline'        },
  77: { label: 'Snow Grains',     icon: 'snow-outline'        },
  80: { label: 'Showers',         icon: 'rainy-outline'       },
  81: { label: 'Showers',         icon: 'rainy-outline'       },
  82: { label: 'Heavy Showers',   icon: 'rainy-outline'       },
  85: { label: 'Snow Showers',    icon: 'snow-outline'        },
  86: { label: 'Heavy Snow',      icon: 'snow-outline'        },
  95: { label: 'Thunderstorm',    icon: 'thunderstorm-outline'},
  96: { label: 'Thunderstorm',    icon: 'thunderstorm-outline'},
  99: { label: 'Thunderstorm',    icon: 'thunderstorm-outline'},
};

export function wmoLookup(code: number): { label: string; icon: string } {
  return WMO[code] ?? { label: 'Unknown', icon: 'cloud-outline' };
}

export function runAdvice(tempF: number, code: number): string {
  if (code >= 95) return 'Thunderstorm — run indoors today';
  if (code >= 71 && code <= 77) return 'Snowy — watch for ice';
  if (code >= 61 && code <= 67) return 'Rainy — dress to stay dry';
  if (code >= 51 && code <= 57) return 'Light drizzle — gear up';
  if (tempF > 90) return 'Extreme heat — shorten & hydrate heavily';
  if (tempF > 80) return 'Hot — slow your pace, hydrate often';
  if (tempF > 65) return 'Warm — hydrate well';
  if (tempF >= 45) return 'Good running conditions';
  if (tempF >= 32) return 'Cold — dress in layers';
  return 'Very cold — run indoors or bundle up';
}

export function fToC(tempF: number): number {
  return Math.round(((tempF - 32) * 5) / 9);
}

/** "62°F" (imperial) or "17°C" (metric) from the canonical °F value. */
export function formatTemp(tempF: number, units: 'imperial' | 'metric'): string {
  return units === 'metric' ? `${fToC(tempF)}°C` : `${Math.round(tempF)}°F`;
}

export function isWeatherStale(fetchedAt: number | null, now: number = Date.now(), ttlMs: number = WEATHER_TTL_MS): boolean {
  if (fetchedAt === null) return true;
  return now - fetchedAt >= ttlMs;
}

export type Coords = { latitude: number; longitude: number };

/** Approximate great-circle distance (equirectangular — fine at 20 km scale). */
export function coordsDistanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = toRad(b.longitude - a.longitude) * Math.cos(toRad((a.latitude + b.latitude) / 2));
  const y = toRad(b.latitude - a.latitude);
  return Math.sqrt(x * x + y * y) * R;
}

export function hasLocationMeaningfullyChanged(a: Coords | null, b: Coords | null, thresholdKm: number = LOCATION_CHANGE_KM): boolean {
  if (!a || !b) return false;
  return coordsDistanceKm(a, b) >= thresholdKm;
}

/**
 * Fold a fetch outcome over the cached last-success. Pure — unit tested.
 * A failure NEVER discards the last real reading and NEVER fabricates one:
 * it returns the cached data flagged stale, under the failure status.
 */
export function mergeWeatherOutcome(
  cached: { data: WeatherData; fetchedAt: number } | null,
  outcome:
    | { kind: 'success'; data: WeatherData; fetchedAt: number }
    | { kind: 'failure'; status: Exclude<WeatherStatus, 'ok'> },
): WeatherReport {
  if (outcome.kind === 'success') {
    return { status: 'ok', data: outcome.data, fetchedAt: outcome.fetchedAt, isStale: false };
  }
  if (cached) {
    return { status: outcome.status, data: cached.data, fetchedAt: cached.fetchedAt, isStale: true };
  }
  return { status: outcome.status, data: null, fetchedAt: null, isStale: false };
}
