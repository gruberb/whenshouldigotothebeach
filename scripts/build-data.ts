import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTides, unavailableTides } from "./lib/chs.js";
import { fetchLatestCitypage } from "./lib/eccc.js";
import {
  availableForecastDates,
  confidenceForDay,
  hoursForDate,
  localDate,
  overridesForDate,
  precisionHoursForDay,
  sampleForecastHours,
  scoreableHoursForDate,
} from "./lib/forecast-days.js";
import { haversineKm } from "./lib/geo.js";
import { loadFoodSnapshot } from "./lib/nearby.js";
import { fetchNovaScotiaParksSwimmingAdvisories } from "./lib/ns-parks-advisories.js";
import { fetchGemForecasts } from "./lib/open-meteo.js";
import { fetchBuoySeaSurfaceTemp, unavailableWater } from "./lib/water.js";
import { buildReasons } from "./lib/reasons.js";
import { loadBeaches, loadOverrides, loadThresholds } from "./lib/registry.js";
import { beachIndexSchema, beachOutputSchema, manifestSchema } from "./lib/schema.js";
import {
  findBestWindow,
  scoreHour,
  sunTimesFor,
  verdictFor,
} from "./lib/score.js";
import type {
  BeachOutput,
  CitypageData,
  GemForecast,
  ScoredHour,
  TideData,
  WaterTemperature,
} from "./lib/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public", "data");
const HOUR_MS = 3600_000;
const FORECAST_DAYS = 7;
const TIMEZONE = "America/Halifax";

function roundedDistance(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  return (
    Math.round(
      haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) * 10,
    ) / 10
  );
}

