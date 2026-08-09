import SunCalc from "suncalc";
import { angularDifference, compassToDegrees } from "./geo.js";
import type {
  BeachConfig,
  BestWindow,
  EcccWarning,
  HourRating,
  HourlyWeather,
  ManualOverride,
  ScoredHour,
  SunTimes,
  Thresholds,
  TideData,
  TidePhase,
  Verdict,
  WindRelation,
} from "./types.js";

const HOUR_MS = 3600 * 1000;

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function isThunder(condition: string): boolean {
  return /thunder/i.test(condition);
}

export function precipitationScore(
  popPercent: number,
  condition: string,
  t: Thresholds,
): number {
  const pop = Math.min(Math.max(popPercent, 0), 100);
  let score: number;
  if (pop <= t.precipitation_pop.low_max) {
    score = lerp(pop, 0, t.precipitation_pop.low_max, 1, 0.8);
  } else if (pop <= t.precipitation_pop.high_max) {
    score = lerp(pop, t.precipitation_pop.low_max, t.precipitation_pop.high_max, 0.8, 0.4);
  } else {
    score = lerp(pop, t.precipitation_pop.high_max, 100, 0.4, 0.05);
  }
  // "Rain" or "Showers" is expected precipitation; "chance of showers" is a
  // probability already reflected in the pop value.
  if (/rain|showers|drizzle/i.test(condition)) {
    const steady = !/chance|risk/i.test(condition);
    score = Math.min(score, steady ? 0.1 : 0.3);
  }
  return score;
}

export function windScore(
  windKmh: number | null,
  gustKmh: number | null,
  t: Thresholds,
): number {
  const effective = Math.max(
    windKmh ?? 0,
    (gustKmh ?? 0) * t.wind_kmh.gust_factor,
  );
  if (effective <= t.wind_kmh.calm_max) {
    return 1;
  }
  if (effective <= t.wind_kmh.ok_max) {
    return lerp(effective, t.wind_kmh.calm_max, t.wind_kmh.ok_max, 1, 0.75);
  }
  if (effective <= t.wind_kmh.windy_max) {
    return lerp(effective, t.wind_kmh.ok_max, t.wind_kmh.windy_max, 0.75, 0.4);
  }
  return lerp(effective, t.wind_kmh.windy_max, 60, 0.4, 0.05);
}

export function temperatureScore(
  temperatureC: number | null,
  humidexC: number | null,
  t: Thresholds,
): number {
  if (temperatureC === null) return 0.6;
  const c = t.temperature_c;
  let score: number;
  if (temperatureC >= c.ideal_min && temperatureC <= c.ideal_max) {
    score = 1;
  } else if (temperatureC < c.ideal_min) {
    if (temperatureC >= c.ok_min) {
      score = lerp(temperatureC, c.ok_min, c.ideal_min, 0.7, 1);
    } else if (temperatureC >= c.poor_min) {
      score = lerp(temperatureC, c.poor_min, c.ok_min, 0.4, 0.7);
    } else {
      score = Math.max(0.1, lerp(temperatureC, c.poor_min - 6, c.poor_min, 0.1, 0.4));
    }
  } else {
    if (temperatureC <= c.ok_max) {
      score = lerp(temperatureC, c.ideal_max, c.ok_max, 1, 0.7);
    } else if (temperatureC <= c.poor_max) {
      score = lerp(temperatureC, c.ok_max, c.poor_max, 0.7, 0.4);
    } else {
      score = Math.max(0.1, lerp(temperatureC, c.poor_max, c.poor_max + 6, 0.4, 0.1));
    }
  }
  if (humidexC !== null && humidexC >= 35) {
    score = Math.max(0.1, score - 0.15);
  }
  return score;
}

export function fogScore(condition: string): number {
  if (/fog patches|mist|haze/i.test(condition)) return 0.6;
  if (/fog/i.test(condition)) return 0.15;
  return 1;
}

