import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCitypage } from "../scripts/lib/eccc.js";

const xml = readFileSync(
  join(__dirname, "fixtures", "eccc", "citypage-lunenburg.xml"),
  "utf8",
);

describe("parseCitypage", () => {
  const parsed = parseCitypage(xml, "s0000440", "fixture://lunenburg");

  it("extracts 24 hourly forecast entries", () => {
    expect(parsed.hourly).toHaveLength(24);
  });

  it("extracts the hourly forecast issue time in UTC", () => {
    expect(parsed.issuedAtUtc).toBe("2026-08-07T16:00:00Z");
  });

  it("parses hourly fields", () => {
    const first = parsed.hourly[0];
    expect(first.time).toBe("2026-08-08T02:00:00Z");
    expect(first.temperatureC).toBe(24);
    expect(first.condition).toBe("A few clouds");
    expect(first.popPercent).toBe(0);
    expect(first.windKmh).toBe(5);
    expect(first.windDirection).toBeNull();
  });

  it("keeps hourly timestamps one hour apart", () => {
    for (let i = 1; i < parsed.hourly.length; i++) {
      const delta =
        Date.parse(parsed.hourly[i].time) - Date.parse(parsed.hourly[i - 1].time);
      expect(delta).toBe(3600_000);
    }
  });

  it("extracts active warnings", () => {
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0].colour).toBe("yellow");
    expect(parsed.warnings[0].description).toMatch(/HEAT/);
  });

  it("extracts daily outlook periods", () => {
    expect(parsed.daily.length).toBeGreaterThanOrEqual(2);
    expect(parsed.daily[0].name.length).toBeGreaterThan(0);
    expect(parsed.daily[0].summary.length).toBeGreaterThan(0);
  });

  it("rejects documents without hourly data", () => {
    expect(() =>
      parseCitypage("<siteData></siteData>", "s0000440", "fixture://broken"),
    ).toThrow();
  });

  // The datamart intermittently stamps forecastIssue with the file-generation
  // date while keeping the issuance hour, e.g. a file created 02:00Z Aug 8
  // claiming an issue time of 16:00Z Aug 8, fourteen hours in the future.
  it("rolls future-dated forecast issue times back against xmlCreation", () => {
    const futureStamped = xml.replace(
      /<timeStamp>20260807160000<\/timeStamp>/g,
      "<timeStamp>20260808160000</timeStamp>",
    );
    const parsed2 = parseCitypage(futureStamped, "s0000440", "fixture://future");
    expect(parsed2.issuedAtUtc).toBe("2026-08-07T16:00:00.000Z");
  });
});
