import { Link } from "react-router-dom";
import { formatTime, formatUpdatedAgo, formatWindow } from "@/utils/format";
import HourStrip from "@/features/beaches/components/hour-strip";
import ReasonIcon from "@/features/beaches/components/reason-icon";
import VerdictBadge from "@/features/beaches/components/verdict-badge";

function Star({ filled }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.8 9.9 5.7l4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z" />
    </svg>
  );
}

function airTemperature(hours, bestWindow) {
  const scope = bestWindow
    ? hours.filter(
        (hour) =>
          Date.parse(hour.time) >= Date.parse(bestWindow.start) &&
          Date.parse(hour.time) < Date.parse(bestWindow.end),
      )
    : hours.filter((hour) => hour.daylight);
  const values = scope
    .map((hour) => hour.temperatureC)
    .filter((value) => value !== null);
  if (values.length === 0) return null;

  const low = Math.round(Math.min(...values));
  const high = Math.round(Math.max(...values));
  return {
    label: low === high ? `${high}°C` : `${low}–${high}°C`,
    title: bestWindow
      ? "Forecast air temperature during the recommended window"
      : "Forecast air temperature during daylight hours",
  };
}

function BeachCard({
  beach,
  hourly,
  generatedAt,
  stale,
  now = new Date(),
  favourite = false,
  onToggleFavourite,
  distanceKm = null,
  selectedDate,
}) {
  const waterAdvisory = beach.advisories?.find(
    (entry) => entry.type === "water-advisory" && entry.status === "active",
  );
  const safetyVerdict = ["WATER_ADVISORY", "HAZARDOUS", "CLOSED"].includes(
    beach.verdict,
  );
  const windowLabel =
    stale || safetyVerdict ? null : formatWindow(beach.bestWindow, generatedAt);
  const headline = waterAdvisory
    ? "Avoid swimming"
    : stale
      ? "—"
      : beach.verdict === "CLOSED"
        ? "Beach closed"
        : beach.verdict === "HAZARDOUS"
          ? "Hazardous conditions"
          : (windowLabel ?? "No good window");
  const nextTide = (beach.tideEvents ?? []).find(
    (event) => Date.parse(event.time) > now.getTime(),
  );
  const temperature = airTemperature(hourly ?? [], beach.bestWindow);
  const reasons = beach.reasons.filter((reason) => reason.kind !== "temperature");

  return (
    <Link
      to={`/beach/${beach.id}?date=${encodeURIComponent(selectedDate)}`}
      style={{ viewTransitionName: `beach-${beach.id}` }}
      className="card relative block no-underline text-noct-text p-4 md:p-5 grid md:grid-cols-[250px_1fr] gap-3 md:gap-7 items-start"
    >
      {onToggleFavourite && (
        <button
          type="button"
          aria-pressed={favourite}
          aria-label={
            favourite
              ? `Remove ${beach.name} from favourites`
              : `Add ${beach.name} to favourites`
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavourite(beach.id);
          }}
          className={`absolute top-3 right-3 p-1.5 rounded-md ${
            favourite
              ? "text-accent-400"
              : "text-neutral-600 hover:text-neutral-300"
          }`}
        >
          <Star filled={favourite} />
        </button>
      )}
      <div className="flex flex-col gap-1.5 items-start">
        <VerdictBadge
          verdict={beach.verdict}
          stale={stale && !waterAdvisory}
        />
        <h2 className="font-display font-medium text-xl mt-1.5 mb-0">
          {beach.name}
        </h2>
        <p className="text-xs text-neutral-500 m-0">{beach.municipality}</p>
        <p
          className={`font-display font-medium text-[26px] tracking-[0.01em] mt-2 mb-0 ${
            waterAdvisory || windowLabel ? "text-accent-300" : "text-neutral-600"
          }`}
        >
          {headline}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {waterAdvisory ? (
            <span className="inline-flex items-start gap-1.5 text-[12px] leading-relaxed text-neutral-300 max-w-[620px]">
              <i
                className="ph ph-warning text-accent-400 text-[15px] mt-px"
                aria-hidden="true"
              />
              {waterAdvisory.message}
            </span>
          ) : (
            <>
              {reasons.map((reason) => (
                <span
                  key={reason.text}
                  title={reason.text}
                  className="inline-flex items-center gap-1.5 text-[12px] text-neutral-300"
                >
                  <span className="text-accent-400">
                    <ReasonIcon kind={reason.kind} />
                  </span>
                  {reason.short}
                </span>
              ))}
              {temperature && (
                <span
                  title={temperature.title}
                  className="inline-flex items-center gap-1.5 text-[12px] text-neutral-300"
                >
                  <span className="text-accent-400">
                    <ReasonIcon kind="temperature" />
                  </span>
                  {temperature.label}
                </span>
              )}
            </>
          )}
        </div>
        {hourly && <HourStrip hours={hourly} compact />}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.06em] text-neutral-500">
          {beach.precisionHours === 3 && <span>Planning forecast</span>}
          {waterAdvisory && (
            <span>
              Advisory checked {formatUpdatedAgo(waterAdvisory.checked_at, now)}
            </span>
          )}
          <span>
            {nextTide
              ? `${nextTide.type === "high" ? "High" : "Low"} tide ${formatTime(nextTide.time)}`
              : "No tide data"}
          </span>
          {beach.water?.sourceKind === "observed-buoy" && (
            <span>Water ~{Math.round(beach.water.valueC)}°C</span>
          )}
          {distanceKm !== null && (
            <span className="ml-auto">~{Math.round(distanceKm)} km away</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default BeachCard;