function skyScore(condition: string): number {
  const text = condition.toLowerCase();
  if (/mainly sunny|mainly clear/.test(text)) return 0.9;
  if (/sunny|clear/.test(text)) return 1;
  if (/a few clouds|a mix of sun and cloud/.test(text)) return 0.85;
  if (/partly cloudy/.test(text)) return 0.8;
  if (/mostly cloudy/.test(text)) return 0.6;
  if (/cloudy|overcast/.test(text)) return 0.5;
  return 0.7;
}

export function windRelationFor(
  windDirection: string | null,
  shoreBearing: number,
): WindRelation | null {
  const windFrom = compassToDegrees(windDirection);
  if (windFrom === null) return null;
  const diff = angularDifference(windFrom, shoreBearing);
  if (diff <= 67.5) return "onshore";
  if (diff >= 112.5) return "offshore";
  return "cross-shore";
}

function tidePhaseAt(time: Date, tides: TideData): TidePhase | null {
  if (tides.events.length === 0) return null;
  const ts = time.getTime();
  let nearest: { event: (typeof tides.events)[0]; distance: number } | null = null;
  for (const event of tides.events) {
    const distance = Math.abs(Date.parse(event.time) - ts);
    if (!nearest || distance < nearest.distance) {
      nearest = { event, distance };
    }
  }
  if (nearest && nearest.distance <= HOUR_MS) {
    return nearest.event.type;
  }
  const next = tides.events.find((event) => Date.parse(event.time) > ts);
  if (!next) return null;
  return next.type === "high" ? "rising" : "falling";
}

export function tideScore(
  phase: TidePhase | null,
  tideEffect: BeachConfig["classification"]["tide_effect"],
): number {
  if (phase === null) return 0.75;
  switch (tideEffect) {
    case "more-sand-at-low":
      return { low: 1, falling: 0.9, rising: 0.7, high: 0.5 }[phase];
    case "warmer-incoming-after-low":
      return { low: 0.85, rising: 1, falling: 0.7, high: 0.6 }[phase];
    case "reduced-access-at-high":
      return { low: 0.9, falling: 0.85, rising: 0.7, high: 0.3 }[phase];
    default:
      return 0.75;
  }
}

export function sunTimesFor(
  dates: string[],
  latitude: number,
  longitude: number,
): SunTimes[] {
  return dates.map((date) => {
    // Noon UTC anchors SunCalc safely inside the local calendar day for NS.
    const times = SunCalc.getTimes(new Date(`${date}T12:00:00Z`), latitude, longitude);
    return {
      date,
      sunrise: times.sunrise.toISOString(),
      sunset: times.sunset.toISOString(),
    };
  });
}

function isDaylight(hourStart: Date, sun: SunTimes[]): boolean {
  const midpoint = hourStart.getTime() + HOUR_MS / 2;
  return sun.some(
    (day) =>
      midpoint >= Date.parse(day.sunrise) && midpoint <= Date.parse(day.sunset),
  );
}

interface ScoreContext {
  beach: BeachConfig;
  thresholds: Thresholds;
  tides: TideData;
  sun: SunTimes[];
}

