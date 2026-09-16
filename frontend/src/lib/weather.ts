import type { ForecastEnvelope, WeatherPayload } from "@/lib/types";

const fallbackPayload = (latitude: number, longitude: number): WeatherPayload => {
  const now = Date.now();
  const time = Array.from({ length: 24 }, (_, index) => new Date(now + index * 3600000).toISOString());
  return {
    latitude,
    longitude,
    timezone: "Asia/Kolkata",
    current: { temperature_2m: 24, relative_humidity_2m: 78, precipitation: 2.2, rain: 2.2, showers: 0, cloud_cover: 82, surface_pressure: 1008, wind_speed_10m: 12, weather_code: 61 },
    hourly: { time, precipitation: time.map((_, index) => [2.2, 3.1, 4.8, 5.2, 3.5, 2.4, 1.9, 1.2, 0.8, 0.5, 0.4, 0.2, 0.2, 0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0][index]), precipitation_probability: time.map((_, index) => Math.max(20, 86 - index * 3)), rain: time.map((_, index) => index < 6 ? 2.2 : 0.2), showers: time.map(() => 0), temperature_2m: time.map(() => 24), relative_humidity_2m: time.map(() => 78), wind_speed_10m: time.map(() => 12), cloud_cover: time.map(() => 82) },
    current_units: { temperature_2m: "°C", precipitation: "mm", wind_speed_10m: "km/h" },
    hourly_units: { precipitation: "mm", precipitation_probability: "%" },
  };
};

export const makeFallbackForecast = (latitude: number, longitude: number): ForecastEnvelope => ({
  status: "FALLBACK",
  provider: "RAIN VISION demo adapter",
  model: "Fallback weather profile",
  latitude,
  longitude,
  fetched_at: new Date().toISOString(),
  cached: false,
  data: fallbackPayload(latitude, longitude),
});

export const weatherDescription = (code = 0) => {
  if (code >= 95) return "Thunderstorm";
  if (code >= 80) return "Rain showers";
  if (code >= 60) return "Rain";
  if (code >= 50) return "Drizzle";
  if (code >= 1) return "Partly cloudy";
  return "Clear sky";
};

export const formatNumber = (value: number | undefined, digits = 1) => Number.isFinite(value) ? Number(value).toFixed(digits) : "—";