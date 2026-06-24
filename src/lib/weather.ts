import * as Location from 'expo-location';

export type WeatherData = {
  tempF:          number;
  feelsLikeF:     number;
  humidity:       number;
  windMph:        number;
  conditionCode:  number;
  conditionLabel: string;
  icon:           string;   // Ionicons name
  runAdvice:      string;
};

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

function runAdvice(tempF: number, code: number): string {
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

// Module-level cache so Training screen and Hydration share one fetch
let cache: { data: WeatherData; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

export async function fetchWeather(): Promise<WeatherData | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude, longitude } = loc.coords;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

    const res  = await fetch(url);
    const json = await res.json();
    const c    = json.current;

    const code  = c.weather_code as number;
    const wmo   = WMO[code] ?? { label: 'Unknown', icon: 'cloud-outline' };
    const tempF = Math.round(c.temperature_2m);

    const data: WeatherData = {
      tempF,
      feelsLikeF:     Math.round(c.apparent_temperature),
      humidity:       Math.round(c.relative_humidity_2m),
      windMph:        Math.round(c.wind_speed_10m),
      conditionCode:  code,
      conditionLabel: wmo.label,
      icon:           wmo.icon,
      runAdvice:      runAdvice(tempF, code),
    };

    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return null;
  }
}