export function scoreHour(hour: HourlyWeather, ctx: ScoreContext): ScoredHour {
  const { beach, thresholds: t, tides, sun } = ctx;
  const start = new Date(hour.time);
  const daylight = isDaylight(start, sun);
  const gated = isThunder(hour.condition);
  const phase = tidePhaseAt(new Date(start.getTime() + HOUR_MS / 2), tides);

  const components = {
    precipitation: precipitationScore(hour.popPercent, hour.condition, t),
    wind: windScore(hour.windKmh, hour.gustKmh, t),
    temperature: temperatureScore(hour.temperatureC, hour.humidexC, t),
    fog: fogScore(hour.condition),
    sky: skyScore(hour.condition),
    tide: tideScore(phase, beach.classification.tide_effect),
  };

  const totalWeight = Object.values(t.weights).reduce((a, b) => a + b, 0);
  let score01 =
    Object.entries(components).reduce(
      (sum, [key, value]) => sum + value * t.weights[key as keyof typeof t.weights],
      0,
    ) / totalWeight;
  // Steady rain must not average away against calm wind and warm air.
  if (components.precipitation <= 0.15) score01 = Math.min(score01, 0.45);
  if (components.fog <= 0.15) score01 = Math.min(score01, 0.5);
  if (gated) score01 = Math.min(score01, 0.15);

  const score = Math.round(score01 * 100);
  let rating: HourRating;
  if (!daylight) rating = "night";
  else if (gated) rating = "poor";
  else if (score >= t.ratings.good_min) rating = "good";
  else if (score >= t.ratings.ok_min) rating = "ok";
  else if (score >= t.ratings.meh_min) rating = "meh";
  else rating = "poor";

  return {
    time: hour.time,
    score,
    rating,
    daylight,
    gated,
    temperatureC: hour.temperatureC,
    humidexC: hour.humidexC,
    condition: hour.condition,
    iconCode: hour.iconCode,
    popPercent: hour.popPercent,
    windKmh: hour.windKmh,
    gustKmh: hour.gustKmh,
    windDirection: hour.windDirection,
    windRelation: windRelationFor(
      hour.windDirection,
      beach.classification.shore_bearing_degrees,
    ),
    tidePhase: phase,
  };
}

function contiguousRuns(
  hours: ScoredHour[],
  predicate: (h: ScoredHour) => boolean,
): ScoredHour[][] {
  const runs: ScoredHour[][] = [];
  let current: ScoredHour[] = [];
  for (const hour of hours) {
    if (predicate(hour)) {
      if (
        current.length > 0 &&
        Date.parse(hour.time) - Date.parse(current[current.length - 1].time) !==
          HOUR_MS
      ) {
        runs.push(current);
        current = [];
      }
      current.push(hour);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

export function findBestWindow(
  hours: ScoredHour[],
  t: Thresholds,
): BestWindow | null {
  const usable = (h: ScoredHour) => h.daylight && !h.gated;

  for (const quality of ["good", "ok"] as const) {
    const minScore = quality === "good" ? t.ratings.good_min : t.ratings.ok_min;
    const runs = contiguousRuns(hours, (h) => usable(h) && h.score >= minScore)
      .filter((run) => run.length >= t.window.min_hours);
    if (runs.length === 0) continue;
    // Every run in this tier is already good enough to go, so the soonest
    // one answers "when should I go". Picking the highest average instead
    // favoured short peaks: the forecast horizon cuts tomorrow's run down
    // to its best first hours, and that two-hour stub outranked a full
    // 93-scoring day, flipping a perfect afternoon to GOOD_LATER.
    const best = runs[0];
    const avgScore = Math.round(
      best.reduce((s, h) => s + h.score, 0) / best.length,
    );
    return {
      start: best[0].time,
      end: new Date(Date.parse(best[best.length - 1].time) + HOUR_MS).toISOString(),
      quality,
      avgScore,
    };
  }
  return null;
}

interface VerdictInput {
  window: BestWindow | null;
  overrides: ManualOverride[];
  warnings: EcccWarning[];
  generatedAt: Date;
}

export function verdictFor(input: VerdictInput): Verdict {
  const { window, overrides, warnings, generatedAt } = input;
  if (overrides.some((o) => o.type === "closure")) return "CLOSED";
  if (warnings.some((w) => w.colour === "red")) return "HAZARDOUS";
  if (overrides.some((o) => o.type === "water-advisory")) return "WATER_ADVISORY";
  if (!window) return "NOT_GREAT";
  if (window.quality === "ok") return "MIXED";
  const startsSoon =
    Date.parse(window.start) <= generatedAt.getTime() + 1.5 * HOUR_MS;
  return startsSoon ? "GO_NOW" : "GOOD_LATER";
}
