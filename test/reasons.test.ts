import { describe, expect, it } from "vitest";
import { buildReasons } from "../scripts/lib/reasons.js";
import type {
  BeachConfig,
  BestWindow,
  ScoredHour,
  TideData,
} from "../scripts/lib/types.js";

const beach: BeachConfig = {
  id: "test",
  name: "Test Beach",
  municipality: "Test",
  region: "south-shore",
  location: { latitude: 44.2, longitude: -64.3, timezone: "America/Halifax" },
  classification: {
    surface: "sand",
    exposure: "open-atlantic",
    shore_bearing_degrees: 140,
    tide_effect: "neutral",
  },
  weather: {
    site_code: "s0000440",
    site_latitude: 44.38,
    site_longitude: -64.32,
    site_name: "Lunenburg",
    province: "NS",
  },
  tide: {
    station_code: "00455",
    station_latitude: 44.375,
    station_longitude: -64.307,
    station_id: "x".repeat(24),
    station_name: "Lunenburg",
    confidence: "regional",
  },
  source_urls: { official_page: "https://example.com" },
  coverage: { status: "full", reviewed_at: "2026-08-07" },
};

const noTides: TideData = {
  stationCode: "00455",
  stationId: "x".repeat(24),
  stationName: "Lunenburg",
  sourceKind: "unavailable",
  fetchedAt: "2026-08-08T00:00:00Z",
  events: [],
  samples: [],
};

const generatedAt = new Date("2026-08-08T12:00:00Z");

function hour(isoTime: string, overrides: Partial<ScoredHour> = {}): ScoredHour {
  return {
    time: isoTime,
    score: 80,
    rating: "good",
    daylight: true,
    gated: false,
    temperatureC: 22,
    feelsLikeC: null,
    condition: "Sunny",
    iconCode: 0,
    popPercent: 0,
    windKmh: 10,
    gustKmh: null,
    windDirection: "SW",
    windRelation: "onshore",
    tidePhase: null,
    ...overrides,
  };
}

describe("buildReasons", () => {
  it("leads with fog when fog suppresses the whole day", () => {
    const hours = Array.from({ length: 8 }, (_, i) =>
      hour(`2026-08-08T${String(12 + i).padStart(2, "0")}:00:00Z`, {
        condition: "Fog",
        score: 50,
        rating: "meh",
      }),
    );
    const reasons = buildReasons(beach, hours, null, noTides, [], generatedAt);
    expect(reasons[0].text).toMatch(/fog/i);
    expect(reasons[0].kind).toBe("fog");
  });

  it("surfaces rain arriving right after a clean window", () => {
    const window: BestWindow = {
      start: "2026-08-08T13:00:00Z",
      end: "2026-08-08T15:00:00Z",
      quality: "good",
      avgScore: 90,
    };
    const hours = [
      hour("2026-08-08T13:00:00Z"),
      hour("2026-08-08T14:00:00Z"),
      hour("2026-08-08T15:00:00Z", {
        condition: "Rain",
        popPercent: 90,
        score: 30,
        rating: "poor",
      }),
      hour("2026-08-08T16:00:00Z", {
        condition: "Rain",
        popPercent: 90,
        score: 30,
        rating: "poor",
      }),
    ];
    const reasons = buildReasons(beach, hours, window, noTides, [], generatedAt);
    const text = reasons.map((r) => r.text).join(" ");
    expect(text).toMatch(/showers around 12:00/i);
    expect(text).not.toMatch(/little to no rain/i);
  });

  it("adds a weekday marker to times on another local day", () => {
    const hours = [
      hour("2026-08-08T20:00:00Z"),
      hour("2026-08-08T21:00:00Z"),
      // 09:00Z next day is 06:00 ADT Sunday.
      hour("2026-08-09T09:00:00Z", {
        condition: "Chance of showers or thunderstorms",
        gated: true,
        score: 10,
        rating: "poor",
      }),
    ];
    const window: BestWindow = {
      start: "2026-08-08T20:00:00Z",
      end: "2026-08-08T22:00:00Z",
      quality: "good",
      avgScore: 85,
    };
    const reasons = buildReasons(beach, hours, window, noTides, [], generatedAt);
    expect(reasons[0].text).toMatch(/thunderstorm risk around SUN/i);
    expect(reasons[0].short).toMatch(/storms SUN/i);
  });

  it("only claims a rain-free day when the whole day is dry", () => {
    const hours = [hour("2026-08-08T13:00:00Z"), hour("2026-08-08T14:00:00Z")];
    const reasons = buildReasons(beach, hours, null, noTides, [], generatedAt);
    expect(reasons.map((r) => r.text).join(" ")).toMatch(/little to no rain/i);
  });
});
