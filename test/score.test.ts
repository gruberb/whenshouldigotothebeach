import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadThresholds } from "../scripts/lib/registry.js";
import {
  findBestWindow,
  fogScore,
  precipitationScore,
  scoreHour,
  tideScore,
  temperatureScore,
  verdictFor,
  windScore,
  windRelationFor,
} from "../scripts/lib/score.js";
import type {
  BeachConfig,
  HourlyWeather,
  ManualOverride,
  ScoredHour,
  SunTimes,
  TideData,
} from "../scripts/lib/types.js";

const thresholds = loadThresholds(join(__dirname, "..", "config", "thresholds.yml"));

const beach: BeachConfig = {
  id: "test",
  name: "Test Beach",
  municipality: "Test",
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
  sourceKind: "predicted",
  fetchedAt: "2026-08-08T00:00:00Z",
  events: [],
  samples: [],
};

// Daylight roughly 09:00Z to 23:30Z, matching Nova Scotia in August.
const sun: SunTimes[] = [
  {
    date: "2026-08-08",
    sunrise: "2026-08-08T09:15:00Z",
    sunset: "2026-08-08T23:35:00Z",
  },
];

function hourAt(isoTime: string, overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  return {
    time: isoTime,
    temperatureC: 22,
    humidexC: null,
    condition: "Sunny",
    iconCode: 0,
    popPercent: 0,
    windKmh: 10,
    gustKmh: null,
    windDirection: "SW",
    ...overrides,
  };
}

const ctx = { beach, thresholds, tides: noTides, sun };

