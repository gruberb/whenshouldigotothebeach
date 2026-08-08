import type {
  BeachConfig,
  BestWindow,
  EcccWarning,
  ScoredHour,
  TideData,
} from "./types.js";

function localTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

function localDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function weekday(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    timeZone: timezone,
  })
    .format(new Date(iso))
    .toUpperCase();
}

function windowHours(hours: ScoredHour[], window: BestWindow): ScoredHour[] {
  return hours.filter(
    (h) =>
      Date.parse(h.time) >= Date.parse(window.start) &&
      Date.parse(h.time) < Date.parse(window.end),
  );
}

function isRainy(h: ScoredHour): boolean {
  return (
    h.popPercent > 60 ||
    (/rain|showers|drizzle/i.test(h.condition) && !/chance|risk/i.test(h.condition))
  );
}

// Two to three plain-language reasons. Anything that argues against going
// (thunder, rain, fog, wind, cold) is listed before comfort positives so a
// poor verdict is never explained with only pleasant facts, and clock times
// that fall on another local day carry a weekday marker.
export function buildReasons(
  beach: BeachConfig,
  hours: ScoredHour[],
  window: BestWindow | null,
  tides: TideData,
  warnings: EcccWarning[],
  generatedAt: Date,
): string[] {
  const timezone = beach.location.timezone;
  const daylight = hours.filter((h) => h.daylight);
  if (daylight.length === 0) return ["No daylight hours in the forecast range"];
  const scope = window ? windowHours(hours, window) : daylight;
  const referenceDate = localDate(generatedAt.toISOString(), timezone);
  const timeLabel = (iso: string) =>
    localDate(iso, timezone) === referenceDate
      ? localTime(iso, timezone)
      : `${weekday(iso, timezone)} ${localTime(iso, timezone)}`;

  const negatives: string[] = [];
  const positives: string[] = [];

  const thunderHours = daylight.filter((h) => h.gated);
  if (thunderHours.length > 0) {
    negatives.push(`Thunderstorm risk around ${timeLabel(thunderHours[0].time)}`);
  }

  const dayMaxPop = Math.max(...daylight.map((h) => h.popPercent));
  const rainyDay = daylight.filter(isRainy);
  const windowEnd = window ? Date.parse(window.end) : null;
  const rainyAfterWindow =
    windowEnd !== null
      ? rainyDay.find((h) => Date.parse(h.time) >= windowEnd)
      : undefined;
  if (dayMaxPop <= 30 && thunderHours.length === 0 && rainyDay.length === 0) {
    positives.push("Little to no rain expected");
  } else if (window && rainyDay.every((h) => Date.parse(h.time) >= (windowEnd ?? 0))) {
    if (rainyAfterWindow) {
      negatives.push(
        `Dry during the window, showers around ${timeLabel(rainyAfterWindow.time)}`,
      );
    }
  } else if (rainyDay.length > 0) {
    negatives.push(`Showers possible around ${timeLabel(rainyDay[0].time)}`);
  } else if (dayMaxPop > 60) {
    negatives.push("Rain likely for most of the day");
  }

  const foggy = daylight.filter((h) => /fog|mist/i.test(h.condition));
  if (foggy.length >= Math.max(2, daylight.length / 3)) {
    negatives.push("Fog for much of the day");
  } else if (foggy.length > 0) {
    negatives.push(`Fog around ${timeLabel(foggy[0].time)}`);
  }

  const avgWind =
    scope.reduce(
      (sum, h) => sum + Math.max(h.windKmh ?? 0, (h.gustKmh ?? 0) * 0.75),
      0,
    ) / scope.length;
  const commonDirection = scope.find((h) => h.windDirection)?.windDirection;
  const windLabel = commonDirection
    ? ` (${commonDirection} ~${Math.round(avgWind)} km/h)`
    : "";
  if (avgWind > 28) {
    negatives.push(`Windy${windLabel}`);
  } else if (avgWind > 15) {
    positives.push(`Breezy${windLabel}`);
  } else {
    positives.push("Light wind");
  }
  const offshore = scope.filter((h) => h.windRelation === "offshore").length;
  if (offshore > scope.length / 2) {
    negatives.push("Offshore wind: keep inflatables off the water");
  }

  const temps = scope
    .map((h) => h.temperatureC)
    .filter((t): t is number => t !== null);
  if (temps.length > 0) {
    const peak = Math.max(...temps);
    if (peak < 14) {
      negatives.push(`Cold for the beach, around ${Math.round(peak)}°C`);
    } else if (peak >= 25) {
      positives.push(`Warm, around ${Math.round(peak)}°C`);
    } else if (peak >= 18) {
      positives.push(`Pleasant, around ${Math.round(peak)}°C`);
    } else {
      positives.push(`Cool, around ${Math.round(peak)}°C`);
    }
  }

  for (const warning of warnings) {
    if (/heat/i.test(warning.description)) {
      negatives.push("Heat warning in effect: bring shade and water");
      break;
    }
  }

  if (tides.sourceKind === "predicted" && window) {
    const effect = beach.classification.tide_effect;
    const lowInWindow = tides.events.find(
      (e) =>
        e.type === "low" &&
        Date.parse(e.time) >= Date.parse(window.start) - 3600_000 &&
        Date.parse(e.time) <= Date.parse(window.end) + 3600_000,
    );
    if (effect === "more-sand-at-low" && lowInWindow) {
      positives.push(
        `Low tide ${timeLabel(lowInWindow.time)} exposes more sand`,
      );
    } else if (effect === "warmer-incoming-after-low" && lowInWindow) {
      positives.push(
        `Incoming tide after the ${timeLabel(lowInWindow.time)} low crosses sun-warmed flats`,
      );
    }
  }

  return [...negatives, ...positives].slice(0, 3);
}
