# Changelog

## 1.5.1 - 2026-08-14

### Fixed

- Beach cards now always show the forecast air-temperature range for the
  recommended window, or the daylight range when there is no recommended
  window. It no longer disappears when wind, rain, or tide fill the three
  explanatory-reason slots, and remains distinct from observed water
  temperature.

## 1.5.0 - 2026-08-14

### Added

- A URL-backed seven-day picker on both the beach rankings and each beach
  detail page. Choosing a date re-ranks every beach and preserves the date
  through map and detail navigation.
- Seven-day Canadian GEM weather forecasts via Open-Meteo and seven-day CHS
  tide predictions. Days four through seven are explicitly labelled as
  lower-confidence planning forecasts and use three-hour precision.
- Per-date static data shards and per-day confidence metadata, while retaining
  ECCC as the source of official warnings and outlook text.

## 1.4.3 - 2026-08-10

### Fixed

- The "Datamart unreachable" error now carries the reason. 1.4.0 stopped it
  blaming a missing forecast for a transport failure, but still discarded the
  failure itself, and undici reports every network-level fault as a bare
  "fetch failed" with the cause hidden on `.cause`. A connection timeout, a
  reset, a DNS failure and a throttle need different responses and were
  indistinguishable in the log. Scheduled runs have been failing this way
  roughly two times in five, each burning five minutes, with no way to tell
  which of those it was.

## 1.4.2 - 2026-08-09

### Added

- `npm run check:buoys`, which answers whether a missing water temperature is
  our fault or ECCC's. It takes the buoys from the registry rather than a
  second list that can drift, and calls the data build's own fetch, so a pass
  means the pipeline would get a reading too. The marine tree is reported
  separately from individual buoys because the whole subtree disappears during
  an outage, which is a different problem from one dead buoy. Exits non-zero
  when any buoy has no usable reading, and accepts an optional ISO timestamp
  to ask about a past moment.

### Changed

- README covers `npm run lint` and `npm run check:buoys`, and says plainly
  that the buoy feed goes quiet sometimes and how to tell.

## 1.4.1 - 2026-08-09

### Fixed

- Buoy staleness errors named the wrong file. The rethrow compared against
  `files[files.length - 1]` after an in-place `reverse()`, which is the
  oldest file on the server, so the current ECCC marine outage logged
  "Latest observation is 38h old" while the newest reading was 24h old. The
  message now carries the buoy id and the real age.
- The same walk kept fetching every older file after finding one past the
  24-hour cutoff, though nothing behind it can be fresher. It now stops at
  the first, which during an outage is one request per buoy instead of up
  to 85.
- A buoy that is publishing but has no sea surface temperature element no
  longer reports as an absent feed. The two need different responses and
  used to read the same in the log.

## 1.4.0 - 2026-08-09

### Added

- White Point Beach (Queens County), the 76th beach and the ninth
  documented surf spot, named as one by Tourism Nova Scotia. It is the only
  entry whose shore is not freely walkable: the beach fronts a private
  resort that gates access behind a paid day pass, and Region of Queens
  Municipality does not list it among its public beaches. The listing says
  so rather than leaving people to find out at the gate. Weather from
  Liverpool (8.7 km), tides from Port Mouton (9.6 km), shore bearing taken
  from the OpenStreetMap coastline normal.
- Live water temperature for Pondville (East Chedabucto Bay buoy, 10.5 km)
  and Port Shoreham (West Chedabucto Bay, 23.2 km). These are the first
  readings from outside Halifax Harbour, extending observed water temp to
  Richmond County and the east end of the Eastern Shore. Both buoys publish
  the same SWOB-ML schema the existing reader already parses.

### Fixed

- An unreachable Datamart no longer reports itself as a missing forecast.
  Directory listings in the citypage lookback were fetched with no retry
  and every error swallowed into an empty result, so a throttled or
  timed-out runner failed the build with "No citypage file for s0000318
  within 12h lookback" while the file sat published on time. This sank the
  1.3.0 deploy. Listings now retry once, a 404 is still read as "this hour
  has not been published", and anything else is reported as what it is.
- Requests no longer retry a definitive 4xx. The lookback walks hour
  directories that routinely do not exist yet, so retrying their 404s spent
  an extra request and a backoff on the normal path.

### Changed

- Black Duck Cove keeps its blank water reading, now with the reason
  recorded in the registry. The East Chedabucto Bay buoy is only 19.7 km
  away, but the beach sits south of the bay mouth on the Atlantic side of
  the Canso peninsula, where bay surface temperature is not representative.

## 1.3.0 - 2026-08-09

### Fixed

- Detail pages could render a late response under the wrong beach.
  Switching beaches started a new fetch without cancelling the previous
  one, so a slow reply could land after navigation. Hook state now carries
  the beach id it belongs to, which drops stale replies and also removes
  the blanking render that ran on every id change.

### Changed

- Frontend restructured onto bulletproof-react layering: `app/` for
  composition and routes, `features/beaches/` for everything specific to
  the beach domain, and `components/`, `hooks/`, `lib/`, `utils/` for
  domain-agnostic code. Imports flow one way, shared to features to app.
  Files and folders are kebab-case, every cross-folder import goes through
  the `@/` alias, and there are no barrel files so Vite can still
  tree-shake.
- Data fetching split into one module per request under
  `features/beaches/api/`, each pairing the fetcher with the hook that
  consumes it.
- XML parser boundaries in the ECCC and buoy readers use a named `XmlNode`
  type instead of scattered `any` casts. The feeds vary per element, so the
  parsers still narrow through `asArray`/`toNumber`/`toText` at the point
  of use.

### Added

- `npm run lint` works. The script was already there but ESLint had never
  been a dependency. The flat config enforces the layer directions with
  `no-restricted-imports`, kebab-case naming with `check-file`, and the
  React hooks rules.

### Removed

- Dead code: an unused `surfaceLabel` helper, unread label fields on the
  tide and verdict metadata, the orphaned `.tag-accent`, `.btn-secondary`
  and Leaflet popup rules in `index.css`, and thirteen pipeline internals
  that were exported but only ever used inside their own module.

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
