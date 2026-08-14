import { fetchJson } from "./fetch.js";
import type { TideData, TideEvent, TideSample } from "./types.js";

const IWLS = "https://api-iwls.dfo-mpo.gc.ca/api/v1";

interface IwlsReading {
  eventDate: string;
  value: number;
}

const CURVE_INTERVAL_MS = 15 * 60_000;

export function downsampleCurve(readings: IwlsReading[]): IwlsReading[] {
  const sorted = [...readings].sort(
    (a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate),
  );
  let lastKept = -Infinity;
  return sorted.filter((reading) => {
    const time = Date.parse(reading.eventDate);
    if (time - lastKept < CURVE_INTERVAL_MS) return false;
    lastKept = time;
    return true;
  });
}

// wlp-hilo returns alternating extrema without labelling them; classify each
// event against its neighbours.
export function classifyExtrema(
  readings: { eventDate: string; value: number }[],
): TideEvent[] {
  const sorted = [...readings].sort(
    (a, b) => Date.parse(a.eventDate) - Date.parse(b.eventDate),
  );
  return sorted.map((reading, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    let isHigh: boolean;
    if (prev && next) {
      isHigh = reading.value > prev.value && reading.value > next.value;
    } else if (next) {
      isHigh = reading.value > next.value;
    } else if (prev) {
      isHigh = reading.value > prev.value;
    } else {
      isHigh = false;
    }
    return {
      time: new Date(reading.eventDate).toISOString(),
      type: isHigh ? ("high" as const) : ("low" as const),
      heightM: reading.value,
    };
  });
}

export async function fetchTides(
  stationId: string,
  stationCode: string,
  stationName: string,
  from: Date,
  to: Date,
): Promise<TideData> {
  const range = `from=${from.toISOString().replace(/\.\d{3}Z$/, "Z")}&to=${to
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")}`;

  const events = await fetchJson<IwlsReading[]>(
    `${IWLS}/stations/${stationId}/data?time-series-code=wlp-hilo&${range}`,
  );
  const curve = await fetchJson<IwlsReading[]>(
    `${IWLS}/stations/${stationId}/data?time-series-code=wlp&${range}`,
  );

  const samples: TideSample[] = downsampleCurve(curve)
    .map((reading) => ({
      time: new Date(reading.eventDate).toISOString(),
      heightM: Math.round(reading.value * 100) / 100,
    }));

  return {
    stationCode,
    stationId,
    stationName,
    sourceKind: "predicted",
    fetchedAt: new Date().toISOString(),
    events: classifyExtrema(events),
    samples,
  };
}

export function unavailableTides(
  stationId: string,
  stationCode: string,
  stationName: string,
): TideData {
  return {
    stationCode,
    stationId,
    stationName,
    sourceKind: "unavailable",
    fetchedAt: new Date().toISOString(),
    events: [],
    samples: [],
  };
}
