import type {
  BeachConfig,
  BestWindow,
  EcccWarning,
  Reason,
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
): Reason[] {
  const timezone = beach.location.timezone;
  const daylight = hours.filter((h) => h.daylight);
  if (daylight.length === 0) {
    return [
      {
        kind: "none",
        text: "No daylight hours in the forecast range",
        short: "no daylight",
      },
    ];
  }
  const scope = window ? windowHours(hours, window) : daylight;
  const referenceDate = localDate(generatedAt.toISOString(), timezone);
  const timeLabel = (iso: string) =>
    localDate(iso, timezone) === referenceDate
      ? localTime(iso, timezone)
      : `${weekday(iso, timezone)} ${localTime(iso, timezone)}`;

  const negatives: Reason[] = [];
  const positives: Reason[] = [];

  const thunderHours = daylight.filter((h) => h.gated);
  if (thunderHours.length > 0) {
    const label = timeLabel(thunderHours[0].time);
    negatives.push({
      kind: "thunder",
      text: `Thunderstorm risk around ${label}`,
      short: `storms ${label}`,
    });
  }

  const dayMaxPop = Math.max(...daylight.map((h) => h.popPercent));
  const rainyDay = daylight.filter(isRainy);
  const windowEnd = window ? Date.parse(window.end) : null;
  const rainyAfterWindow =
    windowEnd !== null
      ? rainyDay.find((h) => Date.parse(h.time) >= windowEnd)
      : undefined;
  if (dayMaxPop <= 30 && thunderHours.length === 0 && rainyDay.length === 0) {
    positives.push({
      kind: "dry",
      text: "Little to no rain expected",
      short: "dry",
    });
  } else if (window && rainyDay.every((h) => Date.parse(h.time) >= (windowEnd ?? 0))) {
    if (rainyAfterWindow) {
      const label = timeLabel(rainyAfterWindow.time);
      negatives.push({
        kind: "rain",
        text: `Dry during the window, showers around ${label}`,
        short: `showers ${label}`,
      });
    }
  } else if (rainyDay.length > 0) {
    const label = timeLabel(rainyDay[0].time);
    negatives.push({
      kind: "rain",
      text: `Showers possible around ${label}`,
      short: `showers ${label}`,
    });
  } else if (dayMaxPop > 60) {
    negatives.push({
      kind: "rain",
      text: "Rain likely for most of the day",
      short: "rain likely",
    });
  }

  const foggy = daylight.filter((h) => /fog|mist/i.test(h.condition));
  if (foggy.length >= Math.max(2, daylight.length / 3)) {
    negatives.push({
      kind: "fog",
      text: "Fog for much of the day",
      short: "fog",
    });
  } else if (foggy.length > 0) {
    const label = timeLabel(foggy[0].time);
    negatives.push({
      kind: "fog",
      text: `Fog around ${label}`,
      short: `fog ${label}`,
    });
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
  const windShort = commonDirection
    ? `${commonDirection} ${Math.round(avgWind)} km/h`
    : `${Math.round(avgWind)} km/h`;
  if (avgWind > 28) {
    negatives.push({
      kind: "wind",
      text: `Windy${windLabel}`,
      short: windShort,
    });
  } else if (avgWind > 15) {
    positives.push({
      kind: "wind",
      text: `Breezy${windLabel}`,
      short: windShort,
    });
  } else {
    positives.push({ kind: "wind", text: "Light wind", short: "light wind" });
  }
  const offshore = scope.filter((h) => h.windRelation === "offshore").length;
  if (offshore > scope.length / 2) {
    negatives.push({
      kind: "offshore",
      text: "Offshore wind: keep inflatables off the water",
      short: "offshore wind",
    });
  }

  const temps = scope
    .map((h) => h.temperatureC)
    .filter((t): t is number => t !== null);
  if (temps.length > 0) {
    const peak = Math.round(Math.max(...temps));
    if (peak < 14) {
      negatives.push({
        kind: "temperature",
        text: `Cold for the beach, around ${peak}°C`,
        short: `${peak}°C`,
      });
    } else if (peak >= 25) {
      positives.push({
        kind: "temperature",
        text: `Warm, around ${peak}°C`,
        short: `${peak}°C`,
      });
    } else if (peak >= 18) {
      positives.push({
        kind: "temperature",
        text: `Pleasant, around ${peak}°C`,
        short: `${peak}°C`,
      });
    } else {
      positives.push({
        kind: "temperature",
        text: `Cool, around ${peak}°C`,
        short: `${peak}°C`,
      });
    }
  }

  for (const warning of warnings) {
    if (/heat/i.test(warning.description)) {
      negatives.push({
        kind: "heat",
        text: "Heat warning in effect: bring shade and water",
        short: "heat warning",
      });
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
      const label = timeLabel(lowInWindow.time);
      positives.push({
        kind: "tide",
        text: `Low tide ${label} exposes more sand`,
        short: `low ${label}`,
      });
    } else if (effect === "warmer-incoming-after-low" && lowInWindow) {
      const label = timeLabel(lowInWindow.time);
      positives.push({
        kind: "tide",
        text: `Incoming tide after the ${label} low crosses sun-warmed flats`,
        short: `low ${label}`,
      });
    }
  }

  return [...negatives, ...positives].slice(0, 3);
}
