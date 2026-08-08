# Changelog

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
