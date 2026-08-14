# When should I go to the beach?

A no-nonsense dashboard for good beach times on Nova Scotia's coast: 76
saltwater beaches across all seven tourism regions, from Yarmouth to Cape
Breton. Sibling site of [isthelclcpoolopen.ca](https://isthelclcpoolopen.ca).

Choose any of the next seven days and each beach gets a plain verdict (GO NOW,
GOOD LATER, MIXED, NOT GREAT), the best continuous window, two or three
reasons, an hourly strip, and tide context. Days four through seven are shown
as lower-confidence planning forecasts with three-hour precision. Data
provenance is always visible: forecasts are labelled as forecasts, tide
predictions as astronomical predictions, and stations show their distance
from the sand.

For how the pieces fit together, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Data sources

- Weather used for scoring: Open-Meteo's Canadian GEM seamless model forecast.
  The first three days use hourly values; later days are presented at
  three-hour planning precision.
- Official warnings and outlook: Environment and Climate Change Canada
  citypage XML from the MSC Datamart.
- Tides: Canadian Hydrographic Service IWLS API predictions (`wlp-hilo` and
  `wlp`). Not for navigation.
- Water temperature: ECCC moored-buoy observations (SWOB-ML,
  `avg_sea_sfc_temp_pst10mts`), display-only and never part of the score.
  Beaches without a buoy in defensible range show no reading rather than a
  misleading one.
- Nearby food: named restaurants, cafes, bakeries, and takeout from
  OpenStreetMap (Overpass), shown with road distances (Valhalla routing,
  ferries excluded). Data © OpenStreetMap contributors.
- Beach knowledge: `config/beaches.yml`, a hand-reviewed registry of
  coordinates, station assignments, exposure, shore bearing, and documented
  tide behaviour per beach.

## How it works

```
Open-Meteo GEM ─────┐
ECCC warnings ──────┤
CHS IWLS tides ─────┤   scripts/build-data.ts        public/data/*.json
manual overrides ───┼─> normalize -> score -> ────>  (7 daily verdicts,
config/beaches.yml ─┘   validate                      windows, hours, tides)
                                                          │
                                                          ▼
                                                 React frontend (Vite)
```

A scheduled GitHub Action refreshes data every 30 minutes and deploys the
built site as a GitHub Pages artifact. Generated JSON is never committed; if
a core fetch or validation fails, the previous deployment stays online and
the frontend flags stale data once `validUntil` passes.

## Development

```
npm install
npm run data       # fetch live GEM + ECCC + CHS data, write 7-day forecasts
npm run dev        # vite dev server
npm test           # scoring invariants, parsers, registry checks
npm run validate   # schema-check generated data
npm run build      # production build (dist/)
npm run lint       # eslint: layering rules, react hooks, kebab-case files
npm run check:buoys # are the water-temperature buoys reporting?
```

`npm run data` and `npm run check:buoys` need network access; everything else
works offline once data exists.

Water temperature comes from ECCC moored buoys, which do go quiet.
`npm run check:buoys` runs the pipeline's own fetch against every buoy in the
registry and says whether a blank reading is ours or theirs, so the answer does
not depend on reading the datamart by hand. It exits non-zero when any buoy has
no usable reading, and takes an optional ISO timestamp to ask about a past
moment:

```
npm run check:buoys 2026-08-08T15:00:00Z
```

## Deployment

Served at [whenshouldigotothebeach.ca](https://whenshouldigotothebeach.ca)
via GitHub Pages (`public/CNAME`). Asset and data paths are absolute and
client-side routes rely on the 404.html fallback, so the site must live at
a domain root; a project-pages subpath will not work without a Vite `base`.

DNS at the registrar: apex A records to 185.199.108.153, 185.199.109.153,
185.199.110.153, 185.199.111.153 (and optionally www as CNAME to the
GitHub Pages hostname).

## Adding a beach

Add an entry to `config/beaches.yml` with verified coordinates, a manually
chosen ECCC site and CHS station (nearest is not always right — check bay and
estuary geometry), shore bearing toward open water, and a documented
`tide_effect`. Run `npm test` to enforce registry completeness.
