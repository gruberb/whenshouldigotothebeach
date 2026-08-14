import { Fragment } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import DayPicker from "@/features/beaches/components/day-picker";
import HourStrip from "@/features/beaches/components/hour-strip";
import TideCurve from "@/features/beaches/components/tide-curve";
import Layout from "@/components/layout";
import Loading from "@/components/loading";
import StaleBanner from "@/features/beaches/components/stale-banner";
import { useBeach } from "@/features/beaches/api/get-beach";
import { useNow } from "@/hooks/use-now";
import { STALE_META, TIDE_EFFECT_META, VERDICT_META, regionLabel } from "@/features/beaches/utils/meta";
import {
  formatSelectedDay,
  formatTime,
  formatUpdatedAgo,
  formatWindow,
  isStale,
  localDateOf,
} from "@/utils/format";

function roundedRange(values, suffix) {
  if (values.length === 0) return "–";
  const low = Math.round(Math.min(...values));
  const high = Math.round(Math.max(...values));
  return low === high ? `${low}${suffix}` : `${low}–${high}${suffix}`;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function SectionLabel({ children, className = "" }) {
  return (
    <p
      className={`text-[11px] uppercase tracking-[0.1em] text-neutral-500 m-0 mb-2 ${className}`}
    >
      {children}
    </p>
  );
}

function SquareTile({ icon, label, meta, title, href }) {
  const inner = (
    <>
      <i className={`ph ${icon} text-[22px] text-accent-300`} />
      <span className="text-[11.5px] text-neutral-300 leading-tight">
        {label}
      </span>
      {meta && <span className="text-[10.5px] text-neutral-500">{meta}</span>}
    </>
  );
  const cls =
    "card flex flex-col items-center gap-2 text-center px-2.5 py-3.5 no-underline";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`${cls} w-[calc(50%-6px)] sm:w-[172px]`}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className={`${cls} w-[108px]`} title={title}>
      {inner}
    </div>
  );
}

const SURFACE_META = {
  sand: { icon: "ph-grains", label: "Sand" },
  "sand-and-cobble": { icon: "ph-circles-three", label: "Sand & cobble" },
  cobble: { icon: "ph-circles-three", label: "Cobble" },
  rock: { icon: "ph-mountains", label: "Rocky" },
};
const EXPOSURE_META = {
  "open-atlantic": { icon: "ph-waves", label: "Open Atlantic" },
  "sheltered-bay": { icon: "ph-shield-check", label: "Sheltered bay" },
  "semi-exposed": { icon: "ph-waves", label: "Semi-exposed" },
  estuary: { icon: "ph-arrows-merge", label: "Estuary" },
  "tidal-flat": { icon: "ph-arrows-out-line-horizontal", label: "Tidal flat" },
};
const TIDE_TILE_META = {
  "more-sand-at-low": { icon: "ph-arrow-line-down", label: "Best at low tide" },
  "warmer-incoming-after-low": {
    icon: "ph-thermometer-simple",
    label: "Warmer on incoming",
  },
  "reduced-access-at-high": {
    icon: "ph-warning",
    label: "Limited access at high tide",
  },
};
const NEARBY_ICONS = {
  restaurant: "ph-fork-knife",
  store: "ph-storefront",
  cafe: "ph-coffee",
  bakery: "ph-bread",
  takeout: "ph-hamburger",
  deli: "ph-cheese",
};

