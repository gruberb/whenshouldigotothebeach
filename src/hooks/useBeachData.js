import { useEffect, useState } from "react";

async function fetchJson(path) {
  const cacheBuster = `_t=${Date.now()}`;
  const response = await fetch(`${path}?${cacheBuster}`, {
    cache: "no-cache",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

export function useBeachIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJson("/data/beaches.json")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return { data, error, loading: !data && !error };
}

export function useBeachDetail(beachId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetchJson(`/data/beach/${beachId}.json`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [beachId]);

  return { data, error, loading: !data && !error };
}
