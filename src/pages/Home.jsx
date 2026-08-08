import React, { lazy, Suspense, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import BeachCard from "../components/beach/BeachCard";
import Layout from "../components/common/Layout";
import Loading from "../components/common/Loading";
import StaleBanner from "../components/common/StaleBanner";
import { useBeachIndex } from "../hooks/useBeachData";
import { useFavourites } from "../hooks/useFavourites";
import { useNow } from "../hooks/useNow";
import { useUserLocation } from "../hooks/useUserLocation";
import {
  compareBeaches,
  formatTime,
  haversineKm,
  isStale,
  REGION_META,
  REGION_ORDER,
  regionLabel,
} from "../lib/format";

// Leaflet only loads when someone opens the map view.
const BeachMap = lazy(() => import("../components/beach/BeachMap"));

const REGION_STORAGE = "beach-region";
const REGION_EXPLICIT = "region-explicit";

function storedRegion() {
  const value = localStorage.getItem(REGION_STORAGE);
  return value === "all" || REGION_META[value] ? value : null;
}

function Crosshair({ active }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="8" cy="8" r="1" fill={active ? "currentColor" : "none"} />
      <path d="M8 0.8v2.4M8 12.8v2.4M0.8 8h2.4M12.8 8h2.4" />
    </svg>
  );
}

function SectionHeading({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 m-0 mb-1 mt-3 first:mt-0">
      {children}
    </p>
  );
}