function profileTiles(beach) {
  const tiles = [];
  const surface =
    SURFACE_META[beach.surface] ?? {
      icon: "ph-grains",
      label: beach.surface.replaceAll("-", " "),
    };
  tiles.push({ ...surface, title: "Beach surface" });
  const exposure =
    EXPOSURE_META[beach.exposure] ?? {
      icon: "ph-waves",
      label: beach.exposure.replaceAll("-", " "),
    };
  tiles.push({ ...exposure, title: "Exposure" });
  const tide = TIDE_TILE_META[beach.tideEffect];
  if (tide) tiles.push({ ...tide, title: "Tide effect" });
  // Phosphor has no surfboard glyph; the board-stance figure is the
  // closest readable stand-in next to the label.
  if (beach.surf)
    tiles.push({
      icon: "ph-person-simple-snowboard",
      label: "Surf spot",
      title: "Surf",
    });
  if (beach.amenities?.washrooms === true)
    tiles.push({ icon: "ph-toilet", label: "Washrooms", title: "Amenities" });
  if (beach.amenities?.food === true)
    tiles.push({
      icon: "ph-fork-knife",
      label: "Food nearby",
      title: "Amenities",
    });
  return tiles;
}

function ConditionTile({ label, value, detail }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.1em] text-accent">
        {label}
      </span>
      <span className="font-display font-medium text-xl">{value}</span>
      {detail && (
        <span className="text-[11.5px] text-neutral-500">{detail}</span>
      )}
    </div>
  );
}

function Notice({ kind, children, url }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="tag tag-outline shrink-0">{kind}</span>
      <p className="text-sm text-neutral-300 m-0">
        {children}{" "}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-accent-300 hover:text-accent-200 underline underline-offset-2"
          >
            Details
          </a>
        )}
      </p>
    </div>
  );
}

