import { useEffect, useState } from "react";
import DayPicker from "@/features/beaches/components/day-picker";

// Homepage header: full-width title, region picker, search + locate +
// List/Map segmented control, filter chips. Replaces Layout's compact nav on
// the homepage only; detail pages keep the small linked title.

const VIEWS = [
  { id: "list", name: "List", icon: "ph-list-bullets" },
  { id: "map", name: "Map", icon: "ph-map-trifold" },
];

function RegionPicker({ regions, region, onRegionChange }) {
  const [open, setOpen] = useState(false);
  const current = regions.find((r) => r.id === region) ?? regions[0];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Region"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 bg-transparent border border-neutral-800 rounded-lg px-3 py-1.5 cursor-pointer text-xs uppercase tracking-[0.1em] text-neutral-300 hover:border-neutral-600 hover:bg-white/[0.04] transition-colors"
      >
        <i className="ph ph-map-pin text-sm text-accent-300" aria-hidden />
        <span>{current.label} · Nova Scotia</span>
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
            aria-label="Region"
            className="card absolute left-0 top-[calc(100%+6px)] z-20 shadow-noct-lg p-1.5 min-w-[240px] flex flex-col"
          >
            {regions.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={r.id === current.id}
                onClick={() => {
                  onRegionChange(r.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 border-0 rounded-md px-2.5 py-2 cursor-pointer text-[13px] text-noct-text text-left hover:bg-white/[0.06] ${
                  r.id === current.id ? "bg-accent/10" : "bg-transparent"
                }`}
              >
                <i
                  aria-hidden
                  className={`ph ph-check text-[13px] text-accent-300 ${r.id === current.id ? "opacity-100" : "opacity-0"}`}
                />
                <span className="flex-1">{r.label}</span>
                <span className="text-[11px] text-neutral-500">{r.count}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HomeHeader({
  regions,
  region,
  onRegionChange,
  dates,
  selectedDate,
  onDateChange,
  query,
  onQueryChange,
  view,
  onViewChange,
  filterOptions,
  activeFilters,
  onToggleFilter,
  locateActive,
  onLocate,
}) {
  return (
    <header className="mb-7">
      <h1 className="font-display font-medium text-[40px] md:text-[52px] leading-[1.05] tracking-[-0.015em] m-0 mb-3.5">
        When should I go to the beach?
      </h1>
      <RegionPicker
        regions={regions}
        region={region}
        onRegionChange={onRegionChange}
      />
      <DayPicker
        dates={dates}
        selectedDate={selectedDate}
        onChange={onDateChange}
      />

      <div className="rule my-6" />

      <div className="flex gap-2.5 items-center mb-3.5">
        <label className="flex-1 min-w-0 flex items-center gap-2.5 bg-noct-surface border border-neutral-800 rounded-lg px-3.5 h-[42px] focus-within:border-accent transition-colors">
          <i
            className="ph ph-magnifying-glass text-base text-neutral-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search beaches…"
            aria-label="Search beaches by name or municipality"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-noct-text h-full placeholder:text-neutral-600"
          />
        </label>
        <button
          type="button"
          aria-pressed={locateActive}
          aria-label={
            locateActive ? "Stop sorting by distance" : "Sort by distance to me"
          }
          title={locateActive ? "Sorting by distance" : "Near me"}
          onClick={onLocate}
          className={`w-[42px] h-[42px] shrink-0 inline-flex items-center justify-center bg-noct-surface border rounded-lg cursor-pointer text-accent-300 hover:border-neutral-600 hover:bg-accent/[0.08] ${
            locateActive ? "border-accent bg-accent/[0.12]" : "border-neutral-800"
          }`}
        >
          <i className="ph ph-crosshair text-lg" aria-hidden />
        </button>
        <div
          className="inline-flex h-[42px] shrink-0 bg-noct-surface border border-neutral-800 rounded-lg p-[3px] gap-0.5"
          role="tablist"
          aria-label="View"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => onViewChange(v.id)}
              className={`inline-flex items-center gap-1.5 px-3 md:px-4 border-0 rounded-md cursor-pointer text-[13px] hover:text-noct-text ${
                view === v.id
                  ? "bg-accent/[0.14] text-accent-200"
                  : "bg-transparent text-neutral-500"
              }`}
            >
              <i className={`ph ${v.icon} text-[15px]`} aria-hidden />
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by category">
        {filterOptions.map((f) => {
          const on = activeFilters.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleFilter(f.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full cursor-pointer text-[12.5px] border transition-colors hover:border-accent-600 ${
                on
                  ? "border-accent bg-accent/[0.12] text-accent-200"
                  : "border-neutral-800 bg-transparent text-neutral-400"
              }`}
            >
              <i className={`ph ${f.icon} text-sm`} aria-hidden />
              {f.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

export default HomeHeader;
