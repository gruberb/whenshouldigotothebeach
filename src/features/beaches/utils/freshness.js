import { isStale } from "@/utils/format";

// Freshness is tiered so a dropped refresh degrades the page instead of
// blanking it. Every dataset carries validUntil (the forecast window),
// safetySource.validUntil (the advisory recheck window) and expiresAt.
// Between a valid window and expiresAt the verdicts stay up and the banner
// names what has aged; past expiresAt the verdicts are hidden, because by
// then the day's best window is likely already behind the reader.
export function freshnessOf(data, now) {
  const weatherStale = isStale(data.validUntil, now);
  const safetyStale = isStale(data.safetySource.validUntil, now);
  const expired = isStale(data.expiresAt, now);
  return {
    weatherStale,
    safetyStale,
    expired,
    stale: expired || weatherStale || safetyStale,
  };
}
