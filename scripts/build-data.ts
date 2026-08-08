import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTides, unavailableTides } from "./lib/chs.js";
import { fetchLatestCitypage } from "./lib/eccc.js";
import { haversineKm } from "./lib/geo.js";
import { fetchFoodPois, nearestFood, type FoodPoi } from "./lib/nearby.js";
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
  BeachConfig,
  BeachOutput,
  CitypageData,
  ScoredHour,
  TideData,
  WaterTemperature,
} from "./lib/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "public", "data");

const HOUR_MS = 3600 * 1000;

function localDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function confidenceFor(
  beach: BeachConfig,
  weather: CitypageData,
  tides: TideData,
  now: Date,
): "high" | "medium" | "low" {
  const issueAgeHours = Math.max(
    0,
    (now.getTime() - Date.parse(weather.issuedAtUtc)) / HOUR_MS,
  );
  const weatherDistanceKm = haversineKm(
    beach.location.latitude,
    beach.location.longitude,
    beach.weather.site_latitude,
    beach.weather.site_longitude,
  );
  const tideDistanceKm = haversineKm(
    beach.location.latitude,
    beach.location.longitude,
    beach.tide.station_latitude,
    beach.tide.station_longitude,
  );
  // ECCC re-issues the hourly forecast group roughly four times a day, so a
  // several-hour-old issue time is normal operation, not staleness.
  if (
    issueAgeHours > 12 ||
    weatherDistanceKm > 40 ||
    tides.sourceKind === "unavailable"
  ) {
    return "low";
  }
  if (issueAgeHours <= 6 && weatherDistanceKm <= 20 && tideDistanceKm <= 12) {
    return "high";
  }
  return "medium";
}

