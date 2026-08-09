# Changelog

## 1.2.1 - 2026-08-09

### Fixed

- Best-window selection recommends the earliest good run instead of the
  highest-average one. The forecast horizon truncates tomorrow morning to
  its best few hours, and that stub used to outrank a full excellent day:
  on a 93-scoring Sunday every South Shore beach read "Good later,
  MON 06:00-08:00".

### Changed

- Windows name their day in full: "Today 08:00-21:00" or
  "Monday 06:00-08:00" instead of a bare range or "MON".
- The "Go now" and "Good later" tags are gone; the dated window line
  already says it. Cautionary and safety tags (Mixed, Not great, water
  advisories, closures, hazards, stale data) remain.

## 1.2.0 - 2026-08-08

### Added

- Category filters beneath the search bar: Washrooms, Water temp (beaches
  with a live buoy reading), and Surf. Chips compose with region, search,
  and the map view, and live in the URL so filtered views can be shared.
- Surf category: eight beaches are flagged as documented surf spots, each
  requiring a public source in the registry (Tourism Nova Scotia names
  Lawrencetown, Martinique, and Summerville; the Point Michaud provincial
  park listing is tagged Surfing; Mavillette hosts a Surfing Association of
  Nova Scotia contest; Ingonish, Cherry Hill, and Hirtle's appear in two
  independent surf databases each). Surf beaches show a "Surf spot" tile on
  their page. Expert-only reef breaks are deliberately excluded.

### Changed

- Homepage header redesigned: full-width title, a region picker with
  per-region beach counts, a search field with icon and accent focus ring,
  a boxed Near-me button, an icon List/Map segmented control, and pill
  filter chips with icons.

## 1.1.1 - 2026-08-08

### Changed

- Ended ECCC bulletins ("SEVERE THUNDERSTORM ENDED") are no longer shown;
  they are all-clear notices, not active safety information.

## 1.1.0 - 2026-08-08

### Added

- Province-wide coverage: 61 new beaches for 75 total, spanning all seven
  coastal tourism regions from Yarmouth & Acadian Shores to Cape Breton.
  Every entry is hand-reviewed: verified coordinates, an ECCC weather site
  and CHS tide station assigned by coastline judgment, shore bearing, and
  tide effects only where officially documented.
- Region selector in the subheadline slot. "All regions" groups the list
  into titled region sections with favourites pinned on top; a single
  region shows the familiar flat ranked list. The choice sticks via URL
  and browser storage, defaulting to South Shore.
- Near me: tapping the crosshair asks the browser for location once,
  pre-selects the nearest region, sorts beaches by distance with
  "~N km away" hints, and drops a position dot on the map. Coordinates
  never leave the browser.
- Beach pages show their region next to the municipality.
- Architecture documentation (docs/ARCHITECTURE.md): system and CI
  diagrams, component map, and the full inventory of external services.

### Changed

- Weather warnings moved out of the banner row above the header. Reasons
  that already state the warning (heat, thunderstorm risk) now link
  directly to the ECCC bulletin; only bulletins not covered by a reason
  render as notices beneath the title, so nothing is ever hidden.
- Beach name labels on the map hide below zoom 9, keeping the province
  view readable; zoom in and they return.
- Map position is remembered per region, so switching regions refits the
  bounds instead of restoring another region's view.
- Nearby-food snapshot rebuilt for the whole coast.

### Fixed

- The map no longer renders empty or fitted to the whole world when the
  page loads in a hidden or background tab; the initial fit now waits for
  the container to have real dimensions.
- Ended ECCC bulletins are tagged "Ended" instead of "Watch".

## 1.0.6 - 2026-08-08

### Added

- Sperry's Beach (Petite Riviere), the fourteenth beach: estuary at the
  river mouth across from Rissers, firm sand and shallow water at low tide,
  with the channel-current hazard noted on the page.

### Fixed

- Nearby tiles fit two per row on narrow screens instead of wrapping.

## 1.0.5 - 2026-08-08

### Added

- Search on the homepage, filtering by beach name or municipality.
- Map view: dark Leaflet map with all beaches as accent markers (brighter =
  better conditions), permanent name labels, and click-through to beach
  pages. Loads lazily so the homepage stays light.
- Favourites: a star on each card pins beaches to the top of the list,
  stored in the browser. Starring animates the reorder via the View
  Transitions API, with reduced-motion and older browsers falling back to
  an instant reorder.

### Changed

