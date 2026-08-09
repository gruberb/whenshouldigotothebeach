import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fetchLatestCitypage, parseCitypage } from "../scripts/lib/eccc.js";

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

// A throttled or timed-out directory listing used to be swallowed into an
// empty result, so an unreachable datamart reported itself as "no citypage
// file within 12h lookback". That message cost a maintainer a hunt for a
// missing ECCC file that had in fact been published on time.
describe("fetchLatestCitypage transport failures", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // One unreachable directory is enough: with a hole in the walk we cannot
  // claim the forecast is absent, only that we failed to look.
  it("names the transport failure when a listing cannot be read", async () => {
    // Keyed on URL, not call count: the failing directory has to stay down
    // across its retry, otherwise the retry resolves it and there is no hole.
    let downUrl: string | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      downUrl ??= url;
      return url === downUrl
        ? new Response("upstream busy", { status: 503 })
        : new Response("not found", { status: 404 });
    }) as typeof fetch;

    await expect(
      fetchLatestCitypage("NS", "s0000318", new Date("2026-08-09T13:36:00Z")),
    ).rejects.toThrow(/Datamart unreachable for 1 of 13 hour directories/);
  });

  // A different day from the test above on purpose: listing results are cached
  // for the lifetime of a build run, so same-day URLs would hit that cache.
  it("still reports a genuinely absent forecast as absent", async () => {
    globalThis.fetch = (async () =>
      new Response("not found", { status: 404 })) as typeof fetch;

    await expect(
      fetchLatestCitypage("NS", "s0000318", new Date("2026-08-07T13:36:00Z")),
    ).rejects.toThrow(/No citypage file for s0000318 within 12h lookback/);
  });
});
