import { useEffect, useState } from 'react';
import { fetchWeather, type WeatherData } from '../lib/weather';

type WeatherState = {
  weather:  WeatherData | null;
  loading:  boolean;
  refresh:  () => void;
};

export function useWeather(): WeatherState {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeather().then(data => {
      if (!cancelled) {
        setWeather(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tick]);

  return { weather, loading, refresh: () => setTick(t => t + 1) };
}
