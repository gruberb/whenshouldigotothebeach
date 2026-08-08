import React from "react";
import { Link } from "react-router-dom";
import { formatTime, formatWindow } from "../../lib/format";
import HourStrip from "./HourStrip";
import ReasonIcon from "./ReasonIcon";
import VerdictBadge from "./VerdictBadge";

function BeachCard({ beach, hourly, generatedAt, stale, now = new Date() }) {
  const windowLabel = stale ? null : formatWindow(beach.bestWindow, generatedAt);
  const nextTide = (beach.tideEvents ?? []).find(
    (event) => Date.parse(event.time) > now.getTime(),
  );

  return (
    <Link
      to={`/beach/${beach.id}`}
      className="card block no-underline text-noct-text p-4 md:p-5 grid md:grid-cols-[250px_1fr] gap-3 md:gap-7 items-start"
    >
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
          <span>
            {nextTide
              ? `${nextTide.type === "high" ? "High" : "Low"} tide ${formatTime(nextTide.time)}`
              : "No tide data"}
          </span>
          {beach.water?.sourceKind === "observed-buoy" && (
            <span>Water ~{Math.round(beach.water.valueC)}°C</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default BeachCard;