- Beach pages redesigned: profile tiles with icons for surface, exposure,
  tide preference, and amenities; nearby food as tappable cards linking to
  the place on Google Maps; a Conditions section that hides tiles with no
  value; reasons on one line under the window.
- Back navigation now restores the homepage view (list or map), search
  query, scroll position, and map position instead of resetting.
- Header divider spacing tightened above the controls.

### Fixed

- Map tiles no longer render washed out: Leaflet's tile fade never
  completed inside the lazily mounted container and left tiles at low
  opacity.

## 1.0.4 - 2026-08-08

### Added

- Green Bay Beach, the thirteenth beach in the registry.
- Weather icons on homepage cards: reasons render as compact icon chips
  driven by structured reason kinds from the pipeline; full sentences
  remain on the beach pages and in chip tooltips.
- Nearby food includes general stores, convenience stores, and delis
  (rural staples like the Rose Bay General Store).

### Changed

- Nearby food distances are road distances with ferries avoided, routed
  via Valhalla during the weekly snapshot refresh. Places more than 20 km
  away by road are dropped.
- Homepage cards drop the confidence line and tighten the spacing between
  the window time and the conditions.

### Fixed

- Sand Dollar Beach no longer lists LaHave Bakery at a misleading 4.9 km
  straight-line distance (41 km by road without the ferry); Rose Bay
  General Store & Bistro, 0.6 km by road, now leads its list.

## 1.0.3 - 2026-08-08

### Changed

- Nearby food now comes from a committed OpenStreetMap snapshot
  (config/nearby-food.json) instead of querying Overpass on every deploy.
  The 1.0.2 deploys shipped empty food lists whenever the live query timed
  out; the snapshot makes builds fast and deterministic. A weekly workflow
  refreshes it, and npm run refresh:food does so on demand.

## 1.0.2 - 2026-08-08

### Added

- Surface and tide-preference tags on beach pages ("Sand", "Sand and
  cobble", "Best at low tide", "Any tide"), sourced from the hand-reviewed
  registry.
- Square markers on the tide curve highlighting the events that suit each
  beach, with a legend line.
- Nearby food: the two closest named restaurants, cafes, bakeries, or
  takeout spots per beach from OpenStreetMap, with straight-line distances.
  Optional data; a failed fetch never blocks the build.

### Changed

- Tide chart keeps a legible minimum width on small screens and scrolls
  horizontally instead of shrinking.
- Removed the subtitle under the tide heading; station provenance lives in
  Details and sources.

## 1.0.1 - 2026-08-08

### Added

- Privacy-friendly analytics (self-hosted Plausible).

### Changed

- Header: larger wordmark with the region as a subheadline beneath it,
  freeing horizontal space on small screens.
- Removed the best-bet hero from the homepage; the ranked list now leads.

## 1.0.0 - 2026-08-08

First release of whenshouldigotothebeach.ca.

### Added

- Verdict engine: hourly 0-100 scoring from precipitation, wind and gusts,
  air temperature, fog, sky, and beach-specific tide behaviour, with hard
  gates (thunderstorm hours, steady rain) that cannot be averaged away.
  Verdicts: GO_NOW, GOOD_LATER, MIXED, NOT_GREAT, WATER_ADVISORY, CLOSED,
  HAZARDOUS, plus a best contiguous daylight window per beach.
- Data pipeline (TypeScript): ECCC citypage hourly forecasts and warnings
  from the MSC Datamart dated tree, CHS IWLS astronomical tide predictions
  (high/low events and curve samples), ECCC moored-buoy sea surface
  temperature (SWOB-ML), all schema-validated before publishing.
- Registry of 12 hand-verified South Shore beaches from Hubbards to
  Barrington, with manually assigned weather sites and tide stations, shore
  bearing for onshore/offshore wind classification, documented tide effects,
  and amenities sourced from official pages only.
- Frontend (React + Vite, Nocturne design system): ranked homepage with a
  best-bet hero, per-beach pages with hour strip, tide curve on a real time
  axis, ECCC outlook, Google Maps directions, and full source provenance
  (kind, station, distance, age) on every value.
- Safety rails: closures, advisories, and red warnings override comfort
  scoring; stale data hides all verdicts; missing data never produces a
  favourable verdict.
- Manual override mechanism for closures and advisories, expiry required.
- Scheduled GitHub Actions workflow: fetch, validate, test, build, and
  deploy to GitHub Pages every 30 minutes; generated JSON is never
  committed and a failed run leaves the previous deployment online.
- Test suite covering scoring invariants, parsers against real API
  fixtures, and registry completeness.
