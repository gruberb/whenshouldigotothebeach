import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSwobSeaSurfaceTemp } from "../scripts/lib/water.js";

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
