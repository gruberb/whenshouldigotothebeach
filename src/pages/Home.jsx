import React from "react";
import BeachCard from "../components/beach/BeachCard";
import Layout from "../components/common/Layout";
import Loading from "../components/common/Loading";
import StaleBanner from "../components/common/StaleBanner";
import { useBeachIndex } from "../hooks/useBeachData";
import { useNow } from "../hooks/useNow";
import {
  compareBeaches,
  formatTime,
  formatWindow,
  isStale,
} from "../lib/format";

function Hero({ beaches, generatedAt }) {
  const top = beaches[0];
  const windowLabel = top ? formatWindow(top.bestWindow, generatedAt) : null;

  if (!top || !windowLabel) {
    return (
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent mb-2.5 m-0">
          Today
        </p>
        <h1 className="font-display font-medium text-4xl md:text-[42px] leading-tight m-0">
          No good beach window today
        </h1>
      </header>
    );
  }

  return (
    <header className="mb-10">
      <p className="text-[11px] uppercase tracking-[0.14em] text-accent mb-2.5 m-0">
        {top.verdict === "GO_NOW" ? "Go now" : "Best bet today"}
      </p>
      <h1
        className="font-display font-medium text-4xl md:text-[42px] leading-tight m-0 mb-2.5 max-w-[640px]"
        style={{ textWrap: "pretty" }}
      >
        {top.name}, {windowLabel}
      </h1>
      {top.reasons?.[0] && (
        <p className="text-[15px] text-neutral-400 m-0 max-w-[560px]">
          {top.reasons[0]}
        </p>
      )}
    </header>
  );
}

function Home() {
  const { data, error, loading } = useBeachIndex();
  const now = useNow();

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
  const beaches = [...data.beaches].sort(compareBeaches);

  return (
    <Layout>
      {stale && <StaleBanner generatedAt={data.generatedAt} />}
      {!stale && <Hero beaches={beaches} generatedAt={data.generatedAt} />}
      <div className="grid gap-3.5">
        {beaches.map((beach) => (
          <BeachCard
            key={beach.id}
            beach={beach}
            hourly={beach.hourly}
            generatedAt={data.generatedAt}
            stale={stale}
            now={now}
          />
        ))}
      </div>
      <p className="text-[11px] text-neutral-600 mt-7 tracking-[0.04em]">
        Brighter bars = better hours · low grey bars = dark out · pale top mark
        = thunder risk · times in Atlantic time · updated{" "}
        {formatTime(data.generatedAt)}
      </p>
    </Layout>
  );
}

export default Home;
