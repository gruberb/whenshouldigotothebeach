import { useEffect, useState } from "react";
import { formatSelectedDay } from "@/utils/format";

function chipLabel(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return formatSelectedDay(date, "short");
}

function dayLabels(date, index) {
  const formatted = formatSelectedDay(date, "short");
  const [weekday, calendarDate] = formatted.split(", ");
  const relative = index === 0 ? "Today" : index === 1 ? "Tomorrow" : null;
  return {
    button: relative ? `${relative} · ${formatted}` : formatted,
    option: relative ?? weekday,
    meta: relative ? formatted : calendarDate,
  };
}

function DayPicker({ dates, selectedDate, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, dates.indexOf(selectedDate));
  const selected = dayLabels(dates[selectedIndex], selectedIndex);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600 m-0 mb-2">
        Plan for
      </p>
      <div className="relative inline-block max-w-full md:hidden">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Beach day"
          onClick={() => setOpen(!open)}
          className="inline-flex max-w-full items-center gap-2 bg-transparent border border-neutral-800 rounded-lg px-3 py-1.5 cursor-pointer text-xs uppercase tracking-[0.1em] text-neutral-300 hover:border-neutral-600 hover:bg-white/[0.04] transition-colors"
        >
          <i className="ph ph-calendar-blank text-sm text-accent-300" aria-hidden />
          <span className="truncate">{selected.button}</span>
          <i
            aria-hidden
            className={`ph ph-caret-down text-xs text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default bg-transparent border-0"
            />
            <div
              role="listbox"
              aria-label="Beach day"
              className="card absolute left-0 top-[calc(100%+6px)] z-20 shadow-noct-lg p-1.5 min-w-[240px] max-w-[calc(100vw-2rem)] flex flex-col"
            >
              {dates.map((date, index) => {
                const labels = dayLabels(date, index);
                return (
                  <button
                    key={date}
                    type="button"
                    role="option"
                    aria-selected={date === selectedDate}
                    onClick={() => {
                      onChange(date);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 border-0 rounded-md px-2.5 py-2 cursor-pointer text-[13px] text-noct-text text-left hover:bg-white/[0.06] ${
                      date === selectedDate ? "bg-accent/10" : "bg-transparent"
                    }`}
                  >
                    <i
                      aria-hidden
                      className={`ph ph-check text-[13px] text-accent-300 ${date === selectedDate ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="flex-1">{labels.option}</span>
                    <span className="text-[11px] text-neutral-500">
                      {labels.meta}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div
        className="hidden md:flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        role="group"
        aria-label="Choose beach day"
      >
        {dates.map((date, index) => {
          const selected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={`Show forecast for ${formatSelectedDay(date)}`}
              onClick={() => onChange(date)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-[12px] cursor-pointer transition-colors ${
                selected
                  ? "border-accent bg-accent/[0.14] text-accent-200"
                  : "border-neutral-800 bg-noct-surface text-neutral-400 hover:border-accent-600 hover:text-neutral-300"
              }`}
            >
              {chipLabel(date, index)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DayPicker;
