// All display times are Atlantic regardless of the viewer's timezone.
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

export function formatSelectedDay(date, weekday = "long") {
  return new Intl.DateTimeFormat("en-CA", {
    weekday,
    month: "short",
    day: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(`${date}T12:00:00Z`));
}

// "Today 6:00-12:00", or "Monday 6:00-12:00" once the window is on another
// day. The day is always named: the window itself is the headline, so it has
// to say when without a verdict label backing it up.
export function formatWindow(window, referenceIso) {
  if (!window) return null;
  const range = `${formatTime(window.start)}–${formatTime(window.end)}`;
  if (referenceIso && localDateOf(window.start) !== localDateOf(referenceIso)) {
    const weekday = new Intl.DateTimeFormat("en-CA", {
      weekday: "long",
      timeZone: TIMEZONE,
    }).format(new Date(window.start));
    return `${weekday} ${range}`;
  }
  return `Today ${range}`;
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
