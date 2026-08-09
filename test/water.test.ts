import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  fetchBuoySeaSurfaceTemp,
  parseSwobSeaSurfaceTemp,
} from "../scripts/lib/water.js";

const xml = readFileSync(
  join(__dirname, "fixtures", "eccc", "swob-44258.xml"),
  "utf8",
);

describe("parseSwobSeaSurfaceTemp", () => {
  it("extracts the sea surface temperature from a real SWOB document", () => {
    const observation = parseSwobSeaSurfaceTemp(xml);
    expect(observation.valueC).toBe(18.2);
    expect(observation.stationName).toBe("HALIFAX HARBOUR");
    expect(observation.observedAt).toBe("2026-08-08T03:05:00.000Z");
  });

  it("rejects documents without a sea surface temperature", () => {
    const stripped = xml.replace(/avg_sea_sfc_temp_pst10mts/g, "removed");
    expect(() => parseSwobSeaSurfaceTemp(stripped)).toThrow(
      /sea surface temperature/i,
    );
  });

  it("rejects unparseable temperature values", () => {
    const broken = xml.replace(
      /name="avg_sea_sfc_temp_pst10mts" uom="°C" value="18.2"/,
      'name="avg_sea_sfc_temp_pst10mts" uom="°C" value="MSNG"',
    );
    expect(() => parseSwobSeaSurfaceTemp(broken)).toThrow(/unparseable/i);
  });
});

// The stale-observation error used to be built from files[files.length - 1]
// after an in-place reverse(), so it reported the age of the OLDEST file on
// the server. During the August 2026 buoy outage that read "38h old" when the
// newest observation was 24h old, pointing at the wrong file entirely.
describe("fetchBuoySeaSurfaceTemp staleness reporting", () => {
  const originalFetch = globalThis.fetch;
  const NOW = new Date("2026-08-09T14:14:00Z");

  const at = (stamp: string, iso: string) => ({
    file: `2026-08-08-${stamp}-4400258-AUTO-swob.xml`,
    xml: xml.replace(
      'name="date_tm" uom="datetime" value="2026-08-08T03:05:00.000Z"',
      `name="date_tm" uom="datetime" value="${iso}"`,
    ),
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports the newest observation's age and stops walking back", async () => {
    const entries = [
      at("0005", "2026-08-08T00:05:00.000Z"),
      at("0705", "2026-08-08T07:05:00.000Z"),
      at("1405", "2026-08-08T14:05:00.000Z"),
    ];
    const fetched: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      // Today's tree is gone, as it was during the outage.
      if (url.includes("/20260809/")) return new Response("", { status: 404 });
      const hit = entries.find((e) => url.endsWith(e.file));
      if (hit) {
        fetched.push(hit.file);
        return new Response(hit.xml, { status: 200 });
      }
      return new Response(
        entries.map((e) => `<a href="${e.file}">${e.file}</a>`).join(""),
        { status: 200 },
      );
    }) as typeof fetch;

    await expect(fetchBuoySeaSurfaceTemp("4400258", NOW)).rejects.toThrow(
      /buoy 4400258 is 24h old/,
    );
    // Only the newest file is read: everything older is older still.
    expect(fetched).toEqual(["2026-08-08-1405-4400258-AUTO-swob.xml"]);
  });

  it("distinguishes a feed publishing without the element from a stale feed", async () => {
    const file = "2026-08-09-1400-4400258-AUTO-swob.xml";
    const missing = xml.replace(/avg_sea_sfc_temp_pst10mts/g, "removed");
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(file)) return new Response(missing, { status: 200 });
      if (url.includes("/20260809/")) {
        return new Response(`<a href="${file}">${file}</a>`, { status: 200 });
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;

    await expect(fetchBuoySeaSurfaceTemp("4400258", NOW)).rejects.toThrow(
      /No usable SWOB observation for buoy 4400258/,
    );
  });
});
