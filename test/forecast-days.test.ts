import { describe, expect, it } from "vitest";
import {
  availableForecastDates,
  confidenceForDay,
  hoursForDate,
  overridesForDate,
  precisionHoursForDay,
  sampleForecastHours,
  scoreableHoursForDate,
} from "../scripts/lib/forecast-days.js";
import type { ManualOverride, ScoredHour, TideData } from "../scripts/lib/types.js";

function hour(time: string): ScoredHour {
  return {
    time,
    score: 80,
    rating: "good",
    daylight: true,
    gated: false,
    temperatureC: 22,
    feelsLikeC: 22,
    condition: "Clear",
    iconCode: 0,
    popPercent: 0,
    windKmh: 10,
    gustKmh: null,
    windDirection: "SW",
    windRelation: "onshore",
    tidePhase: null,
  };
}

const tides: TideData = {
  stationCode: "00455",
  stationId: "station-id",
  stationName: "Lunenburg",
  sourceKind: "predicted",
  fetchedAt: "2026-08-08T12:00:00Z",
  events: [],
  samples: [],
};

describe("forecast day grouping", () => {
  const hours = [
    hour("2026-08-08T02:00:00Z"), // Aug 7 at 23:00 ADT
    hour("2026-08-08T03:00:00Z"),
    hour("2026-08-08T12:00:00Z"),
    hour("2026-08-09T02:00:00Z"),
    hour("2026-08-09T03:00:00Z"),
  ];

  it("groups by Atlantic calendar date rather than UTC date", () => {
    expect(hoursForDate(hours, "2026-08-08", "America/Halifax")).toHaveLength(3);
    expect(
      availableForecastDates(
        hours,
        "America/Halifax",
        new Date("2026-08-08T10:00:00Z"),
      ),
    ).toEqual(["2026-08-08", "2026-08-09"]);
  });

  it("does not recommend hours that already passed today", () => {
    const upcoming = scoreableHoursForDate(
      hours,
      "2026-08-08",
      "America/Halifax",
      new Date("2026-08-08T12:30:00Z"),
    );
    expect(upcoming.map((entry) => entry.time)).toEqual([
      "2026-08-08T12:00:00Z",
      "2026-08-09T02:00:00Z",
    ]);
  });

  it("applies scheduled overrides only to overlapping dates", () => {
    const override: ManualOverride = {
      beach_id: "test",
      type: "closure",
      title: "Closed",
      message: "m",
      source: "s",
      starts_at: "2026-08-09T10:00:00Z",
      expires_at: "2026-08-09T20:00:00Z",
    };
    expect(
      overridesForDate(
        [override],
        hoursForDate(hours, "2026-08-08", "America/Halifax"),
      ),
    ).toEqual([]);
  });

  it("lowers precision and confidence with forecast lead time", () => {
    expect(precisionHoursForDay(2)).toBe(1);
    expect(precisionHoursForDay(3)).toBe(3);
    expect(confidenceForDay(0, 5, 5, tides)).toBe("high");
    expect(confidenceForDay(3, 5, 5, tides)).toBe("medium");
    expect(confidenceForDay(4, 5, 5, tides)).toBe("low");
  });

  it("samples planning days in three-hour steps", () => {
    const day = Array.from({ length: 9 }, (_, index) =>
      hour(`2026-08-08T${String(index + 3).padStart(2, "0")}:00:00Z`),
    );
    expect(sampleForecastHours(day, 3).map((entry) => entry.time)).toEqual([
      "2026-08-08T03:00:00Z",
      "2026-08-08T06:00:00Z",
      "2026-08-08T09:00:00Z",
    ]);
  });
});
