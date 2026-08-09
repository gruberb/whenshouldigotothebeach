import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./fetch.js";
import type { WaterTemperature, XmlNode } from "./types.js";

const DATAMART = "https://dd.weather.gc.ca";
const MAX_OBSERVATION_AGE_HOURS = 24;

function utcDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

// SWOB-ML nests <element name=... value=...> at varying depths; collect every
// element node regardless of structure.
function collectElements(node: unknown, out: Map<string, string>): void {
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "element") {
      for (const el of Array.isArray(value) ? value : [value]) {
        const name = (el as XmlNode)["@_name"];
        const val = (el as XmlNode)["@_value"];
        if (name !== undefined && val !== undefined && !out.has(name)) {
          out.set(String(name), String(val));
        }
        collectElements(el, out);
      }
    } else {
      collectElements(value, out);
    }
  }
}

export function parseSwobSeaSurfaceTemp(xml: string): {
  valueC: number;
  observedAt: string;
  stationName: string;
} {
  const doc = parser.parse(xml);
  const elements = new Map<string, string>();
  collectElements(doc, elements);

  const raw = elements.get("avg_sea_sfc_temp_pst10mts");
  if (raw === undefined) {
    throw new Error("No sea surface temperature element in SWOB document");
  }
  const valueC = Number(raw);
  if (!Number.isFinite(valueC)) {
    throw new Error(`Unparseable sea surface temperature: ${raw}`);
  }
  const observedAt = elements.get("date_tm");
  if (!observedAt) {
    throw new Error("No observation time in SWOB document");
  }
  return {
    valueC,
    observedAt: new Date(observedAt).toISOString(),
    stationName: elements.get("stn_nam") ?? "unknown",
  };
}

// Latest observation for a moored buoy. The dated tree is addressed directly
// (never the /today/ alias) for the same midnight-rollover reason as the
// citypage fetch; buoys report hourly, so today plus yesterday is plenty.
export async function fetchBuoySeaSurfaceTemp(
  buoyId: string,
  now: Date = new Date(),
): Promise<{ valueC: number; observedAt: string; stationName: string }> {
  let staleAgeHours: number | null = null;
  let lastParseError: Error | null = null;

  for (const dayOffset of [0, 1]) {
    // Files are read newest first and yesterday is older than today, so once
    // one is past the cutoff there is nothing fresher left to find.
    if (staleAgeHours !== null) break;

    const day = new Date(now.getTime() - dayOffset * 24 * 3600 * 1000);
    const stamp = utcDateStamp(day);
    const dir = `${DATAMART}/${stamp}/WXO-DD/observations/swob-ml/marine/moored-buoys/${stamp}/${buoyId}/`;
    let newestFirst: string[] = [];
    try {
      const html = await fetchText(dir, 0);
      newestFirst = [...html.matchAll(/href="([^"?/][^"]*-swob\.xml)"/g)]
        .map((m) => m[1])
        .sort()
        .reverse();
    } catch {
      continue;
    }

    for (const file of newestFirst) {
      const xml = await fetchText(dir + file);
      let observation;
      try {
        observation = parseSwobSeaSurfaceTemp(xml);
      } catch (error) {
        // Buoys publish every ten minutes but populate sea surface temperature
        // only in the top-of-hour file; the rest carry MSNG. Keep walking back.
        lastParseError = error as Error;
        continue;
      }
      const ageHours =
        (now.getTime() - Date.parse(observation.observedAt)) / 3600_000;
      if (ageHours > MAX_OBSERVATION_AGE_HOURS) {
        staleAgeHours = ageHours;
        break;
      }
      return observation;
    }
  }

  // Each of these is a different problem for whoever reads the log: an upstream
  // feed that stopped, a feed that is publishing without the element we need,
  // or a buoy that is not there at all. The previous message reported the age
  // of the oldest file on the server, which pointed at none of them.
  if (staleAgeHours !== null) {
    throw new Error(
      `Latest observation for buoy ${buoyId} is ${Math.round(staleAgeHours)}h old`,
    );
  }
  if (lastParseError) {
    throw new Error(
      `No usable SWOB observation for buoy ${buoyId}: ${lastParseError.message}`,
    );
  }
  throw new Error(`No SWOB observations found for buoy ${buoyId}`);
}

export function unavailableWater(): WaterTemperature {
  return {
    sourceKind: "unavailable",
    valueC: null,
    observedAt: null,
    stationName: null,
    distanceKm: null,
  };
}
