import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";

export function getBeaches() {
  return fetchJson("/data/beaches.json");
}

export function useBeaches() {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    let active = true;
    getBeaches()
      .then((data) => {
        if (active) setState({ data, error: null });
      })
      .catch((err) => {
        if (active) setState({ data: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...state, loading: !state.data && !state.error };
}
