// Nocturne is a mono palette: verdicts are ranked by tag treatment and copy,
// not by hue. Outline = attention (hazard), neutral = meh.
export const VERDICT_META = {
  // quiet: the dated window line already says everything the label would;
  // only cautionary and safety verdicts keep a visible tag.
  GO_NOW: { label: "Go now", rank: 0, quiet: true },
  GOOD_LATER: { label: "Good later", rank: 1, quiet: true },
  MIXED: { label: "Mixed", rank: 2, tag: "tag-neutral" },
  NOT_GREAT: { label: "Not great", rank: 3, tag: "tag-neutral" },
  WATER_ADVISORY: { label: "Swimming not advised", rank: 4, tag: "tag-outline" },
  HAZARDOUS: { label: "Hazardous", rank: 5, tag: "tag-outline" },
  CLOSED: { label: "Closed", rank: 6, tag: "tag-outline" },
};

export const STALE_META = { label: "Data stale", tag: "tag-neutral" };

// Tourism regions in display order, west-to-east after the home region.
export const REGION_ORDER = [
  "south-shore",
  "yarmouth-acadian-shores",
  "bay-of-fundy-annapolis-valley",
  "northumberland-shore",
  "halifax-metro",
  "eastern-shore",
  "cape-breton",
];

export const REGION_META = {
  "south-shore": "South Shore",
  "yarmouth-acadian-shores": "Yarmouth & Acadian Shores",
  "bay-of-fundy-annapolis-valley": "Bay of Fundy & Annapolis Valley",
  "northumberland-shore": "Northumberland Shore",
  "halifax-metro": "Halifax Metro",
  "eastern-shore": "Eastern Shore",
  "cape-breton": "Cape Breton",
};

export function regionLabel(id) {
  return REGION_META[id] ?? id;
}

// Registry tide_effect values. bestTide drives the square markers on the
// tide curve; null means no tide preference to mark.
export const TIDE_EFFECT_META = {
  "more-sand-at-low": { bestTide: "low" },
  "warmer-incoming-after-low": { bestTide: "low" },
  "reduced-access-at-high": { bestTide: "low" },
  neutral: { bestTide: null },
  unknown: { bestTide: null },
};

export function compareBeaches(a, b) {
  const rankA = VERDICT_META[a.verdict]?.rank ?? 9;
  const rankB = VERDICT_META[b.verdict]?.rank ?? 9;
  if (rankA !== rankB) return rankA - rankB;
  return (b.peakScore ?? 0) - (a.peakScore ?? 0);
}
