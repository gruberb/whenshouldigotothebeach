import React from "react";
import {
  formatDayLabel,
  formatTime,
  localHourOf,
} from "../../lib/format";

const WIDTH = 640;
const HEIGHT = 192;
const PAD_X = 38;
const PAD_TOP = 28;
const PAD_BOTTOM = 46;
const BOT = HEIGHT - PAD_BOTTOM;
const HOUR = 3600_000;

// Predicted tide curve with a real time axis: hour ticks every six hours,
// day labels, and heights on each high/low. bestTide marks the events that
// suit this beach (square markers) so the preference reads at a glance.
function TideCurve({ tides, now = new Date(), bestTide = null }) {
  if (tides.sourceKind !== "predicted" || tides.samples.length < 2) {
    return (
      <p className="text-sm text-neutral-500">
        No tide prediction available for this station right now.
      </p>
    );
  }

  const samples = tides.samples;
  const t0 = Date.parse(samples[0].time);
  const t1 = Date.parse(samples[samples.length - 1].time);
  const heights = samples.map((s) => s.heightM);
  const hMin = Math.min(...heights);
  const hMax = Math.max(...heights);
  const span = Math.max(0.5, hMax - hMin);

  const x = (time) =>
    PAD_X +
    (((typeof time === "number" ? time : Date.parse(time)) - t0) / (t1 - t0)) *
      (WIDTH - 2 * PAD_X);
  const y = (height) =>
    PAD_TOP + (1 - (height - hMin) / span) * (BOT - PAD_TOP);

  const path = samples
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"}${x(s.time).toFixed(1)},${y(s.heightM).toFixed(1)}`,
    )
    .join(" ");

  const ticks = [];
  const midnights = [];
  for (let t = Math.ceil(t0 / HOUR) * HOUR; t <= t1; t += HOUR) {
    const h = localHourOf(t);
    if (h % 6 === 0) ticks.push({ t, h });
    if (h === 0) midnights.push(t);
  }
  const dayBounds = [t0, ...midnights, t1];
  const days = [];
  for (let i = 0; i < dayBounds.length - 1; i++) {
    if (x(dayBounds[i + 1]) - x(dayBounds[i]) > 64) {
      days.push({
        cx: (x(dayBounds[i]) + x(dayBounds[i + 1])) / 2,
        label: formatDayLabel(
          dayBounds[i] + (dayBounds[i + 1] - dayBounds[i]) / 2,
        ),
      });
    }
  }

  const events = tides.events.filter(
    (e) => Date.parse(e.time) >= t0 && Date.parse(e.time) <= t1,
  );
  const nowX =
    now.getTime() >= t0 && now.getTime() <= t1 ? x(now.getTime()) : null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full block min-w-[560px]"
      role="img"
      aria-label={`Predicted tide heights at ${tides.stationName} with hour and day axis`}
    >
      {[hMin, (hMin + hMax) / 2, hMax].map((h) => (
        <g key={h}>
          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y(h)}
            y2={y(h)}
            stroke="#e9e9ed"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          <text
            x={PAD_X - 6}
            y={y(h) + 3}
            textAnchor="end"
            fontSize="9"
            fill="#9397ab"
          >
            {h.toFixed(1)} m
          </text>
        </g>
      ))}

      {ticks.map(({ t, h }) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={BOT}
            y2={BOT + 4}
            stroke="#595d6c"
            strokeWidth="1"
          />
          <text
            x={x(t)}
            y={BOT + 15}
            textAnchor="middle"
            fontSize="8.5"
            fill="#75798c"
          >
            {String(h).padStart(2, "0")}:00
          </text>
        </g>
      ))}

      {days.map((d) => (
        <text
          key={d.label}
          x={d.cx}
          y={BOT + 32}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.12em"
          fill="#9397ab"
        >
          {d.label}
        </text>
      ))}

      <line
        x1={PAD_X}
        x2={WIDTH - PAD_X}
        y1={BOT}
        y2={BOT}
        stroke="#3f424d"
        strokeWidth="1"
      />

      <path d={path} fill="none" stroke="#968ae0" strokeWidth="2" />

      {nowX !== null && (
        <g>
          <line
            x1={nowX}
            x2={nowX}
            y1={PAD_TOP - 12}
            y2={BOT}
            stroke="#9397ab"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <text
            x={Math.min(nowX + 5, WIDTH - PAD_X - 64)}
            y={PAD_TOP - 15}
            fontSize="9"
            fontWeight="600"
            fill="#cfd3e5"
          >
            NOW {formatTime(now.toISOString())}
          </text>
        </g>
      )}

      {events.map((event) => {
        const ex = x(event.time);
        const ey = y(event.heightM);
        const labelX = Math.max(
          PAD_X + 38,
          Math.min(ex, WIDTH - PAD_X - 38),
        );
        // Lows near the chart floor flip their label above the dot so it
        // never collides with the hour-tick row.
        const below = ey + 17;
        const labelY =
          event.type === "high" ? ey - 10 : below > BOT - 6 ? ey - 10 : below;
        const isBest = bestTide !== null && event.type === bestTide;
        const markerTitle = `${event.type === "high" ? "High" : "Low"} tide ${formatTime(event.time)} · ${event.heightM.toFixed(1)} m${isBest ? " · usually the best tide here" : ""}`;
        return (
          <g key={event.time}>
            {isBest ? (
              <rect
                x={ex - 4}
                y={ey - 4}
                width="8"
                height="8"
                fill="#b5abfc"
                stroke="#161826"
                strokeWidth="1.5"
              >
                <title>{markerTitle}</title>
              </rect>
            ) : (
              <circle
                cx={ex}
                cy={ey}
                r="4"
                fill="#232532"
                stroke="#d2cefd"
                strokeWidth="1.5"
              >
                <title>{markerTitle}</title>
              </circle>
            )}
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill="#cfd3e5"
            >
              {event.type === "high" ? "HIGH" : "LOW"} {formatTime(event.time)}{" "}
              · {event.heightM.toFixed(1)} m
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default TideCurve;
