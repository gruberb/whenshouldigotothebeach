import { fetchJson } from "./fetch.js";
import type { GemForecast, HourlyWeather } from "./types.js";

const GEM_API = "https://api.open-meteo.com/v1/gem";

interface ForecastLocation {
  latitude: number;
  longitude: number;
}

interface GemHourlyResponse {
  time: unknown[];
  temperature_2m: unknown[];
  apparent_temperature: unknown[];
  precipitation_probability: unknown[];
  weather_code: unknown[];
  cloud_cover: unknown[];
  wind_speed_10m: unknown[];
  wind_gusts_10m: unknown[];
  wind_direction_10m: unknown[];
}

interface GemResponse {
  latitude: unknown;
  longitude: unknown;
  hourly: GemHourlyResponse;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requiredNumber(value: unknown, field: string): number {
  const parsed = finiteNumber(value);
  if (parsed === null) throw new Error(`Open-Meteo response has no numeric ${field}`);
  return parsed;
}

function arrayField(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Open-Meteo response has no ${field} array`);
  }
  return value;
}

export function degreesToCompass(value: number | null): string | null {
  if (value === null) return null;
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return directions[Math.round((((value % 360) + 360) % 360) / 22.5) % 16];
}

export function weatherCodeToCondition(
  code: number | null,
  cloudCover: number | null,
): string {
  if (code === null) {
    if (cloudCover !== null && cloudCover >= 85) return "Cloudy";
    if (cloudCover !== null && cloudCover >= 55) return "Mostly cloudy";
    if (cloudCover !== null && cloudCover >= 25) return "A mix of sun and cloud";
    return "Mainly clear";
  }
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "A mix of sun and cloud";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Variable cloud";
}

export function parseGemForecast(
  raw: unknown,
  fetchedAt: string,
): GemForecast {
  if (!raw || typeof raw !== "object") {
    throw new Error("Open-Meteo response is not an object");
  }
  const response = raw as GemResponse;
  if (!response.hourly || typeof response.hourly !== "object") {
    throw new Error("Open-Meteo response has no hourly data");
  }

  const time = arrayField(response.hourly.time, "hourly.time");
  const temperature = arrayField(
    response.hourly.temperature_2m,
    "hourly.temperature_2m",
  );
  const feelsLike = arrayField(
    response.hourly.apparent_temperature,
    "hourly.apparent_temperature",
  );
  const precipitationProbability = arrayField(
    response.hourly.precipitation_probability,
    "hourly.precipitation_probability",
  );
  const weatherCode = arrayField(
    response.hourly.weather_code,
    "hourly.weather_code",
  );
  const cloudCover = arrayField(response.hourly.cloud_cover, "hourly.cloud_cover");
  const windSpeed = arrayField(
    response.hourly.wind_speed_10m,
    "hourly.wind_speed_10m",
  );
  const windGusts = arrayField(
    response.hourly.wind_gusts_10m,
    "hourly.wind_gusts_10m",
  );
  const windDirection = arrayField(
    response.hourly.wind_direction_10m,
    "hourly.wind_direction_10m",
  );

  const fields = [
    temperature,
    feelsLike,
    precipitationProbability,
    weatherCode,
    cloudCover,
    windSpeed,
    windGusts,
    windDirection,
  ];
  if (time.length === 0 || fields.some((field) => field.length !== time.length)) {
    throw new Error("Open-Meteo hourly arrays are empty or have different lengths");
  }

  const hourly: HourlyWeather[] = time.map((stamp, index) => {
    const unixSeconds = requiredNumber(stamp, `hourly.time[${index}]`);
    const code = finiteNumber(weatherCode[index]);
    const clouds = finiteNumber(cloudCover[index]);
    return {
      time: new Date(unixSeconds * 1000).toISOString(),
      temperatureC: finiteNumber(temperature[index]),
      feelsLikeC: finiteNumber(feelsLike[index]),
      condition: weatherCodeToCondition(code, clouds),
      iconCode: code,
      popPercent: Math.min(
        100,
        Math.max(0, finiteNumber(precipitationProbability[index]) ?? 0),
      ),
      windKmh: finiteNumber(windSpeed[index]),
      gustKmh: finiteNumber(windGusts[index]),
      windDirection: degreesToCompass(finiteNumber(windDirection[index])),
    };
  });

  return {
    latitude: requiredNumber(response.latitude, "latitude"),
    longitude: requiredNumber(response.longitude, "longitude"),
    fetchedAt,
    hourly,
  };
}

export async function fetchGemForecasts(
  locations: ForecastLocation[],
  forecastDays = 7,
): Promise<GemForecast[]> {
  if (locations.length === 0) return [];
  const params = new URLSearchParams({
    latitude: locations.map((location) => location.latitude).join(","),
    longitude: locations.map((location) => location.longitude).join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
    ].join(","),
    models: "gem_seamless",
    wind_speed_unit: "kmh",
    timezone: "America/Halifax",
    timeformat: "unixtime",
    forecast_days: String(forecastDays),
  });
  const raw = await fetchJson<unknown>(`${GEM_API}?${params}`);
  const responses = Array.isArray(raw) ? raw : [raw];
  if (responses.length !== locations.length) {
    throw new Error(
      `Open-Meteo returned ${responses.length} locations for ${locations.length} requests`,
    );
  }
  const fetchedAt = new Date().toISOString();
  return responses.map((response) => parseGemForecast(response, fetchedAt));
}
