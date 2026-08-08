const TIMEZONE = "America/Halifax";

export function formatTime(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatHourLabel(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  })
    .format(new Date(iso))
    .replace(/\D/g, "");
}

export function formatWeekday(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatDayLabel(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TIMEZONE,
  })
    .format(new Date(iso))
    .toUpperCase()
    .replace(/[.,]/g, "");
}

export function localHourOf(time) {
  return (
    Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "2-digit",
        hour12: false,
        timeZone: TIMEZONE,
      })
        .format(new Date(time))
        .replace(/\D/g, ""),
    ) % 24
  );
}

export function localDateOf(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

// "6:00-12:00" for today, "SAT 6:00-12:00" once the window is on another day.
export function formatWindow(window, referenceIso) {
  if (!window) return null;
  const range = `${formatTime(window.start)}–${formatTime(window.end)}`;
  if (referenceIso && localDateOf(window.start) !== localDateOf(referenceIso)) {
    return `${formatWeekday(window.start).toUpperCase()} ${range}`;
  }
  return range;
}

export function formatUpdatedAgo(iso, now = new Date()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

export function isStale(validUntil, now = new Date()) {
  return now > new Date(validUntil);
}

// Nocturne is a mono palette: verdicts are ranked by tag treatment and copy,
// not by hue. Outline = attention (best or hazard), tinted = wait, neutral = meh.
export const VERDICT_META = {
  GO_NOW: { label: "Go now", rank: 0, tag: "tag-outline" },
  GOOD_LATER: { label: "Good later", rank: 1, tag: "tag-accent" },
  MIXED: { label: "Mixed", rank: 2, tag: "tag-neutral" },
  NOT_GREAT: { label: "Not great", rank: 3, tag: "tag-neutral" },
  WATER_ADVISORY: { label: "Water advisory", rank: 4, tag: "tag-outline" },
  HAZARDOUS: { label: "Hazardous", rank: 5, tag: "tag-outline" },
  CLOSED: { label: "Closed", rank: 6, tag: "tag-outline" },
};

export const STALE_META = { label: "Data stale", tag: "tag-neutral" };

// Registry tide_effect values, phrased for beachgoers. bestTide drives the
// square markers on the tide curve; null means no tide preference to mark.
export const TIDE_EFFECT_META = {
  "more-sand-at-low": { label: "Best at low tide", bestTide: "low" },
  "warmer-incoming-after-low": {
    label: "Best after low tide",
    bestTide: "low",
  },
  "reduced-access-at-high": {
    label: "Limited access at high tide",
    bestTide: "low",
  },
  neutral: { label: "Any tide", bestTide: null },
  unknown: { label: "Any tide", bestTide: null },
};

export function surfaceLabel(surface) {
  const text = surface.replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function compareBeaches(a, b) {
  const rankA = VERDICT_META[a.verdict]?.rank ?? 9;
  const rankB = VERDICT_META[b.verdict]?.rank ?? 9;
  if (rankA !== rankB) return rankA - rankB;
  return (b.peakScore ?? 0) - (a.peakScore ?? 0);
}

// Sequential accent ramp: brighter = better on the dark ground. Single hue,
// so it survives every CVD type (value carries the signal, not hue).
export function scoreColor(score) {
  if (score >= 85) return "#b5abfc";
  if (score >= 72) return "#968ae0";
  if (score >= 55) return "#796cbf";
  if (score >= 40) return "#5d5294";
  return "#2b2741";
}

export const NIGHT_FILL = "#292b31";