async function main() {
  const now = new Date();
  const beaches = loadBeaches(join(root, "config", "beaches.yml"));
  const thresholds = loadThresholds(join(root, "config", "thresholds.yml"));

  console.log("Fetching current Nova Scotia Parks advisories");
  const safety = await fetchNovaScotiaParksSwimmingAdvisories(
    beaches,
    now,
    thresholds.staleness.safety_valid_minutes,
  );
  console.log(
    `Matched ${safety.advisories.length} active swimming advisories to covered beaches`,
  );

  // The official city forecast remains the source for active warnings and the
  // written outlook. The seven-day score uses a consistent hourly GEM series.
  const officialWeatherBySite = new Map<string, CitypageData>();
  for (const beach of beaches) {
    const key = `${beach.weather.province}/${beach.weather.site_code}`;
    if (officialWeatherBySite.has(key)) continue;
    console.log(
      `Fetching official forecast for ${key} (${beach.weather.site_name})`,
    );
    officialWeatherBySite.set(
      key,
      await fetchLatestCitypage(beach.weather.province, beach.weather.site_code, now),
    );
  }

  console.log(`Fetching ${FORECAST_DAYS}-day Canadian GEM forecast for all beaches`);
  const gemForecasts = await fetchGemForecasts(
    beaches.map((beach) => ({
      latitude: beach.location.latitude,
      longitude: beach.location.longitude,
    })),
    FORECAST_DAYS,
  );
  const gemByBeach = new Map<string, GemForecast>(
    beaches.map((beach, index) => [beach.id, gemForecasts[index]]),
  );
  const dates = availableForecastDates(
    gemForecasts[0].hourly,
    TIMEZONE,
    now,
    FORECAST_DAYS,
  );
  if (dates.length !== FORECAST_DAYS) {
    throw new Error(
      `Canadian GEM returned ${dates.length} selectable dates; expected ${FORECAST_DAYS}`,
    );
  }

  const tideFrom = new Date(gemForecasts[0].hourly[0].time);
  const tideTo = new Date(
    Date.parse(gemForecasts[0].hourly[gemForecasts[0].hourly.length - 1].time) +
      HOUR_MS,
  );
  const overrides = loadOverrides(
    join(root, "config", "manual-overrides.yml"),
    now,
    tideTo,
  );

  const tidesByStation = new Map<string, TideData>();
  for (const beach of beaches) {
    const { station_id, station_code, station_name } = beach.tide;
    if (tidesByStation.has(station_id)) continue;
    console.log(`Fetching tides for station ${station_code} (${station_name})`);
    try {
      tidesByStation.set(
        station_id,
        await fetchTides(
          station_id,
          station_code,
          station_name,
          tideFrom,
          tideTo,
        ),
      );
    } catch (error) {
      console.warn(
        `Tide fetch failed for ${station_code} (${station_name}), continuing without tides:`,
        error instanceof Error ? error.message : error,
      );
      tidesByStation.set(
        station_id,
        unavailableTides(station_id, station_code, station_name),
      );
    }
  }

  // Water temperature is a current supporting observation. A failed buoy
  // fetch never blocks the weather forecast build.
  const waterByBuoy = new Map<
    string,
    { valueC: number; observedAt: string; stationName: string } | null
  >();
  for (const beach of beaches) {
    if (!beach.water || waterByBuoy.has(beach.water.buoy_id)) continue;
    console.log(
      `Fetching water temperature from buoy ${beach.water.buoy_id} (${beach.water.buoy_name})`,
    );
    try {
      waterByBuoy.set(
        beach.water.buoy_id,
        await fetchBuoySeaSurfaceTemp(beach.water.buoy_id, now),
      );
    } catch (error) {
      console.warn(
        `Water temperature fetch failed for buoy ${beach.water.buoy_id}, continuing without:`,
        error instanceof Error ? error.message : error,
      );
      waterByBuoy.set(beach.water.buoy_id, null);
    }
  }

  const foodByBeach = loadFoodSnapshot(join(root, "config", "nearby-food.json"));
  mkdirSync(join(dataDir, "beach"), { recursive: true });
  mkdirSync(join(dataDir, "day"), { recursive: true });

  const validUntil = new Date(
    now.getTime() + thresholds.staleness.valid_minutes * 60_000,
  ).toISOString();
  const indexEntriesByDate = new Map<string, unknown[]>(
    dates.map((date) => [date, []]),
  );

  for (const beach of beaches) {
    const officialWeather = officialWeatherBySite.get(
      `${beach.weather.province}/${beach.weather.site_code}`,
    )!;
    const gem = gemByBeach.get(beach.id)!;
    const tides = tidesByStation.get(beach.tide.station_id)!;
    const weatherDistanceKm = roundedDistance(beach.location, gem);
    const tideDistanceKm = roundedDistance(beach.location, {
      latitude: beach.tide.station_latitude,
      longitude: beach.tide.station_longitude,
    });
    const officialWeatherDistanceKm = roundedDistance(beach.location, {
      latitude: beach.weather.site_latitude,
      longitude: beach.weather.site_longitude,
    });

    const sun = sunTimesFor(
      dates,
      beach.location.latitude,
      beach.location.longitude,
    );
    const ctx = { beach, thresholds, tides, sun };
    const scored: ScoredHour[] = gem.hourly.map((hour) => scoreHour(hour, ctx));
    const beachOverrides = overrides.filter((entry) => entry.beach_id === beach.id);
    const beachSafetyAdvisories = safety.advisories.filter(
      (entry) => entry.beach_id === beach.id,
    );

    const days = dates.map((date, dayOffset) => {
      const completeDay = hoursForDate(scored, date, beach.location.timezone);
      const precisionHours = precisionHoursForDay(dayOffset);
      const hourly = sampleForecastHours(
        scoreableHoursForDate(scored, date, beach.location.timezone, now),
        precisionHours,
      );
      if (hourly.length === 0) {
        throw new Error(`${beach.name} has no forecast hours for ${date}`);
      }
      const dayOverrides = overridesForDate(beachOverrides, completeDay);
      // Official Parks notices remain active until they disappear from a
      // successfully parsed active-advisories page. Apply that current status
      // to every planning day, while the UI explains that it may be lifted.
      const dayAdvisories = [...dayOverrides, ...beachSafetyAdvisories];
      const applicableWarnings = dayOffset === 0 ? officialWeather.warnings : [];
      const window = findBestWindow(hourly, thresholds, precisionHours);
      const reference = dayOffset === 0 ? now : new Date(hourly[0].time);
      const reasons = buildReasons(
        beach,
        hourly,
        window,
        tides,
        applicableWarnings,
        reference,
      );
      const summary = {
        verdict: verdictFor({
          window,
          overrides: dayAdvisories,
          warnings: applicableWarnings,
          generatedAt: now,
        }),
        bestWindow: window,
        reasons,
        confidence: confidenceForDay(
          dayOffset,
          weatherDistanceKm,
          tideDistanceKm,
          tides,
        ),
      };
      return {
        date,
        dayOffset,
        precisionHours,
        summary,
        hourly,
        advisories: dayAdvisories,
      };
    });

    let water: WaterTemperature = unavailableWater();
    if (beach.water) {
      const observation = waterByBuoy.get(beach.water.buoy_id);
      if (observation) {
        water = {
          sourceKind: "observed-buoy",
          valueC: observation.valueC,
          observedAt: observation.observedAt,
          stationName: beach.water.buoy_name,
          distanceKm: roundedDistance(beach.location, {
            latitude: beach.water.buoy_latitude,
            longitude: beach.water.buoy_longitude,
          }),
        };
      }
    }

    const output: BeachOutput = {
      schemaVersion: 3,
      beach: {
        id: beach.id,
        name: beach.name,
        region: beach.region,
        municipality: beach.municipality,
        exposure: beach.classification.exposure,
        surface: beach.classification.surface,
        tideEffect: beach.classification.tide_effect,
        surf: beach.classification.surf ?? false,
        latitude: beach.location.latitude,
        longitude: beach.location.longitude,
        officialPage: beach.source_urls.official_page,
        nsBeachesPage: beach.source_urls.nsbeaches_page ?? null,
        amenities: {
          washrooms: beach.amenities?.washrooms ?? null,
          food: beach.amenities?.food ?? null,
          note: beach.amenities?.note ?? null,
        },
      },
      generatedAt: now.toISOString(),
      validUntil,
      safetySource: safety.source,
      timezone: TIMEZONE,
      days,
      sun,
      tides: {
        stationCode: tides.stationCode,
        stationName: tides.stationName,
        distanceKm: tideDistanceKm,
        sourceKind: tides.sourceKind,
        events: tides.events,
        samples: tides.samples,
      },
      water,
      nearbyFood: foodByBeach[beach.id] ?? [],
      weatherSource: {
        provider: "Open-Meteo",
        model: "Canadian GEM seamless",
        latitude: gem.latitude,
        longitude: gem.longitude,
        distanceKm: weatherDistanceKm,
        fetchedAt: gem.fetchedAt,
        kind: "model-forecast",
      },
      officialForecastSource: {
        siteCode: officialWeather.siteCode,
        siteName: beach.weather.site_name,
        distanceKm: officialWeatherDistanceKm,
        issuedAt: officialWeather.issuedAtUtc,
        fetchedAt: officialWeather.fetchedAt,
        kind: "official-forecast",
      },
      warnings: officialWeather.warnings,
      advisories: [...beachOverrides, ...beachSafetyAdvisories],
      outlook: officialWeather.daily,
    };

    beachOutputSchema.parse(output);
    writeFileSync(
      join(dataDir, "beach", `${beach.id}.json`),
      JSON.stringify(output, null, 2),
    );

    for (const day of days) {
      const daylightScores = day.hourly
        .filter((hour) => hour.daylight && !hour.gated)
        .map((hour) => hour.score);
      const tideEvents = tides.events.filter(
        (event) => localDate(event.time, beach.location.timezone) === day.date,
      );
      indexEntriesByDate.get(day.date)!.push({
        id: beach.id,
        name: beach.name,
        region: beach.region,
        municipality: beach.municipality,
        latitude: beach.location.latitude,
        longitude: beach.location.longitude,
        washrooms: beach.amenities?.washrooms ?? null,
        surf: beach.classification.surf ?? false,
        verdict: day.summary.verdict,
        bestWindow: day.summary.bestWindow,
        reasons: day.summary.reasons,
        confidence: day.summary.confidence,
        precisionHours: day.precisionHours,
        peakScore: daylightScores.length > 0 ? Math.max(...daylightScores) : 0,
        firstHour: day.hourly[0] ?? null,
        hourly: day.hourly,
        advisories: day.advisories,
        tideEvents,
        water,
      });
    }

    const firstDay = days[0];
    console.log(
      `${beach.name}: ${firstDay.summary.verdict}${
        firstDay.summary.bestWindow
          ? ` (${firstDay.summary.bestWindow.start} - ${firstDay.summary.bestWindow.end})`
          : ""
      }`,
    );
  }

  for (const [dayOffset, date] of dates.entries()) {
    const index = {
      schemaVersion: 3 as const,
      generatedAt: now.toISOString(),
      validUntil,
      safetySource: safety.source,
      timezone: TIMEZONE,
      date,
      dayOffset,
      beaches: indexEntriesByDate.get(date),
    };
    beachIndexSchema.parse(index);
    writeFileSync(
      join(dataDir, "day", `${date}.json`),
      JSON.stringify(index, null, 2),
    );
    if (dayOffset === 0) {
      writeFileSync(join(dataDir, "beaches.json"), JSON.stringify(index, null, 2));
    }
  }

  const manifest = {
    schemaVersion: 3 as const,
    generatedAt: now.toISOString(),
    validUntil,
    beachIds: beaches.map((beach) => beach.id),
    dates,
  };
  manifestSchema.parse(manifest);
  writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `Wrote ${dates.length} forecast days for ${beaches.length} beaches to ${dataDir}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
