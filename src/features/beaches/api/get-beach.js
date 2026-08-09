import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";

export function getBeach(beachId) {
  return fetchJson(`/data/beach/${beachId}.json`);
}

// State carries the id it belongs to so a response that arrives after the user
// has already navigated to another beach is never rendered against it. That
// also removes the need to blank the state on beachId change, which would mean
// a synchronous setState in the effect and an extra render pass.
export function useBeach(beachId) {
  const [state, setState] = useState({ id: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    getBeach(beachId)
      .then((data) => {
        if (active) setState({ id: beachId, data, error: null });
      })
      .catch((err) => {
        if (active) setState({ id: beachId, data: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [beachId]);

  const settled = state.id === beachId;
  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading: !settled,
  };
}
