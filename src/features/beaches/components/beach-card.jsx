import { Link } from "react-router-dom";
import { formatTime, formatWindow } from "@/utils/format";
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
  const windowLabel = stale ? null : formatWindow(beach.bestWindow, generatedAt);
  const nextTide = (beach.tideEvents ?? []).find(
    (event) => Date.parse(event.time) > now.getTime(),
  );

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
        <VerdictBadge verdict={beach.verdict} stale={stale} />
        <h2 className="font-display font-medium text-xl mt-1.5 mb-0">
          {beach.name}
        </h2>
        <p className="text-xs text-neutral-500 m-0">{beach.municipality}</p>
        <p
          className={`font-display font-medium text-[26px] tracking-[0.01em] mt-2 mb-0 ${
            windowLabel ? "text-accent-300" : "text-neutral-600"
          }`}
        >
          {stale ? "—" : (windowLabel ?? "No good window")}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {beach.reasons.map((reason) => (
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
        </div>
        {hourly && <HourStrip hours={hourly} compact />}
        <div className="flex gap-4 text-[11px] uppercase tracking-[0.06em] text-neutral-500">
          {beach.precisionHours === 3 && <span>Planning forecast</span>}
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
