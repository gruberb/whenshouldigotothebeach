import { useEffect, useState } from "react";

// Ticking clock so staleness and "next tide" re-evaluate in tabs that stay
// open past validUntil instead of freezing on their first render.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
