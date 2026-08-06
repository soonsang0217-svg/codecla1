import { getKV, setKV } from "./db";

export interface WeatherInfo {
  icon: string;
  description: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitationProbability: number | null;
  /** "HH:MM" local time rain/snow is next expected today, or null if none expected. */
  rainStartTime: string | null;
  airQuality: {
    pm25: number | null;
    pm10: number | null;
    label: string | null;
  } | null;
}

const CACHE_TTL_SECONDS = 1800; // 30 minutes

// WMO weather codes (Open-Meteo's `weather_code`) mapped to an emoji + Korean label.
function describeWeatherCode(code: number): { icon: string; description: string } {
  if (code === 0) return { icon: "☀️", description: "맑음" };
  if (code === 1) return { icon: "🌤️", description: "대체로 맑음" };
  if (code === 2) return { icon: "⛅", description: "구름 조금" };
  if (code === 3) return { icon: "☁️", description: "흐림" };
  if (code === 45 || code === 48) return { icon: "🌫️", description: "안개" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", description: "이슬비" };
  if ([61, 63, 65, 66, 67].includes(code)) return { icon: "🌧️", description: "비" };
  if ([71, 73, 75, 77].includes(code)) return { icon: "🌨️", description: "눈" };
  if ([80, 81, 82].includes(code)) return { icon: "🌦️", description: "소나기" };
  if ([85, 86].includes(code)) return { icon: "🌨️", description: "소나기눈" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", description: "뇌우" };
  return { icon: "🌡️", description: "" };
}

const RAIN_OR_SNOW_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);
const RAIN_PROBABILITY_THRESHOLD = 60;

// Korea's 통합대기환경지수(CAI) PM2.5 breakpoints (µg/m³, hourly reference).
function pm25Label(pm25: number): string {
  if (pm25 <= 15) return "좋음";
  if (pm25 <= 35) return "보통";
  if (pm25 <= 75) return "나쁨";
  return "매우 나쁨";
}

// With `timezone=Asia/Seoul` alone, Open-Meteo returns naive local
// timestamps like "2026-08-06T16:00" (no UTC offset). `new Date(...)` on a
// server running in another timezone (Vercel = UTC) parses that string as
// if it *were* UTC, silently shifting every comparison against the real
// "now" by 9 hours. Requesting `timeformat=unixtime` instead returns
// unambiguous epoch seconds, so parsing is correct no matter where this
// code runs.
interface OpenMeteoForecast {
  daily?: {
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
  hourly?: {
    time?: number[]; // unix seconds (timeformat=unixtime)
    weather_code?: number[];
    precipitation_probability?: number[];
  };
}

interface OpenMeteoAirQuality {
  hourly?: {
    time?: number[]; // unix seconds (timeformat=unixtime)
    pm2_5?: number[];
    pm10?: number[];
  };
}

function findNearestIndex(times: number[], nowEpochSeconds: number): number {
  let closestIndex = 0;
  let smallestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(times[i] - nowEpochSeconds);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function findRainStartTime(hourly: OpenMeteoForecast["hourly"], nowEpochSeconds: number): string | null {
  const times = hourly?.time ?? [];
  const codes = hourly?.weather_code ?? [];
  const probabilities = hourly?.precipitation_probability ?? [];

  for (let i = 0; i < times.length; i++) {
    if (times[i] < nowEpochSeconds) continue;

    const code = codes[i];
    const probability = probabilities[i];
    const rainLikely =
      (code != null && RAIN_OR_SNOW_CODES.has(code)) ||
      (probability != null && probability >= RAIN_PROBABILITY_THRESHOLD);

    if (rainLikely) {
      return new Date(times[i] * 1000).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      });
    }
  }
  return null;
}

export async function getWeather(lat: number, lng: number): Promise<WeatherInfo | null> {
  const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = await getKV<WeatherInfo>(cacheKey);
  if (cached) return cached;

  try {
    const [forecastRes, airRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&timezone=Asia%2FSeoul&timeformat=unixtime&forecast_days=1` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&hourly=weather_code,precipitation_probability`,
        { cache: "no-store" }
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
          `&timezone=Asia%2FSeoul&timeformat=unixtime&forecast_days=1&hourly=pm2_5,pm10`,
        { cache: "no-store" }
      ),
    ]);

    if (!forecastRes.ok) throw new Error(`Open-Meteo forecast returned ${forecastRes.status}`);
    const forecast = (await forecastRes.json()) as OpenMeteoForecast;

    const dailyCode = forecast.daily?.weather_code?.[0] ?? 0;
    const { icon, description } = describeWeatherCode(dailyCode);
    const nowEpochSeconds = Math.floor(Date.now() / 1000);

    const weather: WeatherInfo = {
      icon,
      description,
      tempMax: forecast.daily?.temperature_2m_max?.[0] ?? null,
      tempMin: forecast.daily?.temperature_2m_min?.[0] ?? null,
      precipitationProbability: forecast.daily?.precipitation_probability_max?.[0] ?? null,
      rainStartTime: findRainStartTime(forecast.hourly, nowEpochSeconds),
      airQuality: null,
    };

    if (airRes.ok) {
      const air = (await airRes.json()) as OpenMeteoAirQuality;
      const times = air.hourly?.time ?? [];
      if (times.length > 0) {
        const idx = findNearestIndex(times, nowEpochSeconds);
        const pm25 = air.hourly?.pm2_5?.[idx] ?? null;
        const pm10 = air.hourly?.pm10?.[idx] ?? null;
        weather.airQuality = { pm25, pm10, label: pm25 != null ? pm25Label(pm25) : null };
      }
    }

    await setKV(cacheKey, weather, CACHE_TTL_SECONDS);
    return weather;
  } catch (err) {
    console.error("Failed to fetch weather", err);
    return null;
  }
}