describe("component monotonicity", () => {
  it("more precipitation probability never improves the score", () => {
    let previous = Infinity;
    for (let pop = 0; pop <= 100; pop += 5) {
      const score = precipitationScore(pop, "Cloudy", thresholds);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });

  it("stronger wind never improves the score", () => {
    let previous = Infinity;
    for (let wind = 0; wind <= 70; wind += 5) {
      const score = windScore(wind, null, thresholds);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });

  it("gusts count against calm reported wind", () => {
    expect(windScore(20, 50, thresholds)).toBeLessThan(windScore(20, null, thresholds));
  });

  it("rain in the condition text caps the precipitation component", () => {
    expect(precipitationScore(30, "Light rain", thresholds)).toBeLessThanOrEqual(0.3);
  });
});

describe("temperature comfort", () => {
  it("prefers the ideal band", () => {
    expect(temperatureScore(22, null, thresholds)).toBe(1);
    expect(temperatureScore(10, null, thresholds)).toBeLessThan(0.5);
    expect(temperatureScore(35, null, thresholds)).toBeLessThan(0.5);
  });

  it("does not turn a missing temperature into a great or terrible hour", () => {
    const score = temperatureScore(null, null, thresholds);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.9);
  });
});

describe("fog and sky", () => {
  it("dense fog is much worse than fog patches", () => {
    expect(fogScore("Fog")).toBeLessThan(fogScore("Fog patches"));
    expect(fogScore("Sunny")).toBe(1);
  });
});

describe("tide preference", () => {
  it("neutral beaches ignore tide phase", () => {
    expect(tideScore("low", "neutral")).toBe(tideScore("high", "neutral"));
  });

  it("more-sand-at-low prefers low tide", () => {
    expect(tideScore("low", "more-sand-at-low")).toBeGreaterThan(
      tideScore("high", "more-sand-at-low"),
    );
  });

  it("warmer-incoming prefers the rising tide", () => {
    expect(tideScore("rising", "warmer-incoming-after-low")).toBeGreaterThan(
      tideScore("falling", "warmer-incoming-after-low"),
    );
  });
});

describe("wind relation", () => {
  it("classifies onshore, offshore and cross-shore", () => {
    expect(windRelationFor("SE", 140)).toBe("onshore");
    expect(windRelationFor("NW", 140)).toBe("offshore");
    expect(windRelationFor("NE", 140)).toBe("cross-shore");
    expect(windRelationFor(null, 140)).toBeNull();
  });
});

describe("scoreHour", () => {
  it("gates thunderstorm hours regardless of other conditions", () => {
    const scored = scoreHour(
      hourAt("2026-08-08T15:00:00Z", {
        condition: "Chance of showers or thunderstorms",
      }),
      ctx,
    );
    expect(scored.gated).toBe(true);
    expect(scored.score).toBeLessThanOrEqual(15);
    expect(scored.rating).toBe("poor");
  });

  it("marks hours outside daylight as night", () => {
    const scored = scoreHour(hourAt("2026-08-08T03:00:00Z"), ctx);
    expect(scored.daylight).toBe(false);
    expect(scored.rating).toBe("night");
  });

  it("caps steady rain below the ok band", () => {
    const scored = scoreHour(
      hourAt("2026-08-08T15:00:00Z", { condition: "Rain", popPercent: 90 }),
      ctx,
    );
    expect(scored.score).toBeLessThan(thresholds.ratings.ok_min);
  });

  it("caps steady rain even at moderate probability", () => {
    const scored = scoreHour(
      hourAt("2026-08-08T15:00:00Z", { condition: "Light rain", popPercent: 70 }),
      ctx,
    );
    expect(scored.score).toBeLessThan(thresholds.ratings.ok_min);
  });

  it("does not treat a chance of showers like steady rain", () => {
    const scored = scoreHour(
      hourAt("2026-08-08T15:00:00Z", {
        condition: "Chance of showers",
        popPercent: 30,
      }),
      ctx,
    );
    expect(scored.score).toBeGreaterThanOrEqual(thresholds.ratings.ok_min);
  });

  it("scores a sunny calm warm daylight hour as good", () => {
    const scored = scoreHour(hourAt("2026-08-08T15:00:00Z"), ctx);
    expect(scored.rating).toBe("good");
  });
});

describe("findBestWindow", () => {
  function syntheticHour(
    isoTime: string,
    score: number,
    opts: Partial<ScoredHour> = {},
  ): ScoredHour {
    return {
      time: isoTime,
      score,
      rating: score >= thresholds.ratings.good_min ? "good" : "ok",
      daylight: true,
      gated: false,
      temperatureC: 22,
      humidexC: null,
      condition: "Sunny",
      iconCode: 0,
      popPercent: 0,
      windKmh: 10,
      gustKmh: null,
      windDirection: "SW",
      windRelation: "onshore",
      tidePhase: null,
      ...opts,
    };
  }

  it("returns null when no run reaches the minimum length", () => {
    const hours = [
      syntheticHour("2026-08-08T15:00:00Z", 90),
      syntheticHour("2026-08-08T16:00:00Z", 30, { rating: "poor" }),
      syntheticHour("2026-08-08T17:00:00Z", 90),
    ];
    expect(findBestWindow(hours, thresholds)).toBeNull();
  });

  it("prefers the earliest good run over a later higher-scoring one", () => {
    const hours = [
      syntheticHour("2026-08-08T12:00:00Z", 75),
      syntheticHour("2026-08-08T13:00:00Z", 76),
      syntheticHour("2026-08-08T14:00:00Z", 30, { rating: "poor" }),
      syntheticHour("2026-08-08T15:00:00Z", 95),
      syntheticHour("2026-08-08T16:00:00Z", 96),
    ];
    const window = findBestWindow(hours, thresholds);
    expect(window).not.toBeNull();
    expect(window!.start).toBe("2026-08-08T12:00:00Z");
    expect(window!.quality).toBe("good");
  });

  it("does not let a peak cut off by the forecast horizon beat a full day", () => {
    // Regression: a perfect Sunday (92-100 all day) lost to tomorrow's run,
    // which the data horizon truncated to its two best morning hours; every
    // South Shore beach then read GOOD_LATER "MON 06:00-08:00".
    const today = Array.from({ length: 12 }, (_, i) =>
      syntheticHour(
        `2026-08-09T${String(11 + i).padStart(2, "0")}:00:00Z`,
        i === 0 ? 73 : 92 + (i % 5),
      ),
    );
    const truncatedTomorrow = [
      syntheticHour("2026-08-10T09:00:00Z", 100),
      syntheticHour("2026-08-10T10:00:00Z", 97),
    ];
    const window = findBestWindow([...today, ...truncatedTomorrow], thresholds);
    expect(window!.start).toBe("2026-08-09T11:00:00Z");
    expect(window!.end).toBe("2026-08-09T23:00:00.000Z");
  });

  it("ignores night and gated hours", () => {
    const hours = [
      syntheticHour("2026-08-08T02:00:00Z", 95, { daylight: false, rating: "night" }),
      syntheticHour("2026-08-08T03:00:00Z", 95, { daylight: false, rating: "night" }),
      syntheticHour("2026-08-08T15:00:00Z", 95, { gated: true }),
      syntheticHour("2026-08-08T16:00:00Z", 95, { gated: true }),
    ];
    expect(findBestWindow(hours, thresholds)).toBeNull();
  });

  it("falls back to an ok-quality window", () => {
    const hours = [
      syntheticHour("2026-08-08T15:00:00Z", 60),
      syntheticHour("2026-08-08T16:00:00Z", 62),
    ];
    const window = findBestWindow(hours, thresholds);
    expect(window!.quality).toBe("ok");
  });
});

describe("verdictFor", () => {
  const generatedAt = new Date("2026-08-08T14:00:00Z");
  const goodWindow = {
    start: "2026-08-08T15:00:00Z",
    end: "2026-08-08T18:00:00Z",
    quality: "good" as const,
    avgScore: 90,
  };

  function override(type: ManualOverride["type"]): ManualOverride {
    return {
      beach_id: "test",
      type,
      title: "t",
      message: "m",
      source: "s",
      starts_at: "2026-08-08T00:00:00Z",
      expires_at: "2026-08-09T00:00:00Z",
    };
  }

  it("closure always wins", () => {
    expect(
      verdictFor({
        window: goodWindow,
        overrides: [override("closure")],
        warnings: [],
        generatedAt,
      }),
    ).toBe("CLOSED");
  });

  it("red weather warnings mean hazardous", () => {
    expect(
      verdictFor({
        window: goodWindow,
        overrides: [],
        warnings: [{ type: "warning", colour: "red", description: "X", url: null }],
        generatedAt,
      }),
    ).toBe("HAZARDOUS");
  });

  it("water advisories override favourable weather", () => {
    expect(
      verdictFor({
        window: goodWindow,
        overrides: [override("water-advisory")],
        warnings: [],
        generatedAt,
      }),
    ).toBe("WATER_ADVISORY");
  });

  it("a window starting soon is GO_NOW, later is GOOD_LATER", () => {
    expect(
      verdictFor({ window: goodWindow, overrides: [], warnings: [], generatedAt }),
    ).toBe("GO_NOW");
    expect(
      verdictFor({
        window: { ...goodWindow, start: "2026-08-08T20:00:00Z" },
        overrides: [],
        warnings: [],
        generatedAt,
      }),
    ).toBe("GOOD_LATER");
  });

  it("no window means NOT_GREAT, ok window means MIXED", () => {
    expect(
      verdictFor({ window: null, overrides: [], warnings: [], generatedAt }),
    ).toBe("NOT_GREAT");
    expect(
      verdictFor({
        window: { ...goodWindow, quality: "ok" },
        overrides: [],
        warnings: [],
        generatedAt,
      }),
    ).toBe("MIXED");
  });
});
