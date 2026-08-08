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
import { compareBeaches, formatTime, isStale } from "../lib/format";

// Leaflet only loads when someone opens the map view.
const BeachMap = lazy(() => import("../components/beach/BeachMap"));

function Home() {
  const { data, error, loading } = useBeachIndex();
  const now = useNow();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { favourites, toggle } = useFavourites();

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
  // View and query live in the URL so Back restores them from history.
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const view = searchParams.get("view") === "map" ? "map" : "list";
  const update = (key, value, fallback) => {
    const next = new URLSearchParams(searchParams);
    if (value === fallback || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

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
  // Favourites pin to the top; verdict ranking orders everything else.
  const beaches = [...data.beaches].sort(
    (a, b) =>
      Number(favourites.has(b.id)) - Number(favourites.has(a.id)) ||
      compareBeaches(a, b),
  );
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? beaches.filter((beach) =>
        `${beach.name} ${beach.municipality}`.toLowerCase().includes(needle),
      )
    : beaches;

  return (
    <Layout>
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

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-500 py-6">
          No beaches match "{query.trim()}".
        </p>
      )}

      {view === "map" && filtered.length > 0 && (
        <Suspense fallback={<Loading />}>
          <BeachMap beaches={filtered} stale={stale} />
        </Suspense>
      )}

      {view === "list" && (
        <div className="grid gap-3.5">
          {filtered.map((beach) => (
            <BeachCard
              key={beach.id}
              beach={beach}
              hourly={beach.hourly}
              generatedAt={data.generatedAt}
              stale={stale}
              now={now}
              favourite={favourites.has(beach.id)}
              onToggleFavourite={toggleFavourite}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-neutral-600 mt-7 tracking-[0.04em]">
        Brighter bars = better hours · low grey bars = dark out · pale top mark
        = thunder risk · times in Atlantic time · updated{" "}
        {formatTime(data.generatedAt)}
      </p>
    </Layout>
  );
}

export default Home;
