import React from "react";
import { Link, useParams } from "react-router-dom";
import HourStrip from "../components/beach/HourStrip";
import TideCurve from "../components/beach/TideCurve";
import Layout from "../components/common/Layout";
import Loading from "../components/common/Loading";
import StaleBanner from "../components/common/StaleBanner";
import { useBeachDetail } from "../hooks/useBeachData";
import { useNow } from "../hooks/useNow";
import {
  formatTime,
  formatUpdatedAgo,
  formatWindow,
  isStale,
  STALE_META,
  surfaceLabel,
  TIDE_EFFECT_META,
  VERDICT_META,
} from "../lib/format";

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
  const { data, error, loading } = useBeachDetail(beachId);
  const now = useNow();

  const backLink = (
    <Link
      to="/"
      className="text-[13px] text-accent-300 hover:text-accent-200 no-underline"
    >
      ← All beaches
    </Link>
  );

  if (loading) {
    return (
      <Layout right={backLink}>
        <Loading />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout right={backLink}>
        <div className="card p-4">
          <span className="tag tag-outline mb-2">Error</span>
          <p className="text-sm text-neutral-300">
            Could not load this beach: {error}
          </p>
          <Link to="/" className="text-sm text-accent-300 block mt-2">
            Back to all beaches
          </Link>
        </div>
      </Layout>
    );
  }

  const stale = isStale(data.validUntil, now);
  const meta = stale ? STALE_META : VERDICT_META[data.summary.verdict];
  const windowLabel = formatWindow(data.summary.bestWindow, data.generatedAt);
  const currentHour =
    data.hourly.find((h) => Date.parse(h.time) >= now.getTime() - 3600_000) ??
    data.hourly[0];
  const nextTide = data.tides.events.find(
    (e) => Date.parse(e.time) > now.getTime(),
  );
  const amenities = data.beach.amenities ?? {};
  const amenityTags = [
    amenities.washrooms === true ? "Washrooms" : null,
    amenities.food === true ? "Food nearby" : null,
  ].filter(Boolean);
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

  return (
    <Layout right={backLink}>
      {stale && <StaleBanner generatedAt={data.generatedAt} />}

      {data.warnings.map((warning) => (
        <Notice
          key={warning.description}
          kind={warning.type === "warning" ? "Warning" : "Watch"}
          url={warning.url}
        >
          {warning.description}
        </Notice>
      ))}

      {data.advisories.map((advisory) => (
        <Notice key={advisory.title} kind="Advisory">
          {advisory.title} — {advisory.message}{" "}
          <span className="text-neutral-500">({advisory.source})</span>
        </Notice>
      ))}

      <header className="mb-9">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent mb-2.5 m-0">
          {meta.label} · {data.beach.municipality}
        </p>
        <h1 className="font-display font-medium text-3xl md:text-[38px] leading-tight m-0 mb-1.5">
          {data.beach.name}
        </h1>
        <p
          className={`font-display font-medium text-5xl md:text-[56px] leading-none tracking-[0.01em] my-3 ${
            !stale && windowLabel ? "text-accent-300" : "text-neutral-600"
          }`}
        >
          {stale ? "—" : (windowLabel ?? "No good window")}
        </p>
        <ul className="text-[15px] text-neutral-400 mb-5 p-0 list-none grid gap-1">
          {data.summary.reasons.map((reason) => (
            <li key={reason.text}>· {reason.text}</li>
          ))}
        </ul>
        <div className="flex gap-2.5 items-center flex-wrap">
          <a
            className="btn btn-primary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${data.beach.latitude},${data.beach.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Directions →
          </a>
          <span className="tag tag-neutral">
            {surfaceLabel(data.beach.surface)}
          </span>
          <span className="tag tag-neutral">{tideMeta.label}</span>
          {amenityTags.map((tag) => (
            <span key={tag} className="tag tag-neutral">
              {tag}
            </span>
          ))}
        </div>
        {amenities.note && (
          <p className="text-[13px] text-neutral-500 mt-3 m-0 max-w-[560px]">
            {amenities.note}
          </p>
        )}
        {data.nearbyFood?.length > 0 && (
          <p className="text-[13px] text-neutral-500 mt-1.5 m-0 max-w-[560px]">
            Food nearby:{" "}
            {data.nearbyFood
              .map((f) => `${f.name} (${f.kind}, ${f.distanceKm} km)`)
              .join(" · ")}
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-7">
        <ConditionTile
          label="Air"
          value={
            currentHour?.temperatureC !== null && currentHour !== undefined
              ? `${Math.round(currentHour.temperatureC)}°C`
              : "–"
          }
          detail={currentHour?.condition}
        />
        <ConditionTile
          label="Water"
          value={
            data.water.sourceKind === "observed-buoy"
              ? `~${Math.round(data.water.valueC)}°C`
              : "–"
          }
          detail={
            data.water.sourceKind === "observed-buoy"
              ? `Buoy ${data.water.distanceKm} km away · ${formatUpdatedAgo(data.water.observedAt, now)}`
              : "No measurement nearby"
          }
        />
        <ConditionTile
          label="Wind"
          value={
            currentHour?.windKmh !== null && currentHour !== undefined
              ? `${currentHour.windDirection ?? ""} ${Math.round(currentHour.windKmh)} km/h`.trim()
              : "–"
          }
          detail={currentHour?.windRelation ?? undefined}
        />
        <ConditionTile
          label="Next tide"
          value={
            nextTide
              ? `${nextTide.type === "high" ? "High" : "Low"} ${formatTime(nextTide.time)}`
              : "–"
          }
          detail={
            nextTide ? `${nextTide.heightM.toFixed(1)} m predicted` : undefined
          }
        />
        <ConditionTile
          label="Confidence"
          value={
            data.summary.confidence.charAt(0).toUpperCase() +
            data.summary.confidence.slice(1)
          }
          detail={`Weather ${data.weatherSource.distanceKm} km away`}
        />
      </div>

      <section className="mb-7">
        <h3 className="font-display font-medium text-[15px] m-0 mb-3">
          Next 24 hours
        </h3>
        <HourStrip hours={data.hourly} />
      </section>

      <section className="mb-7">
        <h3 className="font-display font-medium text-[15px] m-0 mb-2.5">
          Tide · {data.tides.stationName} station
        </h3>
        <div className="overflow-x-auto">
          <TideCurve tides={data.tides} now={now} bestTide={tideMeta.bestTide} />
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
            Outlook
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
            Weather: Environment and Climate Change Canada forecast for{" "}
            {data.weatherSource.siteName} ({data.weatherSource.distanceKm} km
            away), issued {formatTime(data.weatherSource.issuedAt)}.
          </p>
          <p className="m-0">
            Tides: Canadian Hydrographic Service prediction, station{" "}
            {data.tides.stationName} ({data.tides.stationCode}),{" "}
            {data.tides.distanceKm} km away. Astronomical prediction, not a
            live observation.
          </p>
          <p className="m-0">
            {data.water.sourceKind === "observed-buoy"
              ? `Water temperature: observed at the ${data.water.stationName} buoy (ECCC), ${data.water.distanceKm} km from the beach — a regional reading, not measured at this beach.`
              : "Water temperature: no buoy close enough to this beach for a meaningful reading."}
          </p>
          <p className="m-0">
            Nearby food: OpenStreetMap contributors, straight-line distances
            from the beach coordinates.
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