function Home() {
  const { data, error, loading } = useBeachIndex();
  const now = useNow();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { favourites, toggle } = useFavourites();
  const {
    location: userLocation,
    status: locationStatus,
    request: requestLocation,
    clear: clearLocation,
  } = useUserLocation();

  // Starring reorders the list; a view transition lets the eye follow the
  // card to its new place. Falls back to an instant reorder where the API
  // is missing or the visitor prefers reduced motion.
  const toggleFavourite = (id) => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(() => flushSync(() => toggle(id)));
    } else {
      toggle(id);
    }
  };

  // Manual scroll restoration: remember where this history entry was
  // scrolled to, and put the visitor back there when they return via Back,
  // once the list has actually rendered.
  useEffect(() => {
    const key = `scroll:${location.key}`;
    const onScroll = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.key]);

  useEffect(() => {
    if (!data || navigationType !== "POP") return;
    const saved = sessionStorage.getItem(`scroll:${location.key}`);
    if (saved) window.scrollTo(0, Number(saved));
  }, [data, navigationType, location.key]);

  // View, query, and region live in the URL so Back restores them; the last
  // region choice is also remembered across visits.
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const view = searchParams.get("view") === "map" ? "map" : "list";
  const urlRegion = searchParams.get("region");
  const region =
    urlRegion === "all" || REGION_META[urlRegion]
      ? urlRegion
      : (storedRegion() ?? "south-shore");
  const update = (key, value, fallback) => {
    const next = new URLSearchParams(searchParams);
    if (value === fallback || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const chooseRegion = (value) => {
    localStorage.setItem(REGION_STORAGE, value);
    sessionStorage.setItem(REGION_EXPLICIT, "1");
    update("region", value, null);
  };

  // With location granted and no explicit choice, pre-select the region of
  // the nearest beach. An explicit dropdown choice always wins afterwards.
  useEffect(() => {
    if (!data || !userLocation) return;
    if (urlRegion || sessionStorage.getItem(REGION_EXPLICIT)) return;
    let nearest = null;
    for (const beach of data.beaches) {
      const km = haversineKm(
        userLocation.lat,
        userLocation.lng,
        beach.latitude,
        beach.longitude,
      );
      if (!nearest || km < nearest.km) nearest = { km, region: beach.region };
    }
    if (nearest && nearest.region !== region) {
      localStorage.setItem(REGION_STORAGE, nearest.region);
      update("region", nearest.region, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, userLocation]);

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="card p-4">
          <span className="tag tag-outline mb-2">Error</span>
          <p className="text-sm text-neutral-300">
            Could not load beach data: {error}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Refresh the page to try again.
          </p>
        </div>
      </Layout>
    );
  }

  const stale = isStale(data.validUntil, now);
  const presentRegions = REGION_ORDER.filter((id) =>
    data.beaches.some((beach) => beach.region === id),
  );

  const distanceOf = (beach) =>
    userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, beach.latitude, beach.longitude)
      : null;

  // Favourites pin to the top; then distance when location is active,
  // otherwise verdict ranking.
  const sorted = [...data.beaches].sort(
    (a, b) =>
      Number(favourites.has(b.id)) - Number(favourites.has(a.id)) ||
      (userLocation
        ? distanceOf(a) - distanceOf(b)
        : compareBeaches(a, b)),
  );

  const inRegion =
    region === "all"
      ? sorted
      : sorted.filter((beach) => beach.region === region);
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? inRegion.filter((beach) =>
        `${beach.name} ${beach.municipality}`.toLowerCase().includes(needle),
      )
    : inRegion;

  // Region sections apply on the All-regions list without location; a
  // proximity sort is the point of Near me, so it flattens the grouping.
  const grouped =
    view === "list" && region === "all" && !userLocation
      ? [
          { label: "Favourites", beaches: filtered.filter((b) => favourites.has(b.id)) },
          ...REGION_ORDER.map((id) => ({
            label: regionLabel(id),
            beaches: filtered.filter(
              (b) => b.region === id && !favourites.has(b.id),
            ),
          })),
        ].filter((section) => section.beaches.length > 0)
      : null;

  const renderCard = (beach) => (
    <BeachCard
      key={beach.id}
      beach={beach}
      hourly={beach.hourly}
      generatedAt={data.generatedAt}
      stale={stale}
      now={now}
      favourite={favourites.has(beach.id)}
      onToggleFavourite={toggleFavourite}
      distanceKm={userLocation ? distanceOf(beach) : null}
    />
  );

  const regionDropdown = (
    <select
      value={region}
      onChange={(event) => chooseRegion(event.target.value)}
      aria-label="Region"
      className="bg-transparent text-[11px] uppercase tracking-[0.1em] text-neutral-400 hover:text-neutral-200 border-0 p-0 pr-4 cursor-pointer appearance-none"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0h8L4 5z' fill='%239397ab'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right center",
      }}
    >
      {presentRegions.map((id) => (
        <option key={id} value={id}>
          {regionLabel(id)}
        </option>
      ))}
      <option value="all">All regions</option>
    </select>
  );

  return (
    <Layout subtitle={regionDropdown}>
      {stale && <StaleBanner generatedAt={data.generatedAt} />}

      <div className="flex gap-2.5 mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => update("q", event.target.value, "")}
          placeholder="Search beaches…"
          aria-label="Search beaches by name or municipality"
          className="card flex-1 min-w-0 px-3.5 py-2 text-sm text-noct-text placeholder:text-neutral-600 border-0"
        />
        <button
          type="button"
          aria-pressed={Boolean(userLocation)}
          aria-label={
            userLocation ? "Stop sorting by distance" : "Sort by distance to me"
          }
          title={userLocation ? "Sorting by distance" : "Near me"}
          onClick={() => (userLocation ? clearLocation() : requestLocation())}
          className={`btn shrink-0 ${userLocation ? "btn-primary" : "btn-secondary"}`}
        >
          <Crosshair active={Boolean(userLocation)} />
        </button>
        <div className="flex shrink-0" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            onClick={() => update("view", "list", "list")}
            className={`btn rounded-r-none ${view === "list" ? "btn-primary" : "btn-secondary"}`}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            onClick={() => update("view", "map", "list")}
            className={`btn rounded-l-none ${view === "map" ? "btn-primary" : "btn-secondary"}`}
          >
            Map
          </button>
        </div>
      </div>

      {locationStatus === "denied" && (
        <p className="text-[12px] text-neutral-500 -mt-2 mb-3">
          Location request was denied; sorting by conditions instead.
        </p>
      )}
      {locationStatus === "unavailable" && (
        <p className="text-[12px] text-neutral-500 -mt-2 mb-3">
          This browser does not offer location access.
        </p>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-500 py-6">
          No beaches match{needle ? ` "${query.trim()}"` : ""} in{" "}
          {region === "all" ? "any region" : regionLabel(region)}.
        </p>
      )}

      {view === "map" && filtered.length > 0 && (
        <Suspense fallback={<Loading />}>
          <BeachMap
            beaches={filtered}
            stale={stale}
            storageKey={`beach-map-view:${region}`}
            userLocation={userLocation}
          />
        </Suspense>
      )}

      {view === "list" &&
        (grouped ? (
          grouped.map((section) => (
            <div key={section.label} className="mb-4">
              <SectionHeading>{section.label}</SectionHeading>
              <div className="grid gap-3.5">
                {section.beaches.map(renderCard)}
              </div>
            </div>
          ))
        ) : (
          <div className="grid gap-3.5">{filtered.map(renderCard)}</div>
        ))}

      <p className="text-[11px] text-neutral-600 mt-7 tracking-[0.04em]">
        Brighter bars = better hours · low grey bars = dark out · pale top mark
        = thunder risk · times in Atlantic time · updated{" "}
        {formatTime(data.generatedAt)}
      </p>
    </Layout>
  );
}

export default Home;