async function main() {
  const now = new Date();
  const beaches = loadBeaches(join(root, "config", "beaches.yml"));
  const thresholds = loadThresholds(join(root, "config", "thresholds.yml"));
  const overrides = loadOverrides(join(root, "config", "manual-overrides.yml"), now);

  const weatherBySite = new Map<string, CitypageData>();
  for (const beach of beaches) {
    const key = `${beach.weather.province}/${beach.weather.site_code}`;
    if (weatherBySite.has(key)) continue;
    console.log(`Fetching weather for ${key} (${beach.weather.site_name})`);
    weatherBySite.set(
      key,
      await fetchLatestCitypage(beach.weather.province, beach.weather.site_code, now),
    );
  }

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
          new Date(now.getTime() - 12 * HOUR_MS),
          new Date(now.getTime() + 36 * HOUR_MS),
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

  // Water temperature is supporting information only; a failed buoy fetch
  // never blocks the build.
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

  // One Overpass query covers every beach; nearby food is supporting
  // information and a failed fetch never blocks the build.
  let foodPois: FoodPoi[] = [];
  try {
    console.log("Fetching nearby food places from OpenStreetMap");
    foodPois = await fetchFoodPois();
    console.log(`Found ${foodPois.length} named food places in the region`);
  } catch (error) {
    console.warn(
      "Nearby food fetch failed, continuing without:",
      error instanceof Error ? error.message : error,
    );
  }

  mkdirSync(join(dataDir, "beach"), { recursive: true });

  const validUntil = new Date(
    now.getTime() + thresholds.staleness.valid_minutes * 60_000,
  ).toISOString();
  const indexEntries = [];

  for (const beach of beaches) {
    const weather = weatherBySite.get(
      `${beach.weather.province}/${beach.weather.site_code}`,
    )!;
    const tides = tidesByStation.get(beach.tide.station_id)!;

    const hours = weather.hourly.filter(
      (h) => Date.parse(h.time) >= now.getTime() - HOUR_MS,
    );
    const dates = [
      ...new Set(hours.map((h) => localDate(h.time, beach.location.timezone))),
    ];
    const sun = sunTimesFor(
      dates,
      beach.location.latitude,
      beach.location.longitude,
    );

    const ctx = { beach, thresholds, tides, sun };
    const scored: ScoredHour[] = hours.map((h) => scoreHour(h, ctx));
    const window = findBestWindow(scored, thresholds);
    const beachOverrides = overrides.filter((o) => o.beach_id === beach.id);
    const verdict = verdictFor({
      window,
      overrides: beachOverrides,
      warnings: weather.warnings,
      generatedAt: now,
    });
    const reasons = buildReasons(
      beach,
      scored,
      window,
      tides,
      weather.warnings,
      now,
    );
    const confidence = confidenceFor(beach, weather, tides, now);

    let water: WaterTemperature = unavailableWater();
    if (beach.water) {
      const observation = waterByBuoy.get(beach.water.buoy_id);
      if (observation) {
        water = {
          sourceKind: "observed-buoy",
          valueC: observation.valueC,
          observedAt: observation.observedAt,
          stationName: beach.water.buoy_name,
          distanceKm:
            Math.round(
              haversineKm(
                beach.location.latitude,
                beach.location.longitude,
                beach.water.buoy_latitude,
                beach.water.buoy_longitude,
              ) * 10,
            ) / 10,
        };
      }
    }

    const output: BeachOutput = {
      schemaVersion: 1,
      beach: {
        id: beach.id,
        name: beach.name,
        municipality: beach.municipality,
        exposure: beach.classification.exposure,
        surface: beach.classification.surface,
        tideEffect: beach.classification.tide_effect,
        latitude: beach.location.latitude,
        longitude: beach.location.longitude,
        officialPage: beach.source_urls.official_page,
        amenities: {
          washrooms: beach.amenities?.washrooms ?? null,
          food: beach.amenities?.food ?? null,
          note: beach.amenities?.note ?? null,
        },
      },
      generatedAt: now.toISOString(),
      validUntil,
      timezone: "America/Halifax",
      summary: { verdict, bestWindow: window, reasons, confidence },
      hourly: scored,
      sun,
      tides: {
        stationCode: tides.stationCode,
        stationName: tides.stationName,
        distanceKm:
          Math.round(
            haversineKm(
              beach.location.latitude,
              beach.location.longitude,
              beach.tide.station_latitude,
              beach.tide.station_longitude,
            ) * 10,
          ) / 10,
        sourceKind: tides.sourceKind,
        events: tides.events,
        samples: tides.samples,
      },
      water,
      nearbyFood: nearestFood(
        beach.location.latitude,
        beach.location.longitude,
        foodPois,
      ),
      weatherSource: {
        siteCode: weather.siteCode,
        siteName: beach.weather.site_name,
        distanceKm:
          Math.round(
            haversineKm(
              beach.location.latitude,
              beach.location.longitude,
              beach.weather.site_latitude,
              beach.weather.site_longitude,
            ) * 10,
          ) / 10,
        issuedAt: weather.issuedAtUtc,
        fetchedAt: weather.fetchedAt,
        kind: "forecast",
      },
      warnings: weather.warnings,
      advisories: beachOverrides,
      outlook: weather.daily,
    };

    beachOutputSchema.parse(output);
    writeFileSync(
      join(dataDir, "beach", `${beach.id}.json`),
      JSON.stringify(output, null, 2),
    );
    console.log(
      `${beach.name}: ${verdict}${window ? ` (${window.start} - ${window.end}, avg ${window.avgScore})` : ""}`,
    );

    const daylightScores = scored
      .filter((h) => h.daylight && !h.gated)
      .map((h) => h.score);
    const firstUpcoming =
      scored.find((h) => Date.parse(h.time) >= now.getTime()) ?? null;
    indexEntries.push({
      id: beach.id,
      name: beach.name,
      municipality: beach.municipality,
      verdict,
      bestWindow: window,
      reasons,
      confidence,
      peakScore: daylightScores.length > 0 ? Math.max(...daylightScores) : 0,
      firstHour: firstUpcoming,
      hourly: scored,
      // The client picks the first event after its own clock; baking a single
      // "next tide" here would go wrong as soon as it passes.
      tideEvents: tides.events.filter(
        (e) => Date.parse(e.time) > now.getTime() - 2 * HOUR_MS,
      ),
      water,
    });
  }

  const index = {
    schemaVersion: 1 as const,
    generatedAt: now.toISOString(),
    validUntil,
    timezone: "America/Halifax" as const,
    beaches: indexEntries,
  };
  beachIndexSchema.parse(index);
  writeFileSync(join(dataDir, "beaches.json"), JSON.stringify(index, null, 2));

  const manifest = {
    schemaVersion: 1 as const,
    generatedAt: now.toISOString(),
    validUntil,
    beachIds: beaches.map((b) => b.id),
  };
  manifestSchema.parse(manifest);
  writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Wrote data for ${beaches.length} beaches to ${dataDir}`);
}

main().catch((error) => {
  console.error("Data build failed:", error);
  process.exit(1);
});
