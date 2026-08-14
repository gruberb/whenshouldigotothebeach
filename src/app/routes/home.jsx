import { lazy, Suspense, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import BeachCard from "@/features/beaches/components/beach-card";
import HomeHeader from "@/features/beaches/components/home-header";
import Layout from "@/components/layout";
import Loading from "@/components/loading";
import StaleBanner from "@/features/beaches/components/stale-banner";
import { useBeaches } from "@/features/beaches/api/get-beaches";
import { useFavourites } from "@/features/beaches/hooks/use-favourites";
import { useNow } from "@/hooks/use-now";
import { useUserLocation } from "@/hooks/use-user-location";
import { REGION_META, REGION_ORDER, compareBeaches, regionLabel } from "@/features/beaches/utils/meta";
import { formatTime, isStale } from "@/utils/format";
import { haversineKm } from "@/utils/geo";

// Leaflet only loads when someone opens the map view.
const BeachMap = lazy(
  () => import("@/features/beaches/components/beach-map"),
);

const REGION_STORAGE = "beach-region";
const REGION_EXPLICIT = "region-explicit";

// Category chips compose with region and search (AND semantics).
const CATEGORY_FILTERS = [
  {
    id: "washrooms",
    label: "Washrooms",
    icon: "ph-toilet",
    test: (b) => b.washrooms === true,
  },
  {
    id: "water",
    label: "Water temp",
    icon: "ph-thermometer-simple",
    test: (b) => b.water?.valueC != null,
  },
  { id: "surf", label: "Surf", icon: "ph-waves", test: (b) => b.surf === true },
];

function storedRegion() {
  const value = localStorage.getItem(REGION_STORAGE);
  return value === "all" || REGION_META[value] ? value : null;
}

function SectionHeading({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 m-0 mb-1 mt-3 first:mt-0">
      {children}
    </p>
  );
}

function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const { data, manifest, selectedDate, error, loading } = useBeaches(requestedDate);
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

  // View, query, region, and category filters live in the URL so Back
  // restores them; the last region choice is also remembered across visits.
  const query = searchParams.get("q") ?? "";
  const view = searchParams.get("view") === "map" ? "map" : "list";
  const urlRegion = searchParams.get("region");
  const activeFilters = (searchParams.get("only") ?? "")
    .split(",")
    .filter((id) => CATEGORY_FILTERS.some((f) => f.id === id));
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
  const searched = needle
    ? inRegion.filter((beach) =>
        `${beach.name} ${beach.municipality}`.toLowerCase().includes(needle),
      )
    : inRegion;
  const filtered = activeFilters.reduce(
    (list, id) => list.filter(CATEGORY_FILTERS.find((f) => f.id === id).test),
    searched,
  );

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
      selectedDate={selectedDate}
    />
  );

  const regionOptions = [
    ...presentRegions.map((id) => {
      const count = data.beaches.filter((b) => b.region === id).length;
      return { id, label: regionLabel(id), count: `${count} beaches` };
    }),
    { id: "all", label: "All regions", count: `${data.beaches.length} beaches` },
  ];

  return (
    <Layout
      header={
        <HomeHeader
          regions={regionOptions}
          region={region}
          onRegionChange={chooseRegion}
          dates={manifest.dates}
          selectedDate={selectedDate}
          onDateChange={(value) => update("date", value, manifest.dates[0])}
          query={query}
          onQueryChange={(value) => update("q", value, "")}
          view={view}
          onViewChange={(value) => update("view", value, "list")}
          filterOptions={CATEGORY_FILTERS}
          activeFilters={activeFilters}
          onToggleFilter={(id) => {
            const next = activeFilters.includes(id)
              ? activeFilters.filter((f) => f !== id)
              : [...activeFilters, id];
            update("only", next.join(","), "");
          }}
          locateActive={Boolean(userLocation)}
          onLocate={() => (userLocation ? clearLocation() : requestLocation())}
        />
      }
    >
      {stale && <StaleBanner generatedAt={data.generatedAt} />}

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
          No beaches match{needle ? ` "${query.trim()}"` : ""}
          {activeFilters.length > 0 &&
            ` with ${activeFilters
              .map((id) => CATEGORY_FILTERS.find((f) => f.id === id).label.toLowerCase())
              .join(" + ")}`}{" "}
          in {region === "all" ? "any region" : regionLabel(region)}.
        </p>
      )}

      {view === "map" && filtered.length > 0 && (
        <Suspense fallback={<Loading />}>
          <BeachMap
            beaches={filtered}
            stale={stale}
            storageKey={`beach-map-view:${region}`}
            userLocation={userLocation}
            selectedDate={selectedDate}
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
        {data.dayOffset >= 3 && "Planning forecast · approximately 3-hour precision · "}
        Brighter bars = better hours · low grey bars = dark out · pale top mark
        = thunder risk · times in Atlantic time · updated{" "}
        {formatTime(data.generatedAt)}
      </p>
    </Layout>
  );
}

export default Home;
