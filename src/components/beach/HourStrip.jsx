import React from "react";
import {
  formatHourLabel,
  formatTime,
  NIGHT_FILL,
  scoreColor,
} from "../../lib/format";

function hourTitle(hour) {
  const parts = [
    `${formatTime(hour.time)} — ${hour.score}/100`,
    hour.condition,
  ];
  if (hour.temperatureC !== null) parts.push(`${Math.round(hour.temperatureC)}°C`);
  if (hour.windKmh !== null) {
    parts.push(
      `wind ${hour.windDirection ?? ""} ${Math.round(hour.windKmh)} km/h`.trim(),
    );
  }
  if (hour.popPercent > 0) parts.push(`${hour.popPercent}% precip`);
  if (hour.gated) parts.push("thunderstorm risk");
  if (!hour.daylight) parts.push("dark out");
  return parts.join(" · ");
}

// Bar height and accent brightness both encode the hourly score, so the strip
// stays readable without color vision. Night hours render as low neutral
// blocks and thunder-gated hours get a pale top marker.
function HourStrip({ hours, compact = false }) {
  const barMax = compact ? 40 : 60;
  const labelEvery = compact ? 6 : 3;

  return (
    <div>
      <div
        className="flex items-end gap-[2px] border-b border-b-[var(--color-divider)] pb-[2px]"
        style={{ height: barMax + 8 }}
      >
        {hours.map((hour) => {
          const height = hour.daylight
            ? Math.max(6, Math.round((hour.score / 100) * barMax))
            : 6;
          return (
            <div
              key={hour.time}
              className="flex-1 relative rounded-t-sm"
              style={{
                height,
                background: hour.daylight ? scoreColor(hour.score) : NIGHT_FILL,
                borderTop: hour.gated ? "2px solid #f5f4ff" : "none",
              }}
              title={hourTitle(hour)}
            />
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {hours.map((hour, i) => (
          <div
            key={hour.time}
            className="flex-1 text-center text-[10px] text-neutral-600"
          >
            {i % labelEvery === 0 ? formatHourLabel(hour.time) : ""}
          </div>
        ))}
      </div>
      {!compact && (
        <p className="text-[11px] text-neutral-600 mt-2 tracking-[0.04em]">
          Brighter = better · low grey = dark out · pale top mark = thunder
          risk · Atlantic time
        </p>
      )}
    </div>
  );
}

export default HourStrip;