function BeachDetail() {
  const { beachId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const { data, error, loading } = useBeach(beachId);
  const now = useNow();
  const navigate = useNavigate();

  // Going back through history keeps the homepage's view, search, and scroll;
  // a plain link to "/" would reset all of it. Direct landings (no in-app
  // history) still fall back to the homepage.
  const backLink = (
    <Link
      to={requestedDate ? `/?date=${encodeURIComponent(requestedDate)}` : "/"}
      onClick={(event) => {
        if (window.history.state?.idx > 0) {
          event.preventDefault();
          navigate(-1);
        }
      }}
      className="text-[13px] text-accent-300 hover:text-accent-200 no-underline"
    >
      ← All beaches
    </Link>
  );

  if (loading) {
    return (
      <Layout right={backLink} homeTo={requestedDate ? `/?date=${requestedDate}` : "/"}>
        <Loading />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout right={backLink} homeTo={requestedDate ? `/?date=${requestedDate}` : "/"}>
        <div className="card p-4">
          <span className="tag tag-outline mb-2">Error</span>
          <p className="text-sm text-neutral-300">
            Could not load this beach: {error}
          </p>
          <Link
            to={requestedDate ? `/?date=${encodeURIComponent(requestedDate)}` : "/"}
            className="text-sm text-accent-300 block mt-2"
          >
            Back to all beaches
          </Link>
        </div>
      </Layout>
    );
  }

  const dates = data.days.map((entry) => entry.date);
  const day =
    data.days.find((entry) => entry.date === requestedDate) ?? data.days[0];
  const selectedDate = day.date;
  const selectDate = (date) => {
    const next = new URLSearchParams(searchParams);
    if (date === dates[0]) next.delete("date");
    else next.set("date", date);
    setSearchParams(next, { replace: true });
  };
  const stale = isStale(data.validUntil, now);
  const meta = stale ? STALE_META : VERDICT_META[day.summary.verdict];
  const windowLabel = formatWindow(day.summary.bestWindow, data.generatedAt);
  const windowHours = day.summary.bestWindow
    ? day.hourly.filter(
        (hour) =>
          Date.parse(hour.time) >= Date.parse(day.summary.bestWindow.start) &&
          Date.parse(hour.time) < Date.parse(day.summary.bestWindow.end),
      )
    : [];
  const daylightHours = day.hourly.filter((hour) => hour.daylight);
  const focusHours = windowHours.length > 0 ? windowHours : daylightHours;
  const temperatures = focusHours
    .map((hour) => hour.temperatureC)
    .filter((value) => value !== null);
  const winds = focusHours
    .map((hour) => hour.windKmh)
    .filter((value) => value !== null);
  const commonWindDirection = mostCommon(
    focusHours.map((hour) => hour.windDirection),
  );
  const commonCondition = mostCommon(focusHours.map((hour) => hour.condition));
  const selectedTideEvents = data.tides.events.filter(
    (event) => localDateOf(event.time) === selectedDate,
  );
  const selectedTides = {
    ...data.tides,
    events: selectedTideEvents,
    samples: data.tides.samples.filter(
      (sample) => localDateOf(sample.time) === selectedDate,
    ),
  };
  const nextTide = selectedTideEvents.find(
    (event) => day.dayOffset > 0 || Date.parse(event.time) > now.getTime(),
  );
  const amenities = data.beach.amenities ?? {};
  const nearby = (data.nearbyFood ?? []).map((place) => ({
    ...place,
    icon: NEARBY_ICONS[place.kind] ?? "ph-fork-knife",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} Nova Scotia`)}`,
  }));
  const officialHost = (() => {
    try {
      return new URL(data.beach.officialPage).hostname.replace(/^www\./, "");
    } catch {
      return "official page";
    }
  })();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${data.beach.name} Nova Scotia official page`,
  )}`;
  const tideMeta =
    TIDE_EFFECT_META[data.beach.tideEffect] ?? TIDE_EFFECT_META.neutral;

  const conditionTiles = [
    {
      label: "Air",
      value: roundedRange(temperatures, "°C"),
      detail: commonCondition,
    },
    {
      label: day.dayOffset === 0 ? "Water" : "Latest water",
      value:
        data.water.sourceKind === "observed-buoy"
          ? `~${Math.round(data.water.valueC)}°C`
          : "–",
      detail:
        data.water.sourceKind === "observed-buoy"
          ? `Buoy ${data.water.distanceKm} km away · ${formatUpdatedAgo(data.water.observedAt, now)}`
          : "No measurement nearby",
    },
    {
      label: "Wind",
      value:
        winds.length > 0
          ? `${commonWindDirection ?? ""} ~${Math.round(
              winds.reduce((sum, value) => sum + value, 0) / winds.length,
            )} km/h`.trim()
          : "–",
      detail: windowHours.length > 0 ? "during the best window" : undefined,
    },
    {
      label: day.dayOffset === 0 ? "Next tide" : "First tide",
      value: nextTide
        ? `${nextTide.type === "high" ? "High" : "Low"} ${formatTime(nextTide.time)}`
        : "–",
      detail: nextTide
        ? `${nextTide.heightM.toFixed(1)} m predicted`
        : undefined,
    },
    {
      label: "Confidence",
      value:
        day.summary.confidence.charAt(0).toUpperCase() +
        day.summary.confidence.slice(1),
      detail:
        day.precisionHours === 3
          ? "Planning forecast · check again closer to the day"
          : `GEM forecast grid ${data.weatherSource.distanceKm} km away`,
    },
  ].filter((tile) => tile.value !== "–");

  // Warnings the reason line already spells out (heat, active thunderstorms)
  // link inline instead of getting their own row; anything else still shows
  // as a notice beneath the title, so no warning is ever hidden.
  const applicableWarnings = day.dayOffset === 0 ? data.warnings : [];
  const heatWarning = applicableWarnings.find((warning) =>
    /heat/i.test(warning.description),
  );
  const thunderWarning = applicableWarnings.find(
    (warning) =>
      /thunder/i.test(warning.description) &&
      !/ended/i.test(warning.description),
  );
  const inlineWarnings = new Set(
    day.summary.reasons
      .map((reason) =>
        reason.kind === "heat"
          ? heatWarning
          : reason.kind === "thunder"
            ? thunderWarning
            : null,
      )
      .filter(Boolean),
  );
  // Ended bulletins are all-clear notices, not active safety information.
  const noticeWarnings = applicableWarnings.filter(
    (warning) => warning.type !== "ended" && !inlineWarnings.has(warning),
  );

  return (
    <Layout
      right={backLink}
      homeTo={
        selectedDate === dates[0]
          ? "/"
          : `/?date=${encodeURIComponent(selectedDate)}`
      }
      subtitle={`${regionLabel(data.beach.region)} · ${data.beach.municipality}`}
    >
      {stale && <StaleBanner generatedAt={data.generatedAt} />}

      <header className="mb-9">
        {!meta.quiet && (
          <p className="text-[11px] uppercase tracking-[0.14em] text-accent mb-2.5 m-0">
            {meta.label}
          </p>
        )}
        <h1 className="font-display font-medium text-3xl md:text-[38px] leading-tight m-0 mb-1.5">
          {data.beach.name}
        </h1>
        <DayPicker
          dates={dates}
          selectedDate={selectedDate}
          onChange={selectDate}
          compact
        />
        {day.precisionHours === 3 && (
          <p className="text-[11.5px] text-neutral-500 mt-2.5 mb-0 tracking-[0.03em]">
            Planning forecast · shown in three-hour steps as uncertainty
            increases · check again closer to {formatSelectedDay(selectedDate, "long").split(",")[0]}
          </p>
        )}
        <p
          className={`font-display font-medium text-5xl md:text-[56px] leading-none tracking-[0.01em] my-3 ${
            !stale && windowLabel ? "text-accent-300" : "text-neutral-600"
          }`}
        >
          {stale ? "—" : (windowLabel ?? "No good window")}
        </p>
        <p className="text-[15px] text-neutral-400 m-0 mb-4 max-w-[560px]">
          {day.summary.reasons.map((reason, index) => {
            const warningUrl =
              reason.kind === "heat"
                ? heatWarning?.url
                : reason.kind === "thunder"
                  ? thunderWarning?.url
                  : null;
            return (
              <Fragment key={`${reason.kind}-${index}`}>
                {index > 0 && " · "}
                {warningUrl ? (
                  <a
                    href={warningUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2"
                  >
                    {reason.text}
                  </a>
                ) : (
                  reason.text
                )}
              </Fragment>
            );
          })}
        </p>

        {noticeWarnings.map((warning) => (
          <Notice
            key={warning.description}
            kind={warning.type === "warning" ? "Warning" : "Watch"}
            url={warning.url}
          >
            {warning.description}
          </Notice>
        ))}
        {day.advisories.map((advisory) => (
          <Notice key={advisory.title} kind="Advisory">
            {advisory.title} — {advisory.message}{" "}
            <span className="text-neutral-500">({advisory.source})</span>
          </Notice>
        ))}
        <div className="flex gap-2.5 items-center flex-wrap mb-6">
          <a
            className="btn btn-primary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${data.beach.latitude},${data.beach.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Directions →
          </a>
        </div>

        <SectionLabel>The beach</SectionLabel>
        <div className="flex gap-3 flex-wrap">
          {profileTiles(data.beach).map((tile) => (
            <SquareTile key={tile.label} {...tile} />
          ))}
        </div>
        {amenities.note && (
          <p className="text-[12.5px] text-neutral-500 mt-2.5 m-0 max-w-[560px]">
            {amenities.note}
          </p>
        )}

        {nearby.length > 0 && (
          <>
            <SectionLabel className="mt-4">Nearby</SectionLabel>
            <div className="flex gap-3 flex-wrap">
              {nearby.map((place) => (
                <SquareTile
                  key={place.name}
                  icon={place.icon}
                  label={place.name}
                  meta={`${place.kind.charAt(0).toUpperCase() + place.kind.slice(1)} · ${place.distanceKm} km`}
                  href={place.mapsUrl}
                />
              ))}
            </div>
          </>
        )}
      </header>

      <SectionLabel>Conditions</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 mb-7">
        {conditionTiles.map((tile) => (
          <ConditionTile key={tile.label} {...tile} />
        ))}
      </div>

      <section className="mb-7">
        <h3 className="font-display font-medium text-[15px] m-0 mb-3">
          {formatSelectedDay(selectedDate)} {day.precisionHours === 1 ? "hourly" : "3-hour"} forecast
        </h3>
        <HourStrip hours={day.hourly} />
      </section>

      <section className="mb-7">
        <h3 className="font-display font-medium text-[15px] m-0 mb-2.5">
          Tide · {data.tides.stationName} station
        </h3>
        <div className="overflow-x-auto">
          <TideCurve
            tides={selectedTides}
            now={now}
            bestTide={tideMeta.bestTide}
          />
        </div>
        {tideMeta.bestTide && (
          <p className="text-[11px] text-neutral-600 mt-1.5 m-0 tracking-[0.04em]">
            Square markers = usually the best tide at this beach
          </p>
        )}
      </section>

      {data.outlook.length > 0 && (
        <section className="mb-7">
          <h3 className="font-display font-medium text-[15px] m-0 mb-3">
            Official ECCC outlook
          </h3>
          <dl className="grid gap-3 m-0 max-w-[640px]">
            {data.outlook.map((period) => (
              <div key={period.name}>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-accent mb-0.5">
                  {period.name}
                </dt>
                <dd className="text-sm text-neutral-300 m-0">
                  {period.summary}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <details className="mb-7">
        <summary className="font-display font-medium text-[15px] cursor-pointer text-neutral-300">
          Details and sources
        </summary>
        <div className="mt-3 text-[13.5px] text-neutral-400 grid gap-2 max-w-[640px]">
          <p className="m-0">
            Weather scoring: Canadian GEM model data via{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-300 hover:text-accent-200 underline underline-offset-2"
            >
              Open-Meteo
            </a>{" "}
            ({data.weatherSource.distanceKm} km from the selected model grid
            point), retrieved {formatTime(data.weatherSource.fetchedAt)}.
          </p>
          <p className="m-0">
            Warnings and written outlook: Environment and Climate Change Canada
            forecast for {data.officialForecastSource.siteName} ({
              data.officialForecastSource.distanceKm
            } km away), issued {formatTime(data.officialForecastSource.issuedAt)}.
          </p>
          <p className="m-0">
            Tides: Canadian Hydrographic Service prediction, station{" "}
            {data.tides.stationName} ({data.tides.stationCode}),{" "}
            {data.tides.distanceKm} km away. Astronomical prediction, not a
            live observation. Not for navigation.
          </p>
          <p className="m-0">
            {data.water.sourceKind === "observed-buoy"
              ? `Water temperature: observed at the ${data.water.stationName} buoy (ECCC), ${data.water.distanceKm} km from the beach — a regional reading, not measured at this beach.`
              : "Water temperature: no buoy close enough to this beach for a meaningful reading."}
          </p>
          <p className="m-0">
            Nearby food: OpenStreetMap contributors; road distances with
            ferries avoided.
          </p>
          <p className="m-0">
            Beach profile: {data.beach.exposure}, {data.beach.surface}
            {data.beach.tideEffect !== "neutral" &&
              `, tide effect: ${data.beach.tideEffect.replaceAll("-", " ")}`}
            .
          </p>
          <p className="m-0">
            Official page:{" "}
            <a
              href={data.beach.officialPage}
              target="_blank"
              rel="noreferrer"
              className="text-accent-300 hover:text-accent-200 underline underline-offset-2"
            >
              {officialHost}
            </a>{" "}
            — municipal sites move pages often; if the link is stale,{" "}
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-300 hover:text-accent-200 underline underline-offset-2"
            >
              search for it instead
            </a>
            .
          </p>
        </div>
      </details>
    </Layout>
  );
}

export default BeachDetail;
