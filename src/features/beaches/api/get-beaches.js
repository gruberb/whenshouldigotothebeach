import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";

let manifestRequest = null;

export function getManifest() {
  manifestRequest ??= fetchJson("/data/manifest.json");
  return manifestRequest;
}

export async function getBeaches(requestedDate = null) {
  const manifest = await getManifest();
  const selectedDate = manifest.dates.includes(requestedDate)
    ? requestedDate
    : manifest.dates[0];
  const data = await fetchJson(`/data/day/${selectedDate}.json`);
  return { data, manifest, selectedDate };
}

export function useBeaches(requestedDate = null) {
  const [state, setState] = useState({
    requestedDate: undefined,
    payload: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getBeaches(requestedDate)
      .then((payload) => {
        if (active) setState({ requestedDate, payload, error: null });
      })
      .catch((err) => {
        if (active) setState({ requestedDate, payload: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [requestedDate]);

  const settled = state.requestedDate === requestedDate;
  return {
    data: settled ? state.payload?.data ?? null : null,
    manifest: settled ? state.payload?.manifest ?? null : null,
    selectedDate: settled ? state.payload?.selectedDate ?? null : null,
    error: settled ? state.error : null,
    loading: !settled || (!state.payload && !state.error),
  };
}
