import React from "react";
import BeachCard from "../components/beach/BeachCard";
import Layout from "../components/common/Layout";
import Loading from "../components/common/Loading";
import StaleBanner from "../components/common/StaleBanner";
import { useBeachIndex } from "../hooks/useBeachData";
import { useNow } from "../hooks/useNow";
import { compareBeaches, formatTime, isStale } from "../lib/format";

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
