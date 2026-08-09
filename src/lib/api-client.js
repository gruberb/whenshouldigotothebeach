// The data files are regenerated every 30 minutes behind the same URLs, so
// every request busts caches; staleness is judged by validUntil, never by
// HTTP freshness.
export async function fetchJson(path) {
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
