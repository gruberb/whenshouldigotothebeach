import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadBeaches,
  loadOverrides,
  loadThresholds,
  REGION_IDS,
} from "../scripts/lib/registry.js";

const configDir = join(__dirname, "..", "config");

describe("beach registry", () => {
  const beaches = loadBeaches(join(configDir, "beaches.yml"));

  it("loads all published beaches", () => {
    expect(beaches.length).toBeGreaterThanOrEqual(5);
  });

  it("gives every beach a unique id and a tide and weather mapping", () => {
    const ids = new Set(beaches.map((b) => b.id));
    expect(ids.size).toBe(beaches.length);
    for (const beach of beaches) {
      expect(beach.tide.station_id.length).toBeGreaterThanOrEqual(10);
      expect(beach.weather.site_code).toMatch(/^s\d{7}$/);
      expect(beach.coverage.reviewed_at).toBeTruthy();
    }
  });

  it("keeps station assignments within plausible distance of the beach", () => {
    for (const beach of beaches) {
      expect(Math.abs(beach.tide.station_latitude - beach.location.latitude)).toBeLessThan(0.6);
      expect(Math.abs(beach.weather.site_latitude - beach.location.latitude)).toBeLessThan(0.6);
    }
  });

  it("assigns every beach a valid tourism region", () => {
    for (const beach of beaches) {
      expect(REGION_IDS).toContain(beach.region);
    }
  });

  it("covers every tourism region", () => {
    const covered = new Set(beaches.map((beach) => beach.region));
    for (const region of REGION_IDS) {
      expect(covered).toContain(region);
    }
  });

  it("flags surf beaches only with a documenting source", () => {
    const surf = beaches.filter((b) => b.classification.surf);
    expect(surf.length).toBeGreaterThanOrEqual(5);
    for (const beach of surf) {
      expect(beach.source_urls.surf_page).toMatch(/^https:\/\//);
    }
    const flagged = new Set(surf.map((b) => b.id));
    for (const id of ["lawrencetown", "martinique", "pointmichaud"]) {
      expect(flagged).toContain(id);
    }
  });

  it("keeps water buoy assignments optional and well-formed", () => {
    const withWater = beaches.filter((b) => b.water);
    expect(withWater.length).toBeGreaterThanOrEqual(1);
    for (const beach of withWater) {
      expect(beach.water!.buoy_id).toMatch(/^\d{7}$/);
      expect(Math.abs(beach.water!.buoy_latitude - beach.location.latitude)).toBeLessThan(1.5);
    }
  });
});

describe("thresholds", () => {
  it("parses and orders the rating cutoffs", () => {
    const t = loadThresholds(join(configDir, "thresholds.yml"));
    expect(t.ratings.good_min).toBeGreaterThan(t.ratings.ok_min);
    expect(t.ratings.ok_min).toBeGreaterThan(t.ratings.meh_min);
  });
});

describe("manual overrides", () => {
  it("returns nothing for the empty file", () => {
    expect(loadOverrides(join(configDir, "manual-overrides.yml"), new Date())).toEqual([]);
  });

  it("drops expired overrides and keeps active ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "overrides-"));
    const path = join(dir, "overrides.yml");
    writeFileSync(
      path,
      `
- beach_id: test
  type: informational
  title: Active
  message: m
  source: s
  starts_at: 2026-08-01T00:00:00Z
  expires_at: 2026-08-20T00:00:00Z
- beach_id: test
  type: closure
  title: Expired
  message: m
  source: s
  starts_at: 2026-07-01T00:00:00Z
  expires_at: 2026-07-02T00:00:00Z
`,
    );
    const active = loadOverrides(path, new Date("2026-08-08T12:00:00Z"));
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Active");
  });

  it("keeps scheduled overrides that overlap the requested horizon", () => {
    const dir = mkdtempSync(join(tmpdir(), "overrides-"));
    const path = join(dir, "overrides.yml");
    writeFileSync(
      path,
      `
- beach_id: test
  type: closure
  title: Tuesday closure
  message: m
  source: s
  starts_at: 2026-08-11T10:00:00Z
  expires_at: 2026-08-11T20:00:00Z
`,
    );
    const scheduled = loadOverrides(
      path,
      new Date("2026-08-08T12:00:00Z"),
      new Date("2026-08-14T00:00:00Z"),
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe("Tuesday closure");
  });

  it("rejects timestamps without an explicit UTC offset", () => {
    const dir = mkdtempSync(join(tmpdir(), "overrides-"));
    const path = join(dir, "overrides.yml");
    writeFileSync(
      path,
      `
- beach_id: test
  type: closure
  title: Ambiguous
  message: m
  source: s
  starts_at: 2026-08-08T10:00:00
  expires_at: 2026-08-09T20:00:00
`,
    );
    expect(() => loadOverrides(path, new Date("2026-08-08T12:00:00Z"))).toThrow();
  });
});
