import { describe, expect, it } from "vitest";
import {
  degreesToCompass,
  parseGemForecast,
  weatherCodeToCondition,
} from "../scripts/lib/open-meteo.js";

describe("Canadian GEM adapter", () => {
  it("normalizes an hourly Open-Meteo response", () => {
    const forecast = parseGemForecast(
      {
        latitude: 44.25,
        longitude: -64.25,
        hourly: {
          time: [1786208400, 1786212000],
          temperature_2m: [21.4, 22.1],
          apparent_temperature: [22.0, 23.2],
          precipitation_probability: [10, 75],
          weather_code: [1, 95],
          cloud_cover: [20, 85],
          wind_speed_10m: [12, 20],
          wind_gusts_10m: [18, 35],
          wind_direction_10m: [225, 90],
        },
      },
      "2026-08-08T12:00:00Z",
    );

    expect(forecast.hourly).toHaveLength(2);
    expect(forecast.hourly[0]).toMatchObject({
      temperatureC: 21.4,
      feelsLikeC: 22,
      condition: "Mainly clear",
      windDirection: "SW",
      popPercent: 10,
    });
    expect(forecast.hourly[1].condition).toBe("Thunderstorms");
  });

  it("maps weather codes and compass directions used by scoring", () => {
    expect(weatherCodeToCondition(45, 100)).toBe("Fog");
    expect(weatherCodeToCondition(63, 100)).toBe("Rain");
    expect(degreesToCompass(359)).toBe("N");
    expect(degreesToCompass(140)).toBe("SE");
  });

  it("rejects mismatched hourly arrays", () => {
    expect(() =>
      parseGemForecast(
        {
          latitude: 44,
          longitude: -64,
          hourly: {
            time: [1, 2],
            temperature_2m: [20],
            apparent_temperature: [20, 21],
            precipitation_probability: [0, 0],
            weather_code: [0, 0],
            cloud_cover: [0, 0],
            wind_speed_10m: [0, 0],
            wind_gusts_10m: [0, 0],
            wind_direction_10m: [0, 0],
          },
        },
        "2026-08-08T12:00:00Z",
      ),
    ).toThrow(/different lengths/);
  });
});
