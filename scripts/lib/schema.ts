import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);

const verdict = z.enum([
  "GO_NOW",
  "GOOD_LATER",
  "MIXED",
  "NOT_GREAT",
  "WATER_ADVISORY",
  "CLOSED",
  "HAZARDOUS",
]);

const region = z.enum([
  "south-shore",
  "yarmouth-acadian-shores",
  "bay-of-fundy-annapolis-valley",
  "northumberland-shore",
  "halifax-metro",
  "eastern-shore",
  "cape-breton",
]);

const reason = z.object({
  kind: z.enum([
    "thunder",
    "rain",
    "dry",
    "fog",
    "wind",
    "offshore",
    "temperature",
    "heat",
    "tide",
    "none",
  ]),
  text: z.string().min(1),
  short: z.string().min(1),
});

const bestWindow = z.object({
  start: isoDate,
  end: isoDate,
  quality: z.enum(["good", "ok"]),
  avgScore: z.number().min(0).max(100),
});

const waterTemperature = z.union([
  z.object({
    sourceKind: z.literal("observed-buoy"),
    valueC: z.number(),
    observedAt: isoDate,
    stationName: z.string(),
    distanceKm: z.number().min(0),
  }),
  z.object({
    sourceKind: z.literal("unavailable"),
    valueC: z.null(),
    observedAt: z.null(),
    stationName: z.null(),
    distanceKm: z.null(),
  }),
]);

const scoredHour = z.object({
  time: isoDate,
  score: z.number().min(0).max(100),
  rating: z.enum(["good", "ok", "meh", "poor", "night"]),
  daylight: z.boolean(),
  gated: z.boolean(),
  temperatureC: z.number().nullable(),
  humidexC: z.number().nullable(),
  condition: z.string(),
  iconCode: z.number().nullable(),
  popPercent: z.number().min(0).max(100),
  windKmh: z.number().nullable(),
  gustKmh: z.number().nullable(),
  windDirection: z.string().nullable(),
  windRelation: z.enum(["onshore", "offshore", "cross-shore"]).nullable(),
  tidePhase: z.enum(["low", "rising", "high", "falling"]).nullable(),
});

export const beachOutputSchema = z.object({
  schemaVersion: z.literal(1),
  beach: z.object({
    id: z.string(),
    name: z.string(),
    region,
    municipality: z.string(),
    exposure: z.string(),
    surface: z.string(),
    tideEffect: z.string(),
    surf: z.boolean(),
    latitude: z.number(),
    longitude: z.number(),
    officialPage: z.string().url(),
    amenities: z.object({
      washrooms: z.boolean().nullable(),
      food: z.boolean().nullable(),
      note: z.string().nullable(),
    }),
  }),
  generatedAt: isoDate,
  validUntil: isoDate,
  timezone: z.literal("America/Halifax"),
  summary: z.object({
    verdict,
    bestWindow: bestWindow.nullable(),
    reasons: z.array(reason).min(1).max(3),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  hourly: z.array(scoredHour).min(12),
  sun: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sunrise: isoDate,
      sunset: isoDate,
    }),
  ),
  tides: z.object({
    stationCode: z.string(),
    stationName: z.string(),
    distanceKm: z.number().min(0),
    sourceKind: z.enum(["predicted", "unavailable"]),
    events: z.array(
      z.object({
        time: isoDate,
        type: z.enum(["high", "low"]),
        heightM: z.number(),
      }),
    ),
    samples: z.array(z.object({ time: isoDate, heightM: z.number() })),
  }),
  water: waterTemperature,
  nearbyFood: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.string().min(1),
        distanceKm: z.number().min(0),
      }),
    )
    .max(3),
  weatherSource: z.object({
    siteCode: z.string(),
    siteName: z.string(),
    distanceKm: z.number().min(0),
    issuedAt: isoDate,
    fetchedAt: isoDate,
    kind: z.literal("forecast"),
  }),
  warnings: z.array(
    z.object({
      type: z.string(),
      colour: z.string().nullable(),
      description: z.string(),
      url: z.string().nullable(),
    }),
  ),
  advisories: z.array(
    z.object({
      beach_id: z.string(),
      type: z.string(),
      title: z.string(),
      message: z.string(),
      source: z.string(),
      starts_at: z.string(),
      expires_at: z.string(),
    }),
  ),
  outlook: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      popPercent: z.number().nullable(),
    }),
  ),
});

export const beachIndexSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: isoDate,
  validUntil: isoDate,
  timezone: z.literal("America/Halifax"),
  beaches: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        region,
        municipality: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        washrooms: z.boolean().nullable(),
        surf: z.boolean(),
        verdict,
        bestWindow: bestWindow.nullable(),
        reasons: z.array(reason),
        confidence: z.enum(["high", "medium", "low"]),
        peakScore: z.number().min(0).max(100),
        firstHour: scoredHour.nullable(),
        hourly: z.array(scoredHour).min(12),
        tideEvents: z.array(
          z.object({
            time: isoDate,
            type: z.enum(["high", "low"]),
            heightM: z.number(),
          }),
        ),
        water: waterTemperature,
      }),
    )
    .min(1),
});

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: isoDate,
  validUntil: isoDate,
  beachIds: z.array(z.string()).min(1),
});
