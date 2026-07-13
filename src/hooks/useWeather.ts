// ─── useWeather ───────────────────────────────────────────────────────────────
//
// One shared hook over src/lib/weather.ts. Fetches once on mount, again when
// the app returns to the foreground with stale data, and on explicit refresh —
// never on every render. `weather`/`loading`/`refresh` keep the legacy shape
// (hydration planner); `status`/`isStale`/`fetchedAt` power the dashboard's
// honest permission/location/service states.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getWeatherReport, type WeatherData, type WeatherStatus } from '../lib/weather';

type WeatherHookState = {
  weather:    WeatherData | null;
  status:     WeatherStatus | null;   // null until the first report resolves
  loading:    boolean;                // first load only
  refreshing: boolean;                // any in-progress reload
  isStale:    boolean;
  fetchedAt:  number | null;
  refresh:    () => void;             // explicit user refresh (forces refetch)
};

export function useWeather(): WeatherHookState {
  const [weather,    setWeather]    = useState<WeatherData | null>(null);
  const [status,     setStatus]     = useState<WeatherStatus | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale,    setIsStale]    = useState(false);
  const [fetchedAt,  setFetchedAt]  = useState<number | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    const report = await getWeatherReport({ force });
    if (!mounted.current) return;
    setWeather(report.data);
    setStatus(report.status);
    setIsStale(report.isStale);
    setFetchedAt(report.fetchedAt);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(false);

    // Foreground return: re-check via the lib. Fresh cache resolves instantly
    // with no network; a stale cache or a ≥20 km move triggers a real refetch.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void load(false);
    });

    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [load]);

  return {
    weather,
    status,
    loading,
    refreshing,
    isStale,
    fetchedAt,
    refresh: () => { void load(true); },
  };
}
