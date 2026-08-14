import type {
  Confidence,
  ManualOverride,
  ScoredHour,
  TideData,
} from "./types.js";

const HOUR_MS = 3600_000;

export function localDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

export function availableForecastDates(
  hours: { time: string }[],
  timezone: string,
  now: Date,
  limit = 7,
): string[] {
  const today = localDate(now.toISOString(), timezone);
  return [
    ...new Set(
      hours
        .map((hour) => localDate(hour.time, timezone))
        .filter((date) => date >= today),
    ),
  ].slice(0, limit);
}

export function hoursForDate<T extends { time: string }>(
  hours: T[],
  date: string,
  timezone: string,
): T[] {
  return hours.filter((hour) => localDate(hour.time, timezone) === date);
}

export function scoreableHoursForDate(
  hours: ScoredHour[],
  date: string,
  timezone: string,
  now: Date,
): ScoredHour[] {
  const day = hoursForDate(hours, date, timezone);
  const today = localDate(now.toISOString(), timezone);
  return date === today
    ? day.filter((hour) => Date.parse(hour.time) >= now.getTime() - HOUR_MS)
    : day;
}

export function overridesForDate(
  overrides: ManualOverride[],
  dayHours: { time: string }[],
): ManualOverride[] {
  if (dayHours.length === 0) return [];
  const start = Date.parse(dayHours[0].time);
  const end = Date.parse(dayHours[dayHours.length - 1].time) + HOUR_MS;
  return overrides.filter(
    (entry) => Date.parse(entry.starts_at) < end && Date.parse(entry.expires_at) >= start,
  );
}

export function precisionHoursForDay(dayOffset: number): 1 | 3 {
  return dayOffset <= 2 ? 1 : 3;
}

export function sampleForecastHours<T>(hours: T[], precisionHours: 1 | 3): T[] {
  return precisionHours === 1
    ? hours
    : hours.filter((_, index) => index % precisionHours === 0);
}

export function confidenceForDay(
  dayOffset: number,
  weatherDistanceKm: number,
  tideDistanceKm: number,
  tides: TideData,
): Confidence {
  if (
    dayOffset >= 4 ||
    weatherDistanceKm > 35 ||
    tides.sourceKind === "unavailable"
  ) {
    return "low";
  }
  if (dayOffset <= 1 && weatherDistanceKm <= 12 && tideDistanceKm <= 12) {
    return "high";
  }
  return "medium";
}
