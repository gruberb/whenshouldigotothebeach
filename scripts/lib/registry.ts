import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import type { BeachConfig, ManualOverride, Thresholds } from "./types.js";

export const REGION_IDS = [
  "south-shore",
  "yarmouth-acadian-shores",
  "bay-of-fundy-annapolis-valley",
  "northumberland-shore",
  "halifax-metro",
  "eastern-shore",
  "cape-breton",
] as const;

const beachSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  region: z.enum(REGION_IDS),
  municipality: z.string().min(1),
  location: z.object({
    latitude: z.number().min(43).max(47.2),
    longitude: z.number().min(-66.6).max(-59.4),
    timezone: z.literal("America/Halifax"),
  }),
  classification: z.object({
    surface: z.string(),
    exposure: z.enum([
      "sheltered-bay",
      "semi-exposed",
      "open-atlantic",
      "estuary",
      "tidal-flat",
    ]),
    shore_bearing_degrees: z.number().min(0).max(359),
    tide_effect: z.enum([
      "neutral",
      "more-sand-at-low",
      "warmer-incoming-after-low",
      "reduced-access-at-high",
      "unknown",
    ]),
    // Same evidence bar as tide_effect: set only where a credible public
    // source names the beach as a surf spot, never inferred from exposure.
    surf: z.boolean().optional(),
  }),
  weather: z.object({
    site_code: z.string().regex(/^s\d{7}$/),
    site_latitude: z.number(),
    site_longitude: z.number(),
    site_name: z.string(),
    province: z.string().length(2),
  }),
  tide: z.object({
    station_code: z.string().regex(/^\d{5}$/),
    station_latitude: z.number(),
    station_longitude: z.number(),
    station_id: z.string().min(10),
    station_name: z.string(),
    confidence: z.enum(["on-site", "nearby", "regional"]),
  }),
  water: z
    .object({
      buoy_id: z.string().regex(/^\d{7}$/),
      buoy_name: z.string(),
      buoy_latitude: z.number(),
      buoy_longitude: z.number(),
    })
    .optional(),
  // Amenities are copied from the beach's official page, never assumed;
  // absent fields mean "not stated", not "not available".
  amenities: z
    .object({
      washrooms: z.boolean().optional(),
      food: z.boolean().optional(),
      note: z.string().optional(),
    })
    .optional(),
  source_urls: z.object({
    official_page: z.string().url(),
    // Required when classification.surf is set (enforced below): the public
    // source that names the beach as a surf spot.
    surf_page: z.string().url().optional(),
  }),
  coverage: z.object({
    status: z.string(),
    reviewed_at: z.union([z.string(), z.date()]),
  }),
}).refine(
  (beach) => !beach.classification.surf || beach.source_urls.surf_page,
  {
    message: "classification.surf requires source_urls.surf_page",
    path: ["source_urls", "surf_page"],
  },
);

// Override timestamps must carry an explicit offset: an offset-less value is
// parsed in the runner's local timezone, which differs between a dev machine
// in Halifax and CI in UTC, silently shifting closure windows by hours.
const offsetTimestamp = z
  .string()
  .regex(
    /(Z|[+-]\d{2}:\d{2})$/,
    "timestamp must include an explicit UTC offset (Z or +-hh:mm)",
  );

const overrideSchema = z.object({
  beach_id: z.string(),
  type: z.enum(["closure", "water-advisory", "informational"]),
  title: z.string().min(1),
  message: z.string().min(1),
  source: z.string().min(1),
  starts_at: offsetTimestamp,
  expires_at: offsetTimestamp,
});

export function loadBeaches(path: string): BeachConfig[] {
  const raw = parse(readFileSync(path, "utf8"));
  const beaches = z.array(beachSchema).parse(raw);
  const ids = new Set<string>();
  for (const beach of beaches) {
    if (ids.has(beach.id)) throw new Error(`Duplicate beach id: ${beach.id}`);
    ids.add(beach.id);
  }
  return beaches as unknown as BeachConfig[];
}

export function loadThresholds(path: string): Thresholds {
  const raw = parse(readFileSync(path, "utf8"));
  const schema = z.object({
    weights: z.object({
      precipitation: z.number().positive(),
      wind: z.number().positive(),
      temperature: z.number().positive(),
      fog: z.number().positive(),
      sky: z.number().positive(),
      tide: z.number().positive(),
    }),
    temperature_c: z.object({
      ideal_min: z.number(),
      ideal_max: z.number(),
      ok_min: z.number(),
      ok_max: z.number(),
      poor_min: z.number(),
      poor_max: z.number(),
    }),
    wind_kmh: z.object({
      calm_max: z.number(),
      ok_max: z.number(),
      windy_max: z.number(),
      gust_factor: z.number(),
    }),
    precipitation_pop: z.object({
      low_max: z.number(),
      high_max: z.number(),
    }),
    ratings: z.object({
      good_min: z.number(),
      ok_min: z.number(),
      meh_min: z.number(),
    }),
    window: z.object({
      min_hours: z.number().int().positive(),
    }),
    staleness: z.object({
      valid_minutes: z.number().int().positive(),
    }),
  });
  return schema.parse(raw);
}

export function loadOverrides(
  path: string,
  now: Date,
  horizonEnd: Date = now,
): ManualOverride[] {
  const raw = parse(readFileSync(path, "utf8"));
  if (raw === null || (Array.isArray(raw) && raw.length === 0)) return [];
  const overrides = z.array(overrideSchema).parse(raw);
  return overrides.filter((entry) => {
    const starts = new Date(entry.starts_at);
    const expires = new Date(entry.expires_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(expires.getTime())) {
      throw new Error(`Override "${entry.title}" has invalid timestamps`);
    }
    return starts <= horizonEnd && now <= expires;
  });
}
