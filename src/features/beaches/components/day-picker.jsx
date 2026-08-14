import { formatSelectedDay } from "@/utils/format";

function chipLabel(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return formatSelectedDay(date, "short");
}

function DayPicker({ dates, selectedDate, onChange, compact = false }) {
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600 m-0 mb-2">
        Plan for
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
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
